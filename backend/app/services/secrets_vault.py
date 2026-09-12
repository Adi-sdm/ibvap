"""
Secrets Vault Service
Manages credentials securely with dual-layer machine-bound Fernet encryption.
Persists across restarts in both SQLite SystemConfigDB and restricted local store.
Never exposes plaintext keys over API endpoints or logs.
"""

import os
import json
import base64
import hashlib
import platform
from pathlib import Path
from typing import Optional
from cryptography.fernet import Fernet

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SECRETS_FILE = PROJECT_ROOT / "database" / ".secrets.json"

class SecretsVault:
    def __init__(self, secrets_path: Path = SECRETS_FILE):
        self.secrets_path = secrets_path
        self._fernet = self._init_fernet()
        self._ensure_file()

    def _init_fernet(self) -> Fernet:
        # Machine-bound deterministic encryption key
        machine_seed = f"{platform.node()}_{os.environ.get('USERNAME', 'default')}_IBVAP_SIH26187_VAULT_KEY"
        key_digest = hashlib.sha256(machine_seed.encode("utf-8")).digest()
        fernet_key = base64.urlsafe_b64encode(key_digest)
        return Fernet(fernet_key)

    def _encrypt(self, plaintext: str) -> str:
        if not plaintext:
            return ""
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def _decrypt(self, ciphertext: str) -> Optional[str]:
        if not ciphertext:
            return None
        try:
            return self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except Exception:
            # Fallback: in case plaintext was stored before encryption migration
            return ciphertext

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

        # 2. Check local encrypted secrets file
        secrets = self._read_secrets()
        raw_key = secrets.get("gemini_api_key_enc") or secrets.get("gemini_api_key")
        decrypted_key = None
        if raw_key:
            decrypted_key = self._decrypt(raw_key)

        # 3. Check SQLite SystemConfigDB (dual persistence)
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import SystemConfigDB
            db = SessionLocal()
            try:
                cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_api_key_enc").first()
                if cfg and cfg.value:
                    sql_key = self._decrypt(cfg.value)
                    if sql_key:
                        decrypted_key = sql_key
                        # Heal local file if missing
                        if not raw_key:
                            secrets["gemini_api_key_enc"] = cfg.value
                            self._write_secrets(secrets)
            finally:
                db.close()
        except Exception:
            pass

        return decrypted_key

    def set_gemini_api_key(self, api_key: str):
        cleaned = api_key.strip()
        if not cleaned:
            return

        encrypted = self._encrypt(cleaned)

        # 1. Write to local encrypted secrets file
        secrets = self._read_secrets()
        secrets["gemini_api_key_enc"] = encrypted
        if "gemini_api_key" in secrets:
            del secrets["gemini_api_key"]
        self._write_secrets(secrets)

        # 2. Write to SQLite SystemConfigDB for dual-layer persistence
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import SystemConfigDB
            db = SessionLocal()
            try:
                cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_api_key_enc").first()
                if not cfg:
                    cfg = SystemConfigDB(key="gemini_api_key_enc", value=encrypted)
                    db.add(cfg)
                else:
                    cfg.value = encrypted
                db.commit()
            finally:
                db.close()
        except Exception as ex:
            print(f"[SecretsVault] Error persisting to SQLite: {ex}")

    def delete_gemini_api_key(self):
        secrets = self._read_secrets()
        if "gemini_api_key_enc" in secrets or "gemini_api_key" in secrets:
            secrets.pop("gemini_api_key_enc", None)
            secrets.pop("gemini_api_key", None)
            self._write_secrets(secrets)

        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import SystemConfigDB
            db = SessionLocal()
            try:
                cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_api_key_enc").first()
                if cfg:
                    db.delete(cfg)
                    db.commit()
            finally:
                db.close()
        except Exception:
            pass

    def is_gemini_configured(self) -> bool:
        key = self.get_gemini_api_key()
        return bool(key and len(key) >= 10)

    def get_masked_gemini_key(self) -> Optional[str]:
        key = self.get_gemini_api_key()
        if not key:
            return None
        if len(key) <= 8:
            return "••••••••"
        return f"••••••••••••{key[-4:]}"

secrets_vault = SecretsVault()
