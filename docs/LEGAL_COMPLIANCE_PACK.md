# TaskBridge Legal and Compliance Pack

Status: operational template for solicitor review before full-scale rollout.
Owner: Growing Fig / TaskBridge operations.
Review cycle: annually, or sooner after a safeguarding incident, data incident, material product change, or legal/regulatory change.

This pack records the documents and operating positions required before TaskBridge is used at scale with care agencies, service users, families and independent handymen.

## 1. Data Processing Agreement

Purpose: define how TaskBridge processes personal data on behalf of care agencies.

Required positions:
- Care agency is normally the controller for service-user care records and task requests.
- Growing Fig / TaskBridge is normally the processor for platform operation, task coordination, visit evidence, notifications and audit records.
- Sub-processors include hosting, database, email, SMS, payment, object storage, AI task planning, DBS/integrations and monitoring providers.
- Processing is limited to care-approved home-safety task coordination, safeguarding controls, payment administration and audit.
- International transfers must use appropriate safeguards where a provider stores or processes data outside the UK.
- Breach notification target: notify affected care agency without undue delay and normally within 24 hours of confirmation.

Minimum schedules:
- Subject matter and duration of processing.
- Categories of data subjects.
- Categories of personal data and special category data.
- Approved sub-processors.
- Technical and organisational measures.
- Data return/deletion process at contract end.

## 2. Privacy Notice

Purpose: explain TaskBridge data use to care agencies, service users, families, staff and handymen.

Must cover:
- Identity and contact details for Growing Fig.
- Categories of personal data processed.
- Limited special category data where needed for safe visits, access requirements or safeguarding.
- Lawful bases: contract, legitimate interests, legal obligation, vital interests and explicit consent where needed.
- Who data is shared with: care agencies, approved handymen, payment providers, email/SMS providers, storage providers, DBS providers and authorities where required.
- Rights: access, correction, deletion, restriction, objection, portability and ICO complaint route.
- Retention periods and deletion process.
- Contact mailbox for privacy queries.

## 3. Retention Schedule

Default retention:
- Care task records and visit evidence: 6 years after task completion or contract end, unless the agency contract requires a shorter period.
- Safeguarding incidents and serious complaints: 6 years after closure, or longer if required by the care agency or legal advice.
- Payment, invoice and payout records: 6 years plus current financial year.
- Handyman compliance records: duration of active relationship plus 6 years.
- Expired onboarding invitations and unused tokens: delete or anonymise after 90 days.
- System audit logs: 12-24 months online, then archive if contractually needed.
- Failed integration payloads: minimise and delete after retry window unless needed for investigation.

Deletion rules:
- Delete or anonymise records when retention ends.
- Preserve records under legal hold, safeguarding investigation, payment dispute or active complaint.
- Never delete audit evidence while an incident is open.

## 4. Safeguarding SOP

Core controls:
- TaskBridge does not provide personal care.
- Care-team approval is required before assignment.
- Vulnerable-adult work requires verified identity, insurance, DBS route review, service suitability and supervision controls.
- Enhanced DBS is used only where the role/activity is legally eligible.
- Where enhanced DBS is not applicable, use Basic DBS, identity, insurance and supervised-visit controls.
- Handymen must not provide personal care, handle medication, accept gifts/money, share personal contact details or enter unauthorised areas.
- Any concern must be recorded as an incident and escalated to the care agency safeguarding lead.

Emergency route:
- Immediate danger: call 999 first.
- Then notify TaskBridge operations and the care agency safeguarding lead.
- Preserve visit evidence and audit logs.
- Suspend dispatch to involved handyman pending review where appropriate.

## 5. DBS Eligibility Policy

Position:
- DBS checks must be proportionate and lawful.
- Ordinary trade work in a vulnerable adult's home does not automatically justify Enhanced DBS.
- Enhanced DBS evidence is accepted only where the role is eligible and evidence is verified.
- Basic DBS, identity checks, insurance checks and supervised visits are the default route for ordinary handyman tasks unless eligibility is confirmed.

Admin decisions must record:
- DBS route chosen.
- Evidence reviewed.
- Expiry or review date.
- Any Update Service consent.
- Supervision restrictions for vulnerable-adult work.

## 6. Contractor Terms

Handyman terms must include:
- Independent contractor status.
- Required insurance and truthful onboarding information.
- Safeguarding duties and prohibited conduct.
- Evidence requirements: check-in, before/after photos, notes and checkout.
- No direct resident marketing or off-platform payment.
- Confidentiality and data protection obligations.
- Right to suspend/remove for safety, fraud, complaints, expired documents or misconduct.
- Payment hold rules for missing evidence, disputes, complaints and safeguarding concerns.

## 7. Care Agency Agreement

Agency terms must include:
- Scope of TaskBridge service and exclusions from personal care.
- Agency responsibility for care-plan accuracy and service-user approval.
- Payment route: agency invoice, family payment or funded support.
- Incident escalation contacts and response times.
- Data processing agreement attachment.
- Service levels for routine, high-risk and urgent tasks.
- Liability boundaries and insurance expectations.
- Cancellation, reassignment and complaint processes.

## 8. Incident Escalation Policy

Incident types:
- Failed visit.
- Missing evidence.
- Family complaint.
- Safeguarding concern.
- Payment dispute.
- Handyman declined or no-show.
- Data protection concern.

Severity:
- Low: operational inconvenience, no safety issue.
- Medium: service delay or missing evidence.
- High: vulnerable-adult risk, repeated failure, complaint, payment dispute.
- Critical: immediate safety risk, suspected abuse, serious data breach, police/authority involvement.

Response targets:
- Critical: immediate action, same-hour escalation.
- High: same business day.
- Medium: within 1 business day.
- Low: within 3 business days.

Every incident must have:
- Owner.
- Status.
- Linked task/agency/handyman where applicable.
- Action log.
- Closure reason.

## 9. Full-Scale Deployment Gate

Do not mark full-scale deployment ready until:
- DPA, privacy notice, contractor terms and agency agreement are solicitor-reviewed.
- Storage, email, SMS, Stripe and backup/recovery checks are live.
- Safeguarding SOP and incident escalation contacts are approved.
- At least one care agency has signed the onboarding pack.
- At least one handyman has passed compliance checks end to end.
- A live low-value Stripe payment has been reconciled.
- A visit evidence upload has been tested in production object storage.
