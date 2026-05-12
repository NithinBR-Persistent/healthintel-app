from __future__ import annotations

from healthintel_api.domain.models import (
    AppealCase,
    AppealStatus,
    AuditEvent,
    CriterionStatus,
    EvidenceItem,
    GuidelineCriterion,
    RiskLevel,
    Urgency,
)


def seed_appeals() -> list[AppealCase]:
    return [
        AppealCase(
            id="APL-2026-1042",
            member="Maya R.",
            age=47,
            policy_number="POL-48392017",
            member_email="maya.member@example.com",
            plan="Commercial PPO",
            provider="Northstar Orthopedics",
            service="MRI lumbar spine without contrast",
            appeal_type="Medical necessity",
            urgency=Urgency.STANDARD,
            status=AppealStatus.NEW,
            specialty="Orthopedics / Radiology",
            risk=RiskLevel.MEDIUM,
            received="May 10, 2026",
            due="June 9, 2026",
            sla_label="29 days left",
            denial_reason=(
                "Advanced imaging was denied because documentation did not clearly "
                "establish failed conservative therapy."
            ),
            appeal_argument=(
                "Provider states symptoms progressed despite medication, physical "
                "therapy, and new neurologic findings suggesting nerve root "
                "compression."
            ),
            ai_brief=(
                "The appeal concerns denial of lumbar spine MRI for a 47-year-old "
                "member with chronic low back pain and worsening left-sided radicular "
                "symptoms. Records support conservative treatment with NSAIDs, "
                "physical therapy, and home exercise, with persistent symptoms and "
                "new neurologic "
                "findings. The denial cites insufficient documentation of conservative "
                "therapy. The appeal may meet medical necessity criteria if therapy "
                "duration and neurologic deficits are confirmed."
            ),
            facts=[
                EvidenceItem(
                    label=(
                        "Primary diagnosis: lumbar radiculopathy with chronic low "
                        "back pain"
                    ),
                    source="Provider note p. 4",
                ),
                EvidenceItem(
                    label=(
                        "Symptoms persisted after NSAIDs, home exercise, and formal PT"
                    ),
                    source="PT summary p. 17",
                ),
                EvidenceItem(
                    label="Positive straight-leg raise documented on left side",
                    source="Exam note p. 9",
                ),
                EvidenceItem(
                    label="MRI requested to guide injection versus surgical referral",
                    source="Appeal letter p. 2",
                ),
            ],
            timeline=[
                EvidenceItem(
                    label="Back pain began after lifting injury",
                    source="Jan 2026",
                ),
                EvidenceItem(
                    label="Started NSAIDs and activity modification",
                    source="Feb 2026",
                ),
                EvidenceItem(
                    label="Completed six weeks of physical therapy",
                    source="Mar-Apr 2026",
                ),
                EvidenceItem(
                    label="Radicular symptoms worsened; MRI requested",
                    source="May 2026",
                ),
            ],
            approval_evidence=[
                EvidenceItem(
                    label="Persistent radicular pain despite conservative management",
                    source="PT summary p. 17",
                ),
                EvidenceItem(
                    label="Documented neurologic finding may change treatment plan",
                    source="Exam note p. 9",
                ),
                EvidenceItem(
                    label="Advanced imaging requested before procedural intervention",
                    source="Appeal letter p. 2",
                ),
            ],
            denial_evidence=[
                EvidenceItem(
                    label=(
                        "PT attendance frequency is summarized but not fully itemized"
                    ),
                    source="PT summary p. 17",
                ),
                EvidenceItem(
                    label="No severe red-flag symptoms such as cauda equina documented",
                    source="Clinical packet",
                ),
            ],
            guideline=[
                GuidelineCriterion(
                    label="Persistent symptoms after conservative therapy",
                    status=CriterionStatus.PARTIAL,
                ),
                GuidelineCriterion(
                    label="Radiculopathy or neurologic deficit documented",
                    status=CriterionStatus.MET,
                ),
                GuidelineCriterion(
                    label="Imaging expected to change management",
                    status=CriterionStatus.MET,
                ),
                GuidelineCriterion(
                    label="Therapy duration clearly documented",
                    status=CriterionStatus.PARTIAL,
                ),
            ],
            recommendation=(
                "Approve if physical therapy documentation confirms at least six weeks "
                "of conservative management and neurologic deficits are validated. "
                "Otherwise request additional information."
            ),
            missing_docs=[
                "Full physical therapy attendance record",
                "Most recent neurologic exam details",
                "Prior imaging report, if available",
            ],
            audit=[
                AuditEvent(
                    time="May 10, 2026 09:15",
                    label="Appeal received",
                    detail="Standard medical necessity appeal opened",
                )
            ],
        ),
        AppealCase(
            id="APL-2026-1037",
            member="Daniel K.",
            age=62,
            policy_number="POL-74012983",
            member_email="daniel.member@example.com",
            plan="Medicare Advantage",
            provider="Metro Oncology Group",
            service="Targeted oncology therapy",
            appeal_type="Pharmacy exception",
            urgency=Urgency.URGENT,
            status=AppealStatus.NEW,
            specialty="Oncology / Pharmacy",
            risk=RiskLevel.HIGH,
            received="May 11, 2026",
            due="May 14, 2026",
            sla_label="68 hours left",
            denial_reason=(
                "Therapy denied because required step therapy documentation was "
                "incomplete."
            ),
            appeal_argument=(
                "Oncologist states member progressed after preferred therapy and delay "
                "could compromise active cancer treatment."
            ),
            ai_brief=(
                "Urgent oncology appeal with potential care-delay risk. Documentation "
                "indicates progression on preferred therapy, but the packet needs "
                "clearer evidence tying biomarker status and prior-line failure to "
                "the requested "
                "targeted therapy."
            ),
            facts=[
                EvidenceItem(
                    label="Active metastatic cancer treatment documented",
                    source="Oncology note p. 6",
                ),
                EvidenceItem(
                    label="Prior preferred regimen discontinued after progression",
                    source="Treatment history p. 11",
                ),
            ],
            timeline=[
                EvidenceItem(label="Preferred therapy initiated", source="Feb 2026"),
                EvidenceItem(
                    label="Progression noted on restaging scan",
                    source="Apr 2026",
                ),
            ],
            approval_evidence=[
                EvidenceItem(
                    label="Progression after preferred therapy",
                    source="Treatment history p. 11",
                )
            ],
            denial_evidence=[
                EvidenceItem(
                    label="Biomarker report not included in packet",
                    source="Clinical packet",
                )
            ],
            guideline=[
                GuidelineCriterion(
                    label="Prior-line therapy failure documented",
                    status=CriterionStatus.MET,
                ),
                GuidelineCriterion(
                    label="Biomarker criteria documented",
                    status=CriterionStatus.MISSING,
                ),
            ],
            recommendation=(
                "Route to oncology pharmacist for urgent review and request biomarker "
                "documentation if not available in claims history."
            ),
            missing_docs=[
                "Biomarker report",
                "Complete prior authorization denial letter",
            ],
            audit=[
                AuditEvent(
                    time="May 11, 2026 08:42",
                    label="Appeal received",
                    detail="Urgent pharmacy exception appeal opened",
                )
            ],
        ),
        AppealCase(
            id="APL-2026-1029",
            member="Eleanor S.",
            age=74,
            policy_number="POL-60218455",
            member_email="eleanor.member@example.com",
            plan="Medicare Advantage",
            provider="Lakeside Medical Center",
            service="Inpatient stay level of care",
            appeal_type="Level-of-care review",
            urgency=Urgency.STANDARD,
            status=AppealStatus.NEW,
            specialty="Internal Medicine",
            risk=RiskLevel.MEDIUM,
            received="May 8, 2026",
            due="June 7, 2026",
            sla_label="27 days left",
            denial_reason=(
                "Inpatient admission denied because observation level of care appeared "
                "sufficient based on submitted records."
            ),
            appeal_argument=(
                "Hospital states admission was medically necessary due to unstable "
                "vitals, dehydration, and worsening renal function."
            ),
            ai_brief=(
                "Standard level-of-care appeal. The packet includes evidence of "
                "clinical instability but lacks complete nursing flowsheets and "
                "serial lab results "
                "needed to validate inpatient intensity."
            ),
            facts=[
                EvidenceItem(
                    label="Acute kidney injury referenced in admission note",
                    source="Admission note p. 3",
                ),
                EvidenceItem(
                    label="Serial creatinine trend is incomplete",
                    source="Lab section",
                ),
            ],
            timeline=[
                EvidenceItem(
                    label="Emergency department presentation",
                    source="May 4, 2026",
                ),
                EvidenceItem(
                    label="Admitted for monitoring and IV fluids",
                    source="May 4, 2026",
                ),
            ],
            approval_evidence=[
                EvidenceItem(
                    label="AKI and unstable vitals described",
                    source="Admission note p. 3",
                )
            ],
            denial_evidence=[
                EvidenceItem(
                    label="Missing nursing flowsheets limit intensity validation",
                    source="Clinical packet",
                )
            ],
            guideline=[
                GuidelineCriterion(
                    label="Acute physiologic instability",
                    status=CriterionStatus.PARTIAL,
                ),
                GuidelineCriterion(
                    label="Inpatient monitoring intensity documented",
                    status=CriterionStatus.MISSING,
                ),
            ],
            recommendation=(
                "Request additional clinical documentation before drafting a final "
                "recommendation."
            ),
            missing_docs=[
                "Nursing flowsheets",
                "Serial labs",
                "Medication administration record",
            ],
            audit=[
                AuditEvent(
                    time="May 8, 2026 14:03",
                    label="Appeal received",
                    detail="Standard level-of-care appeal opened",
                )
            ],
        ),
    ]
