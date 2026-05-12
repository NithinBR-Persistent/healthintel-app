"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

const AUTH_KEY = "healthintel.auth.v1";

export default function LoginRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const [email, setEmail] = useState("reviewer@healthintel.local");
  const [role, setRole] = useState("Medical Director");

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        email,
        role
      })
    );
    router.push(nextPath);
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
            <h1 className="text-xl font-semibold text-ink">Demo Login</h1>
          </div>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={submitLogin}>
          <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
            Email
            <input
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
            Role
            <select
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-accent"
              onChange={(event) => setRole(event.target.value)}
              value={role}
            >
              <option>Medical Director</option>
              <option>Appeals Nurse Reviewer</option>
              <option>Compliance Lead</option>
              <option>Utilization Management Director</option>
            </select>
          </label>

          <button
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6968]"
            type="submit"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Enter workspace
          </button>
        </form>

        <p className="mt-4 text-sm leading-6 text-muted">
          This is a local demo gate. It stores only the selected demo user in
          browser storage and does not perform real authentication.
        </p>
      </section>
    </main>
  );
}
