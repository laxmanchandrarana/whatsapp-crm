import json
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.urls import reverse
from django.conf import settings
from crm_core.models import Contact, Conversation, Message
from crm_core.signature import generate_hub_signature, validate_hub_signature
from crm_core.tasks import process_webhook_payload

class WebhookHandshakeTests(TestCase):
    """
    Test suite covering Meta WhatsApp Webhook handshake verification:
    hub.mode, hub.verify_token, hub.challenge, and 403 on invalid tokens/modes.
    """
    def setUp(self):
        self.verify_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'openmausbot_crm_verify_token_secure')
        self.url = reverse('whatsapp-webhook')

    def test_handshake_success(self):
        """Valid subscribe mode and matching verify token returns 200 with challenge."""
        response = self.client.get(self.url, {
            'hub.mode': 'subscribe',
            'hub.verify_token': self.verify_token,
            'hub.challenge': 'CHALLENGE_ACCEPTED_XYZ_123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode(), 'CHALLENGE_ACCEPTED_XYZ_123')
        self.assertEqual(response['Content-Type'], 'text/plain')

    def test_handshake_invalid_token(self):
        """Incorrect verify token returns 403 Forbidden."""
        response = self.client.get(self.url, {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'completely_wrong_token',
            'hub.challenge': 'CHALLENGE_FAIL'
        })
        self.assertEqual(response.status_code, 403)
        self.assertIn('Verification token mismatch', response.content.decode())

    def test_handshake_missing_verify_token(self):
        """Missing hub.verify_token parameter returns 403 Forbidden."""
        response = self.client.get(self.url, {
            'hub.mode': 'subscribe',
            'hub.challenge': 'CHALLENGE_FAIL'
        })
        self.assertEqual(response.status_code, 403)

    def test_handshake_invalid_mode(self):
        """hub.mode not equal to 'subscribe' returns 403 Forbidden."""
        response = self.client.get(self.url, {
            'hub.mode': 'unsubscribe',
            'hub.verify_token': self.verify_token,
            'hub.challenge': 'CHALLENGE_FAIL'
        })
        self.assertEqual(response.status_code, 403)

    def test_handshake_missing_mode(self):
        """Missing hub.mode parameter returns 403 Forbidden."""
        response = self.client.get(self.url, {
            'hub.verify_token': self.verify_token,
            'hub.challenge': 'CHALLENGE_FAIL'
        })
        self.assertEqual(response.status_code, 403)

    def test_handshake_empty_token(self):
        """Empty string token returns 403 Forbidden."""
        response = self.client.get(self.url, {
            'hub.mode': 'subscribe',
            'hub.verify_token': '',
            'hub.challenge': 'CHALLENGE_FAIL'
        })
        self.assertEqual(response.status_code, 403)


class SignatureVerificationTests(TestCase):
    """
    Test suite for HMAC SHA-256 signature calculation and validation (X-Hub-Signature-256).
    """
    def setUp(self):
        self.app_secret = "test_meta_app_secret_abc123"
        self.payload = b'{"object": "whatsapp_business_account", "entry": []}'

    def test_signature_validation_success(self):
        """Valid HMAC SHA-256 signature passes validation."""
        sig_header = generate_hub_signature(self.payload, self.app_secret)
        self.assertTrue(validate_hub_signature(self.payload, sig_header, self.app_secret))

    def test_signature_validation_tampered_payload(self):
        """Tampering with payload after signature generation must fail validation."""
        sig_header = generate_hub_signature(self.payload, self.app_secret)
        tampered_payload = b'{"object": "whatsapp_business_account", "entry": [{"tampered": true}]}'
        self.assertFalse(validate_hub_signature(tampered_payload, sig_header, self.app_secret))

    def test_signature_validation_missing_header(self):
        """Missing or empty signature header fails validation."""
        self.assertFalse(validate_hub_signature(self.payload, "", self.app_secret))
        self.assertFalse(validate_hub_signature(self.payload, None, self.app_secret))

    def test_signature_validation_malformed_header(self):
        """Header without sha256= prefix or wrong format fails validation."""
        self.assertFalse(validate_hub_signature(self.payload, "invalid_header", self.app_secret))
        self.assertFalse(validate_hub_signature(self.payload, "sha1=abcdef123456", self.app_secret))
        self.assertFalse(validate_hub_signature(self.payload, "md5=abcdef123456", self.app_secret))
        self.assertFalse(validate_hub_signature(self.payload, "sha256:", self.app_secret))

    def test_signature_validation_wrong_secret(self):
        """Valid signature generated with another secret fails validation."""
        sig_header = generate_hub_signature(self.payload, "wrong_secret_key")
        self.assertFalse(validate_hub_signature(self.payload, sig_header, self.app_secret))


@override_settings(WHATSAPP_APP_SECRET="test_meta_app_secret_12345", CELERY_TASK_ALWAYS_EAGER=True)
class WebhookIngestionIntegrationTests(TestCase):
    """
    Integration tests for WhatsApp webhook POST requests including HTTP status codes,
    signature enforcement, and payload parsing.
    """
    def setUp(self):
        self.url = reverse('whatsapp-webhook')
        self.app_secret = "test_meta_app_secret_12345"

    def _post_signed(self, payload_dict, signature=None):
        body = json.dumps(payload_dict).encode('utf-8')
        sig = signature if signature is not None else generate_hub_signature(body, self.app_secret)
        headers = {}
        if sig != '':
            headers['HTTP_X_HUB_SIGNATURE_256'] = sig
        return self.client.post(
            self.url,
            data=body,
            content_type='application/json',
            **headers
        )

    def test_post_with_valid_signature_succeeds(self):
        """POST with valid signature returns 200 EVENT_RECEIVED."""
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"display_phone_number": "12345", "phone_number_id": "test_id"},
                        "contacts": [{"profile": {"name": "Charlie Test"}, "wa_id": "15552223333"}],
                        "messages": [{
                            "from": "15552223333",
                            "id": "wamid.charlie_001",
                            "timestamp": "1700000000",
                            "text": {"body": "Hello CRM!"},
                            "type": "text"
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        response = self._post_signed(payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'EVENT_RECEIVED'})

        # Verify message created in DB
        msg = Message.objects.filter(meta_message_id="wamid.charlie_001").first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.content, "Hello CRM!")
        self.assertEqual(msg.conversation.contact.phone_number, "15552223333")

    def test_post_missing_signature_returns_401(self):
        """POST without X-Hub-Signature-256 header returns 401 Unauthorized."""
        payload = {"object": "whatsapp_business_account", "entry": []}
        body = json.dumps(payload).encode('utf-8')
        response = self.client.post(self.url, data=body, content_type='application/json')
        self.assertEqual(response.status_code, 401)
        self.assertIn('Invalid signature', response.json().get('error', ''))

    def test_post_tampered_payload_returns_401(self):
        """POST with mismatched signature returns 401 Unauthorized."""
        payload = {"object": "whatsapp_business_account", "entry": []}
        body = json.dumps(payload).encode('utf-8')
        tampered_sig = "sha256=0000000000000000000000000000000000000000000000000000000000000000"
        response = self.client.post(
            self.url,
            data=body,
            content_type='application/json',
            HTTP_X_HUB_SIGNATURE_256=tampered_sig
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn('Invalid signature', response.json().get('error', ''))

    def test_post_malformed_signature_prefix_returns_401(self):
        """POST with signature missing sha256= prefix returns 401."""
        payload = {"object": "whatsapp_business_account", "entry": []}
        body = json.dumps(payload).encode('utf-8')
        response = self.client.post(
            self.url,
            data=body,
            content_type='application/json',
            HTTP_X_HUB_SIGNATURE_256="bad_prefix_12345"
        )
        self.assertEqual(response.status_code, 401)

    def test_post_malformed_json_returns_400(self):
        """POST with non-JSON body returns 400 Bad Request."""
        invalid_body = b"Not a JSON string at all {"
        sig = generate_hub_signature(invalid_body, self.app_secret)
        response = self.client.post(
            self.url,
            data=invalid_body,
            content_type='application/json',
            HTTP_X_HUB_SIGNATURE_256=sig
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Malformed JSON', response.json().get('error', ''))

    def test_message_deduplication(self):
        """Ingesting the same Meta message ID twice does not create duplicate records."""
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"display_phone_number": "12345", "phone_number_id": "test_id"},
                        "contacts": [{"profile": {"name": "Dedup User"}, "wa_id": "15553334444"}],
                        "messages": [{
                            "from": "15553334444",
                            "id": "wamid.unique_id_dedup",
                            "timestamp": "1700000000",
                            "text": {"body": "First ingestion"},
                            "type": "text"
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        res1 = self._post_signed(payload)
        self.assertEqual(res1.status_code, 200)

        # Send same payload second time
        res2 = self._post_signed(payload)
        self.assertEqual(res2.status_code, 200)

        count = Message.objects.filter(meta_message_id="wamid.unique_id_dedup").count()
        self.assertEqual(count, 1)

    def test_delivery_and_read_status_updates(self):
        """Statuses array in webhook payload updates message status to DELIVERED and READ."""
        contact = Contact.objects.create(phone_number="+15554445555", name="Status User")
        conv = Conversation.objects.create(contact=contact, status=Conversation.STATUS_OPEN)
        outbound = Message.objects.create(
            conversation=conv,
            direction=Message.DIR_OUTBOUND,
            content="Tracking delivery status",
            status=Message.STATUS_SENT,
            meta_message_id="wamid.status_test_999"
        )

        # Ingest delivery receipt
        delivered_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "statuses": [{
                            "id": "wamid.status_test_999",
                            "status": "delivered",
                            "timestamp": "1700000050",
                            "recipient_id": "15554445555"
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        res_del = self._post_signed(delivered_payload)
        self.assertEqual(res_del.status_code, 200)
        outbound.refresh_from_db()
        self.assertEqual(outbound.status, Message.STATUS_DELIVERED)

        # Ingest read receipt
        read_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "statuses": [{
                            "id": "wamid.status_test_999",
                            "status": "read",
                            "timestamp": "1700000090",
                            "recipient_id": "15554445555"
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        res_read = self._post_signed(read_payload)
        self.assertEqual(res_read.status_code, 200)
        outbound.refresh_from_db()
        self.assertEqual(outbound.status, Message.STATUS_READ)

    def test_interactive_and_media_message_ingestion(self):
        """Webhook ingests button_reply and image messages properly."""
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "123456",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"display_phone_number": "12345", "phone_number_id": "test_id"},
                        "contacts": [{"profile": {"name": "Button Clicker"}, "wa_id": "15556667777"}],
                        "messages": [
                            {
                                "from": "15556667777",
                                "id": "wamid.interactive_001",
                                "timestamp": "1700000100",
                                "type": "interactive",
                                "interactive": {
                                    "type": "button_reply",
                                    "button_reply": {"id": "btn_yes", "title": "Confirm Order"}
                                }
                            },
                            {
                                "from": "15556667777",
                                "id": "wamid.image_002",
                                "timestamp": "1700000105",
                                "type": "image",
                                "image": {"caption": "Receipt photo", "id": "img_999"}
                            }
                        ]
                    },
                    "field": "messages"
                }]
            }]
        }
        res = self._post_signed(payload)
        self.assertEqual(res.status_code, 200)

        msg_btn = Message.objects.get(meta_message_id="wamid.interactive_001")
        self.assertEqual(msg_btn.content, "Confirm Order")

        msg_img = Message.objects.get(meta_message_id="wamid.image_002")
        self.assertIn("Receipt photo", msg_img.content)
        self.assertEqual(msg_img.message_type, Message.TYPE_IMAGE)
