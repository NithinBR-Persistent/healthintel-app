"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { FileUp, LockKeyhole, ShieldCheck } from "lucide-react";

const AUTH_KEY = "healthintel.auth.v1";
const MEMBER_AUTH_KEY = "healthintel.member.auth.v1";
type LoginMode = "reviewer" | "member";

export default function LoginRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const initialMode: LoginMode =
    searchParams.get("mode") === "member" ? "member" : "reviewer";
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [reviewerEmail, setReviewerEmail] = useState(
    "reviewer@healthintel.local"
  );
  const [reviewerPassword, setReviewerPassword] = useState("demo-reviewer");
  const [memberEmail, setMemberEmail] = useState("member@healthintel.local");
  const [memberPassword, setMemberPassword] = useState("demo-member");
  const isReviewerMode = mode === "reviewer";
  const memberNextPath = nextPath.startsWith("/member") ? nextPath : "/member";

  function submitReviewerLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        email: reviewerEmail,
        role: "Appeals Reviewer"
      })
    );
    router.push(nextPath.startsWith("/member") ? "/dashboard" : nextPath);
  }

  function submitMemberLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMemberLogin(memberNextPath);
  }

  function saveMemberLogin(targetPath: string) {
    window.localStorage.setItem(
      MEMBER_AUTH_KEY,
      JSON.stringify({
        email: memberEmail,
        role: "Member"
      })
    );
    router.push(targetPath);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 text-ink">
      <section className="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              HealthIntel
            </p>
            <h1 className="text-xl font-semibold text-ink">
              {isReviewerMode ? "Reviewer Login" : "Member Appeal Access"}
            </h1>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-1">
          <button
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              isReviewerMode
                ? "bg-white text-accent shadow-sm"
                : "text-muted hover:text-ink"
            }`}
            onClick={() => setMode("reviewer")}
            type="button"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Reviewer
          </button>
          <button
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              !isReviewerMode
                ? "bg-white text-accent shadow-sm"
                : "text-muted hover:text-ink"
            }`}
            onClick={() => setMode("member")}
            type="button"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Member
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted">
          {isReviewerMode
            ? "Use the payer reviewer workspace to triage appeals, generate AI reviews, and record decisions."
            : "Use the member portal to submit an appeal PDF or check limited status with a tracking ID and access code."}
        </p>

        {isReviewerMode ? (
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={submitReviewerLogin}
          >
            <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
              Email
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) => setReviewerEmail(event.target.value)}
                placeholder="reviewer@healthintel.local"
                required
                type="email"
                value={reviewerEmail}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
              Password
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) => setReviewerPassword(event.target.value)}
                placeholder="Enter the prototype password"
                required
                type="password"
                value={reviewerPassword}
              />
            </label>

            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
              <div>
                <p className="font-semibold text-ink">Appeals Reviewer</p>
                <p className="text-xs font-medium text-muted">
                  Reviewer workspace access
                </p>
              </div>
            </div>

            <button
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6968]"
              type="submit"
            >
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              Enter reviewer workspace
            </button>
          </form>
        ) : (
          <form className="mt-5 flex flex-col gap-4" onSubmit={submitMemberLogin}>
            <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
              Member Email
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) => setMemberEmail(event.target.value)}
                placeholder="member@example.com"
                required
                type="email"
                value={memberEmail}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
              Password
              <input
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
                onChange={(event) => setMemberPassword(event.target.value)}
                placeholder="Enter the prototype password"
                required
                type="password"
                value={memberPassword}
              />
            </label>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6968]"
              type="submit"
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Enter member portal
            </button>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-70"
              disabled={!memberEmail || !memberPassword}
              onClick={() => saveMemberLogin("/member/status")}
              type="button"
            >
              <LockKeyhole className="h-4 w-4 text-accent" aria-hidden="true" />
              Check status
            </button>
          </form>
        )}

        <p className="mt-4 text-sm leading-6 text-muted">
          {isReviewerMode
            ? "For this prototype, sign-in is local to your browser."
            : "Member access stays limited to appeal submission and safe status lookup."}
        </p>
      </section>
    </main>
  );
}
