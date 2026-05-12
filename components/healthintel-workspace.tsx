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
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  LucideIcon,
  PanelRightOpen,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AppealCase,
  AppealStatus,
  ReviewerAction,
  cases,
  impactMetrics,
  quickStats
} from "@/lib/cases";

type WorkspaceView = "dashboard" | "appeals" | "case" | "policies";

type DemoUser = {
  email: string;
  role: string;
};

const STORAGE_KEY = "healthintel.appeals.v3";
const AUTH_KEY = "healthintel.auth.v1";
const LEGACY_STORAGE_KEYS = [
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

const reviewerActionConfig: Record<
  ReviewerAction,
  {
    status: AppealStatus;
    auditLabel: string;
    auditDetail: string;
    summary: string;
  }
> = {
  Approve: {
    status: "Approved",
    auditLabel: "Reviewer approved appeal",
    auditDetail:
      "Approval selected after reviewing the AI packet, guideline match, and supporting clinical evidence.",
    summary: "Approval selected. The case is ready for final decision letter review."
  },
  "Request Info": {
    status: "Needs info",
    auditLabel: "Reviewer requested information",
    auditDetail:
      "Additional clinical documentation requested before a final determination is drafted.",
    summary:
      "Information request selected. The missing-document list should be sent to the provider."
  },
  "Draft Uphold": {
    status: "Decision drafted",
    auditLabel: "Uphold draft prepared",
    auditDetail:
      "Draft uphold action selected for reviewer validation and rationale completion.",
    summary:
      "Uphold draft selected. The reviewer should validate rationale before release."
  }
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
  const [appeals, setAppeals] = useState<AppealCase[]>(createInitialAppeals);
  const [generatingCaseId, setGeneratingCaseId] = useState<string | null>(null);
  const [hasLoadedStoredState, setHasLoadedStoredState] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    try {
      const savedUser = window.localStorage.getItem(AUTH_KEY);
      if (!savedUser) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setUser(JSON.parse(savedUser) as DemoUser);
      setAuthChecked(true);
    } catch {
      window.localStorage.removeItem(AUTH_KEY);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppealCase[];
        setAppeals(mergeAppealState(parsed));
      }
    } catch {
      setAppeals(createInitialAppeals());
    } finally {
      setHasLoadedStoredState(true);
    }
  }, []);

  useEffect(() => {
    if (hasLoadedStoredState) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appeals));
    }
  }, [appeals, hasLoadedStoredState]);

  useEffect(() => {
    if (!resetNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setResetNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [resetNotice]);

  const selectedCase = useMemo(() => {
    if (!caseId) {
      return appeals[0];
    }

    return appeals.find((appeal) => appeal.id === caseId);
  }, [appeals, caseId]);

  function generatePacket(targetCaseId: string) {
    setGeneratingCaseId(targetCaseId);
    setAppeals((currentAppeals) =>
      currentAppeals.map((appeal) => prepareAppealPacket(appeal, targetCaseId))
    );

    window.setTimeout(() => {
      setGeneratingCaseId((currentCaseId) =>
        currentCaseId === targetCaseId ? null : currentCaseId
      );
    }, 650);
  }

  function resetDemoState() {
    setAppeals(createInitialAppeals());
    setGeneratingCaseId(null);
    setResetNotice(`Demo state reset at ${formatNoticeTime()}`);
    window.localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  }

  function saveReviewerAction(targetCaseId: string, action: ReviewerAction) {
    const actionConfig = reviewerActionConfig[action];
    setAppeals((currentAppeals) =>
      currentAppeals.map((appeal) => {
        if (appeal.id !== targetCaseId) {
          return appeal;
        }

        const preparedAppeal = appeal.analysisPrepared
          ? appeal
          : prepareAppealPacket(appeal, targetCaseId);
        const decisionTime = formatAuditTime();
        return {
          ...preparedAppeal,
          analysisPrepared: true,
          status: actionConfig.status,
          reviewerDecision: action,
          decisionSummary: actionConfig.summary,
          decisionTime,
          audit: [
            ...preparedAppeal.audit,
            {
              time: decisionTime,
              label: actionConfig.auditLabel,
              detail: actionConfig.auditDetail
            }
          ]
        };
      })
    );
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
          activePath={pathname}
          onResetDemo={resetDemoState}
          onSignOut={signOut}
          user={user}
        />

        {resetNotice ? <ResetNotice message={resetNotice} /> : null}

        {view === "dashboard" ? (
          <DashboardView appeals={appeals} onGenerate={generatePacket} />
        ) : null}

        {view === "appeals" ? (
          <AppealsListView appeals={appeals} onGenerate={generatePacket} />
        ) : null}

        {view === "case" ? (
          <CaseReviewView
            appeal={selectedCase}
            isGenerating={generatingCaseId === selectedCase?.id}
            onAction={saveReviewerAction}
            onGenerate={generatePacket}
          />
        ) : null}

        {view === "policies" ? <PolicyLibraryView /> : null}
      </div>
    </main>
  );
}

function Header({
  activePath,
  onResetDemo,
  onSignOut,
  user
}: {
  activePath: string;
  onResetDemo: () => void;
  onSignOut: () => void;
  user: DemoUser | null;
}) {
  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/appeals", label: "Appeals", icon: FileText },
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
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
              {user?.role ?? "Reviewer"}
            </span>
            <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
              {user?.email ?? "demo@healthintel.local"}
            </span>
          </div>
          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            <Tooltip label="Clear generated packets, saved decisions, and demo workflow state in this browser.">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
                onClick={onResetDemo}
                type="button"
              >
                <RotateCcw className="h-4 w-4 text-accent" aria-hidden="true" />
                Reset demo state
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
        Generated AI packets, saved reviewer actions, and demo workflow state
        were cleared.
      </span>
    </div>
  );
}

function DashboardView({
  appeals,
  onGenerate
}: {
  appeals: AppealCase[];
  onGenerate: (caseId: string) => void;
}) {
  const urgentCount = appeals.filter((appeal) => appeal.urgency === "Urgent").length;
  const generatedCount = appeals.filter((appeal) => appeal.analysisPrepared).length;
  const pendingCount = appeals.length - generatedCount;

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Command Center"
        title="Appeals operations dashboard"
        description="Track SLA pressure, packet readiness, and high-risk appeals before reviewers open the clinical workspace."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              className="rounded-lg border border-border bg-panel p-4 shadow-soft transition hover:border-accent/40"
              key={stat.label}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-muted">
                <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                {stat.label}
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="text-3xl font-semibold text-ink">
                  {stat.value}
                </span>
                <span className="pb-1 text-sm text-muted">{stat.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <Panel
          title="Appeals Command Center"
          icon={LayoutDashboard}
          tooltip="A compact view of cases that need packet generation or reviewer attention."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <DashboardMetric
              detail="Cases with a 72-hour decision window."
              icon={Clock3}
              label="Urgent cases"
              value={urgentCount.toString()}
            />
            <DashboardMetric
              detail="Cases where HealthIntel has generated the reviewer packet."
              icon={Sparkles}
              label="AI packets ready"
              value={generatedCount.toString()}
            />
            <DashboardMetric
              detail="Cases still waiting for AI extraction and evidence mapping."
              icon={FileSearch}
              label="Pending packets"
              value={pendingCount.toString()}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {appeals.map((appeal) => (
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
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-ink">
                    {appeal.service}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {appeal.member}, {appeal.age} - {appeal.slaLabel}
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
                        Generate
                      </button>
                    </Tooltip>
                  ) : (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      Packet ready
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
            ))}
          </div>
        </Panel>

        <ExecutiveDashboard />
      </div>
    </section>
  );
}

function AppealsListView({
  appeals,
  onGenerate
}: {
  appeals: AppealCase[];
  onGenerate: (caseId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Work Queue"
        title="Appeals needing review"
        description="Prioritize by SLA, risk, packet readiness, and specialty routing before opening the clinical workspace."
      />

      <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
        <div className="grid grid-cols-1 gap-3">
          {appeals.map((appeal) => (
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
            </div>

            <div className="text-sm text-muted">
              <p className="font-semibold text-ink">{appeal.specialty}</p>
              <p className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {appeal.slaLabel}
              </p>
              <Tooltip label="Whether the demo AI packet has been generated for the case.">
                <Badge
                  className={
                    appeal.analysisPrepared
                      ? packetClasses.Ready
                      : packetClasses.Pending
                  }
                >
                  {appeal.analysisPrepared ? "Packet ready" : "Packet pending"}
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
                    Generate
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
          ))}
        </div>
      </div>
    </section>
  );
}

function CaseReviewView({
  appeal,
  isGenerating,
  onAction,
  onGenerate
}: {
  appeal?: AppealCase;
  isGenerating: boolean;
  onAction: (caseId: string, action: ReviewerAction) => void;
  onGenerate: (caseId: string) => void;
}) {
  if (!appeal) {
    return (
      <Panel title="Appeal Not Found" icon={AlertTriangle}>
        <p className="text-sm leading-6 text-muted">
          The requested appeal could not be found in the demo dataset.
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

      {analysisReady ? (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-[#eefaf9] px-4 py-3 text-sm font-semibold text-accent shadow-soft">
          {isGenerating ? (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {isGenerating
            ? "Refreshing AI review packet..."
            : "AI review packet ready"}
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
          isGenerating={isGenerating}
          onAction={(action) => onAction(appeal.id, action)}
          onGenerate={() => onGenerate(appeal.id)}
        />
      </div>
    </section>
  );
}

function CaseAnalysis({ appeal }: { appeal: AppealCase }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="AI Case Brief"
          icon={Bot}
          tooltip="Concise reviewer-oriented summary generated from the appeal packet."
        >
          <p className="text-sm leading-6 text-slate-700">{appeal.aiBrief}</p>
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
          title="Extracted Clinical Facts"
          icon={FileSearch}
          tooltip="Structured clinical facts pulled out of the source appeal material."
        >
          <EvidenceList items={appeal.facts} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Clinical Timeline"
          icon={ListChecks}
          tooltip="Chronological reconstruction of symptoms, treatment, and appeal events."
        >
          <EvidenceList items={appeal.timeline} compact />
        </Panel>

        <Panel
          title="Guideline Match"
          icon={ShieldCheck}
          tooltip="Mock policy criteria mapped to available clinical evidence."
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
          title="Evidence Supporting Approval"
        />
        <EvidencePanel
          icon={AlertTriangle}
          items={appeal.denialEvidence}
          title="Evidence Supporting Denial"
        />
      </div>
    </>
  );
}

function CaseSnapshot({ appeal }: { appeal: AppealCase }) {
  const packetLabel = appeal.analysisPrepared ? "Ready" : "Pending";

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SnapshotTile
        detail="Member and plan context used to orient the appeal packet."
        icon={UserRound}
        label="Member"
        value={`${appeal.member}, ${appeal.age}`}
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
        detail="AI packet availability for case brief, facts, evidence, and recommendation."
        icon={Gauge}
        label="Packet"
        value={packetLabel}
      />
    </section>
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

function PolicyLibraryView() {
  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Decision Support"
        title="Policy and guideline library"
        description="Mock policy snippets used by the demo to explain why HealthIntel marks criteria as met, partial, or missing."
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
  isGenerating,
  onAction,
  onGenerate
}: {
  appeal: AppealCase;
  analysisReady: boolean;
  isGenerating: boolean;
  onAction: (action: ReviewerAction) => void;
  onGenerate: () => void;
}) {
  return (
    <aside className="flex flex-col gap-4">
      <Panel
        title="Decision Assist"
        icon={PanelRightOpen}
        tooltip="Reviewer support surface for draft recommendation and final action."
      >
        {analysisReady ? (
          <>
            <div className="rounded-lg border border-accent/30 bg-[#eefaf9] p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                <Bot className="h-4 w-4" aria-hidden="true" />
                Draft Recommendation
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {appeal.recommendation}
              </p>
            </div>

            {appeal.reviewerDecision ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Saved Reviewer Action
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-900">
                  {appeal.reviewerDecision}
                </p>
                <p className="mt-1 text-sm leading-5 text-emerald-800">
                  {appeal.decisionSummary}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Saved {appeal.decisionTime}
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-ink">
                Missing or weak documentation
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                {appeal.missingDocs.map((doc) => (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 text-sm text-slate-700"
                    key={doc}
                  >
                    <FileText className="h-4 w-4 text-gold" aria-hidden="true" />
                    {doc}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <ActionButton
                active={appeal.reviewerDecision === "Approve"}
                icon={Check}
                label="Approve"
                onClick={() => onAction("Approve")}
                tone="primary"
              />
              <ActionButton
                active={appeal.reviewerDecision === "Request Info"}
                icon={FileSearch}
                label="Request Info"
                onClick={() => onAction("Request Info")}
              />
              <ActionButton
                active={appeal.reviewerDecision === "Draft Uphold"}
                icon={ArrowRight}
                label="Draft Uphold"
                onClick={() => onAction("Draft Uphold")}
              />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm leading-6 text-muted">
            <p>
              {isGenerating
                ? "Drafting recommendation and reviewer actions..."
                : "Generate an AI review packet to populate decision support."}
            </p>
            <button
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0c6968]"
              disabled={isGenerating}
              onClick={onGenerate}
              type="button"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {isGenerating ? "Generating..." : "Generate packet"}
            </button>
          </div>
        )}
      </Panel>

      <Panel
        title="Smart Routing"
        icon={Route}
        tooltip="Suggested reviewer specialty based on service, risk, and policy domain."
      >
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            Suggested Reviewer
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">{appeal.specialty}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Match based on service category, clinical complexity, and policy domain.
          </p>
        </div>
      </Panel>

      <Panel
        title="Audit Trail"
        icon={ShieldCheck}
        tooltip="Time-stamped workflow events for compliance review."
      >
        <div className="flex flex-col gap-3">
          {appeal.audit.map((event, eventIndex) => (
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
          AI review packet pending
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Generate the structured case brief, extracted facts, guideline match,
          recommendation, and compliance trail for this appeal.
        </p>
        <button
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6968] disabled:opacity-70"
          disabled={isGenerating}
          onClick={onRunAnalysis}
          type="button"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {isGenerating ? "Generating..." : "Generate packet"}
        </button>
      </div>
    </div>
  );
}

function ExecutiveDashboard() {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-soft">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Executive View
        </p>
        <h2 className="mt-1 text-lg font-semibold text-ink">
          Operational impact snapshot
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {impactMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              className="rounded-lg border border-border bg-surface p-4"
              key={metric.label}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted">{metric.label}</p>
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-ink">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-muted">{metric.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
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
  icon,
  label,
  onClick,
  tone = "secondary"
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
}) {
  const Icon = icon;
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "border border-accent bg-[#eefaf9] text-accent"
          : tone === "primary"
          ? "bg-accent text-white hover:bg-[#0c6968]"
          : "border border-border bg-white text-ink hover:bg-surface"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function createInitialAppeals() {
  return cases.map((appeal) => ({
    ...appeal,
    status: appeal.status,
    analysisPrepared: false,
    reviewerDecision: undefined,
    decisionSummary: undefined,
    decisionTime: undefined,
    facts: [...appeal.facts],
    timeline: [...appeal.timeline],
    approvalEvidence: [...appeal.approvalEvidence],
    denialEvidence: [...appeal.denialEvidence],
    guideline: [...appeal.guideline],
    missingDocs: [...appeal.missingDocs],
    audit: [...appeal.audit]
  }));
}

function prepareAppealPacket(appeal: AppealCase, caseId: string): AppealCase {
  if (appeal.id !== caseId) {
    return appeal;
  }

  if (appeal.analysisPrepared) {
    return {
      ...appeal,
      status: appeal.reviewerDecision ? appeal.status : "AI triaged"
    };
  }

  return {
    ...appeal,
    analysisPrepared: true,
    status: appeal.reviewerDecision ? appeal.status : "AI triaged",
    audit: [
      ...appeal.audit,
      {
        time: formatAuditTime(),
        label: "AI classification completed",
        detail: `${appeal.urgency} urgency, ${appeal.risk.toLowerCase()} risk, ${appeal.specialty} routing`
      },
      {
        time: formatAuditTime(),
        label: "Clinical facts extracted",
        detail: `${appeal.facts.length} key facts, ${appeal.timeline.length} timeline events, ${appeal.missingDocs.length} missing-doc signals`
      },
      {
        time: formatAuditTime(),
        label: "Reviewer packet prepared",
        detail:
          "Decision brief, evidence map, recommendation, and guideline checklist generated."
      }
    ]
  };
}

function mergeAppealState(savedAppeals: AppealCase[]) {
  if (!Array.isArray(savedAppeals)) {
    return createInitialAppeals();
  }

  return cases.map((baseAppeal) => {
    const savedAppeal = savedAppeals.find((appeal) => appeal.id === baseAppeal.id);
    return savedAppeal
      ? {
          ...baseAppeal,
          ...savedAppeal,
          analysisPrepared:
            typeof savedAppeal.analysisPrepared === "boolean"
              ? savedAppeal.analysisPrepared
              : false,
          audit: Array.isArray(savedAppeal.audit)
            ? savedAppeal.audit
            : baseAppeal.audit
        }
      : {
          ...baseAppeal,
          analysisPrepared: false,
          audit: [...baseAppeal.audit]
        };
  });
}

function formatAuditTime() {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return `${date} ${time}`;
}

function formatNoticeTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
