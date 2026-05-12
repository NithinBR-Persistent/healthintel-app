"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ClipboardCheck,
  FileSearch,
  FileText,
  FileUp,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  LucideIcon,
  PanelRightOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppealCase, AppealStatus, ReviewerAction } from "@/lib/cases";
import {
  API_BASE_URL,
  applyReviewerAction,
  checkApiHealth,
  createAppeal,
  generateAppealPacket,
  listAppeals,
  listOutboxEmails,
  resetAppeals,
  uploadAppealDocument,
  type AppealDocumentPayload,
  type CreateAppealPayload,
  type OutboxEmail
} from "@/lib/api";

type WorkspaceView = "dashboard" | "appeals" | "case" | "intake" | "policies";
type ApiStatus = "checking" | "connected" | "unavailable";

type DemoUser = {
  email: string;
  role: string;
};

type IntakeFormState = Omit<CreateAppealPayload, "age"> & {
  age: string;
};

const AUTH_KEY = "healthintel.auth.v1";
const WORKFLOW_STORAGE_KEYS = [
  "healthintel.appeals.v3",
  "healthintel.appeals.v1",
  "healthintel.appeals.v2"
];

const riskClasses = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200"
};

const urgencyClasses = {
  Urgent: "bg-red-600 text-white",
  Standard: "bg-slate-900 text-white"
};

const criterionClasses = {
  Met: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
  Missing: "bg-slate-100 text-slate-600 border-slate-200"
};

const statusClasses: Record<AppealStatus, string> = {
  New: "bg-slate-100 text-slate-700 border-slate-200",
  "AI triaged": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "In review": "bg-blue-50 text-blue-700 border-blue-200",
  "Decision drafted": "bg-violet-50 text-violet-700 border-violet-200",
  "Needs info": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200"
};

const packetClasses = {
  Ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-slate-100 text-slate-700 border-slate-200"
};

const policyLibrary = [
  {
    title: "Lumbar Spine MRI Medical Necessity",
    domain: "Imaging",
    updated: "May 2026",
    criteria: [
      "Persistent symptoms after conservative therapy",
      "Radiculopathy or neurologic deficit documented",
      "Imaging expected to change management",
      "Therapy duration clearly documented"
    ]
  },
  {
    title: "Oncology Targeted Therapy Exception",
    domain: "Pharmacy",
    updated: "Apr 2026",
    criteria: [
      "Prior-line therapy failure documented",
      "Biomarker criteria documented",
      "Requested therapy matches diagnosis and mutation profile",
      "Delay could compromise active treatment"
    ]
  },
  {
    title: "Inpatient Level-of-Care Review",
    domain: "Medical",
    updated: "Mar 2026",
    criteria: [
      "Acute physiologic instability",
      "Inpatient monitoring intensity documented",
      "Observation status clinically insufficient",
      "Serial labs and nursing flowsheets support intensity"
    ]
  }
];

export function HealthIntelWorkspace({
  caseId,
  view
}: {
  caseId?: string;
  view: WorkspaceView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [appeals, setAppeals] = useState<AppealCase[]>([]);
  const [outboxEmails, setOutboxEmails] = useState<OutboxEmail[]>([]);
  const [generatingCaseId, setGeneratingCaseId] = useState<string | null>(null);
  const [actingCaseId, setActingCaseId] = useState<string | null>(null);
  const [isCreatingAppeal, setIsCreatingAppeal] = useState(false);
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(true);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [apiError, setApiError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const updateAppeal = useCallback((updatedAppeal: AppealCase) => {
    setAppeals((currentAppeals) =>
      currentAppeals.map((appeal) =>
        appeal.id === updatedAppeal.id ? updatedAppeal : appeal
      )
    );
  }, []);

  const loadAppealsFromApi = useCallback(async ({
    showLoading = true
  }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setIsLoadingAppeals(true);
    }
    if (showLoading) {
      setApiStatus("checking");
    }
    setApiError(null);

    try {
      await checkApiHealth();
      const [nextAppeals, nextOutboxEmails] = await Promise.all([
        listAppeals(),
        listOutboxEmails()
      ]);
      setAppeals(nextAppeals);
      setOutboxEmails(nextOutboxEmails);
      setApiStatus("connected");
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    } finally {
      if (showLoading) {
        setIsLoadingAppeals(false);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const savedUser = window.localStorage.getItem(AUTH_KEY);
      if (!savedUser) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const parsedUser = JSON.parse(savedUser) as DemoUser;
      const normalizedUser: DemoUser = {
        email: parsedUser.email,
        role: "Appeals Reviewer"
      };
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      setAuthChecked(true);
    } catch {
      window.localStorage.removeItem(AUTH_KEY);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (authChecked) {
      void loadAppealsFromApi();
    }
  }, [authChecked, loadAppealsFromApi]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    function refreshVisibleReviewerQueue() {
      if (document.visibilityState === "visible") {
        void loadAppealsFromApi({ showLoading: false });
      }
    }

    window.addEventListener("focus", refreshVisibleReviewerQueue);
    document.addEventListener("visibilitychange", refreshVisibleReviewerQueue);
    return () => {
      window.removeEventListener("focus", refreshVisibleReviewerQueue);
      document.removeEventListener(
        "visibilitychange",
        refreshVisibleReviewerQueue
      );
    };
  }, [authChecked, loadAppealsFromApi]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadAppealsFromApi({ showLoading: false });
      }
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [authChecked, loadAppealsFromApi]);

  useEffect(() => {
    if (!resetNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setResetNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [resetNotice]);

  const orderedAppeals = useMemo(
    () => [...appeals].sort(compareAppealsForReviewQueue),
    [appeals]
  );
  const activeReviewerQueue = useMemo(
    () => orderedAppeals.filter((appeal) => !appeal.reviewerDecision),
    [orderedAppeals]
  );
  const trackedOutsideQueue = useMemo(
    () => orderedAppeals.filter((appeal) => appeal.reviewerDecision),
    [orderedAppeals]
  );

  const selectedCase = useMemo(() => {
    if (!caseId) {
      return orderedAppeals[0];
    }

    return appeals.find((appeal) => appeal.id === caseId);
  }, [appeals, caseId, orderedAppeals]);

  async function generatePacket(targetCaseId: string) {
    setGeneratingCaseId(targetCaseId);
    setApiError(null);

    try {
      updateAppeal(await generateAppealPacket(targetCaseId));
      setApiStatus("connected");
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    } finally {
      setGeneratingCaseId((currentCaseId) =>
        currentCaseId === targetCaseId ? null : currentCaseId
      );
    }
  }

  async function resetDemoState() {
    setGeneratingCaseId(null);
    setActingCaseId(null);
    setApiError(null);

    try {
      setAppeals(await resetAppeals());
      setOutboxEmails([]);
      setApiStatus("connected");
      setResetNotice(`Workspace reset at ${formatNoticeTime()}`);
      WORKFLOW_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    }
  }

  async function saveReviewerAction(
    targetCaseId: string,
    action: ReviewerAction,
    note?: string
  ) {
    setActingCaseId(targetCaseId);
    setApiError(null);

    try {
      updateAppeal(await applyReviewerAction(targetCaseId, action, note));
      setOutboxEmails(await listOutboxEmails());
      setApiStatus("connected");
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    } finally {
      setActingCaseId((currentCaseId) =>
        currentCaseId === targetCaseId ? null : currentCaseId
      );
    }
  }

  async function createAppealFromIntake(
    payload: CreateAppealPayload,
    document?: AppealDocumentPayload
  ) {
    setIsCreatingAppeal(true);
    setApiError(null);

    try {
      const createdAppeal = await createAppeal(payload);
      const finalAppeal = document
        ? await uploadAppealDocument(createdAppeal.id, document)
        : createdAppeal;
      setApiStatus("connected");

      setAppeals((currentAppeals) => [
        ...currentAppeals.filter((appeal) => appeal.id !== finalAppeal.id),
        finalAppeal
      ]);
      router.push(`/appeals/${finalAppeal.id}`);
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(getErrorMessage(error));
    } finally {
      setIsCreatingAppeal(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem(AUTH_KEY);
    router.push("/login");
  }

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-ink">
        <div className="rounded-lg border border-border bg-panel p-6 text-sm font-semibold text-muted shadow-soft">
          Loading HealthIntel...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <Header
          apiStatus={apiStatus}
          activePath={pathname}
          onResetDemo={resetDemoState}
          onRetryApi={loadAppealsFromApi}
          onSignOut={signOut}
          user={user}
        />

        {resetNotice ? <ResetNotice message={resetNotice} /> : null}
        {apiError ? (
          <ApiErrorNotice message={apiError} onRetry={loadAppealsFromApi} />
        ) : null}

        {isLoadingAppeals ? <LoadingAppeals /> : null}

        {!isLoadingAppeals && view === "dashboard" ? (
          <DashboardView
            appeals={activeReviewerQueue}
            onGenerate={generatePacket}
            onRefresh={() => void loadAppealsFromApi({ showLoading: false })}
            outboxEmails={outboxEmails}
            trackedAppeals={trackedOutsideQueue}
          />
        ) : null}

        {!isLoadingAppeals && view === "appeals" ? (
          <AppealsListView
            appeals={activeReviewerQueue}
            onRefresh={() => void loadAppealsFromApi({ showLoading: false })}
            onGenerate={generatePacket}
          />
        ) : null}

        {!isLoadingAppeals && view === "case" ? (
          <CaseReviewView
            appeal={selectedCase}
            isActionPending={actingCaseId === selectedCase?.id}
            isGenerating={generatingCaseId === selectedCase?.id}
            onAction={saveReviewerAction}
            onGenerate={generatePacket}
          />
        ) : null}

        {!isLoadingAppeals && view === "intake" ? (
          <IntakeView
            apiStatus={apiStatus}
            isSubmitting={isCreatingAppeal}
            onCreate={createAppealFromIntake}
          />
        ) : null}

        {!isLoadingAppeals && view === "policies" ? <PolicyLibraryView /> : null}
      </div>
    </main>
  );
}

function Header({
  apiStatus,
  activePath,
  onResetDemo,
  onRetryApi,
  onSignOut,
  user
}: {
  apiStatus: ApiStatus;
  activePath: string;
  onResetDemo: () => void;
  onRetryApi: () => void;
  onSignOut: () => void;
  user: DemoUser | null;
}) {
  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/appeals", label: "Appeals", icon: FileText },
    { href: "/intake", label: "Intake", icon: Plus },
    { href: "/policies", label: "Policies", icon: ShieldCheck }
  ];

  return (
    <header className="rounded-lg border border-border bg-panel shadow-soft">
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              HealthIntel
            </p>
            <h1 className="text-xl font-semibold tracking-normal text-ink sm:text-2xl">
              Appeals Decision Support
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ApiStatusBadge status={apiStatus} onRetry={onRetryApi} />
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
              {user?.role ?? "Reviewer"}
            </span>
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
              {user?.email ?? "demo@healthintel.local"}
            </span>
          </div>
          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            <Tooltip label="Reload the reviewer queue from the system.">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                onClick={onRetryApi}
                type="button"
              >
                <RefreshCw className="h-4 w-4 text-accent" aria-hidden="true" />
                Refresh queue
              </button>
            </Tooltip>
            <Tooltip label="Clear generated AI reviews, reviewer actions, and workspace data.">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                onClick={onResetDemo}
                type="button"
              >
                <RotateCcw className="h-4 w-4 text-accent" aria-hidden="true" />
                Reset workspace
              </button>
            </Tooltip>
            <Tooltip label="Leave the local demo session and return to the login screen.">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                onClick={onSignOut}
                type="button"
              >
                <LogOut className="h-4 w-4 text-accent" aria-hidden="true" />
                Sign out
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? activePath === item.href
              : activePath.startsWith(item.href);

          return (
            <Link
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface hover:text-ink"
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function ResetNotice({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-soft">
      <span className="flex items-center gap-2 font-semibold">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {message}
      </span>
      <span className="hidden text-emerald-700 sm:inline">
        Generated AI reviews, saved reviewer actions, and workspace state
        were cleared.
      </span>
    </div>
  );
}

function ApiStatusBadge({
  onRetry,
  status
}: {
  onRetry: () => void;
  status: ApiStatus;
}) {
  const statusConfig = {
    checking: {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      icon: Clock3,
      label: "System checking"
    },
    connected: {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
      label: "System online"
    },
    unavailable: {
      className: "border-red-200 bg-red-50 text-red-700",
      icon: AlertTriangle,
      label: "System unavailable"
    }
  } satisfies Record<
    ApiStatus,
    { className: string; icon: LucideIcon; label: string }
  >;
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Tooltip
      label={`Connection: ${API_BASE_URL}. Click to recheck.`}
    >
      <button
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-white ${config.className}`}
        onClick={onRetry}
        type="button"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {config.label}
      </button>
    </Tooltip>
  );
}

function ApiErrorNotice({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {message}
      </span>
      <button
        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        onClick={onRetry}
        type="button"
      >
        Retry connection
      </button>
    </div>
  );
}

function LoadingAppeals() {
  return (
    <div className="rounded-lg border border-border bg-panel p-6 text-sm font-semibold text-muted shadow-soft">
      Loading appeals...
    </div>
  );
}

function DashboardView({
  appeals,
  onGenerate,
  onRefresh,
  outboxEmails,
  trackedAppeals
}: {
  appeals: AppealCase[];
  onGenerate: (caseId: string) => void;
  onRefresh: () => void;
  outboxEmails: OutboxEmail[];
  trackedAppeals: AppealCase[];
}) {
  const urgentCount = appeals.filter((appeal) => appeal.urgency === "Urgent").length;
  const pendingPacketCount = appeals.filter(
    (appeal) => !appeal.analysisPrepared
  ).length;
  const recentlyActedAppeals = trackedAppeals.filter((appeal) =>
    isWithinPastDays(appeal.decisionTime, 31)
  );

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Command Center"
        title="Active appeals dashboard"
        description="Live workload, recent decisions, and member notification activity."
      />

      <Panel
        title="Active review queue"
        icon={LayoutDashboard}
        tooltip="Cases that still need reviewer action. Counts are calculated from the current system response."
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <DashboardMetric
              detail="Cases currently visible in the reviewer queue."
              icon={FileText}
              label="Active cases"
              value={appeals.length.toString()}
            />
            <DashboardMetric
              detail="Active cases with a 72-hour decision window."
              icon={Clock3}
              label="Urgent"
              value={urgentCount.toString()}
            />
            <DashboardMetric
              detail="Active cases still waiting for AI extraction and evidence mapping."
              icon={FileSearch}
              label="Awaiting AI Review"
              value={pendingPacketCount.toString()}
            />
            <DashboardMetric
              detail="Appeals with a saved reviewer action in the last 31 days."
              icon={ListChecks}
              label="Acted this month"
              value={recentlyActedAppeals.length.toString()}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-muted">
                Active reviewer queue:{" "}
                <span className="text-ink">{appeals.length}</span>
              </p>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-panel"
                onClick={onRefresh}
                type="button"
              >
                <RefreshCw className="h-4 w-4 text-accent" aria-hidden="true" />
                Refresh queue
              </button>
            </div>
            {appeals.length ? (
              appeals.map((appeal) => (
              <div
                className="flex flex-col gap-3 rounded-lg border border-border bg-white p-3 transition hover:border-accent/40 hover:shadow-sm md:flex-row md:items-center md:justify-between"
                key={appeal.id}
              >
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{appeal.id}</Badge>
                    <Badge className={urgencyClasses[appeal.urgency]}>
                      {appeal.urgency}
                    </Badge>
                    <Badge className={riskClasses[appeal.risk]}>
                      {appeal.risk} risk
                    </Badge>
                    {appeal.source === "Member portal" ? (
                      <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                        Member submitted
                      </Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-ink">
                    {appeal.service}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {appeal.member}, {appeal.age}
                    {appeal.policyNumber ? ` - ${appeal.policyNumber}` : ""} -{" "}
                    {appeal.slaLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!appeal.analysisPrepared ? (
                    <Tooltip label="Generate the summary, facts, guideline match, recommendation, and audit events for this appeal.">
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0c6968]"
                        onClick={() => onGenerate(appeal.id)}
                        type="button"
                      >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Generate AI review
                      </button>
                    </Tooltip>
                  ) : (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      AI review ready
                    </Badge>
                  )}
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                    href={`/appeals/${appeal.id}`}
                  >
                    Open
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
              ))
            ) : (
              <div className="rounded-lg border border-border bg-white p-4 text-sm font-semibold text-muted">
                No active reviewer cases. New submissions or follow-up documents
                will appear here.
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title="Decisions this month"
          icon={ListChecks}
          tooltip="Appeals with saved reviewer actions in the last 31 days. Fresh follow-up documents move cases back into the active queue."
        >
          <div className="grid grid-cols-1 gap-3">
            {recentlyActedAppeals.length ? (
              recentlyActedAppeals.slice(0, 5).map((appeal) => (
                <div
                  className="flex flex-col gap-3 rounded-lg border border-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={appeal.id}
                >
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{appeal.id}</Badge>
                      <Badge className={statusClasses[appeal.status]}>
                        {appeal.status}
                      </Badge>
                      {appeal.source === "Member portal" ? (
                        <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                          Member submitted
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {appeal.member} - {appeal.service}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted">
                      Reviewer action:{" "}
                      {appeal.reviewerDecision
                        ? formatRecommendationAction(appeal.reviewerDecision)
                        : "Saved"}
                    </p>
                  </div>
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                    href={`/appeals/${appeal.id}`}
                  >
                    View case
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-border bg-white p-4 text-sm font-semibold text-muted">
                No reviewer actions recorded in the last month.
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="Member notifications"
          icon={FileText}
          tooltip="Member status notifications queued by reviewer actions."
        >
          <div className="grid grid-cols-1 gap-3">
            {outboxEmails.length ? (
              outboxEmails.slice(0, 5).map((email) => (
                <details
                  className="rounded-lg border border-border bg-white p-3"
                  key={email.id}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            Queued
                          </Badge>
                          <Badge>{email.id}</Badge>
                          <Badge>{email.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-ink">
                          {email.subject}
                        </p>
                        <p className="mt-1 text-xs font-medium text-muted">
                          To {email.to} - Tracking {email.trackingId}
                        </p>
                      </div>
                      <Link
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                        href={`/appeals/${email.appealId}`}
                      >
                        View case
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs leading-5 text-slate-700">
                    {email.body}
                  </pre>
                </details>
              ))
            ) : (
              <div className="rounded-lg border border-border bg-white p-4 text-sm font-semibold text-muted">
                No member notifications queued yet. Notifications appear here after
                reviewer actions.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function AppealsListView({
  appeals,
  onGenerate,
  onRefresh
}: {
  appeals: AppealCase[];
  onGenerate: (caseId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Work Queue"
        title="Appeals needing review"
        description="Prioritize by SLA, risk, AI review readiness, and specialty routing before opening the clinical workspace."
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            {appeals.length} active reviewer cases
          </p>
          <p className="mt-1 text-sm text-muted">
            Member submissions appear here while they still need reviewer action.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className="h-4 w-4 text-accent" aria-hidden="true" />
          Refresh queue
        </button>
      </div>

      <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
        <div className="grid grid-cols-1 gap-3">
          {appeals.length ? (
            appeals.map((appeal) => (
            <div
              className="grid gap-3 rounded-lg border border-border bg-white p-4 transition hover:border-accent/40 hover:shadow-sm lg:grid-cols-[1.4fr_0.9fr_0.8fr_auto]"
              key={appeal.id}
            >
            <div>
              <p className="text-xs font-semibold text-muted">{appeal.id}</p>
              <h3 className="mt-1 text-base font-semibold text-ink">
                {appeal.service}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {appeal.member}, {appeal.age} - {appeal.provider}
              </p>
              {appeal.policyNumber ? (
                <p className="mt-1 text-xs font-semibold text-muted">
                  Policy {appeal.policyNumber}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-start gap-2">
              <Badge className={urgencyClasses[appeal.urgency]}>
                {appeal.urgency}
              </Badge>
              <Badge className={riskClasses[appeal.risk]}>
                {appeal.risk} risk
              </Badge>
              <Tooltip label="Current reviewer workflow state for this appeal.">
                <Badge className={statusClasses[appeal.status]}>
                  {appeal.status}
                </Badge>
              </Tooltip>
              {appeal.source === "Member portal" ? (
                <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                  Member submitted
                </Badge>
              ) : null}
            </div>

            <div className="text-sm text-muted">
              <p className="font-semibold text-ink">{appeal.specialty}</p>
              <p className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {appeal.slaLabel}
              </p>
              <Tooltip label="Whether AI extraction and evidence mapping have been generated for the case.">
                <Badge
                  className={
                    appeal.analysisPrepared
                      ? packetClasses.Ready
                      : packetClasses.Pending
                  }
                >
                  {appeal.analysisPrepared
                    ? "AI review ready"
                    : "Awaiting AI review"}
                </Badge>
              </Tooltip>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {!appeal.analysisPrepared ? (
                <Tooltip label="Create the AI case brief, evidence map, guideline checklist, and decision draft.">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0c6968]"
                    onClick={() => onGenerate(appeal.id)}
                    type="button"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Generate AI review
                  </button>
                </Tooltip>
              ) : null}
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                href={`/appeals/${appeal.id}`}
              >
                Review
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
            ))
          ) : (
            <div className="rounded-lg border border-border bg-white p-6 text-sm font-semibold text-muted">
              No active reviewer cases. Decided appeals stay out of the work
              queue unless fresh documents reopen them.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CaseReviewView({
  appeal,
  isActionPending,
  isGenerating,
  onAction,
  onGenerate
}: {
  appeal?: AppealCase;
  isActionPending: boolean;
  isGenerating: boolean;
  onAction: (caseId: string, action: ReviewerAction, note?: string) => void;
  onGenerate: (caseId: string) => void;
}) {
  if (!appeal) {
    return (
      <Panel title="Appeal not found" icon={AlertTriangle}>
        <p className="text-sm leading-6 text-muted">
          The requested appeal could not be found in the workspace data.
        </p>
        <Link
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
          href="/appeals"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to appeals
        </Link>
      </Panel>
    );
  }

  const analysisReady = appeal.analysisPrepared;

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent"
              href="/appeals"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Appeals queue
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{appeal.id}</Badge>
              <Badge>{appeal.appealType}</Badge>
              <Badge className={urgencyClasses[appeal.urgency]}>
                {appeal.urgency}
              </Badge>
              <Tooltip label="Current reviewer workflow state for this appeal.">
                <Badge className={statusClasses[appeal.status]}>
                  {appeal.status}
                </Badge>
              </Tooltip>
              <Badge className={riskClasses[appeal.risk]}>{appeal.risk} risk</Badge>
              <Badge>{appeal.specialty}</Badge>
              {appeal.source === "Member portal" ? (
                <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                  Member submitted
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-ink">
              {appeal.service}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
              {appeal.denialReason}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3 lg:w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Compliance Clock
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xl font-semibold text-ink">
                {appeal.slaLabel}
              </span>
              <Clock3 className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Received {appeal.received}. Decision due {appeal.due}.
            </p>
          </div>
        </div>
      </div>

      <CaseSnapshot appeal={appeal} />
      {appeal.documents?.length ? (
        <DocumentStrip documents={appeal.documents} />
      ) : null}

      {analysisReady ? (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-[#eefaf9] px-4 py-3 text-sm font-semibold text-accent shadow-soft">
          {isGenerating ? (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {isGenerating
            ? "Refreshing AI review..."
            : "AI review ready"}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {!analysisReady ? (
            <AnalysisPlaceholder
              isGenerating={isGenerating}
              onRunAnalysis={() => onGenerate(appeal.id)}
            />
          ) : (
            <CaseAnalysis appeal={appeal} />
          )}
        </div>

        <DecisionPanel
          appeal={appeal}
          analysisReady={analysisReady}
          isActionPending={isActionPending}
          isGenerating={isGenerating}
          onAction={(action, note) => onAction(appeal.id, action, note)}
          onGenerate={() => onGenerate(appeal.id)}
        />
      </div>
    </section>
  );
}

function CaseAnalysis({ appeal }: { appeal: AppealCase }) {
  const sourceSignals = getDocumentSignals(appeal);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="AI case brief"
          icon={Bot}
          tooltip="Concise reviewer-oriented summary generated from the appeal documents."
        >
          <p className="text-sm leading-6 text-slate-700">{appeal.aiBrief}</p>
          {sourceSignals.length ? (
            <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700">
                PDF Signals Used
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sourceSignals.map((signal) => (
                  <Badge
                    className="border-cyan-200 bg-white text-cyan-700"
                    key={signal}
                  >
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 rounded-lg border border-border bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Provider Appeal Argument
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {appeal.appealArgument}
            </p>
          </div>
        </Panel>

        <Panel
          title="Extracted clinical facts"
          icon={FileSearch}
          tooltip="Structured clinical facts pulled out of the source appeal material."
        >
          <EvidenceList items={appeal.facts} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Clinical timeline"
          icon={ListChecks}
          tooltip="Chronological reconstruction of symptoms, treatment, and appeal events."
        >
          <EvidenceList items={appeal.timeline} compact />
        </Panel>

        <Panel
          title="Guideline match"
          icon={ShieldCheck}
        tooltip="Policy criteria mapped to available clinical evidence."
        >
          <div className="flex flex-col gap-2">
            {appeal.guideline.map((criterion) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3"
                key={criterion.label}
              >
                <span className="text-sm font-medium text-slate-700">
                  {criterion.label}
                </span>
                <Badge className={criterionClasses[criterion.status]}>
                  {criterion.status}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EvidencePanel
          icon={CheckCircle2}
          items={appeal.approvalEvidence}
          title="Evidence supporting approval"
        />
        <EvidencePanel
          icon={AlertTriangle}
          items={appeal.denialEvidence}
          title="Evidence supporting denial"
        />
      </div>
    </>
  );
}

function CaseSnapshot({ appeal }: { appeal: AppealCase }) {
  const packetLabel = appeal.analysisPrepared ? "Ready" : "Not generated";
  const documentCount = appeal.documents?.length ?? 0;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      <SnapshotTile
        detail="Member and plan context used to orient the appeal review."
        icon={UserRound}
        label="Member"
        value={`${appeal.member}, ${appeal.age}${
          appeal.policyNumber ? ` / ${appeal.policyNumber}` : ""
        }`}
      />
      <SnapshotTile
        detail="Suggested clinical reviewer based on service category and complexity."
        icon={Stethoscope}
        label="Specialty"
        value={appeal.specialty}
      />
      <SnapshotTile
        detail="Regulatory timing signal for standard or urgent appeal handling."
        icon={Clock3}
        label="SLA"
        value={appeal.slaLabel}
      />
      <SnapshotTile
        detail="Source documents attached through appeal intake."
        icon={FileUp}
        label="Documents"
        value={`${documentCount} uploaded`}
      />
      <SnapshotTile
        detail="AI review availability for case brief, facts, evidence, and recommendation."
        icon={Gauge}
        label="AI review"
        value={packetLabel}
      />
    </section>
  );
}

function DocumentStrip({
  documents
}: {
  documents: NonNullable<AppealCase["documents"]>;
}) {
  return (
    <Panel
      title="Source Document Evidence"
      icon={FileUp}
      tooltip="PDF evidence attached during intake and signals extracted for reviewer validation."
    >
      <div
        className={`grid grid-cols-1 gap-3 ${
          documents.length > 1 ? "xl:grid-cols-2" : ""
        }`}
      >
        {documents.map((document) => (
          <div
            className="rounded-lg border border-border bg-surface p-3"
            key={document.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {document.fileName}
                </p>
                <p className="mt-1 text-xs font-medium text-muted">
                  {formatFileSize(document.fileSize)} - {document.uploadedAt}
                </p>
              </div>
              <Badge className="border-accent/30 bg-[#eefaf9] text-accent">
                {formatExtractionMode(document.extractionMode)}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-700">
              {document.summary}
            </p>
            {document.llmSummary && document.llmSummary !== document.summary ? (
              <p className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50 p-2 text-xs leading-5 text-cyan-800">
                {document.llmSummary}
              </p>
            ) : null}
            {document.extractionSignals?.length ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Extracted Signals
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {document.extractionSignals.map((signal) => (
                    <Badge
                      className="border-cyan-200 bg-cyan-50 text-cyan-700"
                      key={signal}
                    >
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold text-muted">
                No text signals were available from this PDF.
              </p>
            )}
            {document.contentPreview ? (
              <p className="mt-3 rounded-lg border border-border bg-white p-2 text-xs leading-5 text-muted">
                {document.contentPreview}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SnapshotTile({
  detail,
  icon,
  label,
  value
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const Icon = icon;
  return (
    <div className="rounded-lg border border-border bg-panel p-3 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
          {label}
        </div>
        <InfoTooltip label={detail} />
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-ink">{value}</p>
    </div>
  );
}

function IntakeView({
  apiStatus,
  isSubmitting,
  onCreate
}: {
  apiStatus: ApiStatus;
  isSubmitting: boolean;
  onCreate: (
    payload: CreateAppealPayload,
    document?: AppealDocumentPayload
  ) => Promise<void>;
}) {
  const isApiConnected = apiStatus === "connected";
  const [form, setForm] = useState<IntakeFormState>({
    member: "",
    age: "",
    policyNumber: "",
    plan: "Commercial PPO",
    provider: "",
    service: "",
    appealType: "Medical necessity",
    urgency: "Standard",
    denialReason: "",
    appealArgument: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function updateField(field: keyof IntakeFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isPdfFile(file)) {
      setSelectedFile(null);
      setFileError("Please add the appeal documents as a PDF.");
      return;
    }

    setSelectedFile(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: CreateAppealPayload = {
      ...form,
      age: Number(form.age)
    };
    const document = selectedFile
      ? {
          file: selectedFile
        }
      : undefined;

    await onCreate(payload, document);
  }

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Appeal Intake"
        title="Create a new appeal"
        description="Capture the appeal, add supporting documents, and open the review workspace with SLA and routing already assigned."
      />

      <form
        className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]"
        onSubmit={handleSubmit}
      >
        <Panel
          title="Appeal Details"
          icon={FileText}
          tooltip="Structured intake fields used to create the appeal case."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Member
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) => updateField("member", event.target.value)}
                placeholder="Jordan M."
                required
                type="text"
                value={form.member}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Age
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                min={0}
                onChange={(event) => updateField("age", event.target.value)}
                placeholder="52"
                required
                type="number"
                value={form.age}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Policy Number
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) =>
                  updateField("policyNumber", event.target.value)
                }
                placeholder="POL-91827364"
                required
                type="text"
                value={form.policyNumber}
              />
            </label>
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
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Provider
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) => updateField("provider", event.target.value)}
                placeholder="Summit Specialty Clinic"
                required
                type="text"
                value={form.provider}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink md:col-span-2">
              Requested Service
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) => updateField("service", event.target.value)}
                placeholder="Lumbar epidural steroid injection"
                required
                type="text"
                value={form.service}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Appeal Type
              <select
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) =>
                  updateField("appealType", event.target.value)
                }
                value={form.appealType}
              >
                <option>Medical necessity</option>
                <option>Pharmacy exception</option>
                <option>Level-of-care review</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Urgency
              <select
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) =>
                  updateField(
                    "urgency",
                    event.target.value as CreateAppealPayload["urgency"]
                  )
                }
                value={form.urgency}
              >
                <option>Standard</option>
                <option>Urgent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink md:col-span-2">
              Denial Reason
              <textarea
                className="min-h-[96px] rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium leading-6 text-ink outline-none transition focus:border-accent"
                onChange={(event) =>
                  updateField("denialReason", event.target.value)
                }
                placeholder="Summarize the denial reason from the notice."
                required
                value={form.denialReason}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink md:col-span-2">
              Appeal Argument
              <textarea
                className="min-h-[120px] rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium leading-6 text-ink outline-none transition focus:border-accent"
                onChange={(event) =>
                  updateField("appealArgument", event.target.value)
                }
                placeholder="Summarize the provider or member appeal argument."
                required
                value={form.appealArgument}
              />
            </label>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          {!isApiConnected ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-soft">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                System connection required
              </p>
              <p className="mt-2 leading-5">
                Start the local service at {API_BASE_URL} before creating a new
                appeal.
              </p>
            </div>
          ) : null}

          <Panel
            title="Appeal Documents"
            icon={FileUp}
            tooltip="Upload the PDF documents that will be attached to the new case."
          >
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-accent/40 bg-surface px-4 py-8 text-center transition hover:border-accent"
              htmlFor="appeal-document"
            >
              <FileUp className="h-8 w-8 text-accent" aria-hidden="true" />
              <span className="text-sm font-semibold text-ink">
                {selectedFile ? selectedFile.name : "Add appeal documents"}
              </span>
              {selectedFile ? (
                <span className="text-xs font-medium text-muted">
                  {formatFileSize(selectedFile.size)}
                </span>
              ) : (
                <span className="text-xs font-medium text-muted">
                  PDF required
                </span>
              )}
              <input
                accept="application/pdf,.pdf"
                className="sr-only"
                id="appeal-document"
                onChange={handleFileChange}
                required
                type="file"
              />
            </label>
            {fileError ? (
              <p className="mt-2 text-sm font-semibold text-red-700">
                {fileError}
              </p>
            ) : null}
          </Panel>

          <Panel
            title="Review and create"
            icon={Plus}
            tooltip="Create the appeal and open the review workspace."
          >
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                  Case Preview
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  This will create a {form.urgency.toLowerCase()}{" "}
                  {form.appealType.toLowerCase()} appeal
                  {form.service ? ` for ${form.service}` : ""}.
                </p>
                <p className="mt-2 text-sm text-muted">
                  {selectedFile
                    ? `${selectedFile.name} will be reviewed by the AI workflow.`
                    : "Add the appeal documents before creating the appeal."}
                </p>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6968] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting || !selectedFile || !isApiConnected}
                type="submit"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {!isApiConnected
                  ? "Start backend first"
                  : isSubmitting
                  ? "Creating..."
                  : "Create appeal"}
              </button>
            </div>
          </Panel>
        </div>
      </form>
    </section>
  );
}

function PolicyLibraryView() {
  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Decision Support"
        title="Policy and guideline library"
        description="Reference policy snippets used to explain why HealthIntel marks criteria as met, partial, or missing."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {policyLibrary.map((policy) => (
          <div
            className="rounded-lg border border-border bg-panel p-4 shadow-soft transition hover:border-accent/40"
            key={policy.title}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge>{policy.domain}</Badge>
                <h3 className="mt-3 text-lg font-semibold text-ink">
                  {policy.title}
                </h3>
              </div>
              <span className="text-xs font-semibold text-muted">
                {policy.updated}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {policy.criteria.map((criterion) => (
                <div
                  className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm font-medium text-slate-700"
                  key={criterion}
                >
                  <ClipboardCheck
                    className="mt-0.5 h-4 w-4 flex-none text-accent"
                    aria-hidden="true"
                  />
                  {criterion}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DecisionPanel({
  appeal,
  analysisReady,
  isActionPending,
  isGenerating,
  onAction,
  onGenerate
}: {
  appeal: AppealCase;
  analysisReady: boolean;
  isActionPending: boolean;
  isGenerating: boolean;
  onAction: (action: ReviewerAction, note?: string) => void;
  onGenerate: () => void;
}) {
  const aiRecommendation = appeal.aiRecommendation;
  const latestAuditEvent = appeal.audit.at(-1);
  const actionLocked = Boolean(appeal.reviewerDecision);
  const selectedAction =
    appeal.reviewerDecision ?? aiRecommendation?.action ?? undefined;
  const [requestInfoNote, setRequestInfoNote] = useState("");

  useEffect(() => {
    setRequestInfoNote("");
  }, [appeal.id, appeal.reviewerDecision]);

  return (
    <aside className="flex flex-col gap-4">
      <Panel
        title="Decision assist"
        icon={PanelRightOpen}
        tooltip="Reviewer support surface for draft recommendation and final action."
      >
        {analysisReady ? (
          <>
            {aiRecommendation ? (
              <div className="rounded-lg border border-accent/30 bg-[#eefaf9] p-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  AI recommendation
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={recommendationActionClass(aiRecommendation.action)}>
                    {formatRecommendationAction(aiRecommendation.action)}
                  </Badge>
                  <Badge className="border-cyan-200 bg-white text-cyan-700">
                    {aiRecommendation.confidence} confidence
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {aiRecommendation.rationale}
                </p>
                <details className="mt-3 rounded-lg border border-cyan-200 bg-white p-3 text-sm text-slate-700">
                  <summary className="cursor-pointer text-sm font-semibold text-accent">
                    View support details
                  </summary>
                  <CompactDetailList
                    items={aiRecommendation.supportingEvidence}
                    title="Supports"
                  />
                  <CompactDetailList
                    items={aiRecommendation.cautionNotes}
                    title="Cautions"
                  />
                  <CompactDetailList
                    items={aiRecommendation.complianceNotes}
                    title="Compliance"
                  />
                </details>
              </div>
            ) : (
              <div className="rounded-lg border border-accent/30 bg-[#eefaf9] p-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Draft recommendation
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {appeal.recommendation}
                </p>
              </div>
            )}

            {appeal.reviewerDecision ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Saved reviewer action
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-900">
                  {formatRecommendationAction(appeal.reviewerDecision)}
                </p>
                <p className="mt-1 text-sm leading-5 text-emerald-800">
                  {appeal.decisionSummary}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Saved {appeal.decisionTime}
                </p>
              </div>
            ) : null}

            {appeal.reviewerDecision && latestAuditEvent ? (
              <div className="mt-3 rounded-lg border border-border bg-white p-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                  <ListChecks className="h-4 w-4 text-accent" aria-hidden="true" />
                  Latest audit update
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {latestAuditEvent.label}
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-700">
                  {latestAuditEvent.detail}
                </p>
                <p className="mt-2 text-xs font-medium text-muted">
                  {latestAuditEvent.time}
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-ink">
                Missing or weak documentation
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                {appeal.missingDocs.slice(0, 2).map((doc) => (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 text-sm text-slate-700"
                    key={doc}
                  >
                    <FileText className="h-4 w-4 text-gold" aria-hidden="true" />
                    {doc}
                  </div>
                ))}
                {appeal.missingDocs.length > 2 ? (
                  <p className="text-xs font-semibold text-muted">
                    +{appeal.missingDocs.length - 2} more available in the
                    case evidence
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              {!actionLocked ? (
                <label className="mb-1 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                  Request details
                  <textarea
                    className="min-h-[84px] resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-medium leading-5 text-ink outline-none transition focus:border-amber-500"
                    maxLength={1000}
                    onChange={(event) => setRequestInfoNote(event.target.value)}
                    placeholder="Optional: list exactly what documents or clarification are needed."
                    value={requestInfoNote}
                  />
                </label>
              ) : null}
              <ActionButton
                active={selectedAction === "Approve"}
                disabled={isActionPending || actionLocked}
                icon={Check}
                label="Approve"
                onClick={() => onAction("Approve")}
              />
              <ActionButton
                active={selectedAction === "Request Info"}
                disabled={isActionPending || actionLocked}
                icon={FileSearch}
                label="Request Info"
                onClick={() =>
                  onAction("Request Info", requestInfoNote.trim() || undefined)
                }
              />
              <ActionButton
                active={selectedAction === "Draft Uphold"}
                disabled={isActionPending || actionLocked}
                icon={ArrowRight}
                label="Uphold denial"
                onClick={() => onAction("Draft Uphold")}
              />
            </div>
            {isActionPending ? (
              <p className="mt-2 text-xs font-semibold text-muted">
                Saving reviewer action...
              </p>
            ) : null}
            {actionLocked && !isActionPending ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
                Decision locked. A fresh follow-up document will reopen reviewer
                actions and clear this saved decision.
              </p>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm leading-6 text-muted">
            <p>
              {isGenerating
                ? "Drafting recommendation and reviewer actions..."
                : "Generate an AI review to summarize documents, evidence, and next steps."}
            </p>
            <button
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0c6968]"
              disabled={isGenerating}
              onClick={onGenerate}
              type="button"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {isGenerating ? "Generating..." : "Generate AI review"}
            </button>
          </div>
        )}
      </Panel>

      <Panel
        title="Smart routing"
        icon={Route}
        tooltip="Suggested reviewer specialty based on service, risk, and policy domain."
      >
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            Suggested reviewer
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">{appeal.specialty}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Match based on service category, clinical complexity, and policy domain.
          </p>
        </div>
      </Panel>

      <Panel
        title="Audit trail"
        icon={ShieldCheck}
        tooltip="Time-stamped workflow events for compliance review."
      >
        <div className="flex flex-col gap-3">
          {[...appeal.audit].reverse().map((event, eventIndex) => (
            <div
              className="grid grid-cols-[18px_1fr] gap-3"
              key={`${event.time}-${event.label}-${eventIndex}`}
            >
              <span className="mt-1 h-3 w-3 rounded-full border-2 border-accent bg-white" />
              <div>
                <p className="text-sm font-semibold text-ink">{event.label}</p>
                <p className="text-xs text-muted">{event.time}</p>
                <p className="mt-1 text-sm leading-5 text-slate-700">
                  {event.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

function AnalysisPlaceholder({
  isGenerating,
  onRunAnalysis
}: {
  isGenerating: boolean;
  onRunAnalysis: () => void;
}) {
  return (
    <div className="flex min-h-[460px] items-center justify-center rounded-lg border border-dashed border-accent/40 bg-panel p-8 text-center shadow-soft">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#eefaf9] text-accent">
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-ink">
          AI review not generated
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Generate the structured case brief, extracted facts, guideline match,
          recommendation, and compliance trail.
        </p>
        <button
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6968] disabled:opacity-70"
          disabled={isGenerating}
          onClick={onRunAnalysis}
          type="button"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {isGenerating ? "Generating..." : "Generate AI review"}
        </button>
      </div>
    </div>
  );
}

function CompactDetailList({
  items,
  title
}: {
  items: string[];
  title: string;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.slice(0, 3).map((item) => (
          <li className="text-sm leading-5 text-slate-700" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageHeader({
  description,
  eyebrow,
  title
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-panel px-4 py-4 shadow-soft sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal text-ink">
          {title}
        </h2>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function DashboardMetric({
  detail,
  icon,
  label,
  value
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const Icon = icon;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
          {label}
        </div>
        <InfoTooltip label={detail} />
      </div>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function EvidencePanel({
  icon,
  items,
  title
}: {
  icon: LucideIcon;
  items: AppealCase["approvalEvidence"];
  title: string;
}) {
  return (
    <Panel
      title={title}
      icon={icon}
      tooltip="Evidence items are paired with mock source references for reviewer traceability."
    >
      <EvidenceList items={items} />
    </Panel>
  );
}

function EvidenceList({
  items,
  compact = false
}: {
  items: AppealCase["facts"];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          className={`rounded-lg border border-border bg-white ${
            compact ? "p-2.5" : "p-3"
          }`}
          key={`${item.label}-${item.source}`}
        >
          <p className="text-sm font-medium leading-5 text-slate-700">
            {item.label}
          </p>
          <p className="mt-1 text-xs text-muted">{item.source}</p>
        </div>
      ))}
    </div>
  );
}

function Panel({
  children,
  icon,
  title,
  tooltip
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
  tooltip?: string;
}) {
  const Icon = icon;
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-accent">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
        </div>
        {tooltip ? <InfoTooltip label={tooltip} /> : null}
      </div>
      {children}
    </section>
  );
}

function Tooltip({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-[260px] -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-xs font-medium leading-5 text-white shadow-lg group-hover:block group-focus-within:block"
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}

function InfoTooltip({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <button
        aria-label={label}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-muted transition hover:text-accent"
        type="button"
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function Badge({
  children,
  className = "bg-surface text-muted border-border"
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function ActionButton({
  active = false,
  disabled = false,
  icon,
  label,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  const Icon = icon;
  return (
    <button
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "border border-accent bg-accent text-white shadow-soft"
          : "border border-border bg-white text-ink hover:bg-surface"
      } disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
      {active ? (
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-normal text-white">
          Selected
        </span>
      ) : null}
    </button>
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

function formatExtractionMode(mode: string | null | undefined) {
  if (mode === "LLM") {
    return "LLM extraction";
  }

  if (mode === "Rule-based") {
    return "Document extraction";
  }

  return mode ?? "Document";
}

function formatRecommendationAction(action: ReviewerAction) {
  if (action === "Draft Uphold") {
    return "Uphold denial";
  }

  return action;
}

function compareAppealsForReviewQueue(first: AppealCase, second: AppealCase) {
  const firstSequence = getAppealSequence(first.id);
  const secondSequence = getAppealSequence(second.id);

  if (firstSequence !== secondSequence) {
    return secondSequence - firstSequence;
  }

  if (first.source === "Member portal" && second.source !== "Member portal") {
    return -1;
  }

  if (second.source === "Member portal" && first.source !== "Member portal") {
    return 1;
  }

  return first.id.localeCompare(second.id);
}

function getAppealSequence(appealId: string) {
  const sequence = Number(appealId.split("-").at(-1));
  return Number.isFinite(sequence) ? sequence : 0;
}

function recommendationActionClass(action: ReviewerAction) {
  if (action === "Approve") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (action === "Request Info") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-violet-200 bg-violet-50 text-violet-700";
}

function getDocumentSignals(appeal: AppealCase) {
  const signals: string[] = [];

  for (const document of appeal.documents ?? []) {
    for (const signal of document.extractionSignals ?? []) {
      if (!signals.includes(signal)) {
        signals.push(signal);
      }
    }
  }

  return signals;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong while calling HealthIntel.";
}

function isWithinPastDays(value: string | null | undefined, days: number) {
  if (!value) {
    return false;
  }

  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return true;
  }

  const elapsedMs = Date.now() - dateValue.getTime();
  return elapsedMs >= 0 && elapsedMs <= days * 24 * 60 * 60 * 1000;
}

function formatNoticeTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
