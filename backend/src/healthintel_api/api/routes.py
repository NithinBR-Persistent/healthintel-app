from __future__ import annotations

from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from healthintel_api import __version__
from healthintel_api.api.dependencies import get_appeal_service
from healthintel_api.core.config import settings
from healthintel_api.domain.models import (
    AppealCase,
    AppealDocumentUploadRequest,
    CreateAppealRequest,
    HealthResponse,
    MemberAppealStatusResponse,
    MemberAppealSubmissionRequest,
    MemberAppealSubmissionResponse,
    ReviewerActionRequest,
    Urgency,
)
from healthintel_api.services.appeals import AppealNotFoundError, AppealService
from healthintel_api.services.documents import extract_document_text
from healthintel_api.services.email import list_outbox_emails

router = APIRouter()
AppealServiceDep = Annotated[AppealService, Depends(get_appeal_service)]


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=__version__,
    )


@router.get("/outbox", tags=["system"])
def list_outbox() -> list[dict[str, str]]:
    return [
        {
            "id": email.id,
            "appealId": email.appeal_id,
            "trackingId": email.tracking_id,
            "to": email.to,
            "fromEmail": email.from_email,
            "subject": email.subject,
            "status": email.status,
            "body": email.body,
        }
        for email in list_outbox_emails()
    ]


@router.get("/appeals", response_model=list[AppealCase], tags=["appeals"])
def list_appeals(
    service: AppealServiceDep,
) -> list[AppealCase]:
    return service.list_appeals()


@router.post(
    "/appeals",
    response_model=AppealCase,
    status_code=status.HTTP_201_CREATED,
    tags=["appeals"],
)
def create_appeal(
    payload: CreateAppealRequest,
    service: AppealServiceDep,
) -> AppealCase:
    return service.create_appeal(payload)


@router.post(
    "/member/appeals",
    response_model=MemberAppealSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["member"],
)
async def submit_member_appeal(
    service: AppealServiceDep,
    file: Annotated[UploadFile, File()],
    member: Annotated[str, Form()],
    age: Annotated[int, Form()],
    policy_number: Annotated[str, Form(alias="policyNumber")],
    member_email: Annotated[str, Form(alias="memberEmail")],
    plan: Annotated[str, Form()],
    provider: Annotated[str, Form()],
    service_requested: Annotated[str, Form(alias="service")],
    appeal_type: Annotated[str, Form(alias="appealType")],
    urgency: Annotated[Urgency, Form()],
    denial_reason: Annotated[str, Form(alias="denialReason")],
    appeal_argument: Annotated[str, Form(alias="appealArgument")],
) -> MemberAppealSubmissionResponse:
    appeal, response = service.create_member_appeal(
        MemberAppealSubmissionRequest(
            member=member,
            age=age,
            policy_number=policy_number,
            member_email=member_email,
            plan=plan,
            provider=provider,
            service=service_requested,
            appeal_type=appeal_type,
            urgency=urgency,
            denial_reason=denial_reason,
            appeal_argument=appeal_argument,
        )
    )
    content = await file.read()
    file_name = file.filename or "member-appeal-packet.pdf"
    content_type = file.content_type or "application/octet-stream"
    extracted_text = extract_document_text(
        file_name=file_name,
        content_type=content_type,
        content=content,
    )
    service.upload_document(
        appeal.id,
        AppealDocumentUploadRequest(
            file_name=file_name,
            file_type=content_type,
            file_size=len(content),
            content_preview=extracted_text.content_preview,
            extracted_text=extracted_text.llm_source_text,
        ),
    )
    return response


@router.get(
    "/member/appeals/{tracking_id}",
    response_model=MemberAppealStatusResponse,
    tags=["member"],
)
def get_member_appeal_status(
    tracking_id: str,
    service: AppealServiceDep,
    access_code: Annotated[str, Query(alias="accessCode")],
) -> MemberAppealStatusResponse:
    try:
        return service.get_member_status(tracking_id, access_code)
    except AppealNotFoundError as exc:
        raise _not_found(exc.appeal_id) from exc


@router.post(
    "/member/appeals/{tracking_id}/documents",
    response_model=MemberAppealStatusResponse,
    tags=["member"],
)
async def upload_member_followup_document(
    tracking_id: str,
    service: AppealServiceDep,
    file: Annotated[UploadFile, File()],
    access_code: Annotated[str, Form(alias="accessCode")],
) -> MemberAppealStatusResponse:
    content = await file.read()
    file_name = file.filename or "member-follow-up.pdf"
    content_type = file.content_type or "application/octet-stream"
    extracted_text = extract_document_text(
        file_name=file_name,
        content_type=content_type,
        content=content,
    )
    try:
        return service.upload_member_followup_document(
            tracking_id,
            access_code,
            AppealDocumentUploadRequest(
                file_name=file_name,
                file_type=content_type,
                file_size=len(content),
                content_preview=extracted_text.content_preview,
                extracted_text=extracted_text.llm_source_text,
            ),
        )
    except AppealNotFoundError as exc:
        raise _not_found(exc.appeal_id) from exc


@router.get("/appeals/{appeal_id}", response_model=AppealCase, tags=["appeals"])
def get_appeal(
    appeal_id: str,
    service: AppealServiceDep,
) -> AppealCase:
    try:
        return service.get_appeal(appeal_id)
    except AppealNotFoundError as exc:
        raise _not_found(exc.appeal_id) from exc


@router.post(
    "/appeals/{appeal_id}/generate-packet",
    response_model=AppealCase,
    tags=["appeals"],
)
def generate_packet(
    appeal_id: str,
    service: AppealServiceDep,
) -> AppealCase:
    try:
        return service.generate_packet(appeal_id)
    except AppealNotFoundError as exc:
        raise _not_found(exc.appeal_id) from exc


@router.post(
    "/appeals/{appeal_id}/documents",
    response_model=AppealCase,
    tags=["appeals"],
)
async def upload_document(
    appeal_id: str,
    service: AppealServiceDep,
    file: Annotated[UploadFile, File()],
    content_preview: Annotated[str | None, Form()] = None,
) -> AppealCase:
    content = await file.read()
    file_name = file.filename or "appeal-packet.pdf"
    content_type = file.content_type or "application/octet-stream"
    extracted_text = extract_document_text(
        file_name=file_name,
        content_type=content_type,
        content=content,
    )
    extracted_preview = content_preview or extracted_text.content_preview
    llm_source_text = _combine_text(content_preview, extracted_text.llm_source_text)
    payload = AppealDocumentUploadRequest(
        file_name=file_name,
        file_type=content_type,
        file_size=len(content),
        content_preview=extracted_preview,
        extracted_text=llm_source_text,
    )

    try:
        return service.upload_document(appeal_id, payload)
    except AppealNotFoundError as exc:
        raise _not_found(exc.appeal_id) from exc


@router.post(
    "/appeals/{appeal_id}/actions",
    response_model=AppealCase,
    tags=["appeals"],
)
def apply_reviewer_action(
    appeal_id: str,
    payload: ReviewerActionRequest,
    service: AppealServiceDep,
) -> AppealCase:
    try:
        return service.apply_reviewer_action(appeal_id, payload.action, payload.note)
    except AppealNotFoundError as exc:
        raise _not_found(exc.appeal_id) from exc


@router.post("/appeals/reset", response_model=list[AppealCase], tags=["appeals"])
def reset_appeals(
    service: AppealServiceDep,
) -> list[AppealCase]:
    return service.reset()


def _not_found(appeal_id: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Appeal not found: {appeal_id}",
    )


def _combine_text(*values: str | None) -> str | None:
    text_parts = [value for value in values if value]
    if not text_parts:
        return None

    return "\n\n".join(text_parts)
