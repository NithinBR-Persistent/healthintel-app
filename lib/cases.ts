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

export type AppealDocument = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  summary: string;
  extractionMode?: string;
  llmSummary?: string | null;
  extractionSignals?: string[];
  contentPreview?: string | null;
};

export type AiRecommendation = {
  action: ReviewerAction;
  confidence: string;
  rationale: string;
  supportingEvidence: string[];
  cautionNotes: string[];
  missingInformation: string[];
  complianceNotes: string[];
};

export type AppealCase = {
  id: string;
  member: string;
  age: number;
  policyNumber?: string | null;
  memberEmail?: string | null;
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
  aiRecommendation?: AiRecommendation | null;
  missingDocs: string[];
  documents?: AppealDocument[];
  audit: AuditEvent[];
  source?: string;
  memberTrackingId?: string | null;
  analysisPrepared: boolean;
  reviewerDecision?: ReviewerAction;
  decisionSummary?: string;
  decisionTime?: string;
};
