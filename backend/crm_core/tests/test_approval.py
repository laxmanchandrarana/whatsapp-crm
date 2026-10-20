from unittest.mock import patch
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from crm_core.models import Contact, Conversation, Message, ApprovalQueue
from crm_core.tasks import evaluate_ai_response_and_approval
from crm_core.whatsapp_client import WhatsAppCloudAPIClient

@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ApprovalQueueTests(TestCase):
    """
    Test suite for 1-Click Human-in-the-Loop Approval Queue endpoints:
    - /api/approvals/<id>/approve/
    - /api/approvals/<id>/reject/
    - Status filtering and conversation state transitions.
    """
    def setUp(self):
        self.contact = Contact.objects.create(name="Refund Customer", phone_number="+15559998888")
        self.conversation = Conversation.objects.create(contact=self.contact, status=Conversation.STATUS_OPEN)

    def test_high_risk_message_creates_approval_queue(self):
        """High-risk inbound message automatically creates an unresolved approval record."""
        inbound = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_INBOUND,
            content="I demand an immediate refund for my charged card!",
            status=Message.STATUS_DELIVERED
        )
        evaluate_ai_response_and_approval(inbound.id)

        approval = ApprovalQueue.objects.filter(message__conversation=self.conversation).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.intent, 'refund_request')
        self.assertGreaterEqual(approval.risk_score, 0.9)
        self.assertFalse(approval.is_resolved)

        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_PENDING_APPROVAL)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_approve_action_with_edited_text(self, mock_send):
        """1-Click approve with text editing updates message content and dispatches to Meta."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.approved_mock_001"}]
        }

        draft_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Draft response original",
            status=Message.STATUS_PENDING_APPROVAL
        )
        approval = ApprovalQueue.objects.create(
            message=draft_msg,
            intent='refund_request',
            risk_score=0.92,
            suggested_response=draft_msg.content,
            is_resolved=False
        )

        url = reverse('approval-approve', kwargs={'pk': approval.id})
        response = self.client.post(url, {
            'edited_text': 'Edited approved refund response by supervisor.',
            'approved_by': 'Supervisor Jane'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 200)

        approval.refresh_from_db()
        draft_msg.refresh_from_db()

        self.assertTrue(approval.is_resolved)
        self.assertEqual(approval.approved_by, 'Supervisor Jane')
        self.assertIsNotNone(approval.approved_at)
        self.assertEqual(approval.suggested_response, 'Edited approved refund response by supervisor.')

        self.assertEqual(draft_msg.content, 'Edited approved refund response by supervisor.')
        self.assertEqual(draft_msg.status, Message.STATUS_SENT)
        self.assertEqual(draft_msg.meta_message_id, "wamid.approved_mock_001")

        mock_send.assert_called_once_with(
            recipient_phone="+15559998888",
            text_body='Edited approved refund response by supervisor.'
        )

        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_OPEN)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_approve_action_without_editing(self, mock_send):
        """1-Click approve without editing dispatches the original AI suggested text."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.approved_mock_002"}]
        }

        draft_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Original AI response for pricing",
            status=Message.STATUS_PENDING_APPROVAL
        )
        approval = ApprovalQueue.objects.create(
            message=draft_msg,
            intent='pricing_negotiation',
            risk_score=0.75,
            suggested_response=draft_msg.content,
            is_resolved=False
        )

        url = reverse('approval-approve', kwargs={'pk': approval.id})
        response = self.client.post(url, {'approved_by': 'Agent Bob'}, content_type='application/json')
        self.assertEqual(response.status_code, 200)

        draft_msg.refresh_from_db()
        self.assertEqual(draft_msg.content, "Original AI response for pricing")
        self.assertEqual(draft_msg.status, Message.STATUS_SENT)

        mock_send.assert_called_once_with(
            recipient_phone="+15559998888",
            text_body="Original AI response for pricing"
        )

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_reject_action_with_reason(self, mock_send):
        """1-Click reject sets message to REJECTED and does NOT dispatch to Meta API."""
        draft_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Draft response",
            status=Message.STATUS_PENDING_APPROVAL
        )
        approval = ApprovalQueue.objects.create(
            message=draft_msg,
            intent='refund_request',
            risk_score=0.92,
            suggested_response=draft_msg.content,
            is_resolved=False
        )

        url = reverse('approval-reject', kwargs={'pk': approval.id})
        response = self.client.post(url, {
            'rejection_reason': 'Requires custom phone call by billing team'
        }, content_type='application/json')

        self.assertEqual(response.status_code, 200)

        approval.refresh_from_db()
        draft_msg.refresh_from_db()

        self.assertTrue(approval.is_resolved)
        self.assertEqual(approval.rejection_reason, 'Requires custom phone call by billing team')
        self.assertEqual(draft_msg.status, Message.STATUS_REJECTED)

        # Meta API was never invoked
        mock_send.assert_not_called()

        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_OPEN)

    def test_conversation_status_transitions_with_multiple_approvals(self):
        """Conversation status remains PENDING_APPROVAL until ALL pending drafts are resolved."""
        self.conversation.status = Conversation.STATUS_PENDING_APPROVAL
        self.conversation.save()

        # Create two draft messages
        draft1 = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Draft 1",
            status=Message.STATUS_PENDING_APPROVAL
        )
        approval1 = ApprovalQueue.objects.create(
            message=draft1,
            intent='refund_request',
            risk_score=0.9,
            suggested_response="Draft 1"
        )

        draft2 = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Draft 2",
            status=Message.STATUS_PENDING_APPROVAL
        )
        approval2 = ApprovalQueue.objects.create(
            message=draft2,
            intent='cancellation',
            risk_score=0.85,
            suggested_response="Draft 2"
        )

        # Approve first draft
        url1 = reverse('approval-approve', kwargs={'pk': approval1.id})
        self.client.post(url1, {'approved_by': 'Supervisor'}, content_type='application/json')

        # Since draft2 is still PENDING_APPROVAL, conversation status must remain PENDING_APPROVAL
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_PENDING_APPROVAL)

        # Now reject second draft
        url2 = reverse('approval-reject', kwargs={'pk': approval2.id})
        self.client.post(url2, {'rejection_reason': 'Duplicate issue'}, content_type='application/json')

        # All pending approvals are now resolved, so conversation status transitions back to OPEN
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_OPEN)

    def test_approve_nonexistent_returns_404(self):
        """Attempting to approve a nonexistent approval ID returns 404."""
        url = reverse('approval-approve', kwargs={'pk': 999999})
        response = self.client.post(url, {'approved_by': 'Admin'}, content_type='application/json')
        self.assertEqual(response.status_code, 404)

    def test_reject_nonexistent_returns_404(self):
        """Attempting to reject a nonexistent approval ID returns 404."""
        url = reverse('approval-reject', kwargs={'pk': 999999})
        response = self.client.post(url, {'rejection_reason': 'None'}, content_type='application/json')
        self.assertEqual(response.status_code, 404)

    def test_filter_approval_queue_by_resolved(self):
        """ApprovalQueue list endpoint correctly filters by resolved status and orders by risk."""
        draft1 = Message.objects.create(conversation=self.conversation, direction=Message.DIR_OUTBOUND, content="Msg 1", status=Message.STATUS_PENDING_APPROVAL)
        app1 = ApprovalQueue.objects.create(message=draft1, intent='refund', risk_score=0.95, suggested_response="Msg 1", is_resolved=False)

        draft2 = Message.objects.create(conversation=self.conversation, direction=Message.DIR_OUTBOUND, content="Msg 2", status=Message.STATUS_SENT)
        app2 = ApprovalQueue.objects.create(message=draft2, intent='greeting', risk_score=0.20, suggested_response="Msg 2", is_resolved=True)

        url = reverse('approval-list')

        # Unresolved filter
        res_unresolved = self.client.get(url, {'resolved': 'false'})
        self.assertEqual(res_unresolved.status_code, 200)
        results = res_unresolved.json().get('results', [])
        self.assertTrue(all(item['is_resolved'] is False for item in results))
        self.assertTrue(any(item['id'] == app1.id for item in results))

        # Resolved filter
        res_resolved = self.client.get(url, {'resolved': 'true'})
        self.assertEqual(res_resolved.status_code, 200)
        results = res_resolved.json().get('results', [])
        self.assertTrue(all(item['is_resolved'] is True for item in results))
        self.assertTrue(any(item['id'] == app2.id for item in results))
