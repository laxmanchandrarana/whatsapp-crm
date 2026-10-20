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
        'intent': 'pricing_negotiation',
        'keywords': ['discount', 'cheaper', 'price match', 'enterprise discount', 'quote', 'contract discount', 'deal', 'enterprise quote', 'license'],
        'risk_score': 0.75,
        'suggested_template': "Hi {name}, thank you for your interest in our enterprise tier. I can offer a custom 20% discount on an annual commitment. Let me know if you would like me to prepare the agreement."
    },
    {
        'intent': 'human_handoff',
        'keywords': ['human agent', 'speak to a human', 'speak to a person', 'manager', 'speak to a real person', 'real person', 'live agent', 'human support', 'real person and manager'],
        'risk_score': 0.80,
        'suggested_template': "Hi {name}, I am escalating your conversation to our senior team manager right now."
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
    try:
        msg = Message.objects.select_related('conversation__contact').get(id=message_id)

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


def replace_template_variables(text: str, contact: Contact) -> str:
    if not text:
        return ""
    rendered = str(text)
    rendered = rendered.replace("{{name}}", contact.name or "there")
    rendered = rendered.replace("{{phone}}", contact.phone_number)
    rendered = rendered.replace("{{phone_number}}", contact.phone_number)
    rendered = rendered.replace("{{email}}", contact.email or "")

    attrs = {**(contact.metadata or {}), **(getattr(contact, 'custom_attributes', {}) or {})}
    for k, v in attrs.items():
        rendered = rendered.replace(f"{{{{{k}}}}}", str(v))
        rendered = rendered.replace(f"{{{{custom_attributes.{k}}}}}", str(v))
    return rendered


def process_bot_flow_step(contact: Contact, message_text: str):
    clean_text = (message_text or '').strip().lower()

    session = BotSession.objects.filter(contact=contact, is_completed=False).order_by('-updated_at').first()

    if not session:
        flows = BotFlow.objects.filter(is_active=True)
        matched_flow = None
        for flow in flows:
            if flow.trigger_type == BotFlow.TRIGGER_ALWAYS:
                matched_flow = flow
                break
            elif flow.trigger_type == BotFlow.TRIGGER_KEYWORD:
                for kw in flow.trigger_keywords:
                    if kw.lower() in clean_text:
                        matched_flow = flow
                        break
            elif flow.trigger_type == getattr(BotFlow, 'TRIGGER_REGEX', 'REGEX'):
                for pattern in flow.trigger_keywords:
                    try:
                        if re.search(pattern, message_text, re.IGNORECASE):
                            matched_flow = flow
                            break
                    except re.error:
                        pass
            elif flow.trigger_type == BotFlow.TRIGGER_NEW_CHAT:
                msg_count = Message.objects.filter(conversation__contact=contact).count()
                if msg_count <= 1:
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
    client = WhatsAppCloudAPIClient()

    node_type = str(current_node.get('type', 'message')).lower()
    response_text = ""
    next_node_id = None
    interactive_type = None
    interactive_payload = None

    if node_type in ['message', 'send_message']:
        response_text = replace_template_variables(current_node.get('content', ''), contact)
        for edge in flow.edges:
            if edge.get('source') == current_node['id']:
                next_node_id = edge.get('target')
                break
        if not next_node_id:
            next_node_id = current_node.get('target_node_id')

    elif node_type in ['menu', 'interactive_buttons']:
        options = current_node.get('buttons') or current_node.get('options', [])
        matched_option = None
        for opt in options:
            val = str(opt.get('value') or opt.get('id') or '').lower()
            label = str(opt.get('label') or opt.get('title') or '').lower()
            if (val and val in clean_text) or (label and label in clean_text):
                matched_option = opt
                break

        if matched_option:
            next_node_id = matched_option.get('target_node_id')
            next_node = nodes_map.get(next_node_id)
            if next_node:
                response_text = replace_template_variables(next_node.get('content', f"You selected {matched_option.get('label') or matched_option.get('title')}"), contact)
        else:
            prompt = replace_template_variables(current_node.get('content') or current_node.get('body', 'Please choose an option:'), contact)
            if node_type == 'interactive_buttons' or current_node.get('buttons'):
                interactive_type = 'button'
                interactive_payload = options
                response_text = prompt
            else:
                labels = "\n".join([f"• {opt.get('label') or opt.get('title')}" for opt in options])
                response_text = f"{prompt}\n\n{labels}"
            next_node_id = current_node['id']

    elif node_type == 'interactive_list':
        sections = current_node.get('sections', [])
        rows = []
        for s in sections:
            rows.extend(s.get('rows', []))
        if not rows and current_node.get('rows'):
            rows = current_node.get('rows', [])

        matched_row = None
        for r in rows:
            r_id = str(r.get('id', '')).lower()
            r_title = str(r.get('title', '')).lower()
            if (r_id and r_id in clean_text) or (r_title and r_title in clean_text):
                matched_row = r
                break

        if matched_row:
            next_node_id = matched_row.get('target_node_id')
            next_node = nodes_map.get(next_node_id)
            if next_node:
                response_text = replace_template_variables(next_node.get('content', f"You selected {matched_row.get('title')}"), contact)
        else:
            interactive_type = 'list'
            interactive_payload = sections or [{'title': 'Options', 'rows': rows}]
            response_text = replace_template_variables(current_node.get('content') or current_node.get('body', 'Please choose from the menu:'), contact)
            next_node_id = current_node['id']

    elif node_type == 'user_input':
        val_type = current_node.get('validation_type', 'text').lower()
        is_valid = True
        if val_type == 'email':
            is_valid = bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', clean_text))
        elif val_type == 'phone':
            is_valid = bool(re.match(r'^\+?[0-9\s\-]{7,20}$', clean_text))
        elif val_type == 'number':
            try:
                float(clean_text.replace(',', ''))
                is_valid = True
            except ValueError:
                is_valid = False
        elif val_type == 'text':
            is_valid = bool(clean_text)

        if not is_valid:
            response_text = current_node.get('validation_error', f"Please enter a valid {val_type}.")
            next_node_id = current_node['id']
        else:
            attr_key = current_node.get('attribute_name') or current_node.get('save_to_attribute') or 'input_value'
            if not contact.custom_attributes:
                contact.custom_attributes = {}
            contact.custom_attributes[attr_key] = message_text.strip()
            if not contact.metadata:
                contact.metadata = {}
            contact.metadata[attr_key] = message_text.strip()
            contact.save(update_fields=['custom_attributes', 'metadata'])

            for edge in flow.edges:
                if edge.get('source') == current_node['id']:
                    next_node_id = edge.get('target')
                    break
            if not next_node_id:
                next_node_id = current_node.get('target_node_id')

            next_node = nodes_map.get(next_node_id)
            if next_node:
                response_text = replace_template_variables(next_node.get('content', f"Received your {attr_key}: {message_text.strip()}"), contact)

    elif node_type == 'condition':
        field = current_node.get('field', 'text').lower()
        op = current_node.get('operator', 'equals').lower()
        compare_val = str(current_node.get('value', '')).strip().lower()

        if field in ['text', 'message', 'message_text']:
            actual_val = clean_text
        else:
            attrs = {**(contact.metadata or {}), **(getattr(contact, 'custom_attributes', {}) or {})}
            actual_val = str(attrs.get(field, getattr(contact, field, ''))).strip().lower()

        cond_result = False
        if op == 'equals':
            cond_result = (actual_val == compare_val)
        elif op == 'not_equals':
            cond_result = (actual_val != compare_val)
        elif op == 'contains':
            cond_result = (compare_val in actual_val)
        elif op == 'starts_with':
            cond_result = actual_val.startswith(compare_val)
        elif op == 'greater_than':
            try:
                cond_result = float(actual_val) > float(compare_val)
            except (ValueError, TypeError):
                cond_result = False
        elif op == 'less_than':
            try:
                cond_result = float(actual_val) < float(compare_val)
            except (ValueError, TypeError):
                cond_result = False
        elif op == 'is_set':
            cond_result = bool(actual_val)

        if cond_result:
            next_node_id = current_node.get('target_node_id_yes') or current_node.get('branch_a_target')
            if not next_node_id:
                for e in flow.edges:
                    if e.get('source') == current_node['id'] and str(e.get('label', '')).lower() in ['yes', 'true', 'branch a']:
                        next_node_id = e.get('target')
                        break
        else:
            next_node_id = current_node.get('target_node_id_no') or current_node.get('branch_b_target')
            if not next_node_id:
                for e in flow.edges:
                    if e.get('source') == current_node['id'] and str(e.get('label', '')).lower() in ['no', 'false', 'branch b']:
                        next_node_id = e.get('target')
                        break

        next_node = nodes_map.get(next_node_id)
        if next_node:
            response_text = replace_template_variables(next_node.get('content', ''), contact)

    elif node_type == 'webhook_action':
        url = current_node.get('url', '')
        logger.info(f"Triggering webhook action {current_node.get('id')} -> {url}")
        for edge in flow.edges:
            if edge.get('source') == current_node['id']:
                next_node_id = edge.get('target')
                break
        if not next_node_id:
            next_node_id = current_node.get('target_node_id')
        next_node = nodes_map.get(next_node_id)
        if next_node:
            response_text = replace_template_variables(next_node.get('content', ''), contact)

    elif node_type == 'delay':
        for edge in flow.edges:
            if edge.get('source') == current_node['id']:
                next_node_id = edge.get('target')
                break
        if not next_node_id:
            next_node_id = current_node.get('target_node_id')
        next_node = nodes_map.get(next_node_id)
        if next_node:
            response_text = replace_template_variables(next_node.get('content', ''), contact)

    elif node_type == 'handoff':
        response_text = replace_template_variables(current_node.get('content', "Connecting you to a human agent right now. Please hold on."), contact)
        conv.status = current_node.get('escalate_status', Conversation.STATUS_OPEN)
        conv.save(update_fields=['status'])
        session.is_completed = True
        session.save(update_fields=['is_completed'])
        next_node_id = None

    if response_text:
        meta_id = None
        msg_type = Message.TYPE_TEXT
        if interactive_type == 'button':
            res = client.send_interactive_buttons(recipient_phone=contact.phone_number, body_text=response_text, buttons=interactive_payload or [])
            msg_type = Message.TYPE_INTERACTIVE
        elif interactive_type == 'list':
            res = client.send_interactive_list(recipient_phone=contact.phone_number, body_text=response_text, button_text=current_node.get('button_text', 'View Menu'), sections=interactive_payload or [])
            msg_type = Message.TYPE_INTERACTIVE
        else:
            res = client.send_text_message(recipient_phone=contact.phone_number, text_body=response_text)

        if 'messages' in res and len(res['messages']) > 0:
            meta_id = res['messages'][0].get('id')

        Message.objects.create(
            conversation=conv,
            direction=Message.DIR_OUTBOUND,
            message_type=msg_type,
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
    try:
        msg = Message.objects.select_related('conversation__contact').get(id=inbound_message_id)
        if msg.direction != Message.DIR_INBOUND:
            return

        contact = msg.conversation.contact
        contact_name = contact.name or contact.phone_number

        if process_bot_flow_step(contact, msg.content):
            logger.info(f"Inbound message #{inbound_message_id} handled by active BotStudio flow.")
            return

        ai_config = AIAgentConfig.objects.filter(is_active=True).first()
        risk_threshold = ai_config.risk_threshold if ai_config else 0.50
        model_name = ai_config.model_name if ai_config else 'gemini-2.5-pro'

        intent, risk_score, suggested_tpl = analyze_intent_and_risk(msg.content)
        suggested_text = suggested_tpl.format(name=contact_name)

        logger.info(f"AI Evaluation for msg #{inbound_message_id}: intent='{intent}', risk={risk_score:.2f}, threshold={risk_threshold}")

        if risk_score >= risk_threshold:
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
    try:
        entries = payload.get('entry', [])
        for entry in entries:
            for change in entry.get('changes', []):
                value = change.get('value', {})

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
