from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    words = value.split("_")
    return words[0] + "".join(word.capitalize() for word in words[1:])


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        use_enum_values=True,
    )


class RiskLevel(StrEnum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Urgency(StrEnum):
    URGENT = "Urgent"
    STANDARD = "Standard"


class AppealStatus(StrEnum):
    NEW = "New"
    AI_TRIAGED = "AI triaged"
    IN_REVIEW = "In review"
    DECISION_DRAFTED = "Decision drafted"
    NEEDS_INFO = "Needs info"
    APPROVED = "Approved"


class ReviewerAction(StrEnum):
    APPROVE = "Approve"
    REQUEST_INFO = "Request Info"
    DRAFT_UPHOLD = "Draft Uphold"


class CriterionStatus(StrEnum):
    MET = "Met"
    PARTIAL = "Partial"
    MISSING = "Missing"


class EvidenceItem(ApiModel):
    label: str
    source: str


class GuidelineCriterion(ApiModel):
    label: str
    status: CriterionStatus


class AuditEvent(ApiModel):
    time: str
    label: str
    detail: str


class AiRecommendation(ApiModel):
    action: ReviewerAction
    confidence: str = "Medium"
    rationale: str
    supporting_evidence: list[str] = Field(default_factory=list)
    caution_notes: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    compliance_notes: list[str] = Field(default_factory=list)


class AppealDocument(ApiModel):
    id: str
    file_name: str
    file_type: str
    file_size: int = Field(ge=0)
    uploaded_at: str
    summary: str
    extraction_mode: str = "Rule-based"
    llm_summary: str | None = None
    extraction_signals: list[str] = Field(default_factory=list)
    content_preview: str | None = None


class AppealCase(ApiModel):
    id: str
    member: str
    age: int = Field(ge=0)
    policy_number: str | None = None
    member_email: str | None = None
    plan: str
    provider: str
    service: str
    appeal_type: str
    urgency: Urgency
    status: AppealStatus
    specialty: str
    risk: RiskLevel
    received: str
    due: str
    sla_label: str
    denial_reason: str
    appeal_argument: str
    ai_brief: str
    facts: list[EvidenceItem]
    timeline: list[EvidenceItem]
    approval_evidence: list[EvidenceItem]
    denial_evidence: list[EvidenceItem]
    guideline: list[GuidelineCriterion]
    recommendation: str
    ai_recommendation: AiRecommendation | None = None
    missing_docs: list[str]
    documents: list[AppealDocument] = Field(default_factory=list)
    audit: list[AuditEvent]
    source: str = "Reviewer intake"
    member_tracking_id: str | None = None
    member_access_code: str | None = None
    analysis_prepared: bool = False
    reviewer_decision: ReviewerAction | None = None
    decision_summary: str | None = None
    decision_time: str | None = None


class CreateAppealRequest(ApiModel):
    member: str = Field(min_length=1)
    age: int = Field(ge=0)
    policy_number: str | None = Field(default=None, min_length=1)
    member_email: str | None = Field(default=None, min_length=3)
    plan: str = Field(default="Commercial PPO", min_length=1)
    provider: str = Field(min_length=1)
    service: str = Field(min_length=1)
    appeal_type: str = Field(default="Medical necessity", min_length=1)
    urgency: Urgency = Urgency.STANDARD
    denial_reason: str = Field(min_length=1)
    appeal_argument: str = Field(min_length=1)


class AppealDocumentUploadRequest(ApiModel):
    file_name: str = Field(min_length=1)
    file_type: str = Field(default="application/octet-stream", min_length=1)
    file_size: int = Field(ge=0)
    content_preview: str | None = Field(default=None, max_length=4000)
    extracted_text: str | None = Field(default=None, max_length=60000)


class ReviewerActionRequest(ApiModel):
    action: ReviewerAction
    note: str | None = Field(default=None, max_length=1000)


class MemberAppealSubmissionRequest(ApiModel):
    member: str = Field(min_length=1)
    age: int = Field(ge=0)
    policy_number: str = Field(min_length=1)
    member_email: str = Field(min_length=3)
    plan: str = Field(default="Commercial PPO", min_length=1)
    provider: str = Field(default="Provider listed in packet", min_length=1)
    service: str = Field(min_length=1)
    appeal_type: str = Field(default="Medical necessity", min_length=1)
    urgency: Urgency = Urgency.STANDARD
    denial_reason: str = Field(min_length=1)
    appeal_argument: str = Field(min_length=1)


class MemberAppealSubmissionResponse(ApiModel):
    tracking_id: str
    access_code: str
    status: str
    received: str
    due: str
    message: str


class MemberAppealStatusResponse(ApiModel):
    tracking_id: str
    status: str
    member: str
    policy_number: str | None = None
    member_email: str | None = None
    service: str
    received: str
    due: str
    next_step: str
    can_upload_documents: bool = False
    decision_summary: str | None = None


class HealthResponse(ApiModel):
    status: str
    service: str
    version: str
