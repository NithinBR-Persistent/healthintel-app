import type { AppealCase, ReviewerAction } from "@/lib/cases";

export type CreateAppealPayload = {
  member: string;
  age: number;
  policyNumber: string;
  memberEmail?: string;
  plan: string;
  provider: string;
  service: string;
  appealType: string;
  urgency: "Urgent" | "Standard";
  denialReason: string;
  appealArgument: string;
};

export type AppealDocumentPayload = {
  file: File;
  contentPreview?: string;
};

export type HealthResponse = {
  status: string;
  service: string;
  version: string;
};

export type MemberAppealPayload = CreateAppealPayload & {
  file: File;
};

export type MemberAppealSubmissionResponse = {
  trackingId: string;
  accessCode: string;
  status: string;
  received: string;
  due: string;
  message: string;
};

export type MemberAppealStatusResponse = {
  trackingId: string;
  status: string;
  member: string;
  policyNumber?: string | null;
  memberEmail?: string | null;
  service: string;
  received: string;
  due: string;
  nextStep: string;
  canUploadDocuments: boolean;
  decisionSummary?: string | null;
};

export type OutboxEmail = {
  id: string;
  appealId: string;
  trackingId: string;
  to: string;
  fromEmail: string;
  subject: string;
  status: string;
  body: string;
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

type ApiErrorPayload = {
  detail?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    const isFormData =
      typeof FormData !== "undefined" && init?.body instanceof FormData;
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers
      }
    });
  } catch (error) {
    throw new Error(
      `Backend API is not reachable at ${API_BASE_URL}. Start the FastAPI server and try again.`
    );
  }

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }

    throw new Error(payload?.detail ?? `API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function listAppeals() {
  return request<AppealCase[]>("/api/appeals");
}

export function listOutboxEmails() {
  return request<OutboxEmail[]>("/api/outbox");
}

export function checkApiHealth() {
  return request<HealthResponse>("/api/health");
}

export function createAppeal(payload: CreateAppealPayload) {
  return request<AppealCase>("/api/appeals", {
    body: JSON.stringify(payload),
    method: "POST"
  });
}

export function submitMemberAppeal(payload: MemberAppealPayload) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("member", payload.member);
  formData.append("age", String(payload.age));
  formData.append("policyNumber", payload.policyNumber);
  formData.append("memberEmail", payload.memberEmail ?? "");
  formData.append("plan", payload.plan);
  formData.append("provider", payload.provider);
  formData.append("service", payload.service);
  formData.append("appealType", payload.appealType);
  formData.append("urgency", payload.urgency);
  formData.append("denialReason", payload.denialReason);
  formData.append("appealArgument", payload.appealArgument);

  return request<MemberAppealSubmissionResponse>("/api/member/appeals", {
    body: formData,
    method: "POST"
  });
}

export function getMemberAppealStatus(
  trackingId: string,
  accessCode: string
) {
  const params = new URLSearchParams({ accessCode });
  return request<MemberAppealStatusResponse>(
    `/api/member/appeals/${encodeURIComponent(trackingId)}?${params.toString()}`
  );
}

export function uploadMemberFollowupDocument(
  trackingId: string,
  accessCode: string,
  file: File
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("accessCode", accessCode);

  return request<MemberAppealStatusResponse>(
    `/api/member/appeals/${encodeURIComponent(trackingId)}/documents`,
    {
      body: formData,
      method: "POST"
    }
  );
}

export function uploadAppealDocument(
  appealId: string,
  payload: AppealDocumentPayload
) {
  const formData = new FormData();
  formData.append("file", payload.file);

  if (payload.contentPreview) {
    formData.append("content_preview", payload.contentPreview);
  }

  return request<AppealCase>(`/api/appeals/${appealId}/documents`, {
    body: formData,
    method: "POST"
  });
}

export function generateAppealPacket(appealId: string) {
  return request<AppealCase>(`/api/appeals/${appealId}/generate-packet`, {
    method: "POST"
  });
}

export function applyReviewerAction(
  appealId: string,
  action: ReviewerAction,
  note?: string
) {
  return request<AppealCase>(`/api/appeals/${appealId}/actions`, {
    body: JSON.stringify({ action, note }),
    method: "POST"
  });
}

export function resetAppeals() {
  return request<AppealCase[]>("/api/appeals/reset", {
    method: "POST"
  });
}
