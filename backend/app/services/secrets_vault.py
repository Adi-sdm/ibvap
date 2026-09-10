"""
Secrets Vault Service
Manages credentials securely without storing plaintext keys in SQLite tables.
Prioritizes environment variables and falls back to a restricted local secrets store.
Never exposes plaintext keys over API endpoints.
"""

import os
import json
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SECRETS_FILE = PROJECT_ROOT / "database" / ".secrets.json"

class SecretsVault:
    def __init__(self, secrets_path: Path = SECRETS_FILE):
        self.secrets_path = secrets_path
        self._ensure_file()

    def _ensure_file(self):
        if not self.secrets_path.parent.exists():
            self.secrets_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.secrets_path.exists():
            try:
                with open(self.secrets_path, "w", encoding="utf-8") as f:
                    json.dump({}, f)
            except Exception as e:
                print(f"[SecretsVault] Error initializing secrets file: {e}")

    def _read_secrets(self) -> dict:
        if not self.secrets_path.exists():
            return {}
        try:
            with open(self.secrets_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_secrets(self, data: dict):
        self._ensure_file()
        try:
            with open(self.secrets_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[SecretsVault] Error writing secrets: {e}")

    def get_gemini_api_key(self) -> Optional[str]:
        # 1. Environment variable priority
        env_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if env_key:
            return env_key
        # 2. Local secrets file
        secrets = self._read_secrets()
        return secrets.get("gemini_api_key")

    def set_gemini_api_key(self, api_key: str):
        cleaned = api_key.strip()
        secrets = self._read_secrets()
        secrets["gemini_api_key"] = cleaned
        self._write_secrets(secrets)

    def delete_gemini_api_key(self):
        secrets = self._read_secrets()
        if "gemini_api_key" in secrets:
            del secrets["gemini_api_key"]
            self._write_secrets(secrets)

    def is_gemini_configured(self) -> bool:
        key = self.get_gemini_api_key()
        return bool(key and len(key) >= 10)

    def get_masked_gemini_key(self) -> Optional[str]:
        key = self.get_gemini_api_key()
        if not key:
            return None
        if len(key) <= 8:
            return "••••••••"
        return f"{key[:6]}••••••••{key[-4:]}"

secrets_vault = SecretsVault()
