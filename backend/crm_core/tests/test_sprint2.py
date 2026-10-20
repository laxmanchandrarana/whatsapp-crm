from django.test import TestCase, override_settings
from django.urls import reverse
from crm_core.models import (
    Contact,
    Conversation,
    Message,
    MessageTemplate,
    BroadcastCampaign,
    CampaignRecipient,
    BotFlow,
    BotSession,
    CannedResponse,
    AIAgentConfig
)
from crm_core.tasks import execute_broadcast_campaign, process_bot_flow_step

class Sprint2EnterpriseTests(TestCase):
    def setUp(self):
        self.contact = Contact.objects.create(name="Sarah Connor", phone_number="+15554443333", tags=["VIP"])
        self.conversation = Conversation.objects.create(contact=self.contact, status=Conversation.STATUS_OPEN)
        self.template = MessageTemplate.objects.create(
            name="promo_vip_test",
            category="MARKETING",
            language="en_US",
            meta_status="APPROVED",
            components=[{"type": "BODY", "text": "Hi {{1}}, here is your promo code {{2}}"}]
        )

    def test_internal_whisper_note(self):
        url = reverse('conversation-add-internal-note', kwargs={'pk': self.conversation.id})
        response = self.client.post(url, {
            'content': 'Customer is angry about delays. Offer priority shipping.',
            'author_agent': 'Supervisor Mark'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201)
        note = Message.objects.get(id=response.json()['id'])
        self.assertTrue(note.is_internal)
        self.assertEqual(note.author_agent, 'Supervisor Mark')
        self.assertEqual(note.status, Message.STATUS_SENT)

    def test_conversation_status_transition(self):
        url = reverse('conversation-update-status', kwargs={'pk': self.conversation.id})
        response = self.client.post(url, {'status': 'RESOLVED'}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, 'RESOLVED')
        self.assertIsNotNone(self.conversation.resolved_at)

    def test_canned_responses_api(self):
        CannedResponse.objects.create(shortcut='billing_faq', title='Billing FAQ', content='Here is our billing link')
        url = reverse('canned-response-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        shortcuts = [item['shortcut'] for item in response.json().get('results', response.json())]
        self.assertIn('billing_faq', shortcuts)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_broadcast_campaign_flow(self):
        campaign = BroadcastCampaign.objects.create(
            name="Summer Sale 2026",
            template=self.template,
            target_tag="VIP"
        )

        # Import audience via API
        import_url = reverse('campaign-import-audience', kwargs={'pk': campaign.id})
        res_import = self.client.post(import_url, {'tag': 'VIP'}, content_type='application/json')
        self.assertEqual(res_import.status_code, 200)
        self.assertEqual(res_import.json()['total_recipients'], 1)

        # Start Campaign
        start_url = reverse('campaign-start', kwargs={'pk': campaign.id})
        res_start = self.client.post(start_url)
        self.assertEqual(res_start.status_code, 200)

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, BroadcastCampaign.STATUS_COMPLETED)
        self.assertEqual(campaign.sent_count, 1)

    def test_bot_studio_flow_execution(self):
        flow = BotFlow.objects.create(
            name="Support Flow",
            trigger_type=BotFlow.TRIGGER_KEYWORD,
            trigger_keywords=["help", "menu"],
            nodes=[
                {'id': 'n1', 'type': 'message', 'content': 'Welcome to bot!'},
                {'id': 'n2', 'type': 'menu', 'content': 'Pick an option', 'options': [{'label': 'Billing', 'value': '1', 'target_node_id': 'n3'}]},
                {'id': 'n3', 'type': 'message', 'content': 'Billing info here.'}
            ],
            edges=[{'source': 'n1', 'target': 'n2'}],
            is_active=True
        )

        # Trigger initial flow via task helper
        handled = process_bot_flow_step(self.contact, "help")
        self.assertTrue(handled)

        session = BotSession.objects.filter(contact=self.contact, flow=flow, is_completed=False).first()
        self.assertIsNotNone(session)

    def test_template_sync_from_meta(self):
        url = reverse('template-sync-meta')
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('synced', response.json().get('status'))

    def test_analytics_dashboard_endpoint(self):
        url = reverse('crm-analytics')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('avg_frt_seconds', data)
        self.assertIn('resolution_rate_percent', data)
        self.assertIn('daily_breakdown', data)
        self.assertIn('broadcast_stats', data)
