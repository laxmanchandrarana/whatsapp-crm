from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.utils import timezone
from crm_core.models import Contact, Conversation, Message, ApprovalQueue
from crm_core.tasks import dispatch_outbound_meta_message, evaluate_ai_response_and_approval
from crm_core.whatsapp_client import WhatsAppCloudAPIClient

@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class StrictApprovalGatekeeperTests(TestCase):
    """
    Test suite for Strict Approval Gatekeeping.
    Ensures that the human-in-the-loop approval mechanism never leaks unapproved messages.
    """
    def setUp(self):
        self.contact = Contact.objects.create(name="Security Tester", phone_number="+15550009999")
        self.conversation = Conversation.objects.create(
            contact=self.contact,
            status=Conversation.STATUS_PENDING_APPROVAL
        )

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_cannot_dispatch_pending_approval_message(self, mock_send):
        """Messages in STATUS_PENDING_APPROVAL must be blocked from dispatch."""
        pending_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Unapproved AI response suggesting discount",
            status=Message.STATUS_PENDING_APPROVAL
        )

        result = dispatch_outbound_meta_message(pending_msg.id)

        # Assert gatekeeper blocked it
        self.assertEqual(result.get('status'), 'blocked')
        mock_send.assert_not_called()

        # Database state check: must NOT be marked SENT or given meta_message_id
        pending_msg.refresh_from_db()
        self.assertEqual(pending_msg.status, Message.STATUS_PENDING_APPROVAL)
        self.assertIsNone(pending_msg.meta_message_id)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_cannot_dispatch_draft_message(self, mock_send):
        """Messages in STATUS_DRAFT must be blocked from dispatch."""
        draft_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Unfinished agent draft",
            status=Message.STATUS_DRAFT
        )

        result = dispatch_outbound_meta_message(draft_msg.id)

        self.assertEqual(result.get('status'), 'blocked')
        mock_send.assert_not_called()

        draft_msg.refresh_from_db()
        self.assertEqual(draft_msg.status, Message.STATUS_DRAFT)
        self.assertIsNone(draft_msg.meta_message_id)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_cannot_dispatch_rejected_message(self, mock_send):
        """Messages in STATUS_REJECTED must be blocked from dispatch."""
        rejected_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Rejected inappropriate response",
            status=Message.STATUS_REJECTED
        )

        result = dispatch_outbound_meta_message(rejected_msg.id)

        self.assertEqual(result.get('status'), 'blocked')
        mock_send.assert_not_called()

        rejected_msg.refresh_from_db()
        self.assertEqual(rejected_msg.status, Message.STATUS_REJECTED)
        self.assertIsNone(rejected_msg.meta_message_id)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_cannot_dispatch_inbound_message(self, mock_send):
        """Inbound customer messages cannot be dispatched outbound."""
        inbound_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_INBOUND,
            content="Customer inbound query",
            status=Message.STATUS_DELIVERED
        )

        result = dispatch_outbound_meta_message(inbound_msg.id)

        self.assertEqual(result.get('status'), 'skipped')
        mock_send.assert_not_called()

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_approved_message_can_be_dispatched(self, mock_send):
        """Messages in STATUS_APPROVED are allowed through the gatekeeper."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.gatekeeper_approved_123"}]
        }

        approved_msg = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_OUTBOUND,
            content="Approved safe message",
            status=Message.STATUS_APPROVED
        )

        result = dispatch_outbound_meta_message(approved_msg.id)

        self.assertEqual(result.get('status'), 'sent')
        self.assertEqual(result.get('meta_message_id'), 'wamid.gatekeeper_approved_123')
        mock_send.assert_called_once_with(
            recipient_phone="+15550009999",
            text_body="Approved safe message"
        )

        approved_msg.refresh_from_db()
        self.assertEqual(approved_msg.status, Message.STATUS_SENT)
        self.assertEqual(approved_msg.meta_message_id, "wamid.gatekeeper_approved_123")

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_high_risk_inbound_flow_never_leaks_to_meta_api(self, mock_send):
        """
        End-to-end evaluation flow for high-risk refund request:
        Confirms that draft response is placed in PENDING_APPROVAL and Meta API is never called.
        """
        inbound = Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_INBOUND,
            content="I am demanding a full refund or I will file a chargeback scam claim!",
            status=Message.STATUS_DELIVERED
        )

        # Execute evaluation task
        evaluate_ai_response_and_approval(inbound.id)

        # Meta API must NOT have been called
        mock_send.assert_not_called()

        # ApprovalQueue entry must exist
        approval = ApprovalQueue.objects.filter(message__conversation=self.conversation).first()
        self.assertIsNotNone(approval)
        self.assertFalse(approval.is_resolved)
        self.assertEqual(approval.intent, 'refund_request')

        # The draft message in DB must have status PENDING_APPROVAL
        draft = approval.message
        self.assertEqual(draft.status, Message.STATUS_PENDING_APPROVAL)
        self.assertIsNone(draft.meta_message_id)

        # Attempting to call dispatch directly on this draft must be blocked
        gate_res = dispatch_outbound_meta_message(draft.id)
        self.assertEqual(gate_res.get('status'), 'blocked')
        mock_send.assert_not_called()
