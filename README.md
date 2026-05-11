# HealthIntel Appeals Copilot

HealthIntel is a hackathon prototype for AI-assisted healthcare appeals review. It helps a reviewer move from an appeal queue into a structured case workspace with triage, clinical extraction, guideline-style evidence mapping, decision support, smart routing, and an audit trail.

## Current Prototype Scope

- Next.js product demo for a payer appeals operations team.
- Demo login gate with local browser-based role selection.
- Seeded appeal cases, including the main MRI medical necessity denial case.
- Separate routes for dashboard, appeals queue, appeal review, policies, and login.
- Appeals queue with urgency, risk, status, specialty, packet status, and SLA indicators.
- Case review workspace with AI-style case brief, clinical facts, timeline, guideline match, evidence map, and missing-document signals after packet generation.
- Decision assist panel with draft recommendation, persistent reviewer actions, smart routing, and compliance audit trail.
- Tooltips on key metrics, statuses, AI packet actions, guideline panels, routing, and audit surfaces.
- Reset demo state control for clearing generated AI packets, saved reviewer actions, and browser workflow state during demos.
- Executive snapshot showing modeled review time, SLA, savings, and consistency metrics.

This version uses local mock data so the demo is reliable. Demo login, generated packets, and reviewer actions are persisted in browser `localStorage`, and the header includes a reset control to clear browser-specific workflow state. PDF upload and real AI extraction can be added after the core workflow is polished.

## Requirements

- Node.js 18.16.0 or newer
- npm 9.x or newer

The app was started on Node `18.16.0` and npm `9.5.1`.

## Fresh Clone Quickstart

After cloning the repository, run:

```bash
git clone <repo-url>
cd healthintel-app
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

On first visit, the app redirects to `/login`. Use the prefilled demo identity and click **Enter workspace**.

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

Start the development server:

```bash
npm run dev
```

Open the app in a browser:

```text
http://localhost:3000
```

The app redirects to the demo login page on first visit. Use the prefilled demo identity and click **Enter workspace**.

Create a production build:

```bash
npm run build
```

Run the production server after building:

```bash
npm run start
```

## Project Structure

```text
app/
  appeals/
    [id]/page.tsx Dynamic appeal review route
    page.tsx      Appeals queue route
  globals.css      Global Tailwind styles and base theme
  layout.tsx       Root app layout and metadata
  login/page.tsx   Demo login route
  page.tsx         Dashboard route
  policies/page.tsx Policy library route
components/
  healthintel-workspace.tsx Shared routed workspace UI and demo state logic
lib/
  cases.ts         Seeded appeal cases and dashboard metrics
```

## Routes

```text
/                 Dashboard
/login            Demo login
/appeals          Appeals queue
/appeals/[id]     Appeal review workspace
/policies         Policy and guideline library
```

## Demo Flow

1. Sign in through `/login` with the prefilled demo identity.
2. Start on the dashboard at `/` for the operational overview.
3. Open `/appeals` to view the work queue.
4. Select the MRI lumbar spine appeal.
5. Click **Generate packet** to reveal the AI case brief, extracted facts, timeline, guideline match, and evidence panels.
6. Use the decision assist panel to approve, request more information, or draft an uphold recommendation.
7. Confirm the case status and audit trail update after the reviewer action is saved.
8. Refresh the page to show that reviewer workflow state persists locally.
9. Use **Reset demo state** in the header when you want to clear generated packets, saved decisions, and return to seeded pending cases. A green confirmation banner appears after reset.
10. Visit `/policies` to show the policy snippets behind the guideline match.

## Browser State Notes

Chrome, Edge, and other browsers each maintain their own `localStorage`. A login, generated AI packet, or reviewer action saved in Chrome will not automatically appear in Edge. Use **Reset demo state** in the header if a browser shows stale demo state or if a generated packet does not appear as expected.

## Next Build Steps

- Add a document upload surface for appeal packets.
- Add a real AI extraction API route with structured JSON output.
- Add real authentication or replace the local demo gate.
- Add source-document preview alongside extracted facts.
- Add basic tests once the workflow stabilizes.
