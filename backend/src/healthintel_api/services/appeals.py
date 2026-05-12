from __future__ import annotations

from datetime import datetime, timedelta
from secrets import randbelow

from healthintel_api.domain.models import (
    AiRecommendation,
    AppealCase,
    AppealDocument,
    AppealDocumentUploadRequest,
    AppealStatus,
    AuditEvent,
    CreateAppealRequest,
    CriterionStatus,
    EvidenceItem,
    GuidelineCriterion,
    MemberAppealStatusResponse,
    MemberAppealSubmissionRequest,
    MemberAppealSubmissionResponse,
    ReviewerAction,
    RiskLevel,
    Urgency,
)
from healthintel_api.repositories.appeals import AppealRepository
from healthintel_api.services.email import reset_outbox, send_member_status_email
from healthintel_api.services.llm_extraction import (
    LlmExtractionResult,
    summarize_then_extract_pdf,
)


class AppealNotFoundError(Exception):
    def __init__(self, appeal_id: str) -> None:
        self.appeal_id = appeal_id
        super().__init__(f"Appeal not found: {appeal_id}")


class AppealService:
    def __init__(self, repository: AppealRepository) -> None:
        self._repository = repository

    def list_appeals(self) -> list[AppealCase]:
        return self._repository.list()

    def create_appeal(self, payload: CreateAppealRequest) -> AppealCase:
        now = datetime.now()
        specialty, risk = _classify_case(
            payload.service,
            payload.appeal_type,
            payload.urgency,
        )
        is_urgent = payload.urgency == Urgency.URGENT
        due_at = now + (timedelta(hours=72) if is_urgent else timedelta(days=30))
        sla_label = "72 hours left" if is_urgent else "30 days left"
        appeal = AppealCase(
            id=self._next_appeal_id(now.year),
            member=payload.member,
            age=payload.age,
            policy_number=payload.policy_number,
            member_email=payload.member_email,
            plan=payload.plan,
            provider=payload.provider,
            service=payload.service,
            appeal_type=payload.appeal_type,
            urgency=payload.urgency,
            status=AppealStatus.NEW,
            specialty=specialty,
            risk=risk,
            received=_date_label(now),
            due=_date_label(due_at),
            sla_label=sla_label,
            denial_reason=payload.denial_reason,
            appeal_argument=payload.appeal_argument,
            ai_brief=_draft_brief(payload),
            facts=[
                EvidenceItem(
                    label=f"Appeal submitted for {payload.service}",
                    source="Intake form",
                ),
                EvidenceItem(
                    label=(
                        f"Denial rationale captured: {_shorten(payload.denial_reason)}"
                    ),
                    source="Intake form",
                ),
            ],
            timeline=[
                EvidenceItem(
                    label="Appeal entered into HealthIntel intake",
                    source=_date_label(now),
                ),
                EvidenceItem(
                    label="Decision clock started",
                    source=sla_label,
                ),
            ],
            approval_evidence=[
                EvidenceItem(
                    label="Provider appeal argument is available for reviewer analysis",
                    source="Intake form",
                )
            ],
            denial_evidence=[
                EvidenceItem(
                    label=_shorten(payload.denial_reason),
                    source="Denial rationale",
                )
            ],
            guideline=_guideline_for(payload.service, payload.appeal_type),
            recommendation=_draft_recommendation(payload, specialty),
            ai_recommendation=None,
            missing_docs=[
                "Source appeal packet",
                "Prior authorization denial letter",
                "Relevant clinical notes",
            ],
            documents=[],
            audit=[
                AuditEvent(
                    time=_audit_time(),
                    label="Appeal created",
                    detail=(
                        f"{payload.urgency} {payload.appeal_type.lower()} appeal "
                        "entered through intake."
                    ),
                )
            ],
        )
        return self._repository.save(appeal)

    def create_member_appeal(
        self,
        payload: MemberAppealSubmissionRequest,
    ) -> tuple[AppealCase, MemberAppealSubmissionResponse]:
        now = datetime.now()
        tracking_id = self._next_member_tracking_id(now.year)
        access_code = _new_access_code()
        appeal = self.create_appeal(
            CreateAppealRequest(
                member=payload.member,
                age=payload.age,
                policy_number=payload.policy_number,
                member_email=payload.member_email,
                plan=payload.plan,
                provider=payload.provider,
                service=payload.service,
                appeal_type=payload.appeal_type,
                urgency=payload.urgency,
                denial_reason=payload.denial_reason,
                appeal_argument=payload.appeal_argument,
            )
        )
        appeal.source = "Member portal"
        appeal.member_tracking_id = tracking_id
        appeal.member_access_code = access_code
        appeal.audit.append(
            AuditEvent(
                time=_audit_time(),
                label="Member appeal submitted",
                detail=(
                    "Appeal entered through the member portal with limited "
                    f"status access under tracking ID {tracking_id}."
                ),
            )
        )
        appeal = self._repository.save(appeal)
        return appeal, MemberAppealSubmissionResponse(
            tracking_id=tracking_id,
            access_code=access_code,
            status=_member_status_label(appeal),
            received=appeal.received,
            due=appeal.due,
            message=(
                "Appeal submitted. Save the tracking ID and access code to "
                "check status."
            ),
        )

    def get_member_status(
        self,
        tracking_id: str,
        access_code: str,
    ) -> MemberAppealStatusResponse:
        return _member_status_response(
            self._get_member_appeal(tracking_id, access_code)
        )

    def upload_member_followup_document(
        self,
        tracking_id: str,
        access_code: str,
        payload: AppealDocumentUploadRequest,
    ) -> MemberAppealStatusResponse:
        appeal = self._get_member_appeal(tracking_id, access_code)
        if appeal.status != AppealStatus.NEEDS_INFO:
            return _member_status_response(appeal)

        updated_appeal = self.upload_document(appeal.id, payload)
        updated_appeal.status = AppealStatus.IN_REVIEW
        updated_appeal.reviewer_decision = None
        updated_appeal.decision_summary = None
        updated_appeal.decision_time = None
        updated_appeal.audit.append(
            AuditEvent(
                time=_audit_time(),
                label="Member follow-up document uploaded",
                detail=(
                    f"{payload.file_name} was uploaded through the member portal "
                    "after a request for additional information."
                ),
            )
        )
        updated_appeal = self._repository.save(updated_appeal)
        return _member_status_response(updated_appeal)

    def get_appeal(self, appeal_id: str) -> AppealCase:
        appeal = self._repository.get(appeal_id)
        if appeal is None:
            raise AppealNotFoundError(appeal_id)
        return appeal

    def upload_document(
        self,
        appeal_id: str,
        payload: AppealDocumentUploadRequest,
    ) -> AppealCase:
        appeal = self.get_appeal(appeal_id)
        should_reopen_review = appeal.reviewer_decision is not None
        content_preview = _clean_preview(payload.content_preview)
        llm_result = summarize_then_extract_pdf(
            appeal=appeal,
            source_text=payload.extracted_text or content_preview,
        )
        document = AppealDocument(
            id=f"DOC-{len(appeal.documents) + 1:03d}",
            file_name=payload.file_name,
            file_type=payload.file_type,
            file_size=payload.file_size,
            uploaded_at=_audit_time(),
            summary=llm_result.pdf_summary
            if llm_result
            else _document_summary(payload),
            extraction_mode="LLM" if llm_result else "Rule-based",
            llm_summary=llm_result.pdf_summary if llm_result else None,
            extraction_signals=(
                llm_result.extraction_signals
                if llm_result and llm_result.extraction_signals
                else _extraction_signals(content_preview)
            ),
            content_preview=content_preview,
        )

        appeal.documents.append(document)
        appeal.facts.append(
            EvidenceItem(
                label=f"Appeal packet uploaded: {payload.file_name}",
                source="Document intake",
            )
        )
        if document.content_preview:
            if llm_result:
                _apply_llm_extraction(appeal, document.file_name, llm_result)
            else:
                appeal.facts.extend(
                    _facts_from_preview(document.content_preview, document.file_name)
                )
                appeal.timeline.append(
                    EvidenceItem(
                        label="Source packet processed for simulated extraction",
                        source=document.file_name,
                    )
                )
                appeal.approval_evidence.append(
                    EvidenceItem(
                        label=(
                            "Uploaded text preview available: "
                            f"{_shorten(document.content_preview)}"
                        ),
                        source=payload.file_name,
                    )
                )
                _apply_guideline_signals(appeal, document.content_preview)

            _apply_document_driven_packet_summary(appeal)
            if appeal.ai_recommendation is None:
                appeal.ai_recommendation = _build_ai_recommendation(appeal)

        appeal.missing_docs = [
            missing_doc
            for missing_doc in appeal.missing_docs
            if missing_doc != "Source appeal packet"
        ]
        if appeal.ai_recommendation is not None:
            appeal.ai_recommendation.missing_information = appeal.missing_docs[:3]
        elif document.content_preview:
            appeal.ai_recommendation = _build_ai_recommendation(appeal)

        appeal.audit.append(
            AuditEvent(
                time=_audit_time(),
                label="Appeal packet uploaded",
                detail=(
                    f"{payload.file_name} captured for AI extraction "
                    f"({_format_file_size(payload.file_size)})."
                ),
            )
        )
        if document.content_preview:
            appeal.audit.append(
                AuditEvent(
                    time=_audit_time(),
                    label=(
                        "LLM summary and extraction completed"
                        if llm_result
                        else "Document extraction simulated"
                    ),
                    detail=(
                        "PDF text was summarized first, then extracted into "
                        "facts, evidence, timeline, and guideline signals."
                        if llm_result
                        else (
                            "Source packet text was used to enrich facts, evidence, "
                            "timeline, and guideline signals."
                        )
                    ),
                )
            )
        if should_reopen_review:
            appeal.status = AppealStatus.IN_REVIEW
            appeal.reviewer_decision = None
            appeal.decision_summary = None
            appeal.decision_time = None
            appeal.audit.append(
                AuditEvent(
                    time=_audit_time(),
                    label="Fresh document reopened review",
                    detail=(
                        f"{payload.file_name} was submitted after a reviewer "
                        "decision, so the saved action was cleared for re-review."
                    ),
                )
            )
        return self._repository.save(appeal)

    def generate_packet(self, appeal_id: str) -> AppealCase:
        appeal = self.get_appeal(appeal_id)
        if appeal.analysis_prepared:
            return appeal

        appeal.analysis_prepared = True
        if appeal.reviewer_decision is None:
            appeal.status = AppealStatus.AI_TRIAGED
        _apply_document_driven_packet_summary(appeal)
        if appeal.ai_recommendation is None:
            appeal.ai_recommendation = _build_ai_recommendation(appeal)

        appeal.audit.extend(
            [
                AuditEvent(
                    time=_audit_time(),
                    label="AI classification completed",
                    detail=(
                        f"{appeal.urgency} urgency, {appeal.risk.lower()} risk, "
                        f"{appeal.specialty} routing"
                    ),
                ),
                AuditEvent(
                    time=_audit_time(),
                    label="Clinical facts and source signals extracted",
                    detail=(
                        f"{len(appeal.facts)} key facts, "
                        f"{len(appeal.timeline)} timeline events, "
                        f"{len(appeal.missing_docs)} missing-doc signals, "
                        f"{len(_document_signals(appeal))} PDF extraction signals"
                    ),
                ),
                AuditEvent(
                    time=_audit_time(),
                    label="Reviewer packet prepared",
                    detail=(
                        "Decision brief, evidence map, recommendation, and guideline "
                        "checklist generated."
                    ),
                ),
            ]
        )
        return self._repository.save(appeal)

    def apply_reviewer_action(
        self,
        appeal_id: str,
        action: ReviewerAction,
        note: str | None = None,
    ) -> AppealCase:
        appeal = self.generate_packet(appeal_id)
        if appeal.reviewer_decision is not None:
            return appeal

        status, audit_label, audit_detail, summary = _action_config(
            action,
            _clean_reviewer_note(note),
        )
        decision_time = _audit_time()

        appeal.status = status
        appeal.reviewer_decision = action
        appeal.decision_summary = summary
        appeal.decision_time = decision_time
        appeal.audit.append(
            AuditEvent(time=decision_time, label=audit_label, detail=audit_detail)
        )
        _append_member_email_audit(appeal, action)
        return self._repository.save(appeal)

    def reset(self) -> list[AppealCase]:
        reset_outbox()
        return self._repository.reset()

    def _next_appeal_id(self, year: int) -> str:
        prefix = f"APL-{year}-"
        max_sequence = 1000
        for appeal in self._repository.list():
            if not appeal.id.startswith(prefix):
                continue

            try:
                max_sequence = max(max_sequence, int(appeal.id.split("-")[-1]))
            except ValueError:
                continue

        return f"{prefix}{max_sequence + 1}"

    def _next_member_tracking_id(self, year: int) -> str:
        prefix = f"HI-MBR-{year}-"
        max_sequence = 0
        for appeal in self._repository.list():
            tracking_id = appeal.member_tracking_id
            if not tracking_id or not tracking_id.startswith(prefix):
                continue

            try:
                max_sequence = max(max_sequence, int(tracking_id.split("-")[-1]))
            except ValueError:
                continue

        return f"{prefix}{max_sequence + 1:04d}"

    def _get_member_appeal(self, tracking_id: str, access_code: str) -> AppealCase:
        normalized_tracking_id = tracking_id.strip()
        normalized_access_code = access_code.strip()
        for appeal in self._repository.list():
            if (
                appeal.member_tracking_id == normalized_tracking_id
                and appeal.member_access_code == normalized_access_code
            ):
                return appeal

        raise AppealNotFoundError(normalized_tracking_id)


def _action_config(
    action: ReviewerAction,
    reviewer_note: str | None = None,
) -> tuple[AppealStatus, str, str, str]:
    if action == ReviewerAction.APPROVE:
        return (
            AppealStatus.APPROVED,
            "Reviewer approved appeal",
            (
                "Approval selected after reviewing the AI packet, guideline match, "
                "and supporting clinical evidence."
            ),
            "Approval selected. The case is ready for final decision letter review.",
        )

    if action == ReviewerAction.REQUEST_INFO:
        audit_detail = (
            "Additional clinical documentation requested before a final "
            "determination is drafted."
        )
        summary = (
            "Information request selected. The missing-document list should be "
            "sent to the provider."
        )
        if reviewer_note:
            audit_detail = f"{audit_detail} Reviewer details: {reviewer_note}"
            summary = f"Additional information requested: {reviewer_note}"

        return (
            AppealStatus.NEEDS_INFO,
            "Reviewer requested information",
            audit_detail,
            summary,
        )

    return (
        AppealStatus.DECISION_DRAFTED,
        "Uphold draft prepared",
        (
            "Draft uphold action selected for reviewer validation and rationale "
            "completion."
        ),
        "Uphold draft selected. The reviewer should validate rationale before release.",
    )


def _new_access_code() -> str:
    return f"{randbelow(900000) + 100000}"


def _clean_reviewer_note(note: str | None) -> str | None:
    if not note:
        return None

    normalized = " ".join(note.split())
    if not normalized:
        return None

    return normalized[:1000]


def _member_status_response(appeal: AppealCase) -> MemberAppealStatusResponse:
    return MemberAppealStatusResponse(
        tracking_id=appeal.member_tracking_id or appeal.id,
        status=_member_status_label(appeal),
        member=appeal.member,
        policy_number=appeal.policy_number,
        member_email=appeal.member_email,
        service=appeal.service,
        received=appeal.received,
        due=appeal.due,
        next_step=_member_next_step(appeal),
        can_upload_documents=appeal.status == AppealStatus.NEEDS_INFO,
        decision_summary=_member_decision_summary(appeal),
    )


def _append_member_email_audit(appeal: AppealCase, action: ReviewerAction) -> None:
    if not appeal.member_tracking_id:
        return

    result = send_member_status_email(appeal, action)
    if result.sent:
        detail = result.detail
        if result.provider_message_id:
            detail = f"{detail} Outbox ID: {result.provider_message_id}."
        appeal.audit.append(
            AuditEvent(
                time=_audit_time(),
                label="Member status email queued",
                detail=detail,
            )
        )
        return

    appeal.audit.append(
        AuditEvent(
            time=_audit_time(),
            label=(
                "Member status email failed"
                if result.attempted
                else "Member status email skipped"
            ),
            detail=result.detail,
        )
    )


def _member_status_label(appeal: AppealCase) -> str:
    if appeal.status == AppealStatus.NEEDS_INFO:
        return "More information requested"

    if appeal.status in {AppealStatus.APPROVED, AppealStatus.DECISION_DRAFTED}:
        return "Decision issued"

    if appeal.status in {AppealStatus.AI_TRIAGED, AppealStatus.IN_REVIEW}:
        return "In review"

    return "Submitted"


def _member_next_step(appeal: AppealCase) -> str:
    if appeal.status == AppealStatus.NEEDS_INFO:
        return (
            "The review team needs additional information and will contact you "
            "with the specific request."
        )

    if appeal.status == AppealStatus.APPROVED:
        return "A decision has been issued. Watch for the formal notice from your plan."

    if appeal.status == AppealStatus.DECISION_DRAFTED:
        return "A decision has been drafted and is being finalized for formal notice."

    if appeal.status == AppealStatus.AI_TRIAGED:
        return "Your documents are in clinical review."

    return "Your appeal was received and is waiting for clinical review."


def _member_decision_summary(appeal: AppealCase) -> str | None:
    if appeal.status not in {
        AppealStatus.APPROVED,
        AppealStatus.DECISION_DRAFTED,
        AppealStatus.NEEDS_INFO,
    }:
        return None

    return appeal.decision_summary


def _audit_time() -> str:
    now = datetime.now()
    return f"{now.strftime('%b')} {now.day}, {now.year} {now.strftime('%H:%M')}"


def _date_label(value: datetime) -> str:
    return f"{value.strftime('%b')} {value.day}, {value.year}"


def _classify_case(
    service: str,
    appeal_type: str,
    urgency: Urgency,
) -> tuple[str, RiskLevel]:
    normalized = f"{service} {appeal_type}".lower()

    if any(term in normalized for term in ["oncology", "cancer", "chemotherapy"]):
        return "Oncology / Pharmacy", RiskLevel.HIGH

    if any(term in normalized for term in ["mri", "imaging", "spine", "radiology"]):
        return "Orthopedics / Radiology", RiskLevel.MEDIUM

    if any(term in normalized for term in ["inpatient", "level of care", "admission"]):
        return "Internal Medicine", RiskLevel.MEDIUM

    if urgency == Urgency.URGENT:
        return "Medical Director Review", RiskLevel.HIGH

    return "Medical Director Review", RiskLevel.MEDIUM


def _guideline_for(service: str, appeal_type: str) -> list[GuidelineCriterion]:
    normalized = f"{service} {appeal_type}".lower()

    if any(term in normalized for term in ["mri", "imaging", "spine"]):
        labels = [
            "Conservative therapy documented",
            "Neurologic deficit or red-flag symptoms documented",
            "Imaging expected to change treatment plan",
        ]
    elif any(term in normalized for term in ["oncology", "cancer", "pharmacy"]):
        labels = [
            "Prior-line therapy failure documented",
            "Diagnosis and biomarker criteria documented",
            "Delay could compromise active treatment",
        ]
    elif any(term in normalized for term in ["inpatient", "level of care"]):
        labels = [
            "Acute physiologic instability documented",
            "Inpatient monitoring intensity documented",
            "Observation status clinically insufficient",
        ]
    else:
        labels = [
            "Requested service matches diagnosis",
            "Clinical rationale supports medical necessity",
            "Required supporting documentation is present",
        ]

    return [
        GuidelineCriterion(label=labels[0], status=CriterionStatus.PARTIAL),
        GuidelineCriterion(label=labels[1], status=CriterionStatus.PARTIAL),
        GuidelineCriterion(label=labels[2], status=CriterionStatus.MISSING),
    ]


def _draft_brief(payload: CreateAppealRequest) -> str:
    return (
        f"{payload.urgency} {payload.appeal_type.lower()} appeal for "
        f"{payload.member} involving {payload.service}. The denial rationale "
        f"states: {_shorten(payload.denial_reason, 180)} The provider appeal "
        f"argument states: {_shorten(payload.appeal_argument, 180)}"
    )


def _draft_recommendation(
    payload: CreateAppealRequest,
    specialty: str,
) -> str:
    return (
        f"Route to {specialty} for review. Generate the AI packet after source "
        "documents are uploaded, then validate whether the denial rationale is "
        "overcome by the appeal argument and supporting clinical evidence."
    )


def _document_summary(payload: AppealDocumentUploadRequest) -> str:
    if payload.content_preview:
        if _is_pdf(payload):
            return "PDF uploaded and text preview captured for simulated extraction."

        return "Document text preview captured for simulated extraction."

    if _is_pdf(payload):
        return (
            "PDF uploaded successfully; text extraction preview was unavailable "
            "for this file."
        )

    return "Document metadata captured; text extraction can be added in a later build."


def _is_pdf(payload: AppealDocumentUploadRequest) -> bool:
    return payload.file_type == "application/pdf" or payload.file_name.lower().endswith(
        ".pdf"
    )


def _facts_from_preview(
    content_preview: str,
    file_name: str,
) -> list[EvidenceItem]:
    normalized = content_preview.lower()
    facts: list[EvidenceItem] = [
        EvidenceItem(
            label="Source packet text available for reviewer validation",
            source=file_name,
        )
    ]

    if "physical therap" in normalized or "conservative" in normalized:
        facts.append(
            EvidenceItem(
                label="Conservative therapy signal found in source packet",
                source=file_name,
            )
        )

    if "neurologic" in normalized or "radicular" in normalized:
        facts.append(
            EvidenceItem(
                label="Neurologic or radicular symptom signal found in source packet",
                source=file_name,
            )
        )

    if "prior authorization" in normalized or "denial" in normalized:
        facts.append(
            EvidenceItem(
                label="Prior authorization or denial context found in source packet",
                source=file_name,
            )
        )

    return facts


def _apply_llm_extraction(
    appeal: AppealCase,
    file_name: str,
    extraction: LlmExtractionResult,
) -> None:
    _extend_evidence_items(appeal.facts, extraction.facts, file_name)
    _extend_evidence_items(appeal.timeline, extraction.timeline, file_name)
    _extend_evidence_items(
        appeal.approval_evidence,
        extraction.approval_evidence,
        file_name,
    )
    _extend_evidence_items(
        appeal.denial_evidence,
        extraction.denial_evidence,
        file_name,
    )

    for missing_doc in extraction.missing_docs:
        if missing_doc not in appeal.missing_docs:
            appeal.missing_docs.append(missing_doc)

    _apply_guideline_signal_labels(appeal, extraction.guideline_signals)

    if extraction.ai_brief:
        appeal.ai_brief = extraction.ai_brief

    if extraction.recommendation:
        appeal.recommendation = extraction.recommendation

    appeal.ai_recommendation = _build_ai_recommendation(
        appeal,
        preferred_action=extraction.recommended_action,
        confidence=extraction.confidence,
        rationale=extraction.recommendation_rationale or extraction.recommendation,
        compliance_notes=extraction.compliance_notes,
    )


def _extend_evidence_items(
    target: list[EvidenceItem],
    labels: list[str],
    source: str,
) -> None:
    existing_labels = {item.label for item in target}
    for label in labels:
        if label not in existing_labels:
            target.append(EvidenceItem(label=label, source=source))
            existing_labels.add(label)


def _apply_guideline_signal_labels(
    appeal: AppealCase,
    guideline_signals: list[str],
) -> None:
    normalized_signals = [signal.lower() for signal in guideline_signals]
    for criterion in appeal.guideline:
        criterion_text = criterion.label.lower()
        if any(
            criterion_text in signal or signal in criterion_text
            for signal in normalized_signals
        ):
            criterion.status = CriterionStatus.MET


def _build_ai_recommendation(
    appeal: AppealCase,
    *,
    preferred_action: str | None = None,
    confidence: str | None = None,
    rationale: str | None = None,
    compliance_notes: list[str] | None = None,
) -> AiRecommendation:
    action = _normalize_recommended_action(preferred_action)
    if action is None:
        action = _infer_recommended_action(appeal)

    confidence_label = confidence if confidence in {"High", "Medium", "Low"} else None
    if confidence_label is None:
        confidence_label = _infer_confidence(appeal, action)

    return AiRecommendation(
        action=action,
        confidence=confidence_label,
        rationale=rationale or _recommendation_rationale(appeal, action),
        supporting_evidence=[item.label for item in appeal.approval_evidence[:3]],
        caution_notes=[item.label for item in appeal.denial_evidence[:2]],
        missing_information=appeal.missing_docs[:3],
        compliance_notes=compliance_notes or [_compliance_note(appeal)],
    )


def _normalize_recommended_action(value: str | None) -> ReviewerAction | None:
    if not value:
        return None

    normalized = value.lower()
    if "request" in normalized or "more information" in normalized:
        return ReviewerAction.REQUEST_INFO

    if "uphold" in normalized or "deny" in normalized or "reject" in normalized:
        return ReviewerAction.DRAFT_UPHOLD

    if "approve" in normalized or "overturn" in normalized:
        return ReviewerAction.APPROVE

    return None


def _infer_recommended_action(appeal: AppealCase) -> ReviewerAction:
    missing_criteria = sum(
        1
        for criterion in appeal.guideline
        if criterion.status == CriterionStatus.MISSING
    )
    met_criteria = sum(
        1 for criterion in appeal.guideline if criterion.status == CriterionStatus.MET
    )

    if missing_criteria >= 2 or len(appeal.missing_docs) >= 3:
        return ReviewerAction.REQUEST_INFO

    if met_criteria >= 2 and len(appeal.approval_evidence) >= len(
        appeal.denial_evidence
    ):
        return ReviewerAction.APPROVE

    return ReviewerAction.REQUEST_INFO


def _infer_confidence(appeal: AppealCase, action: ReviewerAction) -> str:
    met_criteria = sum(
        1 for criterion in appeal.guideline if criterion.status == CriterionStatus.MET
    )
    missing_criteria = sum(
        1
        for criterion in appeal.guideline
        if criterion.status == CriterionStatus.MISSING
    )

    if action == ReviewerAction.APPROVE and met_criteria >= 2 and missing_criteria == 0:
        return "High"

    if action == ReviewerAction.REQUEST_INFO and appeal.missing_docs:
        return "Medium"

    return "Low"


def _recommendation_rationale(
    appeal: AppealCase,
    action: ReviewerAction,
) -> str:
    if action == ReviewerAction.APPROVE:
        return (
            "Available evidence appears to address the denial rationale. The "
            "reviewer should validate the cited documents before final approval."
        )

    if action == ReviewerAction.DRAFT_UPHOLD:
        return (
            "The packet does not appear to overcome the denial rationale based on "
            "the currently extracted evidence."
        )

    return (
        "The packet has useful clinical signals, but one or more required documents "
        "or criteria remain unclear."
    )


def _compliance_note(appeal: AppealCase) -> str:
    if appeal.urgency == Urgency.URGENT:
        return "Urgent appeal: keep the 72-hour decision clock visible."

    return "Standard appeal: document the rationale and source evidence for audit."


def _extraction_signals(content_preview: str | None) -> list[str]:
    if not content_preview:
        return []

    normalized = content_preview.lower()
    signals: list[str] = []

    if "physical therap" in normalized or "conservative" in normalized:
        signals.append("Conservative therapy documented")

    if "neurologic" in normalized or "radicular" in normalized:
        signals.append("Neurologic or radicular symptoms documented")

    if "prior authorization" in normalized or "denial" in normalized:
        signals.append("Denial or prior authorization context found")

    if "nsaid" in normalized or "medication" in normalized:
        signals.append("Medication history referenced")

    if not signals:
        signals.append("Source text available for reviewer validation")

    return signals


def _apply_guideline_signals(
    appeal: AppealCase,
    content_preview: str,
) -> None:
    normalized = content_preview.lower()

    for criterion in appeal.guideline:
        criterion_text = criterion.label.lower()
        if ("conservative" in criterion_text or "therapy" in criterion_text) and (
            "physical therap" in normalized or "conservative" in normalized
        ):
            criterion.status = CriterionStatus.MET

        if ("neurologic" in criterion_text or "deficit" in criterion_text) and (
            "neurologic" in normalized or "radicular" in normalized
        ):
            criterion.status = CriterionStatus.MET


def _apply_document_driven_packet_summary(appeal: AppealCase) -> None:
    signals = _document_signals(appeal)
    if not signals:
        return

    document_names = ", ".join(
        document.file_name
        for document in appeal.documents
        if document.extraction_signals
    )
    signal_text = ", ".join(signals)
    base_brief = appeal.ai_brief.split(" Source packet signals:")[0]
    base_recommendation = appeal.recommendation.split(" PDF evidence focus:")[0]

    appeal.ai_brief = (
        f"{base_brief} Source packet signals: {signal_text} from "
        f"{document_names}. These signals were mapped into the extracted facts, "
        "evidence panels, and guideline checklist for reviewer validation."
    )
    appeal.recommendation = (
        f"{base_recommendation} PDF evidence focus: validate {signal_text} "
        "against the policy criteria and request only source documents that remain "
        "unresolved after reviewing the uploaded packet."
    )


def _document_signals(appeal: AppealCase) -> list[str]:
    signals: list[str] = []
    for document in appeal.documents:
        for signal in document.extraction_signals:
            if signal not in signals:
                signals.append(signal)

    return signals


def _clean_preview(content_preview: str | None) -> str | None:
    if not content_preview:
        return None

    normalized = " ".join(content_preview.split())
    return normalized[:700]


def _shorten(value: str, length: int = 120) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= length:
        return normalized

    return f"{normalized[: length - 3]}..."


def _format_file_size(file_size: int) -> str:
    if file_size < 1024:
        return f"{file_size} B"

    if file_size < 1024 * 1024:
        return f"{file_size / 1024:.1f} KB"

    return f"{file_size / (1024 * 1024):.1f} MB"
