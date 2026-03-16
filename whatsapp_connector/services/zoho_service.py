import logging
from typing import Dict, List, Optional, Tuple

import requests
from requests.exceptions import JSONDecodeError


class ZohoService:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        accounts_url: str,
        api_base: str,
        module: str,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token_value = refresh_token
        self.accounts_url = accounts_url.rstrip("/")
        self.api_base = api_base.rstrip("/")
        self.module = module
        self.access_token: Optional[str] = None

    def refresh_access_token(self) -> str:
        url = f"{self.accounts_url}/oauth/v2/token"
        payload = {
            "refresh_token": self.refresh_token_value,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token",
        }
        response = requests.post(url, data=payload, timeout=20)
        response.raise_for_status()
        data = response.json()
        token = data.get("access_token")
        if not token:
            raise RuntimeError(f"Zoho token refresh failed: {data}")
        self.access_token = token
        return token

    def _headers(self) -> dict:
        if not self.access_token:
            self.refresh_access_token()
        return {
            "Authorization": f"Zoho-oauthtoken {self.access_token}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        headers = kwargs.pop("headers", {})
        merged_headers = {**self._headers(), **headers}
        response = requests.request(method, url, headers=merged_headers, timeout=20, **kwargs)

        if response.status_code == 401:
            self.refresh_access_token()
            merged_headers = {**self._headers(), **headers}
            response = requests.request(method, url, headers=merged_headers, timeout=20, **kwargs)

        response.raise_for_status()
        return response

    def _safe_json(self, response: requests.Response, context: str) -> Dict:
        if not response.text or not response.text.strip():
            logging.info("Zoho returned empty body for %s with status %s", context, response.status_code)
            return {}

        try:
            return response.json()
        except JSONDecodeError:
            snippet = response.text[:300].replace("\n", " ").replace("\r", " ")
            logging.error(
                "Zoho returned non-JSON response for %s. status=%s body=%s",
                context,
                response.status_code,
                snippet,
            )
            return {}

    def search_lead_by_phone(self, phone: str) -> Optional[Tuple[str, dict]]:
        fields_to_try = ["Phone", "Mobile", "WhatsApp_Number"]

        for field in fields_to_try:
            criteria = f"({field}:equals:{phone})"
            url = f"{self.api_base}/crm/v2/{self.module}/search"
            try:
                response = self._request("GET", url, params={"criteria": criteria})
                data = self._safe_json(response, f"search_lead_by_phone:{field}:{phone}").get("data", [])
                if data:
                    lead = data[0]
                    return lead.get("id"), lead
            except requests.HTTPError as exc:
                if exc.response is not None and exc.response.status_code in (400, 404):
                    continue
                logging.exception("Zoho lead search error for %s using %s", phone, field)
                break
            except Exception:
                logging.exception("Zoho lead search failed for %s", phone)
                break

        return None

    def search_leads_by_tag(self, tag_name: str, page: int = 1, per_page: int = 200) -> List[Dict]:
        url = f"{self.api_base}/crm/v2/{self.module}/search"
        criteria = f"(Tag:equals:{tag_name})"
        try:
            response = self._request(
                "GET",
                url,
                params={"criteria": criteria, "page": page, "per_page": per_page},
            )
            return self._safe_json(
                response,
                f"search_leads_by_tag:{tag_name}:page={page}",
            ).get("data", []) or []
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code in (400, 404):
                return []
            logging.exception("Failed to search leads by tag %s", tag_name)
            return []
        except Exception:
            logging.exception("Failed to search leads by tag %s", tag_name)
            return []

    def update_lead_status(self, lead_id: str, status: str, timestamp: str) -> bool:
        url = f"{self.api_base}/crm/v2/{self.module}"
        payload = {
            "data": [
                {
                    "id": lead_id,
                    "WhatsApp_Status": status,
                    "WhatsApp_Last_Update": timestamp,
                }
            ]
        }
        try:
            self._request("PUT", url, json=payload)
            return True
        except Exception:
            logging.exception("Failed to update lead %s status to %s", lead_id, status)
            return False

    def add_note(self, lead_id: str, message: str) -> bool:
        url = f"{self.api_base}/crm/v2/Notes"
        payload = {
            "data": [
                {
                    "Parent_Id": {"id": lead_id},
                    "Note_Title": "WhatsApp Update",
                    "Note_Content": message,
                    "$se_module": self.module,
                }
            ]
        }
        try:
            self._request("POST", url, json=payload)
            return True
        except Exception:
            logging.exception("Failed to add note for lead %s", lead_id)
            return False
