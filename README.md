# TaskBridge

TaskBridge is a B2B care operations platform for turning home safety concerns into safeguarded handyman tasks.

Motto: **Making home safer for our vulnerable**

## Run Locally

```bash
node server.js
```

Open:

```text
http://127.0.0.1:4173
http://127.0.0.1:4173/landing.html
```

## Demo Logins

Care coordinator:

```text
Email: maya@birdie.example
Password: demo12345
```

## Railway

Start command:

```bash
node server.js
```

Suggested environment variables:

```text
NODE_ENV=production
TASKBRIDGE_ENCRYPTION_KEY=replace-with-32-byte-secret
TASKBRIDGE_SIGNING_SECRET=replace-with-long-random-secret
USE_REAL_PARTNER_APIS=false
```

## Current Safeguarding Controls

- Care managers/coordinators can create and approve AI-summarised task intake only.
- TaskBridge admins must approve handyman dispatch from the hidden `/taskbridge-admin` access point.
- Vulnerable-adult tasks require an active, unexpired Enhanced DBS before dispatch.
- Dispatch also checks service fit, verified insurance, required qualifications, proximity, availability, quality score, price, and the agency monthly cap.
- Trader checkout moves a job to `Awaiting Confirmation`; care/admin confirmation is required before final completion and care-app callback.
- `/api/state` returns operational data only for a valid care/admin session, or a single token-authorised visit task.

## Database Status

`database/schema.sql` contains the Railway PostgreSQL target schema, including agencies, service users, care users, traders, tasks, AI plans, visit events, partner integration events, webhook events, and audit events.

The current deployed server still uses the in-memory store in `server.js`. The next production phase is to add a PostgreSQL driver, migrate the API reads/writes to `DATABASE_URL`, and run `database/schema.sql` against the Railway Postgres service.
