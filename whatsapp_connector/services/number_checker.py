from datetime import datetime, timezone
from typing import Dict


class NumberChecker:
    def __init__(self, cache):
        self.cache = cache

    def check_number(self, phone: str) -> bool:
        entry: Dict = self.cache.get(phone, {})
        if "valid" in entry:
            return bool(entry["valid"])

        self.cache.set(
            phone,
            {
                "valid": True,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return True

    def mark_result(self, phone: str, valid: bool) -> None:
        self.cache.set(
            phone,
            {
                "valid": bool(valid),
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )
