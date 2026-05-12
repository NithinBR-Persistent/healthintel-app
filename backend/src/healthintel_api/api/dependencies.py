from __future__ import annotations

from healthintel_api.core.config import settings
from healthintel_api.repositories.appeals import AppealRepository
from healthintel_api.services.appeals import AppealService

_service: AppealService | None = None


def get_appeal_service() -> AppealService:
    global _service

    if _service is None:
        _service = AppealService(AppealRepository(settings.database_path))

    return _service
