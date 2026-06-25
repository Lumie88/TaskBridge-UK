# TaskBridge MVP Phase 1-4 Operations Playbook

## Purpose

This playbook defines the minimum operating process for the TaskBridge pilot: who reviews work, who contacts care agencies, how failed visits are handled, how complaints are escalated, and how manual payments are tracked before full payment automation is introduced.

## Phase 1: Landing Page, Demo Page, Book Demo

### Demo Request Handling

1. A care organisation submits the public Book a Demo form.
2. The request is stored in `tenant.demo_requests` with status `new`.
3. A TaskBridge admin reviews the request in the Admin Portal under Demo Requests.
4. The admin contacts the requester and moves the request to `contacted`.
5. If the organisation is suitable for a pilot, the admin moves it to `qualified`.
6. Closed, unsuitable, duplicate, or stale requests are marked `closed`.

### Qualification Checklist

- Confirm the requester uses a work email address.
- Confirm the organisation is a care provider, local authority, commissioner, or relevant care operations partner.
- Confirm the expected pilot area and approximate volume of practical home-safety tasks.
- Confirm whether the organisation needs portal-only onboarding or API/webhook integration.
- Do not request live resident data for the demo.

## Phase 2: Manual Concierge Pilot

### Who Reviews Tasks

- Care coordinators create and approve task summaries.
- TaskBridge admins review assignment eligibility, handyman compliance, evidence exceptions, failed visits, and payment holds.
- TaskBridge super admins approve agency onboarding, staff privileges, policy settings, monthly caps, and high-risk exceptions.

### Who Calls Agencies

- The assigned TaskBridge admin contacts the care agency for demo follow-up, failed visits, disputes, unclear task scope, missing resident location, or missing care confirmation.
- Super admin contacts the agency only for escalation, safeguarding concerns, payment exposure, repeated failed visits, or account suspension.

### Failed Visit Handling

1. Record the failure reason in the task timeline or dispute note.
2. Confirm whether the handyman attended, checked in, or failed before arrival.
3. If no work started, reverse or cancel the assignment where possible.
4. If the provider cancellation fails, the retry queue must be run and monitored.
5. Notify the care agency and agree whether to reassign, reschedule, or cancel.
6. Keep payout on hold until the reason is resolved.

### Complaint Escalation

- Poor workmanship: hold payout, request evidence, ask care coordinator/caregiver for confirmation, decide rework, refund, or close.
- Property damage: hold payout, collect photos, escalate to super admin, review handyman insurance.
- Safeguarding concern: suspend handyman, notify agency safeguarding lead, record incident, escalate immediately to super admin.
- Data concern: preserve audit logs, assess breach risk, follow privacy and incident process.

## Manual Payment Tracking

### Phase 1 Payment Model

- Service user, family, guardian, or funding representative pays via the care agency's existing invoice process.
- TaskBridge records the handyman fee, agency coordination fee, platform fee, total charge, settlement status, and payout status.
- Default pilot monthly cap is GBP 500 per agency unless a super admin changes it.

### Settlement Statuses

- `not_invoiced`: charge created, not yet exported or sent.
- `invoiced`: included in an agency invoice or billing export.
- `agency_paid`: agency has settled the charge with TaskBridge.
- `disputed`: payment or service outcome is under review.
- `written_off`: no further collection expected.

### Payout Rule

- Handyman payout is created on dispatch but held until visit evidence and care confirmation are complete.
- Once care confirms completion, payout becomes eligible approximately 48 hours later.
- Any dispute, missing evidence, complaint, or safeguarding concern keeps payout on hold.

## Phase 3: Agency Portal

### Coordinator Workflow

1. Create or update the service user.
2. Paste the care note.
3. Evaluate the note using the AI task planner.
4. Review each suggested task and remove anything inappropriate.
5. Confirm address, town, county, postcode, keysafe information, visit window, and carer-on-site status.
6. Submit approved tasks for TaskBridge assignment.
7. Monitor status board and notifications.
8. Review before/after photos.
9. Confirm completion only when visible completion is acceptable or a caregiver confirms at the next visit.

### UX Validation

Run at least three observed sessions with care coordinators:

- One service-user creation flow.
- One messy care-note translation flow with multiple tasks.
- One evidence review and completion confirmation flow.
- One reversal request before the handyman starts.

Capture confusion, repeated clicks, unclear labels, missing fields, and time-to-complete.

## Phase 4: Admin And Super Admin Backend

### Agency Settings

Super admin controls:

- Go-live status: `pilot_setup`, `pilot_live`, `paused`, `suspended`.
- Monthly cap.
- Enhanced DBS requirement for vulnerable-adult work.
- Care confirmation requirement.
- Supervised visit exception policy.
- Default visit radius.

### Integration Retries

- Failed care callbacks and network cancellations are placed into `integration.retry_queue`.
- Super admin can run retry processing from the Integrations page.
- Repeated failures must be escalated to the integration owner and care agency contact.

### Provider Credentials Required For Production

Set these in Railway before full pilot use:

- `GOOGLE_GEMINI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_BUCKET`
- `DBS_PROVIDER_API_URL`
- `DBS_PROVIDER_API_KEY`
- `DBS_PROVIDER_WEBHOOK_SECRET`
- `HANDYMAN_NETWORK_API_URL`
- `HANDYMAN_NETWORK_API_KEY`
- `HANDYMAN_NETWORK_CANCEL_API_URL`

## MVP Exit Criteria

- Demo requests can be tracked from new to closed.
- A care agency can be onboarded by super admin.
- A care coordinator can create service users and approved tasks.
- TaskBridge admin can assign only eligible handymen.
- Evidence upload and care confirmation work end to end.
- Agency cap blocks over-limit dispatches.
- Settlement and payout status are visible in admin.
- Failed callbacks can be retried and audited.
- No public marketing page exposes internal provider or security implementation details.
