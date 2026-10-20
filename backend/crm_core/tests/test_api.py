from unittest.mock import patch
from django.test import TestCase, override_settings
from django.urls import reverse
from crm_core.models import Contact, Conversation, Message, MessageTemplate, ApprovalQueue
from crm_core.whatsapp_client import WhatsAppCloudAPIClient

@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class APITests(TestCase):
    """
    Comprehensive test suite for REST API endpoints:
    - Conversations (list, filter by status, search, mark-read, nested messages)
    - Messages (direct agent send text/template, filter by conversation)
    - Contacts & Templates ViewSets
    - Dashboard Stats
    - Mock Webhook Simulation Endpoint
    """
    def setUp(self):
        self.contact = Contact.objects.create(name="Alice Smith", phone_number="+15551112222")
        self.conversation = Conversation.objects.create(
            contact=self.contact,
            status=Conversation.STATUS_OPEN,
            unread_count=3
        )

    def test_list_conversations(self):
        """Conversation list endpoint returns paginated results."""
        url = reverse('conversation-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json().get('results', [])), 1)

    def test_conversation_filter_by_status(self):
        """Conversations can be filtered by STATUS_OPEN or STATUS_PENDING_APPROVAL."""
        Contact.objects.create(name="Pending Bob", phone_number="+15553334444")
        conv_pending = Conversation.objects.create(
            contact=Contact.objects.get(phone_number="+15553334444"),
            status=Conversation.STATUS_PENDING_APPROVAL
        )

        url = reverse('conversation-list')
        response = self.client.get(url, {'status': 'PENDING_APPROVAL'})
        self.assertEqual(response.status_code, 200)
        results = response.json().get('results', [])
        self.assertTrue(all(item['status'] == 'PENDING_APPROVAL' for item in results))
        self.assertTrue(any(item['id'] == conv_pending.id for item in results))

    def test_conversation_search(self):
        """Search query param filters by contact name, phone number, or message content."""
        url = reverse('conversation-list')
        # Search by contact name
        res_name = self.client.get(url, {'search': 'Alice'})
        self.assertEqual(res_name.status_code, 200)
        self.assertGreaterEqual(len(res_name.json().get('results', [])), 1)

        # Search by non-existent query
        res_none = self.client.get(url, {'search': 'NonExistentPersonXYZ'})
        self.assertEqual(res_none.status_code, 200)
        self.assertEqual(len(res_none.json().get('results', [])), 0)

    def test_conversation_mark_read(self):
        """Action endpoint resets unread_count to 0."""
        self.assertEqual(self.conversation.unread_count, 3)
        url = reverse('conversation-mark-read', kwargs={'pk': self.conversation.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.unread_count, 0)

    def test_conversation_messages_action(self):
        """Retrieves all messages for a specific conversation in chronological order."""
        Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_INBOUND,
            content="Message 1",
            status=Message.STATUS_DELIVERED
        )
        Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Message 2",
            status=Message.STATUS_SENT
        )

        url = reverse('conversation-messages', kwargs={'pk': self.conversation.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['content'], "Message 1")
        self.assertEqual(data[1]['content'], "Message 2")

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_send_direct_text_message_via_api(self, mock_send):
        """Agent can send a direct outbound text message to a conversation."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.api_direct_001"}]
        }

        url = reverse('message-list')
        response = self.client.post(url, {
            'conversation_id': self.conversation.id,
            'content': 'Test direct message from agent'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['status'], Message.STATUS_SENT)
        self.assertEqual(data['meta_message_id'], 'wamid.api_direct_001')
        mock_send.assert_called_once_with(
            recipient_phone="+15551112222",
            text_body='Test direct message from agent'
        )

    @patch.object(WhatsAppCloudAPIClient, 'send_template_message')
    def test_send_template_message_via_api(self, mock_send):
        """Agent can send a Meta approved template message."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.api_template_002"}]
        }

        url = reverse('message-list')
        response = self.client.post(url, {
            'conversation_id': self.conversation.id,
            'message_type': 'TEMPLATE',
            'template_name': 'order_update',
            'template_language': 'en_US',
            'components': [{'type': 'body', 'parameters': [{'type': 'text', 'text': '12345'}]}]
        }, content_type='application/json')

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['status'], Message.STATUS_SENT)
        self.assertEqual(data['meta_message_id'], 'wamid.api_template_002')
        mock_send.assert_called_once()

    def test_stats_endpoint(self):
        """Stats endpoint returns summary metrics for conversations, approvals, and messages."""
        url = reverse('crm-stats')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('total_conversations', data)
        self.assertIn('pending_approvals_count', data)
        self.assertIn('sent_messages', data)
        self.assertIn('total_contacts', data)
        self.assertIn('total_templates', data)

    def test_contact_viewset_crud(self):
        """Contact ViewSet creates and retrieves contact records."""
        url = reverse('contact-list')
        response = self.client.post(url, {
            'phone_number': '+15559876543',
            'name': 'David Miller',
            'email': 'david@example.com'
        }, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        contact_id = response.json()['id']

        detail_url = reverse('contact-detail', kwargs={'pk': contact_id})
        res_get = self.client.get(detail_url)
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.json()['name'], 'David Miller')

    def test_mock_webhook_trigger_view(self):
        """Developer mock webhook trigger endpoint injects a message and triggers pipeline."""
        url = reverse('whatsapp-simulate-webhook')
        response = self.client.post(url, {
            'phone_number': '+15558889999',
            'sender_name': 'Mock Inbound Sender',
            'message_text': 'I demand a full refund for this scam order!'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'Simulated webhook processed')
        self.assertIn('simulated_message_id', data)

        # Confirm that an approval queue record was created from this high-risk mock message
        approval = ApprovalQueue.objects.filter(message__conversation__contact__phone_number='+15558889999').first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.intent, 'refund_request')
