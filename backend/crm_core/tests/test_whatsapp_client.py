from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from crm_core.whatsapp_client import WhatsAppCloudAPIClient

class WhatsAppCloudAPIClientTests(TestCase):
    """
    Unit test coverage for WhatsAppCloudAPIClient in simulated and live HTTP modes.
    """
    def setUp(self):
        self.client = WhatsAppCloudAPIClient()

    def test_headers_structure(self):
        """Verifies Authorization and Content-Type headers."""
        headers = self.client._headers()
        self.assertIn("Authorization", headers)
        self.assertEqual(headers["Content-Type"], "application/json")

    def test_send_text_message_simulated(self):
        """Simulated mode generates mock WAMID without network call."""
        res = self.client.send_text_message("+15551234567", "Hello Simulation")
        self.assertTrue(res.get("simulated"))
        self.assertEqual(res["messaging_product"], "whatsapp")
        self.assertTrue(res["messages"][0]["id"].startswith("wamid.HBgL"))

    def test_send_template_message_simulated(self):
        """Simulated template sending returns mock WAMID."""
        res = self.client.send_template_message(
            "+15551234567",
            template_name="welcome_coupon",
            language_code="en_US"
        )
        self.assertTrue(res.get("simulated"))
        self.assertTrue(res["messages"][0]["id"].startswith("wamid.HBgL"))

    def test_mark_message_as_read_simulated(self):
        """Simulated mark read returns success."""
        res = self.client.mark_message_as_read("wamid.mock_12345")
        self.assertTrue(res.get("simulated"))
        self.assertTrue(res.get("success"))

    @override_settings(WHATSAPP_SIMULATE_OUTBOUND=False)
    @patch("requests.post")
    def test_send_text_message_live_http(self, mock_post):
        """Live HTTP mode posts to Meta Graph API endpoint."""
        live_client = WhatsAppCloudAPIClient()
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.live_meta_987"}]
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        res = live_client.send_text_message("+15551234567", "Live message")
        self.assertEqual(res["messages"][0]["id"], "wamid.live_meta_987")
        mock_post.assert_called_once()

    @override_settings(WHATSAPP_SIMULATE_OUTBOUND=False)
    @patch("requests.post")
    def test_send_template_message_live_http(self, mock_post):
        """Live HTTP template message posts to Meta Graph API endpoint."""
        live_client = WhatsAppCloudAPIClient()
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "messaging_product": "whatsapp",
            "messages": [{"id": "wamid.live_template_654"}]
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        res = live_client.send_template_message(
            "+15551234567",
            template_name="seasonal_promo",
            language_code="en_US"
        )
        self.assertEqual(res["messages"][0]["id"], "wamid.live_template_654")
        mock_post.assert_called_once()

    @override_settings(WHATSAPP_SIMULATE_OUTBOUND=False)
    @patch("requests.post")
    def test_mark_message_as_read_live_http(self, mock_post):
        """Live HTTP mark read posts to Meta messages endpoint."""
        live_client = WhatsAppCloudAPIClient()
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        res = live_client.mark_message_as_read("wamid.inbound_999")
        self.assertTrue(res["success"])
        mock_post.assert_called_once()
