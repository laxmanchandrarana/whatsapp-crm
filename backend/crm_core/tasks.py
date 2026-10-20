import re
import time
import logging
from celery import shared_task
from django.utils import timezone
from .models import (
    Contact,
    Conversation,
    Message,
    ApprovalQueue,
    MessageTemplate,
    AIAgentConfig,
    BroadcastCampaign,
    CampaignRecipient,
    BotFlow,
    BotSession
)
from .whatsapp_client import WhatsAppCloudAPIClient

logger = logging.getLogger(__name__)

INTENT_RULES = [
    {
        'intent': 'refund_request',
        'keywords': ['refund', 'money back', 'charged twice', 'double charged', 'billing dispute', 'fraudulent charge', 'chargeback'],
        'risk_score': 0.95,
        'suggested_template': "Hello {name}, I have reviewed your billing inquiry regarding the recent charge. I am processing your refund request right away and will provide the transaction confirmation within 24 hours. A billing supervisor will oversee this request."
    },
    {
        'intent': 'cancellation',
        'keywords': ['cancel', 'unsubscribe', 'terminate', 'close my account', 'stop billing'],
        'risk_score': 0.88,
        'suggested_template': "Hi {name}, we are sorry to see you go. I can help you process your account cancellation. Before proceeding, would you like to pause your subscription or speak with a senior specialist?"
    },
    {
        'intent': 'human_handoff',
        'keywords': ['human', 'person', 'manager', 'speak to a real person', 'real person', 'live agent'],
        'risk_score': 0.80,
        'suggested_template': "Hi {name}, I am escalating your conversation to our senior team manager right now."
    },
    {
        'intent': 'pricing_negotiation',
        'keywords': ['discount', 'cheaper', 'price match', 'enterprise discount', 'quote', 'contract discount', 'deal', 'enterprise quote'],
        'risk_score': 0.75,
        'suggested_template': "Hi {name}, thank you for your interest in our enterprise tier. I can offer a custom 20% discount on an annual commitment. Let me know if you would like me to prepare the agreement."
    },
    {
        'intent': 'support_hours_inquiry',
        'keywords': ['operating hours', 'hours', 'when are you open', 'business hours', 'support time', 'office hours'],
        'risk_score': 0.10,
        'suggested_template': "Hi {name}! Our team is available Monday through Friday from 9:00 AM to 6:00 PM EST. Let us know how we can assist you today!"
    },
    {
        'intent': 'general_greeting',
        'keywords': ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'help'],
        'risk_score': 0.05,
        'suggested_template': "Hello {name}! Thanks for reaching out to DoubleTick WhatsApp Support. How can we help you today?"
    }
]

def analyze_intent_and_risk(text: str):
    clean = text.lower()
    for rule in INTENT_RULES:
        for kw in rule['keywords']:
            if re.search(r'\b' + re.escape(kw) + r'\b', clean):
                return rule['intent'], rule['risk_score'], rule['suggested_template']
    return 'general_inquiry', 0.20, "Hi {name}, thanks for reaching out. We have received your message and an agent will reply shortly."


@shared_task
def dispatch_outbound_meta_message(message_id: int):
    """
    Strict Gatekeeper:
    Sends outbound message via Meta Cloud API only if status is approved/safe.
    Blocks any draft, pending approval, or rejected message.
    """
    try:
        msg = Message.objects.select_related('conversation__contact').get(id=message_id)

        # Gatekeeper checks
        if msg.direction != Message.DIR_OUTBOUND:
            return {'status': 'skipped', 'reason': 'Not outbound message'}

        if msg.status in [Message.STATUS_PENDING_APPROVAL, Message.STATUS_DRAFT, Message.STATUS_REJECTED]:
            logger.warning(f"Gatekeeper BLOCKED message #{msg.id} in status {msg.status}")
            return {'status': 'blocked', 'reason': f"Message #{msg.id} in status {msg.status} is blocked"}

        client = WhatsAppCloudAPIClient()
        recipient_phone = msg.conversation.contact.phone_number

        if msg.message_type == Message.TYPE_TEMPLATE:
            raw_payload = msg.raw_payload or {}
            template_name = raw_payload.get('template_name', '')
            language = raw_payload.get('template_language', 'en_US')
            components = raw_payload.get('components', [])
            res = client.send_template_message(recipient_phone, template_name, language, components)
        else:
            res = client.send_text_message(recipient_phone=recipient_phone, text_body=msg.content)

        meta_id = None
        if 'messages' in res and len(res['messages']) > 0:
            meta_id = res['messages'][0].get('id')

        msg.status = Message.STATUS_SENT
        msg.meta_message_id = meta_id
        msg.raw_payload = res
        msg.save()

        # Update conversation timestamp & first response time calculation
        conv = msg.conversation
        if not conv.first_response_time_seconds:
            elapsed = (timezone.now() - conv.created_at).total_seconds()
            conv.first_response_time_seconds = max(1.0, elapsed)
        conv.last_message_at = timezone.now()
        conv.save(update_fields=['last_message_at', 'first_response_time_seconds'])

        logger.info(f"Dispatched message #{msg.id} to {recipient_phone} with meta_id: {meta_id}")
        return {'status': 'sent', 'meta_id': meta_id, 'meta_message_id': meta_id}

    except Exception as e:
        logger.exception(f"Failed to dispatch outbound message #{message_id}: {e}")
        try:
            msg = Message.objects.get(id=message_id)
            msg.status = Message.STATUS_FAILED
            msg.error_message = str(e)
            msg.save(update_fields=['status', 'error_message'])
        except Exception:
            pass
        return {'status': 'failed', 'error': str(e)}


@shared_task
def execute_broadcast_campaign(campaign_id: int):
    """
    Rate-limited batch dispatching for BroadcastCampaign.
    """
    try:
        campaign = BroadcastCampaign.objects.select_related('template').get(id=campaign_id)
        campaign.status = BroadcastCampaign.STATUS_RUNNING
        campaign.save(update_fields=['status'])

        client = WhatsAppCloudAPIClient()
        recipients = CampaignRecipient.objects.filter(campaign=campaign, status=CampaignRecipient.STATUS_PENDING)

        logger.info(f"Starting broadcast campaign '{campaign.name}' with {recipients.count()} pending recipients.")

        batch_counter = 0
        for item in recipients:
            contact = item.contact
            template = campaign.template

            components = template.components or []
            populated_components = []
            for comp in components:
                c_copy = dict(comp)
                if comp.get('type') == 'BODY':
                    body_text = comp.get('text', '')
                    body_text = body_text.replace('{{1}}', contact.name or 'Customer')
                    body_text = body_text.replace('{{2}}', contact.phone_number)
                    c_copy['text'] = body_text
                populated_components.append(c_copy)

            try:
                res = client.send_template_message(
                    recipient_phone=contact.phone_number,
                    template_name=template.name,
                    language_code=template.language,
                    components=populated_components
                )
                meta_id = None
                if 'messages' in res and len(res['messages']) > 0:
                    meta_id = res['messages'][0].get('id')

                item.status = CampaignRecipient.STATUS_SENT
                item.meta_message_id = meta_id
                item.sent_at = timezone.now()
                item.save(update_fields=['status', 'meta_message_id', 'sent_at'])

                campaign.sent_count += 1

                conv, _ = Conversation.objects.get_or_create(
                    contact=contact,
                    defaults={'status': Conversation.STATUS_OPEN}
                )
                Message.objects.create(
                    conversation=conv,
                    direction=Message.DIR_OUTBOUND,
                    message_type=Message.TYPE_TEMPLATE,
                    content=f"[Broadcast: {campaign.name}] {template.name}",
                    status=Message.STATUS_SENT,
                    meta_message_id=meta_id,
                    raw_payload=res
                )

            except Exception as ex:
                logger.error(f"Failed to send broadcast item to {contact.phone_number}: {ex}")
                item.status = CampaignRecipient.STATUS_FAILED
                item.error_message = str(ex)
                item.save(update_fields=['status', 'error_message'])
                campaign.failed_count += 1

            batch_counter += 1
            if batch_counter % 25 == 0:
                campaign.save(update_fields=['sent_count', 'failed_count'])
                time.sleep(0.5)

        campaign.status = BroadcastCampaign.STATUS_COMPLETED
        campaign.save(update_fields=['status', 'sent_count', 'failed_count'])
        logger.info(f"Broadcast campaign '{campaign.name}' completed. Sent: {campaign.sent_count}, Failed: {campaign.failed_count}")

    except Exception as e:
        logger.exception(f"Error executing broadcast campaign #{campaign_id}: {e}")
        try:
            c = BroadcastCampaign.objects.get(id=campaign_id)
            c.status = BroadcastCampaign.STATUS_PAUSED
            c.save(update_fields=['status'])
        except Exception:
            pass


def process_bot_flow_step(contact: Contact, message_text: str):
    clean_text = message_text.strip().lower()

    session = BotSession.objects.filter(contact=contact, is_completed=False).order_by('-updated_at').first()

    if not session:
        flows = BotFlow.objects.filter(is_active=True)
        matched_flow = None
        for flow in flows:
            if flow.trigger_type == BotFlow.TRIGGER_ALWAYS:
                matched_flow = flow
                break
            if flow.trigger_type == BotFlow.TRIGGER_KEYWORD:
                for kw in flow.trigger_keywords:
                    if kw.lower() in clean_text:
                        matched_flow = flow
                        break
            if matched_flow:
                break

        if not matched_flow:
            return False

        start_node_id = 'start'
        if matched_flow.nodes:
            start_node_id = matched_flow.nodes[0].get('id', 'start')

        session = BotSession.objects.create(
            contact=contact,
            flow=matched_flow,
            current_node_id=start_node_id,
            context_data={}
        )

    flow = session.flow
    nodes_map = {n['id']: n for n in flow.nodes}
    current_node = nodes_map.get(session.current_node_id)

    if not current_node:
        session.is_completed = True
        session.save(update_fields=['is_completed'])
        return False

    conv, _ = Conversation.objects.get_or_create(contact=contact, defaults={'status': Conversation.STATUS_OPEN})

    node_type = current_node.get('type', 'message')
    response_text = ""
    next_node_id = None

    if node_type == 'message':
        response_text = current_node.get('content', '')
        for edge in flow.edges:
            if edge.get('source') == current_node['id']:
                next_node_id = edge.get('target')
                break

    elif node_type == 'menu':
        options = current_node.get('options', [])
        matched_option = None
        for opt in options:
            if opt.get('value', '').lower() in clean_text or opt.get('label', '').lower() in clean_text:
                matched_option = opt
                break

        if matched_option:
            next_node_id = matched_option.get('target_node_id')
            next_node = nodes_map.get(next_node_id)
            if next_node:
                response_text = next_node.get('content', f"You selected {matched_option.get('label')}")
        else:
            labels = "\n".join([f"• {opt.get('label')}" for opt in options])
            response_text = f"{current_node.get('content', 'Please choose an option:')}\n\n{labels}"
            next_node_id = current_node['id']

    elif node_type == 'handoff':
        response_text = current_node.get('content', "Connecting you to a human agent right now. Please hold on.")
        conv.status = Conversation.STATUS_OPEN
        conv.save(update_fields=['status'])
        session.is_completed = True
        session.save(update_fields=['is_completed'])
        next_node_id = None

    if response_text:
        client = WhatsAppCloudAPIClient()
        res = client.send_text_message(recipient_phone=contact.phone_number, text_body=response_text)
        meta_id = None
        if 'messages' in res and len(res['messages']) > 0:
            meta_id = res['messages'][0].get('id')

        Message.objects.create(
            conversation=conv,
            direction=Message.DIR_OUTBOUND,
            message_type=Message.TYPE_TEXT,
            content=f"[Bot Flow: {flow.name}] {response_text}",
            status=Message.STATUS_SENT,
            meta_message_id=meta_id,
            raw_payload=res
        )

    if next_node_id and next_node_id in nodes_map:
        session.current_node_id = next_node_id
        session.save(update_fields=['current_node_id'])
    else:
        session.is_completed = True
        session.save(update_fields=['is_completed'])

    return True


@shared_task
def evaluate_ai_response_and_approval(inbound_message_id: int):
    """
    Evaluates inbound customer message with OpenMausBot Copilot AI rules:
    - If risk score >= risk_threshold: holds draft in ApprovalQueue with PENDING_APPROVAL.
    - If risk score < risk_threshold: dispatches auto-reply directly.
    """
    try:
        msg = Message.objects.select_related('conversation__contact').get(id=inbound_message_id)
        if msg.direction != Message.DIR_INBOUND:
            return

        contact = msg.conversation.contact
        contact_name = contact.name or contact.phone_number

        # 1. First test if message can be handled by BotStudio flow
        if process_bot_flow_step(contact, msg.content):
            logger.info(f"Inbound message #{inbound_message_id} handled by active BotStudio flow.")
            return

        # 2. Retrieve AI Agent configuration
        ai_config = AIAgentConfig.objects.filter(is_active=True).first()
        risk_threshold = ai_config.risk_threshold if ai_config else 0.50
        model_name = ai_config.model_name if ai_config else 'gemini-2.5-pro'

        intent, risk_score, suggested_tpl = analyze_intent_and_risk(msg.content)
        suggested_text = suggested_tpl.format(name=contact_name)

        logger.info(f"AI Evaluation for msg #{inbound_message_id}: intent='{intent}', risk={risk_score:.2f}, threshold={risk_threshold}")

        if risk_score >= risk_threshold:
            # Sensitive: Hold in ApprovalQueue
            draft_msg = Message.objects.create(
                conversation=msg.conversation,
                direction=Message.DIR_OUTBOUND,
                message_type=Message.TYPE_TEXT,
                content=suggested_text,
                status=Message.STATUS_PENDING_APPROVAL,
                raw_payload={'intent': intent, 'risk_score': risk_score, 'ai_model': model_name}
            )

            ApprovalQueue.objects.create(
                message=draft_msg,
                intent=intent,
                risk_score=risk_score,
                suggested_response=suggested_text,
                ai_model=model_name,
                prompt_context=f"Inbound message from {contact_name}: '{msg.content}'"
            )

            conv = msg.conversation
            conv.status = Conversation.STATUS_PENDING_APPROVAL
            conv.save(update_fields=['status'])
            logger.info(f"Enqueued msg #{draft_msg.id} into ApprovalQueue with risk {risk_score:.2f}")

        else:
            # Safe / Low-risk: auto-reply
            client = WhatsAppCloudAPIClient()
            res = client.send_text_message(recipient_phone=contact.phone_number, text_body=suggested_text)
            meta_id = None
            if 'messages' in res and len(res['messages']) > 0:
                meta_id = res['messages'][0].get('id')

            outbound_msg = Message.objects.create(
                conversation=msg.conversation,
                direction=Message.DIR_OUTBOUND,
                message_type=Message.TYPE_TEXT,
                content=suggested_text,
                status=Message.STATUS_SENT,
                meta_message_id=meta_id,
                raw_payload={'auto_replied': True, 'api_response': res}
            )

    except Exception as e:
        logger.exception(f"Error in evaluate_ai_response_and_approval for msg #{inbound_message_id}: {e}")


@shared_task
def process_webhook_payload(payload: dict):
    """
    Parses Meta WhatsApp Webhook payload.
    """
    try:
        entries = payload.get('entry', [])
        for entry in entries:
            for change in entry.get('changes', []):
                value = change.get('value', {})

                # 1. Status receipts
                statuses = value.get('statuses', [])
                for st in statuses:
                    meta_id = st.get('id')
                    status_str = st.get('status', '').upper()
                    if meta_id and status_str in dict(Message.STATUS_CHOICES):
                        Message.objects.filter(meta_message_id=meta_id).update(status=status_str)
                        recipients = CampaignRecipient.objects.filter(meta_message_id=meta_id)
                        for r in recipients:
                            r.status = status_str
                            r.save(update_fields=['status'])
                            if status_str == 'DELIVERED':
                                r.campaign.delivered_count += 1
                                r.campaign.save(update_fields=['delivered_count'])
                            elif status_str == 'READ':
                                r.campaign.read_count += 1
                                r.campaign.save(update_fields=['read_count'])

                # 2. Inbound messages
                messages = value.get('messages', [])
                contacts_meta = value.get('contacts', [])
                name_map = {}
                for c in contacts_meta:
                    wa_id = c.get('wa_id')
                    profile_name = c.get('profile', {}).get('name', '')
                    if wa_id:
                        name_map[wa_id] = profile_name

                for m in messages:
                    sender_phone = m.get('from', '')
                    sender_name = name_map.get(sender_phone, '')
                    msg_id = m.get('id')
                    raw_type = m.get('type', 'text').lower()

                    content = ""
                    msg_type = Message.TYPE_TEXT
                    if raw_type == 'text':
                        content = m.get('text', {}).get('body', '')
                    elif raw_type == 'interactive':
                        msg_type = Message.TYPE_INTERACTIVE
                        interactive = m.get('interactive', {})
                        content = interactive.get('button_reply', {}).get('title') or interactive.get('list_reply', {}).get('title', '')
                    elif raw_type == 'image':
                        msg_type = Message.TYPE_IMAGE
                        content = m.get('image', {}).get('caption') or '[IMAGE Media Message]'
                    elif raw_type in ['document', 'audio', 'video']:
                        msg_type = raw_type.upper()
                        content = f"[{raw_type.upper()} Media Message]"
                    else:
                        content = f"[{raw_type.upper()} Message]"

                    if Message.objects.filter(meta_message_id=msg_id).exists():
                        continue

                    contact, _ = Contact.objects.get_or_create(
                        phone_number=sender_phone,
                        defaults={'name': sender_name}
                    )
                    if not contact.name and sender_name:
                        contact.name = sender_name
                        contact.save(update_fields=['name'])

                    conv, _ = Conversation.objects.get_or_create(
                        contact=contact,
                        defaults={'status': Conversation.STATUS_OPEN}
                    )
                    conv.unread_count += 1
                    conv.last_message_at = timezone.now()
                    conv.save(update_fields=['unread_count', 'last_message_at'])

                    inbound_msg = Message.objects.create(
                        conversation=conv,
                        direction=Message.DIR_INBOUND,
                        message_type=msg_type,
                        content=content,
                        status=Message.STATUS_DELIVERED,
                        meta_message_id=msg_id,
                        raw_payload=m
                    )

                    evaluate_ai_response_and_approval.delay(inbound_msg.id)

    except Exception as e:
        logger.exception(f"Error processing webhook payload: {e}")
