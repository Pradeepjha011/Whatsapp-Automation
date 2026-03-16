import json
import logging
from pathlib import Path
from threading import Lock
from typing import Any, Dict


class JsonCache:
    def __init__(self, path: str):
        self.path = Path(path)
        self.lock = Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text("{}", encoding="utf-8")
        self._data = self._load()

    def _load(self) -> Dict[str, Any]:
        try:
            content = self.path.read_text(encoding="utf-8-sig").strip()
            return json.loads(content) if content else {}
        except Exception:
            logging.exception("Failed to load cache %s. Reinitializing.", self.path)
            return {}

    def save(self) -> None:
        with self.lock:
            tmp_path = self.path.with_suffix(self.path.suffix + ".tmp")
            tmp_path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
            tmp_path.replace(self.path)

    def get(self, key: str, default: Any = None) -> Any:
        with self.lock:
            return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        with self.lock:
            self._data[key] = value
        self.save()

    def all(self) -> Dict[str, Any]:
        with self.lock:
            return dict(self._data)
