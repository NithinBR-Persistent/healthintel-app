from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field


def load_backend_env_file() -> None:
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


load_backend_env_file()


def default_database_path() -> Path:
    configured_path = os.getenv("HEALTHINTEL_DB_PATH")
    if configured_path:
        return Path(configured_path)

    backend_root = Path(__file__).resolve().parents[3]
    return backend_root / "data" / "healthintel.sqlite3"


class Settings(BaseModel):
    app_name: str = "HealthIntel API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api"
    database_path: Path = Field(default_factory=default_database_path)
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:3001",
        ]
    )


settings = Settings()
