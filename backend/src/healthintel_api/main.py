from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from healthintel_api.api.dependencies import get_appeal_service
from healthintel_api.api.routes import router
from healthintel_api.core.config import settings
from healthintel_api.services.appeals import AppealService


def create_app(appeal_service: AppealService | None = None) -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Backend API for the HealthIntel appeals prototype.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix=settings.api_prefix)

    if appeal_service is not None:
        app.dependency_overrides[get_appeal_service] = lambda: appeal_service

    return app


app = create_app()
