$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "TaskBridge_Executive_Process_Phases.docx"
$tmp = Join-Path $env:TEMP ("taskbridge-docx-" + [guid]::NewGuid().ToString("N"))

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
    $boldStart = if ($header) { "<w:b/>" } else { "" }
    $row += "<w:tc><w:tcPr><w:tcW w:w=`"2400`" w:type=`"dxa`"/>$shade</w:tcPr><w:p><w:r><w:rPr>$boldStart</w:rPr><w:t xml:space=`"preserve`">$(XmlEscape $cell)</w:t></w:r></w:p></w:tc>"
  }
  $row += "</w:tr>"
  return $row
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
$body += Paragraph "Executive Process Roadmap" "Subtitle"
$body += Paragraph "Making home safer for our vulnerable" "Subtitle"
$body += Paragraph "Prepared for executive review | Generated June 2026"
$body += PageBreak

$body += Paragraph "1. Executive Summary" "Heading1"
$body += Paragraph "TaskBridge is a B2B HealthTech and care-operations middleware platform that turns home safety concerns into safeguarded handyman tasks. It connects care agencies, vulnerable service users, TaskBridge administrators, and vetted local traders through a controlled digital workflow."
$body += Paragraph "The platform is designed to reduce preventable home risks such as falls, unsafe access, lock issues, window cleaning needs, garden hazards, lawn overgrowth, and minor repairs, while ensuring vulnerable-adult safeguarding rules are enforced."
$body += Bullet "Care coordinators can submit care notes and monitor task status."
$body += Bullet "AI identifies one or more structured tasks from a single note."
$body += Bullet "TaskBridge automates assignment using service fit, Enhanced DBS, proximity, availability, price, and carer-on-site supervision rules."
$body += Bullet "Care users do not see proposed handyman options; they only see pending assignment or assigned handyman details."
$body += Bullet "TaskBridge administrators control compliance, DBS status, operational oversight, and audit review."

$body += Paragraph "2. Strategic Objectives" "Heading1"
$body += Bullet "Improve home safety for vulnerable adults by acting quickly on practical risks."
$body += Bullet "Create a secure bridge between care agencies and local trade networks."
$body += Bullet "Reduce coordinator workload by automating note interpretation, task splitting, and assignment."
$body += Bullet "Maintain a clear safeguarding boundary around vulnerable residents."
$body += Bullet "Build a scalable platform that can integrate with care apps, DBS providers, marketplaces, SMS, and database-backed audit logs."

$body += Paragraph "3. Phased Delivery Roadmap" "Heading1"
$body += Table @(
  @("Phase", "Purpose", "Executive Outcome"),
  @("Phase 1 - Product Foundation", "Define TaskBridge brand, role model, core workflows, and safeguarding rules.", "Clear proposition and user journeys for care users, admins, and handymen."),
  @("Phase 2 - Prototype Platform", "Build Node.js backend, React portal, landing page, auth flows, task board, and visit workflow.", "Clickable live platform for stakeholder demos."),
  @("Phase 3 - AI Task Planning", "Use AI-style logic to summarise notes, split multiple tasks, infer urgency, and prepare structured assignments.", "Reduced coordinator effort and consistent task quality."),
  @("Phase 4 - Automated Assignment", "Rank eligible handymen by DBS status, service fit, proximity, price, and availability.", "Faster assignment with safeguarding controls."),
  @("Phase 5 - Railway Deployment", "Deploy app to Railway, connect GitHub, verify public URL, and prepare custom domain.", "Live environment available for pilots and demos."),
  @("Phase 6 - PostgreSQL Persistence", "Create production tables for agencies, service users, care users, traders, tasks, AI plans, visits, webhooks, and audit events.", "Durable data foundation for real users."),
  @("Phase 7 - Compliance Hardening", "Add password hashing, API key hashing, token expiry, audit review, DPIA support, and operational controls.", "Production-grade security posture."),
  @("Phase 8 - Partner Integrations", "Connect care apps, Amiqus DBS, Twilio SMS, marketplace dispatch, and completion callbacks.", "Operational interoperability with external services."),
  @("Phase 9 - Pilot Launch", "Run controlled pilot with one care agency and a limited trader network.", "Evidence for safety impact, cost, conversion, and adoption."),
  @("Phase 10 - Scale", "Add multi-agency support, reporting, SLAs, billing, and regional trade capacity.", "Commercially scalable B2B platform.")
)

$body += Paragraph "4. Operational Workflow" "Heading1"
$body += Paragraph "The operational workflow is designed to keep care users focused on the resident concern while TaskBridge handles the operational and safeguarding complexity."
$body += Bullet "Care coordinator logs a note such as: lawn overgrown, window needs cleaning, bathroom grab rail loose."
$body += Bullet "AI identifies whether the note contains one task or multiple tasks."
$body += Bullet "Each task is categorised, assigned urgency, and linked to the service user."
$body += Bullet "If the service user is vulnerable, the digital ring-fence is activated."
$body += Bullet "TaskBridge automatically searches for suitable handymen using DBS, proximity, price, availability, and service fit."
$body += Bullet "If Enhanced DBS is not present, non-DBS assignment is only considered when a carer will be on site for the full visit."
$body += Bullet "Care users see task status only: pending assignment or assigned handyman details."
$body += Bullet "Handymen receive tokenized visit links; resident contact details remain hidden."
$body += Bullet "The visit workflow records check-in, photo proof, checkout, and completion callback."

$body += Paragraph "5. Role-Based Access Model" "Heading1"
$body += Table @(
  @("Role", "Access", "Restrictions"),
  @("Care Manager / Coordinator", "Create notes, generate AI task plans, create tasks, view pending or assigned status.", "Cannot see proposed handymen, approve DBS, manage traders, or access admin portal."),
  @("TaskBridge Admin", "Manage compliance, DBS checks, trader registry, audit logs, and assignment oversight.", "Admin route is not linked from public landing page or care portal."),
  @("Handyman / Trader", "Access only tokenized visit workflow for assigned task.", "No direct resident contact details; no dashboard access."),
  @("Agency Partner", "Receives completion updates and can trigger inbound webhooks.", "Only data scoped to its own service users.")
)

$body += Paragraph "6. Safeguarding And Compliance Controls" "Heading1"
$body += Bullet "Digital ring-fence for vulnerable adults."
$body += Bullet "Enhanced DBS-first assignment policy."
$body += Bullet "Carer-on-site supervised exception only where explicitly indicated."
$body += Bullet "No direct resident contact details exposed to traders."
$body += Bullet "Tokenized visit links for mobile check-in and completion."
$body += Bullet "Geofenced check-in and after-photo proof."
$body += Bullet "Audit logs for AI planning, assignment, DBS changes, visit events, and webhooks."
$body += Bullet "Future production hardening: hashed passwords, hashed API keys, token expiry, encryption key rotation, backup policy, and DPIA pack."

$body += Paragraph "7. Technical Architecture" "Heading1"
$body += Table @(
  @("Layer", "Current Status", "Next Step"),
  @("Frontend", "React/Tailwind app plus standalone landing page.", "Polish responsive UI and executive demo path."),
  @("Backend", "Node.js HTTP server with REST APIs.", "Connect to PostgreSQL and add production auth hardening."),
  @("Database", "PostgreSQL schema and seed files created.", "Run schema in Railway and wire server.js to DATABASE_URL."),
  @("Deployment", "Railway deployment live at production URL.", "Complete custom domain DNS and SSL verification."),
  @("AI Planning", "Rule-based local AI-style planner implemented.", "Replace or augment with managed LLM integration when ready."),
  @("Integrations", "Mock Amiqus and marketplace adapters exist.", "Connect live Amiqus, Twilio, TaskRabbit/Checkatrade/Airtasker APIs.")
)

$body += Paragraph "8. Current Deployment Position" "Heading1"
$body += Bullet "Railway production URL is live: https://taskbridge-uk-production.up.railway.app/"
$body += Bullet "GitHub repository is connected and deploys from main branch."
$body += Bullet "Custom domain DNS is in progress for www.taskbridge.co.uk."
$body += Bullet "Database schema has been created in database/schema.sql."
$body += Bullet "Optional seed data exists in database/seed.sql."

$body += Paragraph "9. Immediate Next Actions" "Heading1"
$body += Bullet "Create Railway PostgreSQL service."
$body += Bullet "Run database/schema.sql in Railway PostgreSQL."
$body += Bullet "Optionally run database/seed.sql for demo data."
$body += Bullet "Add DATABASE_URL to Railway app variables."
$body += Bullet "Refactor server.js from in-memory data to PostgreSQL persistence."
$body += Bullet "Complete custom domain DNS verification."
$body += Bullet "Remove demo credentials before external pilot."
$body += Bullet "Add production password hashing and session/token management."

$body += Paragraph "10. Executive Decision Points" "Heading1"
$body += Bullet "Confirm safeguarding policy for non-DBS handyman visits when a carer is on site."
$body += Bullet "Select pilot care agency and target region."
$body += Bullet "Decide whether AI planning should remain rule-based initially or use a managed AI API."
$body += Bullet "Confirm first marketplace/trader source for live integration."
$body += Bullet "Approve compliance workstream: DPIA, DPA, retention policy, audit export, and incident response."
$body += Bullet "Approve budget for Railway, database, Twilio, Amiqus, and marketplace API access."

$body += Paragraph "11. Success Measures" "Heading1"
$body += Bullet "Time from care note to task creation."
$body += Bullet "Percentage of notes correctly split into multiple tasks."
$body += Bullet "Percentage of vulnerable-adult tasks assigned to Enhanced DBS-approved traders."
$body += Bullet "Number of home hazards completed."
$body += Bullet "Fall-risk and access-risk reduction indicators."
$body += Bullet "Care coordinator time saved."
$body += Bullet "Assignment failure rate and average time to assignment."
$body += Bullet "Completion proof rate and webhook callback success rate."

$body += Paragraph "12. Recommended Executive Summary Statement" "Heading1"
$body += Paragraph "TaskBridge is positioned as a safeguarding-first operational bridge between care teams and trusted local trade capacity. It reduces home safety risks for vulnerable residents by transforming care observations into structured, auditable, and automatically assigned tasks while preserving strict access control and resident privacy."

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
  <dc:title>TaskBridge Executive Process Roadmap</dc:title>
  <dc:subject>Project processes and phases</dc:subject>
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

$zipPath = Join-Path $env:TEMP ("taskbridge-docx-" + [guid]::NewGuid().ToString("N") + ".zip")
Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $outPath -Force
Remove-Item -LiteralPath $tmp -Recurse -Force

Write-Output $outPath
