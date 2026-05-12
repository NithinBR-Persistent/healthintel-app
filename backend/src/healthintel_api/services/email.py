from __future__ import annotations

import os
from dataclasses import dataclass

from healthintel_api.domain.models import AppealCase, ReviewerAction

OUTBOX: list[OutboxEmail] = []


@dataclass(frozen=True)
class EmailDeliveryResult:
    attempted: bool
    sent: bool
    detail: str
    provider_message_id: str | None = None


@dataclass(frozen=True)
class OutboxEmail:
    id: str
    appeal_id: str
    tracking_id: str
    to: str
    from_email: str
    subject: str
    status: str
    body: str


def send_member_status_email(
    appeal: AppealCase,
    action: ReviewerAction,
) -> EmailDeliveryResult:
    if not appeal.member_email:
        return EmailDeliveryResult(
            attempted=False,
            sent=False,
            detail="Member email was not available.",
        )

    email = _build_outbox_email(appeal, action)
    OUTBOX.append(email)
    return EmailDeliveryResult(
        attempted=True,
        sent=True,
        detail=f"Email queued in demo outbox for {appeal.member_email}.",
        provider_message_id=email.id,
    )


def list_outbox_emails() -> list[OutboxEmail]:
    return list(reversed(OUTBOX))


def reset_outbox() -> None:
    OUTBOX.clear()


def _build_outbox_email(
    appeal: AppealCase,
    action: ReviewerAction,
) -> OutboxEmail:
    email_from = os.getenv("EMAIL_FROM", "HealthIntel <demo@healthintel.local>")
    app_url = os.getenv("HEALTHINTEL_PUBLIC_APP_URL", "http://localhost:3000")
    tracking_id = appeal.member_tracking_id or appeal.id
    status = _status_label(action)
    status_url = f"{app_url.rstrip('/')}/member/status/{tracking_id}"
    email_id = f"OUTBOX-{len(OUTBOX) + 1:04d}"
    return OutboxEmail(
        id=email_id,
        appeal_id=appeal.id,
        tracking_id=tracking_id,
        to=appeal.member_email or "",
        from_email=email_from,
        subject="Your HealthIntel appeal status changed",
        status=status,
        body=(
            "Your HealthIntel appeal status changed.\n\n"
            f"New status: {status}\n"
            f"Tracking ID: {tracking_id}\n\n"
            "Please sign in to the member portal to view next steps:\n"
            f"{status_url}\n\n"
            "For privacy, this demo notification does not include clinical details."
        ),
    )


def _status_label(action: ReviewerAction) -> str:
    if action == ReviewerAction.REQUEST_INFO:
        return "More information requested"

    return "Decision issued"
