"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  FileText,
  FileUp,
  LogOut,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  API_BASE_URL,
  checkApiHealth,
  getMemberAppealStatus,
  submitMemberAppeal,
  uploadMemberFollowupDocument,
  type MemberAppealPayload,
  type MemberAppealStatusResponse,
  type MemberAppealSubmissionResponse
} from "@/lib/api";

type MemberPortalView = "submit" | "status";
type ApiStatus = "checking" | "connected" | "unavailable";
type MemberUser = {
  email: string;
  role: string;
};

type MemberAppealFormState = Omit<MemberAppealPayload, "age" | "file"> & {
  age: string;
};

const MEMBER_AUTH_KEY = "healthintel.member.auth.v1";
const MEMBER_STATUS_KEY = "healthintel.member.latest.v1";

const statusClasses: Record<string, string> = {
  Submitted: "border-cyan-200 bg-cyan-50 text-cyan-700",
  "In review": "border-blue-200 bg-blue-50 text-blue-700",
  "More information requested": "border-amber-200 bg-amber-50 text-amber-700",
  "Decision issued": "border-emerald-200 bg-emerald-50 text-emerald-700"
};

export function MemberAppealPortal({
  trackingId,
  view
}: {
  trackingId?: string;
  view: MemberPortalView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [apiError, setApiError] = useState<string | null>(null);
  const [memberUser, setMemberUser] = useState<MemberUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [submission, setSubmission] =
    useState<MemberAppealSubmissionResponse | null>(null);
  const [statusResult, setStatusResult] =
    useState<MemberAppealStatusResponse | null>(null);
  const [statusForm, setStatusForm] = useState({
    trackingId: trackingId ?? "",
    accessCode: searchParams.get("accessCode") ?? ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isUploadingFollowup, setIsUploadingFollowup] = useState(false);

  useEffect(() => {
    try {
      const savedUser = window.localStorage.getItem(MEMBER_AUTH_KEY);
      if (!savedUser) {
        router.replace(
          `/login?mode=member&next=${encodeURIComponent(
            `${pathname}${window.location.search}`
          )}`
        );
        return;
      }

      setMemberUser(JSON.parse(savedUser) as MemberUser);
      setAuthChecked(true);
    } catch {
      window.localStorage.removeItem(MEMBER_AUTH_KEY);
      router.replace(`/login?mode=member&next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    async function checkApi() {
      try {
        await checkApiHealth();
        setApiStatus("connected");
      } catch (error) {
        setApiStatus("unavailable");
        setApiError(getErrorMessage(error));
      }
    }

    void checkApi();
  }, [authChecked]);

  useEffect(() => {
    if (!trackingId || !statusForm.accessCode) {
      return;
    }

    void loadStatus(trackingId, statusForm.accessCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingId, statusForm.accessCode]);

  async function submitAppeal(payload: MemberAppealPayload) {
    setIsSubmitting(true);
    setApiError(null);
    setSubmission(null);

    try {
      const response = await submitMemberAppeal(payload);
      setSubmission(response);
      setStatusResult(null);
      setApiStatus("connected");
      window.localStorage.setItem(
        MEMBER_STATUS_KEY,
        JSON.stringify({
          accessCode: response.accessCode,
          trackingId: response.trackingId
        })
      );
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadStatus(targetTrackingId: string, accessCode: string) {
    setIsCheckingStatus(true);
    setApiError(null);

    try {
      const response = await getMemberAppealStatus(targetTrackingId, accessCode);
      setStatusResult(response);
      setApiStatus("connected");
      window.localStorage.setItem(
        MEMBER_STATUS_KEY,
        JSON.stringify({
          accessCode,
          trackingId: targetTrackingId
        })
      );
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    } finally {
      setIsCheckingStatus(false);
    }
  }

  async function uploadFollowupDocument(file: File) {
    if (!statusResult) {
      return;
    }

    setIsUploadingFollowup(true);
    setApiError(null);

    try {
      const response = await uploadMemberFollowupDocument(
        statusResult.trackingId,
        statusForm.accessCode,
        file
      );
      setStatusResult(response);
      setApiStatus("connected");
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    } finally {
      setIsUploadingFollowup(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem(MEMBER_AUTH_KEY);
    router.push("/login?mode=member");
  }

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-ink">
        <div className="rounded-lg border border-border bg-panel p-6 text-sm font-semibold text-muted shadow-soft">
          Loading member portal...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <MemberHeader
          apiStatus={apiStatus}
          memberUser={memberUser}
          onSignOut={signOut}
        />

        {apiError ? <MemberError message={apiError} /> : null}

        {view === "submit" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
            <MemberSubmitForm
              apiStatus={apiStatus}
              isSubmitting={isSubmitting}
              memberEmail={memberUser?.email ?? ""}
              onSubmit={submitAppeal}
            />
            <MemberSidePanel
              isCheckingStatus={isCheckingStatus}
              onLookup={(nextTrackingId, nextAccessCode) => {
                setStatusForm({
                  accessCode: nextAccessCode,
                  trackingId: nextTrackingId
                });
                void loadStatus(nextTrackingId, nextAccessCode);
              }}
              statusResult={statusResult}
              submission={submission}
            />
          </div>
        ) : (
          <MemberStatusPanel
            isCheckingStatus={isCheckingStatus}
            onLookup={(nextTrackingId, nextAccessCode) => {
              setStatusForm({
                accessCode: nextAccessCode,
                trackingId: nextTrackingId
              });
              router.push(
                `/member/status/${encodeURIComponent(
                  nextTrackingId
                )}?accessCode=${encodeURIComponent(nextAccessCode)}`
              );
              void loadStatus(nextTrackingId, nextAccessCode);
            }}
            isUploadingFollowup={isUploadingFollowup}
            onUploadFollowup={uploadFollowupDocument}
            statusForm={statusForm}
            statusResult={statusResult}
          />
        )}
      </div>
    </main>
  );
}

function MemberHeader({
  apiStatus,
  memberUser,
  onSignOut
}: {
  apiStatus: ApiStatus;
  memberUser: MemberUser | null;
  onSignOut: () => void;
}) {
  return (
    <header className="rounded-lg border border-border bg-panel p-4 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              HealthIntel
            </p>
            <h1 className="text-xl font-semibold text-ink">
              Member Appeal Portal
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ApiStatusBadge status={apiStatus} />
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
            {memberUser?.email ?? "member account"}
          </span>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
            onClick={onSignOut}
            type="button"
          >
            <LogOut className="h-4 w-4 text-accent" aria-hidden="true" />
            Sign out
          </button>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
            href="/login"
          >
            <LockKeyhole className="h-4 w-4 text-accent" aria-hidden="true" />
            Reviewer login
          </Link>
        </div>
      </div>
    </header>
  );
}

function MemberSubmitForm({
  apiStatus,
  isSubmitting,
  memberEmail,
  onSubmit
}: {
  apiStatus: ApiStatus;
  isSubmitting: boolean;
  memberEmail: string;
  onSubmit: (payload: MemberAppealPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<MemberAppealFormState>({
    member: "",
    age: "",
    policyNumber: "",
    memberEmail,
    plan: "Commercial PPO",
    provider: "",
    service: "",
    appealType: "Medical necessity",
    urgency: "Standard",
    denialReason: "",
    appealArgument: ""
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const isApiConnected = apiStatus === "connected";

  useEffect(() => {
    setForm((currentForm) => ({
      ...currentForm,
      memberEmail: currentForm.memberEmail || memberEmail
    }));
  }, [memberEmail]);

  function updateField(field: keyof MemberAppealFormState, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFileError(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!isPdfFile(nextFile)) {
      setFile(null);
      setFileError("Please add the appeal documents as a PDF.");
      return;
    }

    setFile(nextFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setFileError("Please add the appeal documents as a PDF.");
      return;
    }

    await onSubmit({ ...form, age: Number(form.age), file });
  }

  return (
    <form
      className="rounded-lg border border-border bg-panel p-4 shadow-soft"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink">Submit an appeal</h2>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField
          label="Member Name"
          onChange={(value) => updateField("member", value)}
          placeholder="Elena Thompson"
          value={form.member}
        />
        <TextField
          label="Policy Number"
          onChange={(value) => updateField("policyNumber", value)}
          placeholder="POL-55281409"
          value={form.policyNumber}
        />
        <TextField
          label="Member Email"
          onChange={(value) => updateField("memberEmail", value)}
          placeholder="member@example.com"
          type="email"
          value={form.memberEmail ?? ""}
        />
        <NumberField
          label="Age"
          onChange={(value) => updateField("age", value)}
          placeholder="59"
          value={form.age}
        />
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Plan
          <select
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
            onChange={(event) => updateField("plan", event.target.value)}
            value={form.plan}
          >
            <option>Commercial PPO</option>
            <option>Medicare Advantage</option>
            <option>Managed Medicaid</option>
          </select>
        </label>
        <TextField
          label="Provider"
          onChange={(value) => updateField("provider", value)}
          placeholder="North Valley Spine Institute"
          value={form.provider}
        />
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Urgency
          <select
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
            onChange={(event) =>
              updateField(
                "urgency",
                event.target.value as MemberAppealPayload["urgency"]
              )
            }
            value={form.urgency}
          >
            <option>Standard</option>
            <option>Urgent</option>
          </select>
        </label>
        <TextField
          className="md:col-span-2"
          label="Service or treatment"
          onChange={(value) => updateField("service", value)}
          placeholder="MRI lumbar spine without contrast"
          value={form.service}
        />
        <TextAreaField
          label="Denial Reason"
          onChange={(value) => updateField("denialReason", value)}
          placeholder="The request was denied because documentation was incomplete."
          value={form.denialReason}
        />
        <TextAreaField
          label="Why are you appealing?"
          onChange={(value) => updateField("appealArgument", value)}
          placeholder="Explain why the service should be approved and reference the attached PDF."
          value={form.appealArgument}
        />
      </div>

      <label
        className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-accent/40 bg-surface px-4 py-8 text-center transition hover:border-accent"
        htmlFor="member-appeal-document"
      >
        <FileUp className="h-8 w-8 text-accent" aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">
          {file ? file.name : "Add appeal documents"}
        </span>
        <span className="text-xs font-medium text-muted">
          {file ? formatFileSize(file.size) : "PDF required"}
        </span>
        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          id="member-appeal-document"
          onChange={handleFileChange}
          required
          type="file"
        />
      </label>
      {fileError ? (
        <p className="mt-2 text-sm font-semibold text-red-700">{fileError}</p>
      ) : null}

      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6968] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting || !file || !isApiConnected}
        type="submit"
      >
        <FileUp className="h-4 w-4" aria-hidden="true" />
        {!isApiConnected
          ? "System unavailable"
          : isSubmitting
          ? "Submitting..."
          : "Submit appeal"}
      </button>
    </form>
  );
}

function MemberSidePanel({
  isCheckingStatus,
  onLookup,
  statusResult,
  submission
}: {
  isCheckingStatus: boolean;
  onLookup: (trackingId: string, accessCode: string) => void;
  statusResult: MemberAppealStatusResponse | null;
  submission: MemberAppealSubmissionResponse | null;
}) {
  return (
    <aside className="flex flex-col gap-4">
      {submission ? <SubmissionCard submission={submission} /> : null}
      <MemberStatusLookup
        isCheckingStatus={isCheckingStatus}
        onLookup={onLookup}
      />
      {statusResult ? <StatusCard statusResult={statusResult} /> : null}
    </aside>
  );
}

function MemberStatusPanel({
  isUploadingFollowup,
  isCheckingStatus,
  onLookup,
  onUploadFollowup,
  statusForm,
  statusResult
}: {
  isUploadingFollowup: boolean;
  isCheckingStatus: boolean;
  onLookup: (trackingId: string, accessCode: string) => void;
  onUploadFollowup: (file: File) => Promise<void>;
  statusForm: { trackingId: string; accessCode: string };
  statusResult: MemberAppealStatusResponse | null;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <MemberStatusLookup
        initialAccessCode={statusForm.accessCode}
        initialTrackingId={statusForm.trackingId}
        isCheckingStatus={isCheckingStatus}
        onLookup={onLookup}
      />
      {statusResult ? (
        <div className="flex flex-col gap-4">
          <StatusCard statusResult={statusResult} />
          {statusResult.canUploadDocuments ? (
            <FollowupUploadCard
              isUploading={isUploadingFollowup}
              onUpload={onUploadFollowup}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-panel p-6 text-sm font-semibold text-muted shadow-soft">
          Enter a tracking ID and access code to view appeal status.
        </div>
      )}
    </section>
  );
}

function FollowupUploadCard({
  isUploading,
  onUpload
}: {
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFileError(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!isPdfFile(nextFile)) {
      setFile(null);
      setFileError("Please add the requested documents as a PDF.");
      return;
    }

    setFile(nextFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setFileError("Please add the requested documents as a PDF.");
      return;
    }

    await onUpload(file);
    setFile(null);
  }

  return (
    <form
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-soft"
      onSubmit={handleSubmit}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <FileUp className="h-4 w-4" aria-hidden="true" />
        Upload requested documents
      </p>
      <p className="mt-2 text-sm leading-6 text-amber-800">
        The review team asked for more information. Add the requested PDF so
        the case can return to clinical review.
      </p>
      <label
        className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-white px-4 py-5 text-center transition hover:border-amber-500"
        htmlFor="member-followup-document"
      >
        <FileUp className="h-6 w-6 text-amber-700" aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">
          {file ? file.name : "Add requested documents"}
        </span>
        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          id="member-followup-document"
          onChange={handleFileChange}
          type="file"
        />
      </label>
      {fileError ? (
        <p className="mt-2 text-sm font-semibold text-red-700">{fileError}</p>
      ) : null}
      <button
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={!file || isUploading}
        type="submit"
      >
        <FileUp className="h-4 w-4" aria-hidden="true" />
        {isUploading ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}

function SubmissionCard({
  submission
}: {
  submission: MemberAppealSubmissionResponse;
}) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Appeal submitted
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
        <KeyValue label="Tracking ID" value={submission.trackingId} />
        <KeyValue label="Access Code" value={submission.accessCode} />
        <KeyValue label="Status" value={submission.status} />
      </div>
      <Link
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
        href={`/member/status/${encodeURIComponent(
          submission.trackingId
        )}?accessCode=${encodeURIComponent(submission.accessCode)}`}
      >
        View status
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

function MemberStatusLookup({
  initialAccessCode = "",
  initialTrackingId = "",
  isCheckingStatus,
  onLookup
}: {
  initialAccessCode?: string;
  initialTrackingId?: string;
  isCheckingStatus: boolean;
  onLookup: (trackingId: string, accessCode: string) => void;
}) {
  const [trackingId, setTrackingId] = useState(initialTrackingId);
  const [accessCode, setAccessCode] = useState(initialAccessCode);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLookup(trackingId, accessCode);
  }

  return (
    <form
      className="rounded-lg border border-border bg-panel p-4 shadow-soft"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-2">
        <FileSearch className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink">Check Status</h2>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <TextField
          label="Tracking ID"
          onChange={setTrackingId}
          value={trackingId}
        />
        <TextField
          label="Access Code"
          onChange={setAccessCode}
          value={accessCode}
        />
      </div>
      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isCheckingStatus || !trackingId || !accessCode}
        type="submit"
      >
        <FileSearch className="h-4 w-4 text-accent" aria-hidden="true" />
        {isCheckingStatus ? "Checking..." : "Check status"}
      </button>
    </form>
  );
}

function StatusCard({
  statusResult
}: {
  statusResult: MemberAppealStatusResponse;
}) {
  const decisionSummaryClass =
    statusResult.status === "More information requested"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Appeal Status
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            {statusResult.service}
          </h2>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            statusClasses[statusResult.status] ??
            "border-slate-200 bg-slate-100 text-slate-700"
          }`}
        >
          {statusResult.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <KeyValue label="Tracking ID" value={statusResult.trackingId} />
        <KeyValue label="Policy Number" value={statusResult.policyNumber ?? "-"} />
        <KeyValue label="Submitted" value={statusResult.received} />
        <KeyValue label="Decision Due" value={statusResult.due} />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />
          Next step
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          {statusResult.nextStep}
        </p>
      </div>

      {statusResult.decisionSummary ? (
        <p
          className={`mt-3 rounded-lg border p-3 text-sm leading-6 ${decisionSummaryClass}`}
        >
          {statusResult.decisionSummary}
        </p>
      ) : null}
    </section>
  );
}

function ApiStatusBadge({ status }: { status: ApiStatus }) {
  const config = {
    checking: "border-amber-200 bg-amber-50 text-amber-700",
    connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
    unavailable: "border-red-200 bg-red-50 text-red-700"
  } satisfies Record<ApiStatus, string>;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${config[status]}`}
      title={`Connection: ${API_BASE_URL}`}
    >
      {status === "unavailable" ? (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      System {status === "connected" ? "online" : status}
    </span>
  );
}

function MemberError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-soft">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {message}
      </span>
    </div>
  );
}

function TextField({
  className = "",
  label,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-semibold text-ink ${className}`}>
      {label}
      <input
        className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

function NumberField({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      <input
        className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
        min={0}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type="number"
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      <textarea
        className="min-h-[112px] rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium leading-6 text-ink outline-none transition focus:border-accent"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        value={value}
      />
    </label>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function formatFileSize(fileSize: number) {
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong while calling HealthIntel.";
}
