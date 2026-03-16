import logging
from typing import Dict, List, Optional

import requests


class WhatsAppService:
    def __init__(self, token: str, phone_number_id: str, api_version: str = "v18.0"):
        self.token = token
        self.phone_number_id = phone_number_id
        self.api_version = api_version

    def send_message(self, phone: str, message: str) -> Dict:
        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": message},
        }

        response = requests.post(url, headers=headers, json=payload, timeout=20)
        if response.status_code >= 400:
            logging.error("WhatsApp send failed: %s", response.text)
        response.raise_for_status()
        return response.json()

    def send_template_message(
        self,
        phone: str,
        template_name: str,
        language_code: str = "en",
        body_parameters: Optional[List[str]] = None,
    ) -> Dict:
        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
            },
        }

        params = body_parameters or []
        if params:
            payload["template"]["components"] = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": p} for p in params],
                }
            ]

        response = requests.post(url, headers=headers, json=payload, timeout=20)
        if response.status_code >= 400:
            logging.error("WhatsApp template send failed: %s", response.text)
        response.raise_for_status()
        return response.json()
