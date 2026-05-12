from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import healthintel_api.services.appeals as appeals_module
from healthintel_api.main import create_app
from healthintel_api.repositories.appeals import AppealRepository
from healthintel_api.services.appeals import AppealService
from healthintel_api.services.llm_extraction import LlmExtractionResult


@pytest.fixture(autouse=True)
def disable_live_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("EMAIL_FROM", raising=False)
    monkeypatch.delenv("HEALTHINTEL_PUBLIC_APP_URL", raising=False)


def make_client(database_path: Path) -> TestClient:
    repository = AppealRepository(database_path)
    service = AppealService(repository)
    client = TestClient(create_app(service))
    client.post("/api/appeals/reset")
    return client


def test_health_endpoint(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "HealthIntel API",
        "version": "0.1.0",
    }


def test_list_appeals_returns_seed_cases(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.get("/api/appeals")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 3
    assert payload[0]["id"] == "APL-2026-1042"
    assert payload[0]["analysisPrepared"] is False
    assert payload[0]["documents"] == []


def test_create_appeal_returns_new_case(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.post(
        "/api/appeals",
        json={
            "member": "Nora P.",
            "age": 55,
            "policyNumber": "POL-5500192",
            "plan": "Commercial PPO",
            "provider": "Summit Pain Center",
            "service": "Epidural steroid injection",
            "appealType": "Medical necessity",
            "urgency": "Standard",
            "denialReason": "Documentation did not confirm conservative therapy.",
            "appealArgument": (
                "Provider states pain persisted after therapy and NSAIDs."
            ),
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["id"] == "APL-2026-1043"
    assert payload["member"] == "Nora P."
    assert payload["policyNumber"] == "POL-5500192"
    assert payload["status"] == "New"
    assert payload["analysisPrepared"] is False
    assert payload["missingDocs"][0] == "Source appeal packet"


def test_upload_document_updates_case(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.post(
        "/api/appeals/APL-2026-1042/documents",
        data={
            "content_preview": ("Physical therapy notes and neurologic exam attached.")
        },
        files={
            "file": (
                "appeal-packet.pdf",
                b"%PDF-1.4 simulated packet",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["documents"][0]["id"] == "DOC-001"
    assert payload["documents"][0]["fileName"] == "appeal-packet.pdf"
    assert payload["documents"][0]["fileType"] == "application/pdf"
    assert "PDF uploaded" in payload["documents"][0]["summary"]
    assert (
        "Conservative therapy documented"
        in payload["documents"][0]["extractionSignals"]
    )
    assert (
        "Neurologic or radicular symptoms documented"
        in payload["documents"][0]["extractionSignals"]
    )
    assert "Source appeal packet" not in payload["missingDocs"]
    assert any(
        fact["label"] == "Conservative therapy signal found in source packet"
        for fact in payload["facts"]
    )
    assert any(event["label"] == "Appeal packet uploaded" for event in payload["audit"])
    assert any(
        event["label"] == "Document extraction simulated" for event in payload["audit"]
    )


def test_upload_document_applies_llm_summary_then_extraction(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_llm_extraction(*args: object, **kwargs: object) -> LlmExtractionResult:
        return LlmExtractionResult(
            pdf_summary="LLM PDF summary: therapy failed and radicular pain persisted.",
            ai_brief="LLM case brief generated from the PDF summary.",
            recommendation="LLM recommendation based on summarized PDF evidence.",
            recommended_action="Approve",
            confidence="High",
            recommendation_rationale="LLM recommends approval after summary review.",
            facts=["Six weeks of physical therapy documented"],
            timeline=["Physical therapy completed before appeal"],
            approval_evidence=["Persistent radicular symptoms after therapy"],
            denial_evidence=["Original denial cited insufficient documentation"],
            missing_docs=["Updated neurologic exam"],
            guideline_signals=["Conservative therapy documented"],
            extraction_signals=["LLM conservative therapy signal"],
            compliance_notes=["Standard appeal audit note"],
        )

    monkeypatch.setattr(
        appeals_module,
        "summarize_then_extract_pdf",
        fake_llm_extraction,
    )
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.post(
        "/api/appeals/APL-2026-1042/documents",
        data={"content_preview": "physical therapy and radicular symptoms"},
        files={
            "file": (
                "appeal-packet.pdf",
                b"%PDF-1.4 simulated packet",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["documents"][0]["extractionMode"] == "LLM"
    assert payload["documents"][0]["summary"].startswith("LLM PDF summary")
    assert "LLM case brief generated from the PDF summary." in payload["aiBrief"]
    assert (
        "Source packet signals: LLM conservative therapy signal" in payload["aiBrief"]
    )
    assert payload["recommendation"] == (
        "LLM recommendation based on summarized PDF evidence. "
        "PDF evidence focus: validate LLM conservative therapy signal against "
        "the policy criteria and request only source documents that remain "
        "unresolved after reviewing the uploaded packet."
    )
    assert payload["aiRecommendation"]["action"] == "Approve"
    assert payload["aiRecommendation"]["confidence"] == "High"
    assert payload["aiRecommendation"]["rationale"] == (
        "LLM recommends approval after summary review."
    )
    assert any(
        event["label"] == "LLM summary and extraction completed"
        for event in payload["audit"]
    )


def test_llm_recommendation_request_info_takes_precedence_over_approve_wording(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_llm_extraction(*args: object, **kwargs: object) -> LlmExtractionResult:
        return LlmExtractionResult(
            pdf_summary="LLM PDF summary: key documentation remains incomplete.",
            recommended_action="Do not approve yet; request more information.",
            confidence="Medium",
            recommendation_rationale=(
                "The packet has useful clinical signals, but one or more "
                "required documents or criteria remain unclear."
            ),
            missing_docs=["Complete therapy attendance record"],
            guideline_signals=["Conservative therapy documented"],
        )

    monkeypatch.setattr(
        appeals_module,
        "summarize_then_extract_pdf",
        fake_llm_extraction,
    )
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.post(
        "/api/appeals/APL-2026-1042/documents",
        data={"content_preview": "therapy noted but attendance record incomplete"},
        files={
            "file": (
                "appeal-packet.pdf",
                b"%PDF-1.4 simulated packet",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["aiRecommendation"]["action"] == "Request Info"
    assert payload["aiRecommendation"]["rationale"] == (
        "The packet has useful clinical signals, but one or more required "
        "documents or criteria remain unclear."
    )


def test_member_submission_creates_limited_status_access(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.post(
        "/api/member/appeals",
        data={
            "member": "Elena T.",
            "age": "59",
            "policyNumber": "POL-9922001",
            "memberEmail": "elena@example.com",
            "plan": "Commercial PPO",
            "provider": "North Valley Spine Institute",
            "service": "MRI lumbar spine without contrast",
            "appealType": "Medical necessity",
            "urgency": "Standard",
            "denialReason": "Conservative therapy duration was unclear.",
            "appealArgument": "Therapy failed and weakness is documented.",
        },
        files={
            "file": (
                "member-packet.pdf",
                b"%PDF-1.4 member submitted packet",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["trackingId"].startswith("HI-MBR-")
    assert len(payload["accessCode"]) == 6

    status_response = client.get(
        f"/api/member/appeals/{payload['trackingId']}",
        params={"accessCode": payload["accessCode"]},
    )

    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["trackingId"] == payload["trackingId"]
    assert status_payload["policyNumber"] == "POL-9922001"
    assert status_payload["memberEmail"] == "elena@example.com"
    assert status_payload["status"] == "Submitted"
    assert status_payload["canUploadDocuments"] is False
    assert "aiBrief" not in status_payload
    assert "audit" not in status_payload

    appeals_response = client.get("/api/appeals")
    appeals_payload = appeals_response.json()
    member_case = next(
        appeal
        for appeal in appeals_payload
        if appeal["memberTrackingId"] == payload["trackingId"]
    )
    assert member_case["source"] == "Member portal"
    assert member_case["policyNumber"] == "POL-9922001"
    assert member_case["memberEmail"] == "elena@example.com"


def test_reviewer_request_info_queues_outbox_email_and_allows_followup_upload(
    tmp_path: Path,
) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")
    submission_response = client.post(
        "/api/member/appeals",
        data={
            "member": "Elena T.",
            "age": "59",
            "policyNumber": "POL-9922001",
            "memberEmail": "elena@example.com",
            "plan": "Commercial PPO",
            "provider": "North Valley Spine Institute",
            "service": "MRI lumbar spine without contrast",
            "appealType": "Medical necessity",
            "urgency": "Standard",
            "denialReason": "Conservative therapy duration was unclear.",
            "appealArgument": "Therapy failed and weakness is documented.",
        },
        files={
            "file": (
                "member-packet.pdf",
                b"%PDF-1.4 member submitted packet",
                "application/pdf",
            )
        },
    )
    submission = submission_response.json()
    appeals_payload = client.get("/api/appeals").json()
    appeal_id = next(
        appeal["id"]
        for appeal in appeals_payload
        if appeal["memberTrackingId"] == submission["trackingId"]
    )

    action_response = client.post(
        f"/api/appeals/{appeal_id}/actions",
        json={
            "action": "Request Info",
            "note": "Please upload the PT notes and the denial letter.",
        },
    )

    assert action_response.status_code == 200
    action_payload = action_response.json()
    assert action_payload["status"] == "Needs info"
    assert any(
        event["label"] == "Member status email queued"
        for event in action_payload["audit"]
    )
    assert any(
        "Please upload the PT notes and the denial letter." in event["detail"]
        for event in action_payload["audit"]
    )
    outbox_payload = client.get("/api/outbox").json()
    assert len(outbox_payload) == 1
    assert outbox_payload[0]["to"] == "elena@example.com"
    assert outbox_payload[0]["trackingId"] == submission["trackingId"]
    assert outbox_payload[0]["status"] == "More information requested"
    assert outbox_payload[0]["id"].startswith("OUTBOX-")
    audit_count_after_action = len(action_payload["audit"])

    repeat_action_response = client.post(
        f"/api/appeals/{appeal_id}/actions",
        json={"action": "Approve"},
    )

    assert repeat_action_response.status_code == 200
    repeat_action_payload = repeat_action_response.json()
    assert repeat_action_payload["status"] == "Needs info"
    assert repeat_action_payload["reviewerDecision"] == "Request Info"
    assert len(repeat_action_payload["audit"]) == audit_count_after_action
    assert len(client.get("/api/outbox").json()) == 1

    status_response = client.get(
        f"/api/member/appeals/{submission['trackingId']}",
        params={"accessCode": submission["accessCode"]},
    )
    status_payload = status_response.json()
    assert status_payload["status"] == "More information requested"
    assert status_payload["canUploadDocuments"] is True
    assert (
        status_payload["decisionSummary"]
        == "Additional information requested: Please upload the PT notes and "
        "the denial letter."
    )

    followup_response = client.post(
        f"/api/member/appeals/{submission['trackingId']}/documents",
        data={"accessCode": submission["accessCode"]},
        files={
            "file": (
                "follow-up.pdf",
                b"%PDF-1.4 follow up packet",
                "application/pdf",
            )
        },
    )

    assert followup_response.status_code == 200
    followup_payload = followup_response.json()
    assert followup_payload["status"] == "In review"
    assert followup_payload["canUploadDocuments"] is False

    updated_case = client.get(f"/api/appeals/{appeal_id}").json()
    assert updated_case["status"] == "In review"
    assert updated_case["reviewerDecision"] is None
    assert len(updated_case["documents"]) == 2
    assert any(
        event["label"] == "Member follow-up document uploaded"
        for event in updated_case["audit"]
    )
    assert any(
        event["label"] == "Fresh document reopened review"
        for event in updated_case["audit"]
    )

    reopened_action_response = client.post(
        f"/api/appeals/{appeal_id}/actions",
        json={"action": "Approve"},
    )

    assert reopened_action_response.status_code == 200
    reopened_action_payload = reopened_action_response.json()
    assert reopened_action_payload["status"] == "Approved"
    assert reopened_action_payload["reviewerDecision"] == "Approve"
    final_outbox_payload = client.get("/api/outbox").json()
    assert len(final_outbox_payload) == 2
    assert final_outbox_payload[0]["status"] == "Decision issued"
    assert final_outbox_payload[1]["status"] == "More information requested"


def test_generate_packet_uses_pdf_extraction_signals(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")
    client.post(
        "/api/appeals/APL-2026-1042/documents",
        data={
            "content_preview": (
                "Physical therapy notes show conservative therapy and "
                "radicular symptoms."
            )
        },
        files={
            "file": (
                "appeal-packet.pdf",
                b"%PDF-1.4 simulated packet",
                "application/pdf",
            )
        },
    )

    response = client.post("/api/appeals/APL-2026-1042/generate-packet")

    assert response.status_code == 200
    payload = response.json()
    assert "Source packet signals:" in payload["aiBrief"]
    assert "Conservative therapy documented" in payload["aiBrief"]
    assert "PDF evidence focus:" in payload["recommendation"]
    assert any(
        event["label"] == "Clinical facts and source signals extracted"
        for event in payload["audit"]
    )


def test_get_appeal_returns_case_detail(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.get("/api/appeals/APL-2026-1042")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "MRI lumbar spine without contrast"
    assert payload["appealType"] == "Medical necessity"


def test_generate_packet_marks_analysis_ready(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.post("/api/appeals/APL-2026-1042/generate-packet")

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysisPrepared"] is True
    assert payload["status"] == "AI triaged"
    assert any(
        event["label"] == "Reviewer packet prepared" for event in payload["audit"]
    )


def test_reviewer_action_prepares_packet_and_updates_status(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.post(
        "/api/appeals/APL-2026-1042/actions",
        json={"action": "Approve"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysisPrepared"] is True
    assert payload["status"] == "Approved"
    assert payload["reviewerDecision"] == "Approve"
    assert payload["decisionSummary"] is not None
    assert any(
        event["label"] == "Reviewer approved appeal" for event in payload["audit"]
    )


def test_missing_appeal_returns_404(tmp_path: Path) -> None:
    client = make_client(tmp_path / "healthintel.sqlite3")

    response = client.get("/api/appeals/NOPE")

    assert response.status_code == 404
    assert response.json()["detail"] == "Appeal not found: NOPE"


def test_sqlite_repository_persists_state_between_app_instances(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "healthintel.sqlite3"
    client = make_client(database_path)
    client.post(
        "/api/appeals/APL-2026-1042/actions",
        json={"action": "Approve"},
    )

    restarted_service = AppealService(AppealRepository(database_path))
    restarted_client = TestClient(create_app(restarted_service))

    response = restarted_client.get("/api/appeals/APL-2026-1042")

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysisPrepared"] is True
    assert payload["status"] == "Approved"
    assert payload["reviewerDecision"] == "Approve"
