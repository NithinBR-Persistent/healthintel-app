import {
  Activity,
  Brain,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Stethoscope
} from "lucide-react";

export type RiskLevel = "High" | "Medium" | "Low";
export type Urgency = "Urgent" | "Standard";
export type AppealStatus =
  | "New"
  | "AI triaged"
  | "In review"
  | "Decision drafted"
  | "Needs info"
  | "Approved";

export type ReviewerAction = "Approve" | "Request Info" | "Draft Uphold";

export type EvidenceItem = {
  label: string;
  source: string;
};

export type GuidelineCriterion = {
  label: string;
  status: "Met" | "Partial" | "Missing";
};

export type AuditEvent = {
  time: string;
  label: string;
  detail: string;
};

export type AppealCase = {
  id: string;
  member: string;
  age: number;
  plan: string;
  provider: string;
  service: string;
  appealType: string;
  urgency: Urgency;
  status: AppealStatus;
  specialty: string;
  risk: RiskLevel;
  received: string;
  due: string;
  slaLabel: string;
  denialReason: string;
  appealArgument: string;
  aiBrief: string;
  facts: EvidenceItem[];
  timeline: EvidenceItem[];
  approvalEvidence: EvidenceItem[];
  denialEvidence: EvidenceItem[];
  guideline: GuidelineCriterion[];
  recommendation: string;
  missingDocs: string[];
  audit: AuditEvent[];
  analysisPrepared: boolean;
  reviewerDecision?: ReviewerAction;
  decisionSummary?: string;
  decisionTime?: string;
};

export const cases: AppealCase[] = [
  {
    id: "APL-2026-1042",
    member: "Maya R.",
    age: 47,
    plan: "Commercial PPO",
    provider: "Northstar Orthopedics",
    service: "MRI lumbar spine without contrast",
    appealType: "Medical necessity",
    urgency: "Standard",
    status: "New",
    specialty: "Orthopedics / Radiology",
    risk: "Medium",
    received: "May 10, 2026",
    due: "June 9, 2026",
    slaLabel: "29 days left",
    denialReason:
      "Advanced imaging was denied because documentation did not clearly establish failed conservative therapy.",
    appealArgument:
      "Provider states symptoms progressed despite medication, physical therapy, and new neurologic findings suggesting nerve root compression.",
    aiBrief:
      "The appeal concerns denial of lumbar spine MRI for a 47-year-old member with chronic low back pain and worsening left-sided radicular symptoms. Records support conservative treatment with NSAIDs, physical therapy, and home exercise, with persistent symptoms and new neurologic findings. The denial cites insufficient documentation of conservative therapy. The appeal may meet medical necessity criteria if therapy duration and neurologic deficits are confirmed.",
    facts: [
      {
        label: "Primary diagnosis: lumbar radiculopathy with chronic low back pain",
        source: "Provider note p. 4"
      },
      {
        label: "Symptoms persisted after NSAIDs, home exercise, and formal PT",
        source: "PT summary p. 17"
      },
      {
        label: "Positive straight-leg raise documented on left side",
        source: "Exam note p. 9"
      },
      {
        label: "MRI requested to guide injection versus surgical referral",
        source: "Appeal letter p. 2"
      }
    ],
    timeline: [
      {
        label: "Back pain began after lifting injury",
        source: "Jan 2026"
      },
      {
        label: "Started NSAIDs and activity modification",
        source: "Feb 2026"
      },
      {
        label: "Completed six weeks of physical therapy",
        source: "Mar-Apr 2026"
      },
      {
        label: "Radicular symptoms worsened; MRI requested",
        source: "May 2026"
      }
    ],
    approvalEvidence: [
      {
        label: "Persistent radicular pain despite conservative management",
        source: "PT summary p. 17"
      },
      {
        label: "Documented neurologic finding may change treatment plan",
        source: "Exam note p. 9"
      },
      {
        label: "Advanced imaging requested before procedural intervention",
        source: "Appeal letter p. 2"
      }
    ],
    denialEvidence: [
      {
        label: "PT attendance frequency is summarized but not fully itemized",
        source: "PT summary p. 17"
      },
      {
        label: "No severe red-flag symptoms such as cauda equina documented",
        source: "Clinical packet"
      }
    ],
    guideline: [
      {
        label: "Persistent symptoms after conservative therapy",
        status: "Partial"
      },
      {
        label: "Radiculopathy or neurologic deficit documented",
        status: "Met"
      },
      {
        label: "Imaging expected to change management",
        status: "Met"
      },
      {
        label: "Therapy duration clearly documented",
        status: "Partial"
      }
    ],
    recommendation:
      "Approve if physical therapy documentation confirms at least six weeks of conservative management and neurologic deficits are validated. Otherwise request additional information.",
    missingDocs: [
      "Full physical therapy attendance record",
      "Most recent neurologic exam details",
      "Prior imaging report, if available"
    ],
    analysisPrepared: false,
    audit: [
      {
        time: "May 10, 2026 09:15",
        label: "Appeal received",
        detail: "Standard medical necessity appeal opened"
      }
    ]
  },
  {
    id: "APL-2026-1037",
    member: "Daniel K.",
    age: 62,
    plan: "Medicare Advantage",
    provider: "Metro Oncology Group",
    service: "Targeted oncology therapy",
    appealType: "Pharmacy exception",
    urgency: "Urgent",
    status: "New",
    specialty: "Oncology / Pharmacy",
    risk: "High",
    received: "May 11, 2026",
    due: "May 14, 2026",
    slaLabel: "68 hours left",
    denialReason:
      "Therapy denied because required step therapy documentation was incomplete.",
    appealArgument:
      "Oncologist states member progressed after preferred therapy and delay could compromise active cancer treatment.",
    aiBrief:
      "Urgent oncology appeal with potential care-delay risk. Documentation indicates progression on preferred therapy, but the packet needs clearer evidence tying biomarker status and prior-line failure to the requested targeted therapy.",
    facts: [
      {
        label: "Active metastatic cancer treatment documented",
        source: "Oncology note p. 6"
      },
      {
        label: "Prior preferred regimen discontinued after progression",
        source: "Treatment history p. 11"
      }
    ],
    timeline: [
      {
        label: "Preferred therapy initiated",
        source: "Feb 2026"
      },
      {
        label: "Progression noted on restaging scan",
        source: "Apr 2026"
      }
    ],
    approvalEvidence: [
      {
        label: "Progression after preferred therapy",
        source: "Treatment history p. 11"
      }
    ],
    denialEvidence: [
      {
        label: "Biomarker report not included in packet",
        source: "Clinical packet"
      }
    ],
    guideline: [
      {
        label: "Prior-line therapy failure documented",
        status: "Met"
      },
      {
        label: "Biomarker criteria documented",
        status: "Missing"
      }
    ],
    recommendation:
      "Route to oncology pharmacist for urgent review and request biomarker documentation if not available in claims history.",
    missingDocs: ["Biomarker report", "Complete prior authorization denial letter"],
    analysisPrepared: false,
    audit: [
      {
        time: "May 11, 2026 08:42",
        label: "Appeal received",
        detail: "Urgent pharmacy exception appeal opened"
      }
    ]
  },
  {
    id: "APL-2026-1029",
    member: "Eleanor S.",
    age: 74,
    plan: "Medicare Advantage",
    provider: "Lakeside Medical Center",
    service: "Inpatient stay level of care",
    appealType: "Level-of-care review",
    urgency: "Standard",
    status: "New",
    specialty: "Internal Medicine",
    risk: "Medium",
    received: "May 8, 2026",
    due: "June 7, 2026",
    slaLabel: "27 days left",
    denialReason:
      "Inpatient admission denied because observation level of care appeared sufficient based on submitted records.",
    appealArgument:
      "Hospital states admission was medically necessary due to unstable vitals, dehydration, and worsening renal function.",
    aiBrief:
      "Standard level-of-care appeal. The packet includes evidence of clinical instability but lacks complete nursing flowsheets and serial lab results needed to validate inpatient intensity.",
    facts: [
      {
        label: "Acute kidney injury referenced in admission note",
        source: "Admission note p. 3"
      },
      {
        label: "Serial creatinine trend is incomplete",
        source: "Lab section"
      }
    ],
    timeline: [
      {
        label: "Emergency department presentation",
        source: "May 4, 2026"
      },
      {
        label: "Admitted for monitoring and IV fluids",
        source: "May 4, 2026"
      }
    ],
    approvalEvidence: [
      {
        label: "AKI and unstable vitals described",
        source: "Admission note p. 3"
      }
    ],
    denialEvidence: [
      {
        label: "Missing nursing flowsheets limit intensity validation",
        source: "Clinical packet"
      }
    ],
    guideline: [
      {
        label: "Acute physiologic instability",
        status: "Partial"
      },
      {
        label: "Inpatient monitoring intensity documented",
        status: "Missing"
      }
    ],
    recommendation:
      "Request additional clinical documentation before drafting a final recommendation.",
    missingDocs: ["Nursing flowsheets", "Serial labs", "Medication administration record"],
    analysisPrepared: false,
    audit: [
      {
        time: "May 8, 2026 14:03",
        label: "Appeal received",
        detail: "Standard level-of-care appeal opened"
      }
    ]
  }
];

export const impactMetrics = [
  {
    label: "Review time",
    value: "18 min",
    detail: "Target from 45-90 min baseline",
    icon: Activity
  },
  {
    label: "SLA risk",
    value: "0 cases",
    detail: "No appeal within 24 hours of breach",
    icon: ClipboardCheck
  },
  {
    label: "Estimated savings",
    value: "$42M",
    detail: "Modeled annual opportunity",
    icon: FileText
  },
  {
    label: "Consistency",
    value: "92%",
    detail: "Guideline-aligned review packets",
    icon: Brain
  }
];

export const quickStats = [
  {
    label: "Open appeals",
    value: "128",
    trend: "+14 today",
    icon: FileText
  },
  {
    label: "Urgent queue",
    value: "9",
    trend: "72-hour SLA",
    icon: HeartPulse
  },
  {
    label: "Specialist routed",
    value: "84%",
    trend: "First-pass match",
    icon: Stethoscope
  }
];
