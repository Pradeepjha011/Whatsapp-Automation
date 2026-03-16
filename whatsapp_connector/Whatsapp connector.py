import json
import logging
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request

from config import Config
from services.cache_store import JsonCache
from services.number_checker import NumberChecker
from services.whatsapp_service import WhatsAppService
from services.zoho_service import ZohoService


BASE_DIR = Path(__file__).resolve().parent


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")

    # Default Indian local mobile numbers to E.164 country code without the plus sign.
    if len(digits) == 10 and digits[0] in ("6", "7", "8", "9"):
        return f"91{digits}"

    if len(digits) == 12 and digits.startswith("91"):
        return digits

    return digits


def setup_logging() -> None:
    log_path = BASE_DIR / Config.LOG_FILE
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


def extract_message_payload(payload: Dict[str, Any]) -> Optional[Dict[str, str]]:
    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            if not messages:
                continue

            contacts = value.get("contacts", [])
            default_phone = contacts[0].get("wa_id", "") if contacts else ""

            msg = messages[0]
            phone = msg.get("from", default_phone)
            message_id = msg.get("id", "")
            text_obj = msg.get("text", {})
            text = text_obj.get("body", "")
            return {
                "phone": normalize_phone(phone),
                "message": text,
                "message_id": message_id,
            }
    return None


def extract_lead_phone(lead: Dict[str, Any]) -> str:
    return normalize_phone(
        str(lead.get("Mobile") or lead.get("Phone") or lead.get("WhatsApp_Number") or "")
    )


def extract_lead_name(lead: Dict[str, Any]) -> str:
    first_name = str(lead.get("First_Name") or "").strip()
    full_name = str(lead.get("Full_Name") or "").strip()
    last_name = str(lead.get("Last_Name") or "").strip()
    return first_name or full_name or last_name or "Doctor"


def create_app() -> Flask:
    setup_logging()
    app = Flask(__name__)

    sync_cache = JsonCache(str(BASE_DIR / Config.SYNC_CACHE_FILE))
    number_cache = JsonCache(str(BASE_DIR / Config.NUMBER_CACHE_FILE))

    zoho = ZohoService(
        client_id=Config.ZOHO_CLIENT_ID,
        client_secret=Config.ZOHO_CLIENT_SECRET,
        refresh_token=Config.ZOHO_REFRESH_TOKEN,
        accounts_url=Config.ZOHO_ACCOUNTS_URL,
        api_base=Config.ZOHO_API_BASE,
        module=Config.ZOHO_MODULE,
    )
    whatsapp = WhatsAppService(
        token=Config.WHATSAPP_TOKEN,
        phone_number_id=Config.PHONE_NUMBER_ID,
        api_version=Config.WHATSAPP_API_VERSION,
    )
    number_checker = NumberChecker(number_cache)

    stats = {
        "messages_sent": 0,
        "messages_received": 0,
        "last_activity_timestamp": None,
        "automation_last_scan_timestamp": None,
    }
    stats_lock = threading.Lock()

    def mark_activity(event: str) -> None:
        with stats_lock:
            stats["last_activity_timestamp"] = utc_now_iso()
        logging.info("Activity: %s", event)

    def increment_sent() -> None:
        with stats_lock:
            stats["messages_sent"] += 1
            stats["last_activity_timestamp"] = utc_now_iso()

    def increment_received() -> None:
        with stats_lock:
            stats["messages_received"] += 1
            stats["last_activity_timestamp"] = utc_now_iso()

    def mark_scan() -> None:
        with stats_lock:
            stats["automation_last_scan_timestamp"] = utc_now_iso()

    def process_tagged_lead(lead: Dict[str, Any]) -> None:
        lead_id = str(lead.get("id") or "").strip()
        phone = extract_lead_phone(lead)

        if not lead_id or not phone:
            return
        if not number_checker.check_number(phone):
            return

        existing = sync_cache.get(phone, {})
        if existing.get("first_template_sent"):
            return

        if not Config.WA_TEMPLATE_NAME:
            logging.warning("WA_TEMPLATE_NAME is empty; skipping tag automation send")
            return

        name = extract_lead_name(lead)
        body_parameters = [name] if Config.WA_TEMPLATE_USE_LEAD_NAME else None
        response = whatsapp.send_template_message(
            phone=phone,
            template_name=Config.WA_TEMPLATE_NAME,
            language_code=Config.WA_TEMPLATE_LANG,
            body_parameters=body_parameters,
        )

        message_id = response.get("messages", [{}])[0].get("id")
        timestamp = utc_now_iso()
        zoho.update_lead_status(lead_id, "Sent", timestamp)
        zoho.add_note(
            lead_id,
            f"WhatsApp template sent automatically for tag {Config.ZOHO_TRIGGER_TAG} to {name}.",
        )

        sync_cache.set(
            phone,
            {
                "lead_id": lead_id,
                "last_message_id": message_id,
                "last_status": "sent_template",
                "first_template_sent": True,
                "last_message_text": f"template:{Config.WA_TEMPLATE_NAME}",
                "last_update": timestamp,
            },
        )

        increment_sent()
        logging.info("Auto template sent to %s for lead %s", phone, lead_id)

    def tagged_lead_sync_loop() -> None:
        logging.info(
            "Starting tag sync loop: tag=%s interval=%ss",
            Config.ZOHO_TRIGGER_TAG,
            Config.TAG_SYNC_INTERVAL_SECONDS,
        )
        while True:
            try:
                page = 1
                while True:
                    leads = zoho.search_leads_by_tag(Config.ZOHO_TRIGGER_TAG, page=page, per_page=200)
                    if not leads:
                        break
                    for lead in leads:
                        try:
                            process_tagged_lead(lead)
                        except Exception:
                            logging.exception("Failed processing tagged lead")
                    if len(leads) < 200:
                        break
                    page += 1
                mark_scan()
            except Exception:
                logging.exception("Tag sync loop failure")
            time.sleep(max(Config.TAG_SYNC_INTERVAL_SECONDS, 10))

    sync_thread = threading.Thread(target=tagged_lead_sync_loop, name="zoho_tag_sync", daemon=True)
    sync_thread.start()

    @app.get("/health")
    def health():
        return jsonify({"status": "running"}), 200

    @app.get("/status")
    def status():
        with stats_lock:
            return jsonify(dict(stats)), 200

    @app.get("/webhook/whatsapp")
    def verify_webhook():
        mode = request.args.get("hub.mode")
        token = request.args.get("hub.verify_token")
        challenge = request.args.get("hub.challenge")

        if mode == "subscribe" and token == Config.META_VERIFY_TOKEN:
            return challenge or "", 200
        return jsonify({"error": "verification failed"}), 403

    @app.post("/webhook/whatsapp")
    def receive_webhook():
        payload = request.get_json(silent=True) or {}
        logging.info("Webhook payload: %s", json.dumps(payload))

        extracted = extract_message_payload(payload)
        if not extracted:
            return jsonify({"status": "ignored", "reason": "no message payload"}), 200

        phone = extracted["phone"]
        message = extracted["message"]
        message_id = extracted["message_id"]

        if not phone or not message_id:
            return jsonify({"status": "ignored", "reason": "missing phone or message_id"}), 200

        existing = sync_cache.get(phone, {})
        if existing.get("last_message_id") == message_id:
            return jsonify({"status": "duplicate_ignored"}), 200

        lead = zoho.search_lead_by_phone(phone)
        timestamp = utc_now_iso()

        if lead:
            lead_id, _lead_obj = lead
            zoho.update_lead_status(lead_id, "Replied", timestamp)
            zoho.add_note(lead_id, f"WhatsApp reply received: {message}")

        sync_cache.set(
            phone,
            {
                "last_message_id": message_id,
                "last_status": "replied",
                "last_message_text": message,
                "last_update": timestamp,
                "first_template_sent": existing.get("first_template_sent", False),
                "lead_id": existing.get("lead_id"),
            },
        )

        increment_received()
        mark_activity("incoming_message")
        return jsonify({"status": "processed", "phone": phone}), 200

    @app.post("/send")
    def send_message():
        body = request.get_json(silent=True) or {}
        phone = normalize_phone(str(body.get("phone", "")))
        message = str(body.get("message", "")).strip()

        if not phone or not message:
            return jsonify({"error": "phone and message are required"}), 400

        if not number_checker.check_number(phone):
            return jsonify({"error": "invalid_whatsapp_number"}), 400

        try:
            response = whatsapp.send_message(phone, message)
            message_id = (
                response.get("messages", [{}])[0].get("id") if isinstance(response, dict) else None
            )
            timestamp = utc_now_iso()

            lead = zoho.search_lead_by_phone(phone)
            if lead:
                lead_id, _lead_obj = lead
                zoho.update_lead_status(lead_id, "Sent", timestamp)
                zoho.add_note(lead_id, f"WhatsApp message sent: {message}")

            existing = sync_cache.get(phone, {})
            sync_cache.set(
                phone,
                {
                    "last_message_id": message_id,
                    "last_status": "sent",
                    "last_message_text": message,
                    "last_update": timestamp,
                    "first_template_sent": existing.get("first_template_sent", False),
                    "lead_id": existing.get("lead_id"),
                },
            )

            increment_sent()
            mark_activity("outgoing_message")
            logging.info("Sent WhatsApp message to %s: %s", phone, message)
            return jsonify({"status": "sent", "response": response}), 200
        except Exception:
            number_checker.mark_result(phone, valid=False)
            logging.exception("Failed to send WhatsApp message")
            return jsonify({"error": "send_failed"}), 502

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT)
