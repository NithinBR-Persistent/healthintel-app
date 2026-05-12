from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from healthintel_api.domain.models import AppealCase

MAX_LLM_INPUT_CHARS = 30000
MAX_LIST_ITEMS = 8


@dataclass(frozen=True)
class LlmExtractionResult:
    pdf_summary: str
    ai_brief: str | None = None
    recommendation: str | None = None
    recommended_action: str | None = None
    confidence: str | None = None
    recommendation_rationale: str | None = None
    facts: list[str] = field(default_factory=list)
    timeline: list[str] = field(default_factory=list)
    approval_evidence: list[str] = field(default_factory=list)
    denial_evidence: list[str] = field(default_factory=list)
    missing_docs: list[str] = field(default_factory=list)
    guideline_signals: list[str] = field(default_factory=list)
    extraction_signals: list[str] = field(default_factory=list)
    compliance_notes: list[str] = field(default_factory=list)


def summarize_then_extract_pdf(
    appeal: AppealCase,
    source_text: str | None,
) -> LlmExtractionResult | None:
    if not source_text or not _is_enabled():
        return None

    summary_payload = _summarize_pdf(appeal, source_text[:MAX_LLM_INPUT_CHARS])
    if not summary_payload:
        return None

    extraction_payload = _extract_from_summary(appeal, summary_payload)
    if not extraction_payload:
        return LlmExtractionResult(
            pdf_summary=_as_text(summary_payload.get("pdf_summary")),
            extraction_signals=_as_list(summary_payload.get("key_signals")),
        )

    return LlmExtractionResult(
        pdf_summary=_as_text(
            extraction_payload.get("pdf_summary") or summary_payload.get("pdf_summary")
        ),
        ai_brief=_optional_text(extraction_payload.get("ai_brief")),
        recommendation=_optional_text(extraction_payload.get("recommendation")),
        recommended_action=_optional_text(extraction_payload.get("recommended_action")),
        confidence=_optional_text(extraction_payload.get("confidence")),
        recommendation_rationale=_optional_text(
            extraction_payload.get("recommendation_rationale")
        ),
        facts=_as_list(extraction_payload.get("facts")),
        timeline=_as_list(extraction_payload.get("timeline")),
        approval_evidence=_as_list(extraction_payload.get("approval_evidence")),
        denial_evidence=_as_list(extraction_payload.get("denial_evidence")),
        missing_docs=_as_list(extraction_payload.get("missing_docs")),
        guideline_signals=_as_list(extraction_payload.get("guideline_signals")),
        extraction_signals=_as_list(extraction_payload.get("extraction_signals")),
        compliance_notes=_as_list(extraction_payload.get("compliance_notes")),
    )


def _summarize_pdf(
    appeal: AppealCase,
    source_text: str,
) -> dict[str, Any] | None:
    return _chat_json(
        [
            {
                "role": "system",
                "content": (
                    "You summarize healthcare appeal PDF text for a payer medical "
                    "reviewer. Return compact JSON only. Do not invent facts."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": (
                            "Summarize the PDF first so downstream extraction can "
                            "use fewer tokens."
                        ),
                        "appeal_context": _appeal_context(appeal),
                        "return_json_keys": [
                            "pdf_summary",
                            "clinical_history",
                            "denial_focus",
                            "appeal_argument",
                            "key_signals",
                            "documentation_gaps",
                        ],
                        "pdf_text": source_text,
                    }
                ),
            },
        ]
    )


def _extract_from_summary(
    appeal: AppealCase,
    summary_payload: dict[str, Any],
) -> dict[str, Any] | None:
    return _chat_json(
        [
            {
                "role": "system",
                "content": (
                    "You extract structured appeal review data from a PDF summary. "
                    "Return JSON only. Keep outputs concise and source-grounded."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": (
                            "Extract key review details from the PDF summary. "
                            "Use guideline_signals that match or closely relate "
                            "to the provided guideline labels."
                        ),
                        "appeal_context": _appeal_context(appeal),
                        "guideline_labels": [
                            criterion.label for criterion in appeal.guideline
                        ],
                        "return_json_keys": [
                            "pdf_summary",
                            "facts",
                            "timeline",
                            "approval_evidence",
                            "denial_evidence",
                            "missing_docs",
                            "guideline_signals",
                            "extraction_signals",
                            "ai_brief",
                            "recommendation",
                            "recommended_action",
                            "confidence",
                            "recommendation_rationale",
                            "compliance_notes",
                        ],
                        "recommendation_options": [
                            "Approve",
                            "Request Info",
                            "Draft Uphold",
                        ],
                        "pdf_summary": summary_payload,
                    }
                ),
            },
        ]
    )


def _chat_json(messages: list[dict[str, str]]) -> dict[str, Any] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    timeout = int(os.getenv("HEALTHINTEL_LLM_TIMEOUT_SECONDS", "30"))
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        url=f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.HTTPError, json.JSONDecodeError):
        return None

    content = response_payload.get("choices", [{}])[0].get("message", {}).get("content")
    if not isinstance(content, str):
        return None

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def _is_enabled() -> bool:
    enabled_value = os.getenv("HEALTHINTEL_LLM_ENABLED", "true").lower()
    return enabled_value in {"1", "true", "yes", "on"}


def _appeal_context(appeal: AppealCase) -> dict[str, Any]:
    return {
        "id": appeal.id,
        "member": appeal.member,
        "age": appeal.age,
        "policy_number": appeal.policy_number,
        "plan": appeal.plan,
        "provider": appeal.provider,
        "service": appeal.service,
        "appeal_type": appeal.appeal_type,
        "urgency": appeal.urgency,
        "denial_reason": appeal.denial_reason,
        "appeal_argument": appeal.appeal_argument,
    }


def _as_text(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()

    return "PDF summary was unavailable from the LLM response."


def _optional_text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def _as_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    result: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            result.append(item.strip())
        elif isinstance(item, dict):
            label = item.get("label") or item.get("summary") or item.get("text")
            if isinstance(label, str) and label.strip():
                result.append(label.strip())

        if len(result) >= MAX_LIST_ITEMS:
            break

    return result
