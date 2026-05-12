# HealthIntel Appeals Copilot

HealthIntel is a hackathon prototype for AI-assisted healthcare appeals review. It helps a reviewer move from an appeal queue into a structured case workspace with triage, clinical extraction, guideline-style evidence mapping, decision support, smart routing, and an audit trail.

## Current Prototype Scope

- Next.js product demo for a payer appeals operations team.
- FastAPI backend with seeded appeals, packet generation, reviewer actions, and reset endpoints.
- Demo login gate with a reviewer/member switch and demo email/password fields.
- Frontend API client that reads and updates appeal workflow state through the backend.
- Header API status badge that checks backend connectivity before demo actions.
- Minimal member appeal portal for submitting a PDF packet and checking limited status with a tracking ID and access code.
- Demo member email outbox when reviewers approve, uphold, or request more information.
- Member follow-up document upload when the reviewer asks for additional documentation.
- Seeded appeal cases, including the main MRI medical necessity denial case.
- Separate routes for login, member submission, member status, dashboard, intake, appeals queue, appeal review, and policies.
- Intake form for creating a new appeal and adding the appeal PDF.
- Appeals queue focused only on cases still needing reviewer action.
- Case review workspace with AI-style case brief, clinical facts, timeline, guideline match, evidence map, and missing-document signals after packet generation.
- Summary-first PDF extraction: when an LLM key is configured, the backend summarizes uploaded PDF text, then extracts facts, timeline, evidence, guideline signals, the AI brief, and recommendation from that summary.
- Compact AI recommendation support for approve, request more information, or uphold-denial review paths.
- Decision assist panel with draft recommendation, reviewer actions, latest audit update, smart routing, and compliance audit trail.
- Reviewer actions lock after a decision is saved; fresh documents reopen the case for a new decision.
- Decided cases leave the active reviewer queue and return only when fresh documents reopen review.
- Reviewers can add optional request-info details beyond the AI recommendation.
- Reviewer queues refresh on focus and every few seconds while open, with an explicit **Refresh queue** control for demos.
- Tooltips on key metrics, statuses, AI packet actions, guideline panels, routing, and audit surfaces.
- Reset workspace control for clearing generated AI reviews and saved reviewer actions during demos.
- Dashboard metrics are calculated from the live backend queue, with recent acted-upon appeals and demo outbox activity.

This version uses a deterministic backend demo API with optional LLM extraction so the workflow is reliable for a hackathon presentation. Demo login is still local to the browser, while appeals, generated AI reviews, reviewer actions, member-submitted cases, and reset state are stored in a local SQLite database.

## Requirements

- Node.js 18.16.0 or newer
- npm 9.x or newer
- Python 3.11 or newer

The app was started on Node `18.16.0` and npm `9.5.1`.

## Fresh Clone Quickstart

After cloning the repository, run:

```powershell
git clone <repo-url>
cd healthintel-app
```

Start the backend API in one terminal:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn healthintel_api.main:app --reload --port 8000
```

After the first setup, you can start the backend from the repository root with:

```powershell
npm run backend
```

That helper starts the API on port 8000.

If pip hits a local certificate issue while installing backend packages:

```powershell
python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements-dev.txt
```

Start the frontend in a second terminal from the repository root:

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

The root URL redirects to `/login` every time. Use the login switch to choose **Reviewer** or **Member**. For reviewer demos, use the prefilled email and password, then click **Enter reviewer workspace**. After login, the app opens `/dashboard`.

The frontend defaults to this API base URL:

```text
http://localhost:8000
```

To point the UI at a different backend, create `.env.local` in the repository root:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

To verify a production build after cloning:

```bash
npm run build
```

To run the production server after a successful build:

```bash
npm run start
```

## Prototype Security Note

This hackathon build is pinned to a Next.js 13 patch release so it runs on the local Node 18.16 runtime. `npm audit` may still report Next.js advisories. Before any production or public deployment, upgrade Node to `20.9.0` or newer and move Next.js to the current patched major release.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the backend API:

```powershell
npm run backend
```

Start the frontend development server from the repository root:

```powershell
npm run dev
```

Open the app in a browser:

```text
http://localhost:3000
```

The app redirects to the demo login page. Use the **Reviewer** tab, keep the prefilled demo email/password, and click **Enter reviewer workspace**. Keep the backend running while using AI review generation, intake, reviewer actions, and reset. The header shows `System online` when the backend health check succeeds.

Create a production build:

```bash
npm run build
```

Run the production server after building:

```bash
npm run start
```

## Run Backend API

The backend lives in `backend/` and uses Python 3.11, FastAPI, and a standard `src/` layout.

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn healthintel_api.main:app --reload --port 8000
```

Or use the repo helper from the repository root:

```powershell
npm run backend
```

Use `.\backend\start.ps1 -Reload` only when you specifically want backend auto-reload during development.

Open:

```text
http://localhost:8000/docs
```

Backend checks:

```powershell
python -m pytest
python -m ruff check .
```

By default, the backend creates a local SQLite database at:

```text
backend/data/healthintel.sqlite3
```

To use a different database path:

```powershell
$env:HEALTHINTEL_DB_PATH="C:\temp\healthintel.sqlite3"
python -m uvicorn healthintel_api.main:app --reload --port 8000
```

Optional LLM extraction:

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-4o-mini"
```

When these are set, uploaded PDFs are summarized first and then extracted into
structured appeal review fields. Without a key, the app keeps using deterministic
demo extraction.

## Member Notifications

Reviewer actions on member-submitted appeals queue a generic member status
message in the demo outbox. No external email service or email credentials are
required. The message includes only the new status, tracking ID, and member
portal link; clinical details stay inside the portal.

You can view queued messages on the Dashboard under **Member notifications** or
through the API:

```text
GET http://localhost:8000/api/outbox
```

The outbox is in memory for the hackathon demo. Reset workspace clears it, and
restarting the backend starts with an empty outbox.

Optional sender/link labels can still be set in the terminal before starting the
backend:

```powershell
$env:EMAIL_FROM="HealthIntel <demo@healthintel.local>"
$env:HEALTHINTEL_PUBLIC_APP_URL="http://localhost:3000"
```

## Project Structure

```text
app/
  appeals/
    [id]/page.tsx   Dynamic appeal review route
    page.tsx        Appeals queue route
  dashboard/page.tsx Dashboard route
  globals.css       Global Tailwind styles and base theme
  layout.tsx        Root app layout and metadata
  login/page.tsx    Demo login route
  member/           Member appeal submission and status routes
  page.tsx          Root route that redirects to login
  intake/page.tsx   Appeal intake route
  policies/page.tsx Policy library route
components/
  healthintel-workspace.tsx Shared routed workspace UI
lib/
  api.ts            Frontend API client for the FastAPI backend
  cases.ts          Frontend appeal and workflow types
backend/
  src/healthintel_api/ FastAPI application, routes, services, repository, and seed data
  tests/              Backend endpoint tests
```

## Routes

```text
/                  Redirects to /login
/login             Demo login
/member            Member appeal submission
/member/submit     Member appeal submission
/member/status     Member status lookup
/member/status/[trackingId] Member status detail
/dashboard         Dashboard
/intake            Appeal intake
/appeals           Appeals queue
/appeals/[id]      Appeal review workspace
/policies          Policy and guideline library
```

## Demo Flow

Member submission flow:

1. Open `http://localhost:3000/login?mode=member`.
2. Use the prefilled demo member email/password to enter the member portal.
3. Enter member name, policy number, member email, service, appeal explanation, and attach a PDF.
4. Submit the appeal and save the tracking ID and access code.
5. Check status from `/member/status` or the generated status link.
6. If the reviewer requests more information, upload the requested follow-up PDF from the status page.

Reviewer flow:

1. Open `http://localhost:3000`, which redirects to `/login`.
2. Sign in with the prefilled demo identity.
3. Start on `/dashboard` for the operational overview.
4. Open `/intake` to create a new appeal and add the appeal PDF.
5. Submit intake to open the new appeal review workspace.
6. Open `/appeals` to view only appeals still needing reviewer action.
7. Select the MRI lumbar spine appeal or the case created through intake.
8. Click **Generate AI review** to reveal the AI case brief, extracted facts, timeline, guideline match, and evidence panels.
9. Use the decision assist panel to approve, request more information, or draft an uphold recommendation.
10. For request-info decisions, optionally add reviewer details before clicking **Request Info**.
11. Confirm the case status and latest audit update after the reviewer action is saved.
12. After a reviewer action is saved, the decision buttons lock and the case leaves the active work queue. It remains visible on `/dashboard` under **Decisions this month** for traceability. If fresh follow-up documents are uploaded, the case reopens and reviewer actions become available again.
13. Refresh the page to show that reviewer workflow state persists while the backend API process is running.
14. Use **Reset workspace** in the header when you want to clear generated AI reviews, saved decisions, intake-created cases, and return to seeded pending cases. A green confirmation banner appears after reset.
15. Visit `/policies` to show the policy snippets behind the guideline match.

## Sample PDFs

Use these synthetic appeal packets when testing PDF upload and extraction:

```text
sample-data/healthintel-sample-appeal-packet.pdf
sample-data/healthintel-large-appeal-packet-with-images.pdf
```

They contain no real patient information. The smaller packet is useful for fast
smoke tests. The larger packet has 12 pages, embedded image-style attachments,
timeline notes, guideline signals, evidence mapping, and missing-document
signals so you can test the summary-first extraction path with a more realistic
appeal packet.

## Browser State Notes

Chrome, Edge, and other browsers each maintain their own demo reviewer and member login state. The demo password fields are local UI gates only and are not real authentication. Appeal workflow state now comes from the backend API, so generated AI reviews, reviewer actions, member submissions, and audit events are shared across browsers connected to the same backend database. Restarting the backend keeps saved workflow state; use **Reset workspace** to return to seeded pending cases.

## Next Build Steps

- Improve PDF extraction quality and add source-page citations.
- Add source citations to the AI recommendation details.
- Add real authentication or replace the local demo gate.
- Add database migrations once the schema grows beyond the prototype JSON table.
- Add member-visible decision-letter drafts with safe, non-PHI email links.
