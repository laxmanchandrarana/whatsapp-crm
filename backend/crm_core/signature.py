import hmac
import hashlib
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def validate_hub_signature(payload_bytes: bytes, signature_header: str, app_secret: str = None) -> bool:
    """
    Validates the X-Hub-Signature-256 header sent by Meta WhatsApp Cloud API webhooks.
    Format of header: sha256=<hex_encoded_hmac>
    Uses timing-attack-safe comparison (hmac.compare_digest).
    """
    if not signature_header:
        logger.warning("Missing X-Hub-Signature-256 header in webhook request.")
        return False

    secret = app_secret or getattr(settings, 'WHATSAPP_APP_SECRET', '')
    if not secret:
        # In development/simulated mode, if app secret is not configured, log a warning
        if getattr(settings, 'DEBUG', False) and getattr(settings, 'WHATSAPP_SIMULATE_OUTBOUND', True):
            logger.info("DEBUG mode with empty WHATSAPP_APP_SECRET: bypassing signature validation.")
            return True
        logger.error("WHATSAPP_APP_SECRET is not configured.")
        return False

    parts = signature_header.split('=', 1)
    if len(parts) != 2 or parts[0].strip().lower() != 'sha256':
        logger.warning(f"Invalid X-Hub-Signature-256 header format: {signature_header}")
        return False

    expected_signature = parts[1].strip()
    mac = hmac.new(secret.encode('utf-8'), msg=payload_bytes, digestmod=hashlib.sha256)
    computed_signature = mac.hexdigest()

    return hmac.compare_digest(computed_signature, expected_signature)


def generate_hub_signature(payload_bytes: bytes, app_secret: str) -> str:
    """
    Utility helper for test suites or simulation to generate valid X-Hub-Signature-256 headers.
    """
    mac = hmac.new(app_secret.encode('utf-8'), msg=payload_bytes, digestmod=hashlib.sha256)
    return f"sha256={mac.hexdigest()}"
