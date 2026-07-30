# TaskBridge

TaskBridge turns care notes into approved home-safety tasks, applies safeguarding controls, and coordinates secure visits with suitable handymen.

**Making home safer for our vulnerable.**

## What is integrated

- Modern React/Vite public website, care coordinator portal, isolated admin portal, and mobile visit workflow.
- PostgreSQL as the system of record with `auth`, `tenant`, `care`, `trader`, `ops`, `integration`, `audit`, and `billing` schemas.
- Care-team approval before assignment; multi-task extraction from a single note.
- Strict DBS route, insurance, service, supervision, distance, and availability checks.
- Opaque database-backed sessions, role middleware, encrypted resident fields, hashed visit/API tokens, and audit logs.
- Provider-neutral adapters for care applications, DBS verification, handyman networks, SMS, task planning, and S3-compatible photo storage.

Care coordinators never see proposed candidates. They see either **Pending assignment** or the final assigned handyman. Candidate evaluation, DBS review, and dispatch are available only at the unlinked `/internal/taskbridge` route.

## Local setup

Requires Node.js 20+ and PostgreSQL 15+.

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run dev
```

Open `http://localhost:4173`. The public care-team sign-in is `/sign-in`; the restricted admin entry point is intentionally not linked from the website.

Development data is opt-in:

```bash
set ALLOW_DEMO_SEED=true
npm run db:seed
```

Never enable demo seed data in production.

## Create the first production admin

After migrations, run this once with temporary environment variables:

```bash
set ADMIN_NAME=TaskBridge Administrator
set ADMIN_EMAIL=admin@your-work-domain.co.uk
set ADMIN_PASSWORD=use-a-unique-password-of-16-or-more-characters
set ADMIN_ROLE=taskbridge_super_admin
npm run admin:create
```

Remove `ADMIN_PASSWORD` immediately after the account is created.

## Railway deployment

1. Add a Railway PostgreSQL service to the project.
2. Set the application service `DATABASE_URL` to the PostgreSQL reference variable.
3. Set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain`, and a long random `ENCRYPTION_KEY`.
4. Add the provider variables from `.env.example`. S3-compatible object storage is required for mobile visit evidence.
5. Deploy. `railway.toml` runs the production build, applies pending migrations, starts the server, and checks `/api/readiness`.
6. Run `npm run admin:create` as a one-off Railway command, then remove the temporary admin password variable.

The application listens on Railway's injected `PORT`. `/api/health` confirms the process is running; `/api/readiness` also confirms PostgreSQL and required production configuration.

## Object storage

Set:

```text
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_PUBLIC_BASE_URL=
```

Use a private write policy and a controlled read/CDN URL. Upload links expire after five minutes and accept only JPEG, PNG, or WebP files up to 10 MB.

## Production provider integrations

### DDC DBS checks

Set `DBS_PROVIDER_KIND=ddc` and add the DDC sandbox or production values supplied by Due Diligence Checking:

```text
DDC_API_BASE_URL=
DDC_API_TOKEN=
DDC_APPLICATION_PATH=/api/applications
DDC_ACCOUNT_CODE=
DDC_LOCATION_CODE=
DDC_BASIC_PACKAGE_CODE=basic_dbs
DDC_ENHANCED_PACKAGE_CODE=enhanced_dbs
DBS_PROVIDER_WEBHOOK_SECRET=
```

TaskBridge sends DBS application requests to the configured DDC path and accepts provider results at `/api/webhooks/ddc-callback`. Enhanced DBS must still be used only where the role is legally eligible; ordinary handyman work should use the Basic DBS/supervised-visit route.

### Twilio SMS

Set:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_STATUS_CALLBACK_URL=
```

TaskBridge uses Twilio Programmable Messaging to send secure visit links to handymen. If Twilio variables are not configured, SMS delivery records are marked `not_configured` instead of crashing the dispatch flow.

### Zoho Mail

Set `EMAIL_PROVIDER_KIND=zoho` and add:

```text
EMAIL_FROM_ADDRESS=TaskBridge Onboarding <integrations@growingfig.com>
ZOHO_MAIL_API_BASE_URL=https://mail.zoho.com
ZOHO_MAIL_ACCOUNT_ID=
ZOHO_MAIL_OAUTH_TOKEN=
```

Zoho is used for demo receipts, care-agency staff invitations and handyman onboarding invitations.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Database migrations are checksum-protected in `database/migrations`. Do not edit an applied migration; add a new numbered migration instead.

## Handyman Android/iOS app

The optional native handyman app lives in `apps/handyman-mobile`. It is an Expo app that reuses the same secure visit-token APIs as the web visit link, including accept/decline, geofenced check-in, before/after evidence upload, and checkout.

```bash
cd apps/handyman-mobile
npm install
npm run start
```

Android/iOS builds use EAS:

```bash
npm run build:android
npm run build:ios
```
