import uuid
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

class WhatsAppCloudAPIClient:
    """
    Wrapper for Meta WhatsApp Business Cloud API.
    Supports simulated local responses for development/offline environments
    as well as live Meta Graph API calls.
    """
    def __init__(self):
        self.api_token = getattr(settings, 'WHATSAPP_API_TOKEN', '')
        self.phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
        self.business_account_id = getattr(settings, 'WHATSAPP_BUSINESS_ACCOUNT_ID', '')
        self.api_version = getattr(settings, 'WHATSAPP_API_VERSION', 'v20.0')
        self.simulate = getattr(settings, 'WHATSAPP_SIMULATE_OUTBOUND', True) or not self.api_token

        self.base_url = f"https://graph.facebook.com/{self.api_version}"
        self.messages_url = f"{self.base_url}/{self.phone_number_id}/messages"

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def _get_headers(self):
        return self._headers()

    def send_text_message(self, recipient_phone: str, text_body: str = None, text: str = None, preview_url: bool = False):
        body_content = text_body if text_body is not None else (text or '')
        if self.simulate:
            simulated_id = f"wamid.HBgL{uuid.uuid4().hex[:12].upper()}"
            logger.info(f"[SIMULATED OUTBOUND] Sent to {recipient_phone}: '{body_content}' -> {simulated_id}")
            return {
                "messaging_product": "whatsapp",
                "simulated": True,
                "contacts": [{"input": recipient_phone, "wa_id": recipient_phone.replace('+', '')}],
                "messages": [{"id": simulated_id}]
            }

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": body_content,
            }
        }
        res = requests.post(self.messages_url, headers=self._headers(), json=payload, timeout=10)
        res.raise_for_status()
        return res.json()

    def send_template_message(self, recipient_phone: str, template_name: str, language_code: str = "en_US", components: list = None):
        if self.simulate:
            simulated_id = f"wamid.HBgL{uuid.uuid4().hex[:12].upper()}"
            logger.info(f"[SIMULATED TEMPLATE] Sent {template_name} to {recipient_phone} -> {simulated_id}")
            return {
                "messaging_product": "whatsapp",
                "simulated": True,
                "contacts": [{"input": recipient_phone, "wa_id": recipient_phone.replace('+', '')}],
                "messages": [{"id": simulated_id}]
            }

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or []
            }
        }
        res = requests.post(self.messages_url, headers=self._headers(), json=payload, timeout=10)
        res.raise_for_status()
        return res.json()

    def create_template(self, name: str, category: str, language: str, components: list):
        """Submit a new template for Meta WhatsApp Business Account approval"""
        if self.simulate:
            tpl_id = f"tpl_{uuid.uuid4().hex[:10]}"
            logger.info(f"[SIMULATED CREATE TEMPLATE] Created template {name} ({category}) -> {tpl_id}")
            return {
                "id": tpl_id,
                "status": "APPROVED",
                "category": category
            }

        url = f"{self.base_url}/{self.business_account_id}/message_templates"
        payload = {
            "name": name,
            "category": category,
            "language": language,
            "components": components
        }
        res = requests.post(url, headers=self._headers(), json=payload, timeout=10)
        res.raise_for_status()
        return res.json()

    def fetch_templates_from_meta(self):
        """Fetch all message templates from Meta WhatsApp Business Account"""
        if self.simulate:
            return [
                {
                    "name": "seasonal_offer_discount",
                    "category": "MARKETING",
                    "language": "en_US",
                    "status": "APPROVED",
                    "components": [
                        {"type": "HEADER", "format": "TEXT", "text": "Exclusive 25% Off Summer Deal"},
                        {"type": "BODY", "text": "Hi {{1}}, upgrade your plan today with promo code {{2}} to save 25%!"},
                        {"type": "FOOTER", "text": "Reply STOP to unsubscribe"}
                    ]
                },
                {
                    "name": "appointment_reminder",
                    "category": "UTILITY",
                    "language": "en_US",
                    "status": "APPROVED",
                    "components": [
                        {"type": "BODY", "text": "Hi {{1}}, your consultation is scheduled for {{2}} at {{3}}. Confirm or reschedule?"},
                        {"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": "Confirm"}, {"type": "QUICK_REPLY", "text": "Reschedule"}]}
                    ]
                }
            ]

        url = f"{self.base_url}/{self.business_account_id}/message_templates"
        res = requests.get(url, headers=self._headers(), timeout=10)
        res.raise_for_status()
        data = res.json()
        return data.get('data', [])

    def mark_message_as_read(self, meta_message_id: str):
        if self.simulate:
            logger.info(f"[SIMULATED READ RECEIPT] Marked {meta_message_id} as READ")
            return {"success": True, "simulated": True}

        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": meta_message_id
        }
        res = requests.post(self.messages_url, headers=self._headers(), json=payload, timeout=10)
        res.raise_for_status()
        return res.json()
