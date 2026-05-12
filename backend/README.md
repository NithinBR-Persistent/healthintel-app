# HealthIntel API

Python backend for the HealthIntel appeals prototype.

## What This Provides

- FastAPI app entrypoint at `healthintel_api.main:app`
- SQLite appeal repository seeded with demo appeal cases
- Service layer for AI packet generation, reviewer actions, and decision locking
- Health check endpoint
- Appeal list/detail endpoints
- Appeal intake endpoint
- Member appeal submission and limited status endpoints
- Member follow-up document upload after request-info decisions
- Demo member email outbox for reviewer status notifications
- Reviewer actions lock after the first saved decision until fresh documents reopen the case
- Optional reviewer notes on request-info actions
- PDF document attachment endpoint with text-preview extraction fallback
- Packet generation endpoint
- PDF extraction signals mapped into facts, guideline checks, AI brief, and recommendation
- Structured AI recommendation for approve, request-info, or uphold-denial review paths
- Optional summary-first LLM extraction when `OPENAI_API_KEY` is configured
- Reviewer action endpoint
- Reset endpoint for restoring seeded demo data
- Pytest endpoint coverage
- Ruff lint/format configuration

## Run Locally

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
python -m uvicorn healthintel_api.main:app --reload --port 8000
```

After the first setup, you can start the backend from the repository root with:

```powershell
npm run backend
```

That helper starts the API on port 8000.
Use `.\backend\start.ps1 -Reload` only when you specifically want backend
auto-reload during development.

If your local Python install has certificate issues reaching PyPI, use:

```powershell
python -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements-dev.txt
```

Open:

```text
http://localhost:8000/docs
```

The Next.js frontend calls this API by default at `http://localhost:8000`.
If you run the API on another port, set `NEXT_PUBLIC_API_BASE_URL` in the
frontend `.env.local`.

By default, workflow state is stored in:

```text
backend/data/healthintel.sqlite3
```

To use another SQLite file:

```powershell
$env:HEALTHINTEL_DB_PATH="C:\temp\healthintel.sqlite3"
python -m uvicorn healthintel_api.main:app --reload --port 8000
```

## LLM Extraction

PDF upload works without an LLM by using deterministic demo extraction. To enable
summary-first LLM extraction, set:

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-4o-mini"
```

The backend first summarizes extracted PDF text, then uses that summary to
populate structured facts, timeline, evidence, missing documents, guideline
signals, the AI brief, and the recommendation. This keeps later extraction
prompts smaller and makes large appeal packets faster to process. If the LLM
call fails or no key is configured, the backend falls back to deterministic
demo extraction.

## Member Notifications

Reviewer actions on member-submitted appeals queue a generic member status
message in the demo outbox. No external email service or email credentials are
required. The queued message includes only the new status, tracking ID, and
member portal link; clinical details stay inside the portal.

Use `GET /api/outbox` or the Dashboard **Member notifications** panel to inspect
queued messages during a demo. The outbox is in memory, so reset demo state or
restarting the backend clears it.

Optional sender/link labels can be set in the terminal before starting the API:

```powershell
$env:EMAIL_FROM="HealthIntel <demo@healthintel.local>"
$env:HEALTHINTEL_PUBLIC_APP_URL="http://localhost:3000"
```

After one reviewer action is saved, later action calls return the existing
decision without changing status or audit history. If fresh documents are
uploaded after a decision, the case returns to review and can receive a fresh
reviewer action.

## API Endpoints

```text
GET  /api/health
GET  /api/outbox
GET  /api/appeals
POST /api/appeals
POST /api/member/appeals
GET  /api/member/appeals/{tracking_id}?accessCode=123456
POST /api/member/appeals/{tracking_id}/documents
GET  /api/appeals/{appeal_id}
POST /api/appeals/{appeal_id}/documents
POST /api/appeals/{appeal_id}/generate-packet
POST /api/appeals/{appeal_id}/actions
POST /api/appeals/reset
```

Example intake request:

```json
{
  "member": "Nora P.",
  "age": 55,
  "policyNumber": "POL-5500192",
  "plan": "Commercial PPO",
  "provider": "Summit Pain Center",
  "service": "Epidural steroid injection",
  "appealType": "Medical necessity",
  "urgency": "Standard",
  "denialReason": "Documentation did not confirm conservative therapy.",
  "appealArgument": "Provider states symptoms persisted after therapy and NSAIDs."
}
```

Example member submission request:

```powershell
curl.exe -X POST http://localhost:8000/api/member/appeals `
  -F "member=Elena Thompson" `
  -F "age=59" `
  -F "policyNumber=POL-55281409" `
  -F "memberEmail=elena@example.com" `
  -F "plan=Commercial PPO" `
  -F "provider=North Valley Spine Institute" `
  -F "service=MRI lumbar spine without contrast" `
  -F "appealType=Medical necessity" `
  -F "urgency=Standard" `
  -F "denialReason=The MRI was denied because conservative therapy documentation was incomplete." `
  -F "appealArgument=Symptoms continued after medication and physical therapy." `
  -F "file=@../sample-data/healthintel-large-appeal-packet-with-images.pdf;type=application/pdf"
```

Example member follow-up upload after a request-info decision:

```powershell
curl.exe -X POST http://localhost:8000/api/member/appeals/HI-MBR-2026-0001/documents `
  -F "accessCode=123456" `
  -F "file=@../sample-data/healthintel-sample-appeal-packet.pdf;type=application/pdf"
```

Example document request:

```powershell
curl.exe -X POST http://localhost:8000/api/appeals/APL-2026-1042/documents `
  -F "file=@appeal-packet.pdf;type=application/pdf" `
  -F "content_preview=Physical therapy notes and neurologic exam attached."
```

You can also use the repo's synthetic test packet:

```powershell
curl.exe -X POST http://localhost:8000/api/appeals/APL-2026-1042/documents `
  -F "file=@../sample-data/healthintel-sample-appeal-packet.pdf;type=application/pdf"
```

For a heavier PDF with image-style attachments:

```powershell
curl.exe -X POST http://localhost:8000/api/appeals/APL-2026-1042/documents `
  -F "file=@../sample-data/healthintel-large-appeal-packet-with-images.pdf;type=application/pdf"
```

Example reviewer action request:

```json
{
  "action": "Request Info",
  "note": "Please upload the physical therapy notes and prior authorization denial letter."
}
```

Valid actions:

```text
Approve
Request Info
Draft Uphold
```

## Test

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m pytest
```

## Lint And Format

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m ruff check .
python -m ruff format .
```

## Notes

`pyproject.toml` keeps the package metadata, and the requirements files provide the reviewer-friendly install path. `requirements.txt` lists runtime dependencies, and `requirements-dev.txt` adds test/lint tools.

This backend stores each appeal as validated JSON in SQLite. Restarting the API process keeps workflow state, and `POST /api/appeals/reset` restores the seeded demo cases.
