# End-to-End Product and SDK Testing Runbook

This document is the step-by-step guide for validating the full ApexMonitor product before using it with a real startup tenant.

It covers:

- backend verification
- frontend verification
- SDK verification
- testing from a separate consumer project
- production readiness checks

The goal is to prove that the platform works as a complete system, not just as isolated services.

---

## 1. What Should Be True Before Testing

Before starting, make sure these are true:

- the monorepo builds successfully
- PostgreSQL, MongoDB, Redis, and RabbitMQ are running
- API environment variables are set
- frontend environment variables point to the API
- SDK packages have been built
- OAuth buttons are disabled in the frontend until OAuth is fully implemented

Required commands from the repo root:

```bash
npm install
npm run validate:migrations
npm run build --workspace=apps/server
npm run build --workspace=apps/web
npm run build:sdks
npm run conformance:sdks
```

If any of these fail, fix the build first before starting product validation.

---

## 2. Backend Verification

### 2.1 Start infrastructure

Use the local stack:

```bash
docker compose up -d
```

Verify the services are reachable:

- MongoDB
- PostgreSQL
- Redis
- RabbitMQ

### 2.2 Apply schema and seed data

Run the SQL bootstrap scripts in order that your environment requires. For local development, ensure the `init-postgres.sql` schema exists and the application can connect.

Important tables to confirm:

- `users`
- `projects`
- `project_members`
- `api_keys`
- `rum_keys`
- `audit_logs`
- metrics and insights tables

### 2.3 Start the server

```bash
npm run dev --workspace=apps/server
```

Then validate these endpoints:

- `GET /health`
- `GET /ready`
- `GET /metrics/system`

### 2.4 Smoke the auth flow

1. Register a new user.
2. Confirm the default project is created.
3. Log in with the new credentials.
4. Confirm the profile endpoint works.
5. Confirm logout clears the session.

### 2.5 Smoke project-scoped operations

1. List projects for the authenticated user.
2. Create a new project.
3. List keys for that project.
4. Create an API key.
5. Revoke the API key.
6. Add or remove a project member if the logged-in user is the owner.

### 2.6 Smoke telemetry ingestion

1. Send a small ingest batch with an idempotency key.
2. Repeat the same batch with the same idempotency key.
3. Confirm the second request is deduplicated.
4. Send a browser RUM batch with `x-rum-key`.
5. Confirm the batch is accepted and queued.
6. Check Redis live counters and worker consumption.

### 2.7 Smoke websocket live traffic

1. Open the dashboard.
2. Join a project room with a valid token.
3. Confirm `pulse:live` updates appear.
4. Confirm a user without project membership cannot join.

---

## 3. Frontend Verification

### 3.1 Start the web app

```bash
npm run dev --workspace=apps/web
```

### 3.2 Check the public auth screens

1. Open the login page.
2. Confirm Google and GitHub OAuth buttons are disabled and marked as coming soon.
3. Open the register page.
4. Confirm the same disabled OAuth behavior.
5. Confirm login and register still work with email/password.

### 3.3 Check dashboard flows

1. After login, verify the dashboard loads the project list.
2. Confirm overview metrics render.
3. Confirm logs, traces, insights, keys, billing, and settings pages load.
4. Confirm a logout returns the user to the login page.

### 3.4 Verify error handling

1. Force an invalid login.
2. Confirm the frontend shows the server message or fallback text.
3. Force a forbidden project action.
4. Confirm the UI surfaces the access failure cleanly.

---

## 4. SDK Verification in This Repo

### 4.1 TypeScript SDK

```bash
npm run build --workspace=@apexmonitor/sdk
```

Then run the conformance script:

```bash
npm run conformance:sdks
```

The conformance check should confirm:

- canonical success envelope handling
- retry behavior on retryable failures
- request ID propagation
- auth header behavior
- browser RUM flush structure
- `x-rum-key` handling

### 4.2 Browser SDK

```bash
npm run build --workspace=@apexmonitor/browser-sdk
```

Then confirm:

- events queue locally
- `flush()` sends the queued batch
- the request body contains an `events` array
- the request uses `x-rum-key`

### 4.3 Python SDK

```bash
cd packages/python-sdk
python -m pip install --upgrade build twine
python -m build
python -m twine check dist/*
```

Confirm:

- the wheel builds successfully
- the sdist builds successfully
- metadata is valid
- the package installs cleanly in a fresh virtual environment

---

## 5. Testing the SDKs From Another Project

This is the most important validation step before launch.

Use a completely separate consumer repo, not this monorepo.

### 5.1 Create a clean consumer project

Example with TypeScript:

```bash
mkdir apexmonitor-sdk-consumer
cd apexmonitor-sdk-consumer
npm init -y
npm install @apexmonitor/sdk @apexmonitor/browser-sdk
```

Example with Python:

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install apexmonitor-sdk
```

### 5.2 Validate the TypeScript SDK consumer flow

In the external project:

1. Import `ApexClient` from `@apexmonitor/sdk`.
2. Configure the client with the real or staging API base URL.
3. Authenticate using bearer, API key, or RUM key depending on the use case.
4. Call a read endpoint such as projects, metrics, logs, or traces.
5. Call an ingest endpoint with a small controlled payload.
6. Confirm the response shape is usable without extra unwrapping.
7. Confirm retry behavior does not duplicate data when idempotency keys are used.

Example:

```ts
import { ApexClient } from '@apexmonitor/sdk';

const client = new ApexClient({
  baseUrl: process.env.APEXMONITOR_BASE_URL!,
  auth: { type: 'apiKey', value: process.env.APEXMONITOR_API_KEY! },
});

const projects = await client.projects.listMine();
console.log(projects);
```

### 5.3 Validate the browser SDK consumer flow

In a separate frontend app:

1. Import the browser SDK.
2. Initialize it with a RUM key and project ID.
3. Track a page view.
4. Track a synthetic error.
5. Track a custom event.
6. Force a flush.
7. Confirm the backend accepts the batch and the dashboard reflects it.

Example:

```ts
import { createBrowserRumClient } from '@apexmonitor/browser-sdk';

const rum = createBrowserRumClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  projectId: 'proj_123',
  rumKey: process.env.NEXT_PUBLIC_RUM_KEY!,
});

rum.trackPageView();
await rum.flush();
```

### 5.4 Validate the Python SDK consumer flow

In the external Python project:

1. Import `ApexClient`.
2. Configure the base URL.
3. Authenticate.
4. Call metrics and logs endpoints.
5. Confirm JSON responses are parsed correctly.
6. Confirm errors surface as typed exceptions.

Example:

```python
from apexmonitor_sdk import ApexClient

client = ApexClient(
    base_url="https://api.example.com",
    auth={"type": "bearer", "token": "YOUR_TOKEN"},
)

print(client.metrics_overview({"projectId": "proj_123"}))
```

### 5.5 What to check in all consumer projects

- install works from the package registry
- the minimum quick-start snippet works without code edits
- errors are understandable
- retries do not break idempotency
- RUM ingestion lands in the dashboard
- auth and project access are enforced correctly

---

## 6. Full End-to-End Product Test

Run this sequence on staging before any real customer use.

### 6.1 Account setup

1. Register a new startup account.
2. Verify the owner project is created.
3. Log in and confirm the dashboard loads.

### 6.2 Key creation

1. Create an API key for server ingestion.
2. Create a RUM key for frontend telemetry.
3. Confirm the keys are shown once and cannot be recovered in plaintext.

### 6.3 Server ingestion

1. Send real log traffic from a sample backend.
2. Confirm raw logs are stored.
3. Confirm aggregates are produced.
4. Confirm the logs and metrics pages show the data.

### 6.4 Browser telemetry

1. Load a sample frontend with the browser SDK.
2. Trigger page views, errors, and custom events.
3. Confirm RUM data appears in analytics.
4. Confirm the live traffic view reflects real-time activity.

### 6.5 Permissions

1. Invite a second user.
2. Confirm the second user has only the assigned role.
3. Confirm unauthorized project access is blocked.

### 6.6 Resilience

1. Stop Redis briefly and verify the app fails gracefully.
2. Stop RabbitMQ briefly and verify queued ingest is handled safely.
3. Restart services and confirm the system recovers.

### 6.7 Auditability

1. Inspect audit logs after auth and key actions.
2. Confirm the event trail includes actor, project, action, and resource data.
3. Confirm request IDs appear in API responses and error payloads.

---

## 7. Production Readiness Checklist

Do not launch broadly until these pass:

- backend and web builds pass
- SDK builds pass
- SDK conformance passes
- migration validation passes
- audit logging is visible
- support and escalation paths are documented
- backup and restore drills are completed
- a real tenant has been dogfooded successfully
- OAuth buttons remain disabled until OAuth is fully implemented and tested

---

## 8. Recommended Launch Order

1. Validate the repo locally.
2. Validate staging end to end.
3. Test the SDKs from external consumer projects.
4. Run one real tenant in dogfood mode.
5. Only then open the product for broader startup use.