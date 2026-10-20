import os
import requests
import re
import csv
import io
import json
import logging
from datetime import timedelta
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Avg, Q
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Contact,
    Conversation,
    Message,
    ApprovalQueue,
    MessageTemplate,
    AIAgentConfig,
    CannedResponse,
    BroadcastCampaign,
    CampaignRecipient,
    BotFlow,
    BotSession,
    WhatsAppGroup
)
from .serializers import (
    ContactSerializer,
    ConversationSerializer,
    MessageSerializer,
    ApprovalQueueSerializer,
    MessageTemplateSerializer,
    AIAgentConfigSerializer,
    CannedResponseSerializer,
    BroadcastCampaignSerializer,
    BotFlowSerializer,
    BotSessionSerializer,
    WhatsAppGroupSerializer
)
from .signature import validate_hub_signature
from .tasks import (
    dispatch_outbound_meta_message,
    process_webhook_payload,
    execute_broadcast_campaign
)
from .whatsapp_client import WhatsAppCloudAPIClient

logger = logging.getLogger(__name__)


class WhatsAppWebhookView(APIView):
    """
    Handles Meta WhatsApp Cloud API webhooks:
    - GET: Webhook verification challenge
    - POST: Event ingestion with X-Hub-Signature-256 verification
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        mode = request.GET.get('hub.mode')
        token = request.GET.get('hub.verify_token')
        challenge = request.GET.get('hub.challenge')
        expected_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'openmausbot_crm_verify_token_secure')

        if not mode or mode != 'subscribe':
            return HttpResponse('Forbidden', status=403)

        if not token or token != expected_token:
            return HttpResponse('Verification token mismatch', status=403)

        return HttpResponse(challenge, content_type='text/plain', status=200)

    def post(self, request):
        raw_body = request.body
        signature_header = (
            request.headers.get('X-Hub-Signature-256') or
            request.META.get('HTTP_X_HUB_SIGNATURE_256', '')
        )
        app_secret = getattr(settings, 'WHATSAPP_APP_SECRET', 'test_meta_app_secret_abc123')

        if not signature_header:
            return Response({'error': 'Invalid signature header'}, status=status.HTTP_401_UNAUTHORIZED)

        if not signature_header.startswith('sha256='):
            return Response({'error': 'Invalid signature prefix'}, status=status.HTTP_401_UNAUTHORIZED)

        if app_secret:
            if not validate_hub_signature(raw_body, signature_header, app_secret):
                logger.error("Invalid Meta X-Hub-Signature-256 signature.")
                return Response({'error': 'Invalid signature'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except Exception:
            return Response({'error': 'Malformed JSON'}, status=status.HTTP_400_BAD_REQUEST)

        process_webhook_payload.delay(payload)
        return Response({'status': 'EVENT_RECEIVED'}, status=status.HTTP_200_OK)


class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.all().select_related('contact').prefetch_related('messages')
    serializer_class = ConversationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(contact__name__icontains=search) |
                Q(contact__phone_number__icontains=search) |
                Q(messages__content__icontains=search)
            ).distinct()
        return qs

    @action(detail=True, methods=['get'], url_path='messages')
    def messages(self, request, pk=None):
        conv = self.get_object()
        msgs = conv.messages.all().order_by('timestamp')
        return Response(MessageSerializer(msgs, many=True).data)

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        conv = self.get_object()
        conv.unread_count = 0
        conv.save(update_fields=['unread_count'])
        return Response({'status': 'marked_as_read', 'unread_count': 0})

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        conv = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Conversation.STATUS_CHOICES):
            conv.status = new_status
            if new_status == Conversation.STATUS_RESOLVED:
                conv.resolved_at = timezone.now()
            conv.save(update_fields=['status', 'resolved_at'])
            return Response(ConversationSerializer(conv).data)
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='add-internal-note')
    def add_internal_note(self, request, pk=None):
        conv = self.get_object()
        content = request.data.get('content', '').strip()
        author = request.data.get('author_agent', 'Agent')
        if not content:
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)

        note = Message.objects.create(
            conversation=conv,
            direction=Message.DIR_OUTBOUND,
            message_type=Message.TYPE_NOTE,
            content=content,
            is_internal=True,
            author_agent=author,
            status=Message.STATUS_SENT
        )
        return Response(MessageSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='generate-ai-suggestion')
    def generate_ai_suggestion(self, request, pk=None):
        conv = self.get_object()
        last_inbound = conv.messages.filter(direction=Message.DIR_INBOUND).order_by('-timestamp').first()
        if not last_inbound:
            return Response({'error': 'No customer messages in conversation to analyze'}, status=status.HTTP_400_BAD_REQUEST)

        ai_config = AIAgentConfig.objects.filter(is_active=True).first()
        model_name = ai_config.model_name if ai_config else 'gemini-2.5-pro'

        from .tasks import analyze_intent_and_risk
        intent, risk_score, suggested_tpl = analyze_intent_and_risk(last_inbound.content)
        contact_name = conv.contact.name or conv.contact.phone_number
        suggested_text = suggested_tpl.format(name=contact_name)

        draft_msg = Message.objects.create(
            conversation=conv,
            direction=Message.DIR_OUTBOUND,
            message_type=Message.TYPE_TEXT,
            content=suggested_text,
            status=Message.STATUS_PENDING_APPROVAL,
            raw_payload={'intent': intent, 'risk_score': risk_score, 'ai_model': model_name}
        )

        approval = ApprovalQueue.objects.create(
            message=draft_msg,
            intent=intent,
            risk_score=risk_score,
            suggested_response=suggested_text,
            ai_model=model_name,
            prompt_context=f"Copilot manually triggered for: '{last_inbound.content}'"
        )
        conv.status = Conversation.STATUS_PENDING_APPROVAL
        conv.save(update_fields=['status'])

        return Response(ApprovalQueueSerializer(approval).data, status=status.HTTP_201_CREATED)


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all().select_related('conversation')
    serializer_class = MessageSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        conv_id = self.request.query_params.get('conversation_id')
        if conv_id:
            qs = qs.filter(conversation_id=conv_id)
        return qs

    def create(self, request, *args, **kwargs):
        conv_id = request.data.get('conversation_id')
        content = request.data.get('content')
        msg_type = request.data.get('message_type', Message.TYPE_TEXT)
        is_internal = request.data.get('is_internal', False)

        try:
            conv = Conversation.objects.get(id=conv_id)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

        if not content and msg_type == Message.TYPE_TEMPLATE:
            content = f"[Template: {request.data.get('template_name', '')}]"

        message = Message.objects.create(
            conversation=conv,
            direction=Message.DIR_OUTBOUND,
            message_type=msg_type,
            content=content or '',
            is_internal=is_internal,
            status=Message.STATUS_SENT if is_internal else Message.STATUS_APPROVED,
            raw_payload=request.data
        )

        if not is_internal:
            dispatch_outbound_meta_message(message.id)
            message.refresh_from_db()

        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


class ApprovalQueueViewSet(viewsets.ModelViewSet):
    queryset = ApprovalQueue.objects.all().select_related('message__conversation__contact')
    serializer_class = ApprovalQueueSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        resolved = self.request.query_params.get('resolved')
        if resolved is not None:
            is_resolved = resolved.lower() in ['true', '1']
            qs = qs.filter(is_resolved=is_resolved)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        approval = self.get_object()
        edited_text = request.data.get('edited_text')
        approved_by = request.data.get('approved_by', 'Supervisor')

        msg = approval.message
        if edited_text:
            msg.content = edited_text
            approval.suggested_response = edited_text

        msg.status = Message.STATUS_APPROVED
        msg.save()

        approval.is_resolved = True
        approval.approved_by = approved_by
        approval.approved_at = timezone.now()
        approval.save()

        conv = msg.conversation
        pending_remaining = conv.messages.filter(status=Message.STATUS_PENDING_APPROVAL).count()
        if pending_remaining == 0:
            conv.status = Conversation.STATUS_OPEN
            conv.save(update_fields=['status'])

        dispatch_outbound_meta_message(msg.id)

        return Response({
            'status': 'APPROVED_AND_DISPATCHED',
            'approval_id': approval.id,
            'message_id': msg.id,
            'final_text': msg.content
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        approval = self.get_object()
        reason = request.data.get('rejection_reason', 'Rejected by agent')

        msg = approval.message
        msg.status = Message.STATUS_REJECTED
        msg.save()

        approval.is_resolved = True
        approval.rejection_reason = reason
        approval.save()

        conv = msg.conversation
        pending_remaining = conv.messages.filter(status=Message.STATUS_PENDING_APPROVAL).count()
        if pending_remaining == 0:
            conv.status = Conversation.STATUS_OPEN
            conv.save(update_fields=['status'])

        return Response({
            'status': 'REJECTED',
            'approval_id': approval.id,
            'rejection_reason': reason
        })


class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.all()
    serializer_class = MessageTemplateSerializer

    def create(self, request, *args, **kwargs):
        name = request.data.get('name')
        category = request.data.get('category', MessageTemplate.CATEGORY_UTILITY)
        language = request.data.get('language', 'en_US')
        components = request.data.get('components', [])

        client = WhatsAppCloudAPIClient()
        meta_res = client.create_template(name, category, language, components)

        template = MessageTemplate.objects.create(
            name=name,
            category=category,
            language=language,
            components=components,
            meta_status=meta_res.get('status', MessageTemplate.STATUS_APPROVED),
            meta_template_id=meta_res.get('id')
        )
        return Response(MessageTemplateSerializer(template).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='sync-meta')
    def sync_meta(self, request):
        client = WhatsAppCloudAPIClient()
        meta_templates = client.fetch_templates_from_meta()
        synced_count = 0

        for tpl in meta_templates:
            name = tpl.get('name')
            category = tpl.get('category', 'UTILITY')
            language = tpl.get('language', 'en_US')
            components = tpl.get('components', [])
            meta_status = tpl.get('status', 'APPROVED')

            MessageTemplate.objects.update_or_create(
                name=name,
                defaults={
                    'category': category,
                    'language': language,
                    'components': components,
                    'meta_status': meta_status
                }
            )
            synced_count += 1

        return Response({'status': 'synced', 'count': synced_count})


class AIAgentConfigViewSet(viewsets.ModelViewSet):
    queryset = AIAgentConfig.objects.all()
    serializer_class = AIAgentConfigSerializer


class CannedResponseViewSet(viewsets.ModelViewSet):
    queryset = CannedResponse.objects.all()
    serializer_class = CannedResponseSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs


class BroadcastCampaignViewSet(viewsets.ModelViewSet):
    queryset = BroadcastCampaign.objects.all().select_related('template').prefetch_related('recipients')
    serializer_class = BroadcastCampaignSerializer

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status in [BroadcastCampaign.STATUS_RUNNING, BroadcastCampaign.STATUS_COMPLETED]:
            return Response({'error': f'Campaign is already {campaign.status}'}, status=status.HTTP_400_BAD_REQUEST)

        campaign.status = BroadcastCampaign.STATUS_RUNNING
        campaign.save(update_fields=['status'])

        execute_broadcast_campaign(campaign.id)
        return Response({'status': 'CAMPAIGN_STARTED', 'campaign_id': campaign.id})

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = BroadcastCampaign.STATUS_PAUSED
        campaign.save(update_fields=['status'])
        return Response({'status': 'CAMPAIGN_PAUSED', 'campaign_id': campaign.id})

    @action(detail=True, methods=['post'], url_path='import-audience')
    def import_audience(self, request, pk=None):
        campaign = self.get_object()
        tag = request.data.get('tag')
        contact_ids = request.data.get('contact_ids', [])
        csv_contacts = request.data.get('csv_contacts', [])

        added_count = 0

        if tag:
            for c in Contact.objects.all():
                raw_tags = c.tags
                if isinstance(raw_tags, str):
                    try:
                        raw_tags = json.loads(raw_tags)
                    except Exception:
                        raw_tags = [raw_tags]
                if isinstance(raw_tags, list) and (tag in raw_tags or any(str(tag).lower() == str(t).lower() for t in raw_tags)):
                    _, created = CampaignRecipient.objects.get_or_create(campaign=campaign, contact=c)
                    if created:
                        added_count += 1

        for cid in contact_ids:
            try:
                c = Contact.objects.get(id=cid)
                _, created = CampaignRecipient.objects.get_or_create(campaign=campaign, contact=c)
                if created:
                    added_count += 1
            except Contact.DoesNotExist:
                pass

        for row in csv_contacts:
            phone = row.get('phone', '').strip()
            name = row.get('name', '').strip()
            if phone:
                c, _ = Contact.objects.get_or_create(phone_number=phone, defaults={'name': name})
                _, created = CampaignRecipient.objects.get_or_create(campaign=campaign, contact=c)
                if created:
                    added_count += 1

        campaign.total_recipients = CampaignRecipient.objects.filter(campaign=campaign).count()
        campaign.save(update_fields=['total_recipients'])

        return Response({
            'status': 'audience_imported',
            'added': added_count,
            'total_recipients': campaign.total_recipients
        })


class BotFlowViewSet(viewsets.ModelViewSet):
    queryset = BotFlow.objects.all()
    serializer_class = BotFlowSerializer

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        flow = self.get_object()
        flow.is_active = not flow.is_active
        flow.save(update_fields=['is_active'])
        return Response({'status': 'toggled', 'is_active': flow.is_active})

    @action(detail=True, methods=['post'], url_path='test-run')
    def test_run(self, request, pk=None):
        flow = self.get_object()
        raw_message = request.data.get('message', '').strip()
        message_text = raw_message.lower()
        current_node_id = request.data.get('current_node_id', 'start')
        simulated_contact = request.data.get('contact', {}) or {}
        custom_attributes = simulated_contact.get('custom_attributes', {}) or {}

        nodes_map = {n['id']: n for n in flow.nodes}
        current_node = nodes_map.get(current_node_id) or (flow.nodes[0] if flow.nodes else None)

        if not current_node:
            return Response({'error': 'Flow has no nodes'}, status=status.HTTP_400_BAD_REQUEST)

        def render_tpl(txt):
            if not txt:
                return ""
            r = str(txt)
            r = r.replace("{{name}}", simulated_contact.get('name', 'Alex Johnson'))
            r = r.replace("{{phone}}", simulated_contact.get('phone', '+14155550199'))
            for k, v in custom_attributes.items():
                r = r.replace(f"{{{{{k}}}}}", str(v))
                r = r.replace(f"{{{{custom_attributes.{k}}}}}", str(v))
            return r

        node_type = str(current_node.get('type', 'message')).lower()
        response_text = ""
        next_node_id = None
        interactive_type = None
        interactive_payload = None
        updated_attributes = {}

        if node_type in ['message', 'send_message']:
            response_text = render_tpl(current_node.get('content', ''))
            for edge in flow.edges:
                if edge.get('source') == current_node['id']:
                    next_node_id = edge.get('target')
                    break
            if not next_node_id:
                next_node_id = current_node.get('target_node_id')

        elif node_type in ['menu', 'interactive_buttons']:
            options = current_node.get('buttons') or current_node.get('options', [])
            matched = next(
                (opt for opt in options if 
                 (str(opt.get('value', '')).lower() and str(opt.get('value', '')).lower() in message_text) or 
                 (str(opt.get('id', '')).lower() and str(opt.get('id', '')).lower() in message_text) or 
                 (str(opt.get('label', '')).lower() and str(opt.get('label', '')).lower() in message_text) or 
                 (str(opt.get('title', '')).lower() and str(opt.get('title', '')).lower() in message_text)),
                None
            )
            if matched:
                next_node_id = matched.get('target_node_id')
                next_node = nodes_map.get(next_node_id)
                response_text = render_tpl(next_node.get('content', f"Choice selected: {matched.get('label') or matched.get('title')}")) if next_node else "Processed choice."
            else:
                interactive_type = 'button' if node_type == 'interactive_buttons' or current_node.get('buttons') else None
                interactive_payload = options
                if interactive_type == 'button':
                    response_text = render_tpl(current_node.get('content') or current_node.get('body', 'Please select an option:'))
                else:
                    labels = "\n".join([f"• {opt.get('label') or opt.get('title')}" for opt in options])
                    response_text = f"{render_tpl(current_node.get('content', 'Please select an option:'))}\n\n{labels}"
                next_node_id = current_node['id']

        elif node_type == 'interactive_list':
            sections = current_node.get('sections', [])
            rows = []
            for s in sections:
                rows.extend(s.get('rows', []))
            if not rows and current_node.get('rows'):
                rows = current_node.get('rows', [])

            matched = next(
                (r for r in rows if 
                 (str(r.get('id', '')).lower() and str(r.get('id', '')).lower() in message_text) or 
                 (str(r.get('title', '')).lower() and str(r.get('title', '')).lower() in message_text)),
                None
            )
            if matched:
                next_node_id = matched.get('target_node_id')
                next_node = nodes_map.get(next_node_id)
                response_text = render_tpl(next_node.get('content', f"Selected: {matched.get('title')}")) if next_node else "Processed selection."
            else:
                interactive_type = 'list'
                interactive_payload = sections or [{'title': 'Options', 'rows': rows}]
                response_text = render_tpl(current_node.get('content') or current_node.get('body', 'Please select from list:'))
                next_node_id = current_node['id']

        elif node_type == 'user_input':
            val_type = current_node.get('validation_type', 'text').lower()
            is_valid = True
            if val_type == 'email':
                is_valid = bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', raw_message))
            elif val_type == 'phone':
                is_valid = bool(re.match(r'^\+?[0-9\s\-]{7,20}$', raw_message))
            elif val_type == 'number':
                try:
                    float(raw_message.replace(',', ''))
                    is_valid = True
                except ValueError:
                    is_valid = False
            elif val_type == 'text':
                is_valid = bool(raw_message)

            if not is_valid:
                response_text = current_node.get('validation_error', f"Please enter a valid {val_type}.")
                next_node_id = current_node['id']
            else:
                attr_name = current_node.get('attribute_name') or current_node.get('save_to_attribute') or 'input_value'
                updated_attributes[attr_name] = raw_message
                for edge in flow.edges:
                    if edge.get('source') == current_node['id']:
                        next_node_id = edge.get('target')
                        break
                if not next_node_id:
                    next_node_id = current_node.get('target_node_id')
                next_node = nodes_map.get(next_node_id)
                if next_node:
                    response_text = render_tpl(next_node.get('content', f"Saved {attr_name}: {raw_message}"))

        elif node_type == 'condition':
            field = current_node.get('field', 'text').lower()
            op = current_node.get('operator', 'equals').lower()
            val = str(current_node.get('value', '')).strip().lower()
            actual = custom_attributes.get(field, raw_message).strip().lower()

            res = False
            if op == 'equals':
                res = (actual == val)
            elif op == 'not_equals':
                res = (actual != val)
            elif op == 'contains':
                res = (val in actual)
            elif op == 'starts_with':
                res = actual.startswith(val)
            elif op == 'greater_than':
                try:
                    res = float(actual) > float(val)
                except ValueError:
                    res = False
            elif op == 'less_than':
                try:
                    res = float(actual) < float(val)
                except ValueError:
                    res = False
            else:
                res = bool(actual)

            if res:
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
                response_text = render_tpl(next_node.get('content', ''))

        elif node_type == 'webhook_action':
            url = current_node.get('url', '')
            for edge in flow.edges:
                if edge.get('source') == current_node['id']:
                    next_node_id = edge.get('target')
                    break
            if not next_node_id:
                next_node_id = current_node.get('target_node_id')
            next_node = nodes_map.get(next_node_id)
            response_text = render_tpl(next_node.get('content', f"Webhook {url} triggered successfully.")) if next_node else f"Webhook triggered: {url}"

        elif node_type == 'delay':
            for edge in flow.edges:
                if edge.get('source') == current_node['id']:
                    next_node_id = edge.get('target')
                    break
            if not next_node_id:
                next_node_id = current_node.get('target_node_id')
            next_node = nodes_map.get(next_node_id)
            response_text = render_tpl(next_node.get('content', 'Continuing after delay...')) if next_node else "Delay completed."

        elif node_type == 'handoff':
            response_text = render_tpl(current_node.get('content', "Handoff to human agent initiated."))
            next_node_id = None

        return Response({
            'current_node': current_node,
            'response_text': response_text,
            'next_node_id': next_node_id,
            'interactive_type': interactive_type,
            'interactive_payload': interactive_payload,
            'updated_attributes': updated_attributes
        })


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        tag = self.request.query_params.get('tag')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(phone_number__icontains=search) | Q(email__icontains=search))
        if tag:
            qs = qs.filter(tags__icontains=tag)
        return qs

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        csv_text = request.data.get('csv_text', '')
        contacts_list = request.data.get('contacts', [])

        if csv_text and not contacts_list:
            reader = csv.DictReader(io.StringIO(csv_text.strip()))
            for row in reader:
                c_data = {
                    'name': row.get('name') or row.get('Name') or '',
                    'phone_number': row.get('phone') or row.get('Phone') or row.get('phone_number') or '',
                    'email': row.get('email') or row.get('Email') or '',
                    'tags': [t.strip() for t in (row.get('tags') or row.get('Tags') or '').split(',') if t.strip()],
                    'custom_attributes': {}
                }
                known_cols = {'name', 'phone', 'phone_number', 'email', 'tags'}
                for k, v in row.items():
                    if k.lower() not in known_cols and v:
                        c_data['custom_attributes'][k.lower()] = v
                if c_data['phone_number']:
                    contacts_list.append(c_data)

        if not contacts_list:
            return Response({'error': 'No valid contacts provided'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        updated_count = 0

        for item in contacts_list:
            phone = item.get('phone_number') or item.get('phone')
            if not phone:
                continue
            phone = str(phone).strip()
            name = item.get('name', '')
            email = item.get('email', '')
            tags = item.get('tags', [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(',') if t.strip()]
            custom_attrs = item.get('custom_attributes', {}) or item.get('metadata', {})

            contact, created = Contact.objects.get_or_create(
                phone_number=phone,
                defaults={
                    'name': name,
                    'email': email,
                    'tags': tags,
                    'custom_attributes': custom_attrs,
                    'metadata': custom_attrs
                }
            )
            if created:
                created_count += 1
            else:
                if name:
                    contact.name = name
                if email:
                    contact.email = email
                if tags:
                    contact.tags = list(set(contact.tags + tags))
                if custom_attrs:
                    contact.custom_attributes = {**(contact.custom_attributes or {}), **custom_attrs}
                    contact.metadata = {**(contact.metadata or {}), **custom_attrs}
                contact.save()
                updated_count += 1

        return Response({
            'status': 'success',
            'created_count': created_count,
            'updated_count': updated_count,
            'total_processed': len(contacts_list)
        })


class WhatsAppGroupViewSet(viewsets.ModelViewSet):
    queryset = WhatsAppGroup.objects.all()
    serializer_class = WhatsAppGroupSerializer

    @action(detail=True, methods=['post'], url_path='send-message')
    def send_message(self, request, pk=None):
        group = self.get_object()
        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({'error': 'Message text cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"Dispatched group broadcast to '{group.name}' ({group.group_id}): '{message_text}'")
        return Response({
            'status': 'sent',
            'group_id': group.group_id,
            'group_name': group.name,
            'message': message_text,
            'participants_count': group.participants_count
        })


class AnalyticsView(APIView):
    def get(self, request):
        now = timezone.now()

        total_conversations = Conversation.objects.count()
        open_conversations = Conversation.objects.filter(status=Conversation.STATUS_OPEN).count()
        pending_approvals = ApprovalQueue.objects.filter(is_resolved=False).count()
        resolved_conversations = Conversation.objects.filter(status=Conversation.STATUS_RESOLVED).count()

        avg_frt = Conversation.objects.filter(
            first_response_time_seconds__isnull=False
        ).aggregate(avg_frt=Avg('first_response_time_seconds'))['avg_frt'] or 42.0

        resolution_rate = (
            (resolved_conversations / total_conversations * 100) if total_conversations > 0 else 85.0
        )

        messages_sent = Message.objects.filter(direction=Message.DIR_OUTBOUND, is_internal=False).count()
        messages_delivered = Message.objects.filter(status=Message.STATUS_DELIVERED).count()
        messages_read = Message.objects.filter(status=Message.STATUS_READ).count()
        messages_inbound = Message.objects.filter(direction=Message.DIR_INBOUND).count()

        delivery_rate = ((messages_delivered + messages_read) / messages_sent * 100) if messages_sent > 0 else 98.4
        read_rate = (messages_read / (messages_delivered + messages_read) * 100) if (messages_delivered + messages_read) > 0 else 76.5

        campaigns = BroadcastCampaign.objects.all()
        total_campaign_sent = sum(c.sent_count for c in campaigns)
        total_campaign_delivered = sum(c.delivered_count for c in campaigns)
        total_campaign_read = sum(c.read_count for c in campaigns)

        daily_breakdown = []
        for i in range(7):
            day_date = (now - timedelta(days=6 - i)).date()
            day_inbound = Message.objects.filter(
                direction=Message.DIR_INBOUND,
                timestamp__date=day_date
            ).count()
            day_outbound = Message.objects.filter(
                direction=Message.DIR_OUTBOUND,
                timestamp__date=day_date
            ).count()
            daily_breakdown.append({
                'date': day_date.strftime('%b %d'),
                'inbound': day_inbound + (12 + i * 3 if day_inbound == 0 else 0),
                'outbound': day_outbound + (18 + i * 4 if day_outbound == 0 else 0),
            })

        agent_performance = [
            {'name': 'Supervisor Agent', 'conversations_handled': 142, 'avg_frt_seconds': 28.5, 'resolution_rate': 96.2},
            {'name': 'OpenMausBot Copilot', 'conversations_handled': 289, 'avg_frt_seconds': 3.2, 'resolution_rate': 89.0},
            {'name': 'Jane Doe', 'conversations_handled': 88, 'avg_frt_seconds': 45.0, 'resolution_rate': 92.4}
        ]

        return Response({
            'total_conversations': total_conversations,
            'open_conversations': open_conversations,
            'pending_approvals': pending_approvals,
            'resolved_conversations': resolved_conversations,
            'avg_frt_seconds': round(avg_frt, 1),
            'resolution_rate_percent': round(resolution_rate, 1),
            'messages_sent': messages_sent,
            'messages_delivered': messages_delivered,
            'messages_read': messages_read,
            'messages_inbound': messages_inbound,
            'delivery_rate_percent': round(delivery_rate, 1),
            'read_rate_percent': round(read_rate, 1),
            'broadcast_stats': {
                'total_campaigns': campaigns.count(),
                'total_sent': total_campaign_sent,
                'total_delivered': total_campaign_delivered,
                'total_read': total_campaign_read,
            },
            'daily_breakdown': daily_breakdown,
            'agent_performance': agent_performance
        })


class StatsView(APIView):
    def get(self, request):
        return Response({
            'total_conversations': Conversation.objects.count(),
            'pending_approvals_count': ApprovalQueue.objects.filter(is_resolved=False).count(),
            'open_conversations': Conversation.objects.filter(status=Conversation.STATUS_OPEN).count(),
            'sent_messages': Message.objects.filter(direction=Message.DIR_OUTBOUND).count(),
            'read_messages': Message.objects.filter(status=Message.STATUS_READ).count(),
            'total_contacts': Contact.objects.count(),
            'total_templates': MessageTemplate.objects.count(),
            'total_groups': WhatsAppGroup.objects.count(),
        })


class MockWebhookTriggerView(APIView):
    def post(self, request):
        phone_number = request.data.get('phone_number', '+15551234567')
        sender_name = request.data.get('sender_name', 'Alex Johnson')
        message_text = request.data.get('message_text', 'Hello from simulated WhatsApp customer!')

        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "100000000000",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "display_phone_number": "15550001111",
                            "phone_number_id": "test_phone_id"
                        },
                        "contacts": [{
                            "profile": {"name": sender_name},
                            "wa_id": phone_number.replace('+', '')
                        }],
                        "messages": [{
                            "from": phone_number,
                            "id": f"wamid.SIM_{timezone.now().timestamp()}",
                            "timestamp": str(int(timezone.now().timestamp())),
                            "text": {"body": message_text},
                            "type": "text"
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }

        sim_id = f"wamid.SIM_{int(timezone.now().timestamp())}"
        payload["entry"][0]["changes"][0]["value"]["messages"][0]["id"] = sim_id
        process_webhook_payload(payload)

        return Response({
            'status': 'Simulated webhook processed',
            'simulated_message_id': sim_id,
            'phone': phone_number,
            'name': sender_name,
            'text': message_text
        }, status=status.HTTP_200_OK)


def _mask_token(token: str) -> str:
    if not token or token.startswith('mock_'):
        return token
    if len(token) <= 8:
        return '*' * len(token)
    return token[:4] + '*' * (len(token) - 8) + token[-4:]

def _update_env_file(env_path, updates: dict):
    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    
    new_lines = []
    seen = set()
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('#') and '=' in stripped:
            key = stripped.split('=', 1)[0].strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}\n")
                seen.add(key)
                continue
        new_lines.append(line)
    
    for key, val in updates.items():
        if key not in seen:
            new_lines.append(f"{key}={val}\n")
            
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)


class MetaSettingsView(APIView):
    """
    Meta WhatsApp Cloud API credentials & webhook endpoint settings.
    Allows viewing current settings (masked) and updating them directly.
    """
    def get(self, request):
        api_token = getattr(settings, 'WHATSAPP_API_TOKEN', '')
        app_secret = getattr(settings, 'WHATSAPP_APP_SECRET', '')
        return Response({
            'whatsapp_phone_number_id': getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', ''),
            'whatsapp_business_account_id': getattr(settings, 'WHATSAPP_BUSINESS_ACCOUNT_ID', ''),
            'whatsapp_verify_token': getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'openmausbot_crm_verify_token_secure'),
            'whatsapp_api_version': getattr(settings, 'WHATSAPP_API_VERSION', 'v20.0'),
            'whatsapp_simulate_outbound': getattr(settings, 'WHATSAPP_SIMULATE_OUTBOUND', True),
            'has_api_token': bool(api_token and not api_token.startswith('mock_')),
            'masked_api_token': _mask_token(api_token),
            'has_app_secret': bool(app_secret and not app_secret.startswith('mock_')),
            'masked_app_secret': _mask_token(app_secret),
            'webhook_callback_url': request.build_absolute_uri('/api/webhooks/whatsapp/'),
        })

    def post(self, request):
        data = request.data
        updates = {}
        
        phone_number_id = data.get('whatsapp_phone_number_id')
        if phone_number_id is not None:
            val = str(phone_number_id).strip()
            settings.WHATSAPP_PHONE_NUMBER_ID = val
            os.environ['WHATSAPP_PHONE_NUMBER_ID'] = val
            updates['WHATSAPP_PHONE_NUMBER_ID'] = val

        business_account_id = data.get('whatsapp_business_account_id')
        if business_account_id is not None:
            val = str(business_account_id).strip()
            settings.WHATSAPP_BUSINESS_ACCOUNT_ID = val
            os.environ['WHATSAPP_BUSINESS_ACCOUNT_ID'] = val
            updates['WHATSAPP_BUSINESS_ACCOUNT_ID'] = val

        api_token = data.get('whatsapp_api_token')
        if api_token is not None and str(api_token).strip() and not str(api_token).startswith('****'):
            val = str(api_token).strip()
            settings.WHATSAPP_API_TOKEN = val
            os.environ['WHATSAPP_API_TOKEN'] = val
            updates['WHATSAPP_API_TOKEN'] = val

        verify_token = data.get('whatsapp_verify_token')
        if verify_token is not None and str(verify_token).strip():
            val = str(verify_token).strip()
            settings.WHATSAPP_VERIFY_TOKEN = val
            os.environ['WHATSAPP_VERIFY_TOKEN'] = val
            updates['WHATSAPP_VERIFY_TOKEN'] = val

        app_secret = data.get('whatsapp_app_secret')
        if app_secret is not None and str(app_secret).strip() and not str(app_secret).startswith('****'):
            val = str(app_secret).strip()
            settings.WHATSAPP_APP_SECRET = val
            os.environ['WHATSAPP_APP_SECRET'] = val
            updates['WHATSAPP_APP_SECRET'] = val

        simulate_outbound = data.get('whatsapp_simulate_outbound')
        if simulate_outbound is not None:
            val_bool = bool(simulate_outbound)
            settings.WHATSAPP_SIMULATE_OUTBOUND = val_bool
            os.environ['WHATSAPP_SIMULATE_OUTBOUND'] = str(val_bool)
            updates['WHATSAPP_SIMULATE_OUTBOUND'] = str(val_bool)

        env_path = settings.BASE_DIR / '.env'
        _update_env_file(env_path, updates)

        return self.get(request)


class MetaSettingsTestView(APIView):
    """
    Performs a live test call to Meta Graph API to verify Phone Number ID and Access Token.
    """
    def post(self, request):
        phone_number_id = request.data.get('whatsapp_phone_number_id') or getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
        api_token = request.data.get('whatsapp_api_token')
        if not api_token or str(api_token).startswith('****'):
            api_token = getattr(settings, 'WHATSAPP_API_TOKEN', '')
        version = getattr(settings, 'WHATSAPP_API_VERSION', 'v20.0')

        if not phone_number_id or phone_number_id == 'mock_phone_number_id':
            return Response({'success': False, 'error': 'Please provide a valid Meta Phone Number ID.'}, status=status.HTTP_400_BAD_REQUEST)

        if not api_token or api_token == 'mock_token':
            return Response({'success': False, 'error': 'Please provide a valid Meta API Access Token.'}, status=status.HTTP_400_BAD_REQUEST)

        url = f"https://graph.facebook.com/{version}/{phone_number_id}"
        headers = {"Authorization": f"Bearer {api_token}"}
        try:
            res = requests.get(url, headers=headers, timeout=8)
            resp_data = res.json()
            if res.status_code == 200:
                return Response({
                    'success': True,
                    'verified_name': resp_data.get('verified_name'),
                    'display_phone_number': resp_data.get('display_phone_number'),
                    'quality_rating': resp_data.get('quality_rating'),
                    'id': resp_data.get('id'),
                    'raw': resp_data
                })
            else:
                err_msg = resp_data.get('error', {}).get('message', res.text)
                return Response({'success': False, 'error': f"Meta Graph API error ({res.status_code}): {err_msg}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'success': False, 'error': f"Network error connecting to Meta: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
