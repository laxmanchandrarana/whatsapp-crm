from unittest.mock import patch
from django.test import TestCase, override_settings
from crm_core.models import Contact, Conversation, Message, ApprovalQueue
from crm_core.tasks import evaluate_ai_response_and_approval
from crm_core.whatsapp_client import WhatsAppCloudAPIClient

@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class RiskRoutingAndAutoReplyTests(TestCase):
    """
    Test suite for AI intent classification, risk assessment, and routing:
    - High-risk messages (pricing disputes, cancellations, refund requests, human handoff)
      must route to ApprovalQueue with status PENDING_APPROVAL.
    - Low-risk messages (greetings, FAQs, general inquiries)
      must automatically generate and dispatch an immediate auto-reply.
    """
    def setUp(self):
        self.contact = Contact.objects.create(name="Customer Persona", phone_number="+15557778888")
        self.conversation = Conversation.objects.create(contact=self.contact, status=Conversation.STATUS_OPEN)

    def _create_inbound_message(self, text):
        return Message.objects.create(
            conversation=self.conversation,
            direction=Message.DIR_INBOUND,
            content=text,
            status=Message.STATUS_DELIVERED
        )

    # ------------------ High-Risk Test Cases ------------------

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_high_risk_refund_intent(self, mock_send):
        """Inbound refund / chargeback demand creates approval queue entry with risk >= 0.9."""
        inbound = self._create_inbound_message("I am demanding an immediate refund for my duplicate charge.")
        evaluate_ai_response_and_approval(inbound.id)

        mock_send.assert_not_called()

        approval = ApprovalQueue.objects.filter(message__conversation=self.conversation).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.intent, 'refund_request')
        self.assertGreaterEqual(approval.risk_score, 0.90)
        self.assertFalse(approval.is_resolved)
        self.assertIn("billing supervisor", approval.suggested_response.lower())

        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_PENDING_APPROVAL)

        draft = approval.message
        self.assertEqual(draft.status, Message.STATUS_PENDING_APPROVAL)
        self.assertIsNone(draft.meta_message_id)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_high_risk_cancellation_intent(self, mock_send):
        """Inbound subscription cancellation or termination creates approval queue entry."""
        inbound = self._create_inbound_message("Please cancel my account and terminate my subscription.")
        evaluate_ai_response_and_approval(inbound.id)

        mock_send.assert_not_called()

        approval = ApprovalQueue.objects.filter(message__conversation=self.conversation).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.intent, 'cancellation')
        self.assertGreaterEqual(approval.risk_score, 0.85)
        self.assertFalse(approval.is_resolved)

        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_PENDING_APPROVAL)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_high_risk_pricing_dispute_intent(self, mock_send):
        """Inbound pricing or enterprise discount negotiation routes to approval queue."""
        inbound = self._create_inbound_message("Can we negotiate an enterprise quote discount for our 50-person team?")
        evaluate_ai_response_and_approval(inbound.id)

        mock_send.assert_not_called()

        approval = ApprovalQueue.objects.filter(message__conversation=self.conversation).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.intent, 'pricing_negotiation')
        self.assertGreaterEqual(approval.risk_score, 0.70)
        self.assertFalse(approval.is_resolved)

        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_PENDING_APPROVAL)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_high_risk_human_handoff_intent(self, mock_send):
        """Inbound demand to speak to human supervisor routes to approval queue."""
        inbound = self._create_inbound_message("I need to speak to a real person and manager right now.")
        evaluate_ai_response_and_approval(inbound.id)

        mock_send.assert_not_called()

        approval = ApprovalQueue.objects.filter(message__conversation=self.conversation).first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.intent, 'human_handoff')
        self.assertGreaterEqual(approval.risk_score, 0.75)
        self.assertFalse(approval.is_resolved)

        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_PENDING_APPROVAL)

    # ------------------ Low-Risk Test Cases ------------------

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_low_risk_greeting_auto_reply(self, mock_send):
        """Inbound greeting generates instant auto-reply without creating approval queue entry."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.autoreply_greeting_001"}]
        }

        inbound = self._create_inbound_message("Hello, good morning!")
        evaluate_ai_response_and_approval(inbound.id)

        # Meta API was called for the auto-reply
        mock_send.assert_called_once()

        # ApprovalQueue must remain empty
        self.assertEqual(ApprovalQueue.objects.filter(message__conversation=self.conversation).count(), 0)

        # Conversation remains OPEN
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_OPEN)

        # Outbound message recorded as SENT
        outbound = Message.objects.filter(conversation=self.conversation, direction=Message.DIR_OUTBOUND).first()
        self.assertIsNotNone(outbound)
        self.assertEqual(outbound.status, Message.STATUS_SENT)
        self.assertEqual(outbound.meta_message_id, "wamid.autoreply_greeting_001")
        self.assertTrue(outbound.raw_payload.get('auto_replied'))

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_low_risk_faq_auto_reply(self, mock_send):
        """Inbound question about business hours generates instant auto-reply."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.autoreply_faq_002"}]
        }

        inbound = self._create_inbound_message("What are your business opening hours and location?")
        evaluate_ai_response_and_approval(inbound.id)

        mock_send.assert_called_once()
        self.assertEqual(ApprovalQueue.objects.filter(message__conversation=self.conversation).count(), 0)

        outbound = Message.objects.filter(conversation=self.conversation, direction=Message.DIR_OUTBOUND).first()
        self.assertIn("9:00 AM to 6:00 PM", outbound.content)
        self.assertEqual(outbound.status, Message.STATUS_SENT)

    @patch.object(WhatsAppCloudAPIClient, 'send_text_message')
    def test_low_risk_general_inquiry_auto_reply(self, mock_send):
        """General inquiry with low risk triggers auto-reply."""
        mock_send.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.autoreply_gen_003"}]
        }

        inbound = self._create_inbound_message("I would like to know how your product works.")
        evaluate_ai_response_and_approval(inbound.id)

        mock_send.assert_called_once()
        self.assertEqual(ApprovalQueue.objects.filter(message__conversation=self.conversation).count(), 0)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, Conversation.STATUS_OPEN)
