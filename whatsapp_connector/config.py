import os


class Config:
    HOST = os.getenv("CONNECTOR_HOST", "0.0.0.0")
    PORT = int(os.getenv("CONNECTOR_PORT", os.getenv("PORT", "8098")))

    META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "wa_verify_20260305_k9m2x7")
    WHATSAPP_TOKEN = os.getenv(
        "WHATSAPP_TOKEN",
        "EAAlkrNtzZAa8BRNNnZAvBGhsRW6SkF0rzP8ZAtptU4ZBAl8g1TD3UZBHZC9zP1WmYTC6dLvGez5ZCydIpKY9f1jjwcBj1BdqpusZAd0BHqYjHayRqxKyZCUVFDXHCOoqtLWFZA9gePHxZCtcLRWrdNxctCtzOQlsQhGfiljbuBzphkkwrE2IhEHuBSVvrjQn2pXWga46qEdahff0qb84Q5CdvmrocCRspVX9JqjEZBFG",
    )
<<<<<<< HEAD
    PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID", "1047973371731561")
=======
    PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID", "")
>>>>>>> 9e06e20cb8c0d10b3958ff8a291f745553584fbb
    WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v18.0")
    WA_TEMPLATE_NAME = os.getenv("WA_TEMPLATE_NAME", "q_temp")
    WA_TEMPLATE_LANG = os.getenv("WA_TEMPLATE_LANG", "en")
    WA_TEMPLATE_USE_LEAD_NAME = os.getenv("WA_TEMPLATE_USE_LEAD_NAME", "true").lower() == "true"

    ZOHO_CLIENT_ID = os.getenv("ZOHO_CLIENT_ID", "")
    ZOHO_CLIENT_SECRET = os.getenv(
        "ZOHO_CLIENT_SECRET",
        "",
    )
    ZOHO_REFRESH_TOKEN = os.getenv(
        "ZOHO_REFRESH_TOKEN",
        "",
    )
    ZOHO_ACCOUNTS_URL = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.in")
    ZOHO_API_BASE = os.getenv("ZOHO_API_BASE", "https://www.zohoapis.in")
    ZOHO_MODULE = os.getenv("ZOHO_MODULE", "Leads")
    ZOHO_TRIGGER_TAG = os.getenv("ZOHO_TRIGGER_TAG", "WA")
    TAG_SYNC_INTERVAL_SECONDS = int(os.getenv("TAG_SYNC_INTERVAL_SECONDS", "30"))

    LOG_FILE = os.getenv("LOG_FILE", "logs/whatsapp_sync.log")
    SYNC_CACHE_FILE = os.getenv("SYNC_CACHE_FILE", "cache/whatsapp_sync_cache.json")
    NUMBER_CACHE_FILE = os.getenv("NUMBER_CACHE_FILE", "cache/number_check_cache.json")
