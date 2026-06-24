$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "TaskBridge_Project_Overview_and_Integrations.docx"
$tmp = Join-Path $env:TEMP ("taskbridge-overview-docx-" + [guid]::NewGuid().ToString("N"))

function XmlEscape([string]$text) {
  return [System.Security.SecurityElement]::Escape($text)
}

function Paragraph([string]$text, [string]$style = "") {
  $escaped = XmlEscape $text
  if ($style) {
    return "<w:p><w:pPr><w:pStyle w:val=`"$style`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
  }
  return "<w:p><w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function Bullet([string]$text) {
  $escaped = XmlEscape $text
  return "<w:p><w:pPr><w:pStyle w:val=`"Bullet`"/></w:pPr><w:r><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function PageBreak() {
  return "<w:p><w:r><w:br w:type=`"page`"/></w:r></w:p>"
}

function TableRow([string[]]$cells, [bool]$header = $false) {
  $row = "<w:tr>"
  foreach ($cell in $cells) {
    $shade = if ($header) { "<w:shd w:fill=`"DFF5E8`"/>" } else { "" }
    $bold = if ($header) { "<w:b/>" } else { "" }
    $row += "<w:tc><w:tcPr><w:tcW w:w=`"2400`" w:type=`"dxa`"/>$shade</w:tcPr><w:p><w:r><w:rPr>$bold</w:rPr><w:t xml:space=`"preserve`">$(XmlEscape $cell)</w:t></w:r></w:p></w:tc>"
  }
  return $row + "</w:tr>"
}

function Table([array]$rows) {
  $xml = "<w:tbl><w:tblPr><w:tblStyle w:val=`"TableGrid`"/><w:tblW w:w=`"0`" w:type=`"auto`"/><w:tblBorders><w:top w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2DD`"/><w:left w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2DD`"/><w:bottom w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2DD`"/><w:right w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2DD`"/><w:insideH w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2DD`"/><w:insideV w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2DD`"/></w:tblBorders></w:tblPr>"
  for ($i = 0; $i -lt $rows.Count; $i++) {
    $xml += TableRow $rows[$i] ($i -eq 0)
  }
  return $xml + "</w:tbl>"
}

New-Item -ItemType Directory -Force -Path (Join-Path $tmp "_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmp "word") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmp "word\_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmp "docProps") | Out-Null

$body = ""
$body += Paragraph "TaskBridge" "Title"
$body += Paragraph "Project Overview, Partner API Integrations, and DBS Automation" "Subtitle"
$body += Paragraph "Making home safer for our vulnerable" "Subtitle"
$body += Paragraph "Prepared for executive and partner discussions | June 2026"
$body += PageBreak

$body += Paragraph "1. What TaskBridge Is" "Heading1"
$body += Paragraph "TaskBridge is a safeguarding-first B2B middleware and operational portal for the UK care sector. It helps care agencies identify practical home risks for vulnerable residents and automatically convert those concerns into controlled handyman tasks."
$body += Paragraph "The platform bridges three groups: care providers, TaskBridge administrators, and vetted local handymen/traders. It is designed to protect vulnerable service users while enabling practical, everyday interventions such as garden clearance, lawn mowing, window cleaning, lock repairs, loose rail repairs, trip hazard removal, and minor safety works."
$body += Bullet "Care teams submit notes from their existing care workflow or directly through TaskBridge."
$body += Bullet "AI identifies one or more actionable tasks from the note."
$body += Bullet "TaskBridge applies safeguarding rules and automates assignment."
$body += Bullet "Care users see only pending assignment or assigned handyman details, not proposed trader lists."
$body += Bullet "TaskBridge administrators retain operational and compliance oversight."

$body += Paragraph "2. The Problem TaskBridge Solves" "Heading1"
$body += Bullet "Homecare teams often notice hazards but lack a secure, governed way to arrange practical fixes."
$body += Bullet "Vulnerable residents need extra protection when external tradespeople visit their homes."
$body += Bullet "Care coordinators should not manually search public marketplaces or expose resident contact details."
$body += Bullet "DBS status, availability, proximity, price, and service fit must be considered together."
$body += Bullet "Care systems need completion updates without forcing staff into duplicated administration."

$body += Paragraph "3. Core Users And Access Model" "Heading1"
$body += Table @(
  @("User Group", "Role In TaskBridge", "Access Controls"),
  @("Care Manager / Coordinator", "Create notes, generate AI task plans, and monitor status.", "Limited access. Cannot see proposed handymen, DBS controls, admin location, or assignment engine internals."),
  @("TaskBridge Admin", "Oversee compliance, trader checks, assignment rules, audit logs, and exception handling.", "Separate unlinked admin access point with full operational privileges."),
  @("Handyman / Trader", "Completes assigned tasks using tokenized visit links.", "No dashboard access and no direct resident contact details."),
  @("Care Agency Partner", "Receives callbacks and task updates through API integration.", "Scoped only to its own service users, tasks, and events.")
)

$body += Paragraph "4. End-To-End Process" "Heading1"
$body += Bullet "A care worker or coordinator identifies a home risk during care delivery."
$body += Bullet "The note enters TaskBridge through the portal or partner API/webhook."
$body += Bullet "AI summarises the note and splits it into separate tasks where required."
$body += Bullet "TaskBridge identifies category, urgency, preferred time window, and whether a carer will be on site."
$body += Bullet "If the resident is vulnerable, TaskBridge applies the digital ring-fence."
$body += Bullet "The assignment engine selects a suitable handyman using Enhanced DBS, service fit, proximity, availability, price, and supervision rules."
$body += Bullet "If no safe automatic assignment is possible, the task remains pending for TaskBridge admin review."
$body += Bullet "The handyman receives a tokenized visit workflow, completes check-in, uploads proof, and checks out."
$body += Bullet "TaskBridge sends completion updates back to the originating care system."

$body += Paragraph "5. AI Task Planning" "Heading1"
$body += Paragraph "TaskBridge uses AI-assisted task planning to reduce care coordinator workload and create consistent operational tasks from unstructured care notes."
$body += Bullet "Detects multiple tasks from one note, for example: lawn mowing, window cleaning, and loose rail repair."
$body += Bullet "Summarises each task in operational language."
$body += Bullet "Assigns a likely service category and urgency."
$body += Bullet "Uses carer-on-site availability as part of the safeguarding logic."
$body += Bullet "Keeps proposed handyman options hidden from care staff."
$body += Bullet "Supports future integration with a managed large language model for more advanced note interpretation."

$body += Paragraph "6. Services Supported" "Heading1"
$body += Bullet "Garden path clearing, moss removal, leaf clearing, weed removal, garden clearance, hedge trimming, and lawn mowing."
$body += Bullet "Window cleaning, low-level exterior window cleaning, internal window cleaning, and door glass cleaning."
$body += Bullet "Loose rail repair, grab rail installation, stair rail tightening, lock repair, and key-safe installation."
$body += Bullet "Trip hazard removal, loose carpet fixing, rug anti-slip fitting, threshold repair, and decluttering for safe access."
$body += Bullet "Appliance safety tasks, oven cleaning, smoke alarm fitting, carbon monoxide alarm fitting, and minor household safety work."

$body += Paragraph "7. Birdie API Integration" "Heading1"
$body += Paragraph "TaskBridge will integrate with Birdie as a care-system partner to receive home safety risks and return task progress or completion updates. Final endpoint details must be confirmed against Birdie's partner API documentation and commercial access model."
$body += Bullet "Inbound from Birdie: service user identifier, care note, task category where available, urgency, location reference, care worker context, and carer-on-site timing."
$body += Bullet "TaskBridge processing: validate agency API credentials, map Birdie service user to TaskBridge service user, run AI planning, create one or more tasks, apply safeguarding rules, and automate assignment."
$body += Bullet "Outbound to Birdie: task accepted, pending assignment, assigned, checked-in, completed, blocked, or exception status."
$body += Bullet "Completion payload: task summary, completion timestamp, non-sensitive proof reference, and care-note update text."
$body += Bullet "Security: bearer/API key authentication, webhook signature verification where supported, idempotency keys, audit logs, and no resident contact details passed to external traders."

$body += Paragraph "8. PASS API Integration" "Heading1"
$body += Paragraph "TaskBridge will integrate with PASS as a digital care planning and care management system. The integration pattern is expected to mirror the core care-platform workflow: receive safety concerns, map service user identity, and send status updates back to the care record. Exact endpoints and payload formats should be confirmed with PASS integration documentation or partner access."
$body += Bullet "Inbound from PASS: service user reference, care note, risk observation, care visit context, and optional preferred completion window."
$body += Bullet "TaskBridge actions: AI task splitting, vulnerability check, assignment automation, and visit workflow creation."
$body += Bullet "Outbound to PASS: structured task summary, assignment status, visit completion, and safeguarding notes."
$body += Bullet "Operational benefit: care coordinators stay inside PASS while TaskBridge handles the practical works workflow."
$body += Bullet "Governance: only minimum required service-user data should be exchanged, with encrypted storage and auditable processing."

$body += Paragraph "9. Cera DCP API Integration" "Heading1"
$body += Paragraph "TaskBridge will integrate with Cera DCP as a care delivery platform integration for safety-risk intake and completion callbacks. Integration details should be validated with Cera's technical partnership route and DCP API documentation."
$body += Bullet "Inbound from Cera DCP: resident/service user reference, field note, risk category, location metadata, care visit timing, and carer-on-site indicator."
$body += Bullet "TaskBridge processing: convert free-text notes into tasks, apply vulnerable-adult rules, select eligible handymen, and create secure visit tokens."
$body += Bullet "Outbound to Cera DCP: task lifecycle updates, completion summary, exception notices, and proof references."
$body += Bullet "Safeguarding: TaskBridge must ensure external traders never receive direct resident contact details from Cera DCP data."
$body += Bullet "Audit: all inbound and outbound events are logged against agency, service user, task, and timestamp."

$body += Paragraph "10. Standard Partner API Pattern" "Heading1"
$body += Table @(
  @("Integration Event", "Direction", "Purpose"),
  @("care_task.created", "Care system to TaskBridge", "Create a TaskBridge task from a care note or risk observation."),
  @("task.accepted", "TaskBridge to care system", "Confirm intake and task creation."),
  @("task.pending_assignment", "TaskBridge to care system", "Notify that assignment is pending due to compliance, availability, or matching constraints."),
  @("task.assigned", "TaskBridge to care system", "Notify that a handyman has been safely assigned."),
  @("visit.checked_in", "TaskBridge to care system", "Confirm geofenced visit check-in."),
  @("task.completed", "TaskBridge to care system", "Send completion summary and proof reference."),
  @("task.blocked", "TaskBridge to care system", "Report safeguarding or assignment failure requiring human review.")
)

$body += Paragraph "11. Amiqus DBS Integration For Handymen" "Heading1"
$body += Paragraph "TaskBridge will integrate with Amiqus to make DBS and identity verification seamless for handymen. The objective is to reduce manual compliance administration while ensuring Enhanced DBS status is captured before vulnerable-adult assignments."
$body += Bullet "Handyman onboarding begins in TaskBridge or through an approved marketplace/trader source."
$body += Bullet "TaskBridge creates an Amiqus verification session for the handyman."
$body += Bullet "The handyman completes identity and DBS verification through the Amiqus workflow."
$body += Bullet "Amiqus sends completion webhook events back to TaskBridge."
$body += Bullet "TaskBridge updates the trader's DBS status to Pending, Approved, or Rejected."
$body += Bullet "Approved Enhanced DBS records include expiry date and last checked timestamp."
$body += Bullet "Tasks for vulnerable adults prioritise Enhanced DBS-approved handymen."
$body += Bullet "If DBS is not approved, TaskBridge only permits assignment when the policy allows a supervised visit with a carer on site."

$body += Paragraph "12. Amiqus DBS Data Flow" "Heading1"
$body += Table @(
  @("Step", "Description", "System Of Record"),
  @("1. Trader profile created", "TaskBridge records trader identity, mobile number, services, location, rate, and marketplace source.", "TaskBridge"),
  @("2. Verification session requested", "TaskBridge calls Amiqus to create a DBS/identity verification session.", "TaskBridge + Amiqus"),
  @("3. Trader completes check", "Handyman completes the Amiqus verification flow.", "Amiqus"),
  @("4. Webhook received", "Amiqus sends completion result to TaskBridge.", "TaskBridge"),
  @("5. DBS status updated", "TaskBridge stores DBS status, expiry date, session ID, and audit trail.", "TaskBridge"),
  @("6. Assignment engine uses DBS", "TaskBridge uses DBS status as a primary factor for vulnerable-adult tasks.", "TaskBridge")
)

$body += Paragraph "13. Safeguarding Rules" "Heading1"
$body += Bullet "Vulnerable adult tasks activate the digital ring-fence."
$body += Bullet "Enhanced DBS-approved handymen are preferred and normally required for vulnerable-adult assignments."
$body += Bullet "Non-DBS handyman assignment is only considered where a carer will be present throughout the visit and the safeguarding policy permits it."
$body += Bullet "Care coordinators do not see or choose from proposed handymen."
$body += Bullet "TaskBridge hides resident direct contact details and uses tokenized communication links."
$body += Bullet "Every sensitive action is auditable: AI plan, assignment, DBS change, check-in, checkout, and webhook callback."

$body += Paragraph "14. Data And Security" "Heading1"
$body += Bullet "Service user name and address should be encrypted at rest."
$body += Bullet "Agency API keys should be hashed, not stored as plaintext."
$body += Bullet "Passwords should be hashed with a modern password hashing algorithm before production use."
$body += Bullet "Webhook signatures and idempotency keys should be used for partner integrations."
$body += Bullet "Only minimum necessary service-user data should be sent to partners and traders."
$body += Bullet "Visit tokens should be time-limited and cryptographically signed."
$body += Bullet "Audit logs should be immutable or restricted to admin-only review."

$body += Paragraph "15. Database Foundation" "Heading1"
$body += Paragraph "A PostgreSQL schema has been prepared for Railway and includes the core operational tables required for production persistence."
$body += Bullet "agencies, service_users, care_users, traders, tasks, ai_task_plans, demo_requests, visit_events, outbound_webhook_events, and audit_events."
$body += Bullet "Indexes are included for agency scoping, task status, assignment status, trader DBS status, services, and audit event ordering."
$body += Bullet "The next implementation step is wiring the Node.js backend to DATABASE_URL so live data persists across Railway restarts."

$body += Paragraph "16. Deployment And Hosting" "Heading1"
$body += Bullet "TaskBridge is deployed on Railway at https://taskbridge-uk-production.up.railway.app/"
$body += Bullet "GitHub is the source repository for deployment."
$body += Bullet "A custom domain, www.taskbridge.co.uk, is being configured through DNS."
$body += Bullet "Railway PostgreSQL should be added for persistence."
$body += Bullet "Environment variables should be configured for DATABASE_URL, encryption key, signing secret, Amiqus key, Twilio credentials, and marketplace credentials."

$body += Paragraph "17. Implementation Roadmap" "Heading1"
$body += Table @(
  @("Phase", "Focus", "Outcome"),
  @("Phase 1", "Live prototype and landing page", "Stakeholder demo and Railway deployment."),
  @("Phase 2", "PostgreSQL persistence", "Production data survives restarts and supports real pilots."),
  @("Phase 3", "Care platform APIs", "Birdie, PASS, and Cera DCP intake/callback integrations."),
  @("Phase 4", "Amiqus DBS", "Seamless handyman verification and automated DBS updates."),
  @("Phase 5", "Twilio visit workflow", "Tokenized SMS links, check-in, proof, and checkout."),
  @("Phase 6", "Marketplace/private trader routing", "Automated safe assignment to approved providers."),
  @("Phase 7", "Pilot and compliance", "Controlled launch with DPIA, DPA, audit review, and operating playbook."),
  @("Phase 8", "Scale", "Multi-agency, multi-region, reporting, billing, and service-level management.")
)

$body += Paragraph "18. Executive Positioning" "Heading1"
$body += Paragraph "TaskBridge is not simply a handyman booking tool. It is a safeguarding middleware layer for care organisations. It converts care observations into managed, auditable, and safely assigned practical interventions, while using partner APIs and Amiqus DBS automation to reduce administrative burden and improve outcomes for vulnerable residents."

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $body
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="102027"/></w:rPr><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="56"/><w:color w:val="102027"/></w:rPr><w:pPr><w:spacing w:after="180"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:sz w:val="30"/><w:color w:val="2563EB"/></w:rPr><w:pPr><w:spacing w:after="220"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="102027"/></w:rPr><w:pPr><w:spacing w:before="360" w:after="160"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D9E2DD"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D9E2DD"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D9E2DD"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D9E2DD"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9E2DD"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9E2DD"/></w:tblBorders></w:tblPr></w:style>
</w:styles>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@

$relsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$documentRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@

$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>TaskBridge Project Overview and Integrations</dc:title>
  <dc:subject>Project overview, care platform APIs, and Amiqus DBS integration</dc:subject>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-06-13T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-13T00:00:00Z</dcterms:modified>
</cp:coreProperties>
"@

$appXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>TaskBridge</Application>
</Properties>
"@

[System.IO.File]::WriteAllText((Join-Path $tmp "[Content_Types].xml"), $contentTypesXml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $tmp "_rels\.rels"), $relsXml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $tmp "word\document.xml"), $documentXml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $tmp "word\styles.xml"), $stylesXml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $tmp "word\_rels\document.xml.rels"), $documentRelsXml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $tmp "docProps\core.xml"), $coreXml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $tmp "docProps\app.xml"), $appXml, [System.Text.Encoding]::UTF8)

if (Test-Path $outPath) {
  Remove-Item -LiteralPath $outPath -Force
}

$zipPath = Join-Path $env:TEMP ("taskbridge-overview-docx-" + [guid]::NewGuid().ToString("N") + ".zip")
Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $outPath -Force
Remove-Item -LiteralPath $tmp -Recurse -Force

Write-Output $outPath
