import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Heart,
  HeartPulse,
  Link2,
  LogIn,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Pause,
  Play,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Square,
  Star,
  Store,
  UsersRound
} from "lucide-react";
import heroImage from "../assets/home-safety-hero.jpg";
import { api } from "../api";
import { DemoModal, PublicHeader } from "../components";
import HowItWorksGuideline from "../guidelines/HowItWorksGuideline";
import IntegrationsGuideline from "../guidelines/IntegrationsGuideline";
import SafeguardingGuideline from "../guidelines/SafeguardingGuideline";
import ServicesGuideline from "../guidelines/ServicesGuideline";

const services = [
  "Minor home repairs",
  "Grab rails and safety fittings",
  "Garden paths and lawn care",
  "Window cleaning",
  "Appliance safety tasks",
  "Locks, doors and access"
];

const handymanServices = [
  "Minor repairs",
  "Grab rail fitting",
  "Garden path clearing",
  "Lawn care",
  "Window cleaning",
  "Lock and handle repairs",
  "Trip hazard removal",
  "Appliance safety checks"
];

const faqs = [
  {
    question: "How does TaskBridge handle work outside normal handyman scope?",
    answer: "Tasks are reviewed before release. Anything specialist, unsafe or outside an approved home-support category is held for TaskBridge operations review instead of being sent to a general handyman."
  },
  {
    question: "How are vulnerable service users safeguarded?",
    answer: "Care-team approval is required before assignment. Vulnerable-adult visits require an active Enhanced DBS check, verified insurance, service suitability and a secure visit record. Resident contact and access details remain protected."
  },
  {
    question: "How does the handyman receive and complete a task?",
    answer: "Once approved, the handyman receives a tokenised SMS link. The link supports geofenced check-in, visit instructions, photographic evidence and check-out without exposing the service user's direct contact details."
  },
  {
    question: "How are care agency staff given access?",
    answer: "A TaskBridge super admin creates the agency workspace and sends the nominated manager a one-use email invitation. Additional coordinators and managers are invited into that agency only, so they cannot see another organisation's records."
  }
];

export function MarketingHome() {
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <div className="marketing-page">
      <PublicHeader onDemo={() => setDemoOpen(true)} />
      <main>
        <section className="studio-hero">
          <div className="site-width studio-hero-grid">
            <div className="studio-hero-copy">
              <span className="studio-trust-pill"><ShieldCheck size={16} /> Compliant care operations middleware</span>
              <h1>Connecting care teams with trusted, <span>vetted home safety</span> support.</h1>
              <blockquote>“Making home safer for our vulnerable”</blockquote>
              <p>TaskBridge by Growing Fig bridges the gap between care management and home safety. Convert carer observations into approved, trackable practical tasks while keeping resident identity and contact details secure.</p>
              <div className="studio-assurance" aria-label="Service assurances">
                <span><BadgeCheck size={19} /> Enhanced DBS-checked operatives</span>
                <span><BadgeCheck size={19} /> GDPR compliant</span>
              </div>
              <div className="studio-hero-actions">
                <button className="button studio-dark-button" onClick={() => setDemoOpen(true)}>Book a demo <ArrowRight size={17} /></button>
                <a className="button studio-light-button" href="/how-it-works"><Play size={15} /> See how it works</a>
                <a className="button studio-portal-button" href="/sign-in"><LogIn size={16} /> Sign in to portal</a>
              </div>
            </div>
            <div className="studio-hero-visual">
              <div className="studio-image-frame"><img src={heroImage} alt="A verified handyman installing a safety rail in a bright bathroom" /></div>
              <div className="studio-float-card verification-card"><span><BadgeCheck size={20} /></span><div><small>Verification match</small><strong>Enhanced DBS verified</strong><p>Operative status active &amp; validated</p></div></div>
              <div className="studio-float-card privacy-card"><span><ShieldAlert size={20} /></span><div><small>Encrypted privacy</small><strong>Contact details secured</strong><p>Resident contact numbers fully shielded</p></div></div>
            </div>
          </div>
        </section>

        <section className="studio-trust" id="integrations">
          <div className="site-width">
            <div className="studio-section-title"><span>Engineered for complete peace of mind</span><h2>Four pillars of safe, trusted care support</h2></div>
            <div className="studio-trust-grid">
              <StudioPillar icon={<Link2 />} tone="rose" title="Extremely compatible" detail="Compatible with most leading care management applications to sync notes smoothly." label="Integration ready" />
              <StudioPillar icon={<ShieldCheck />} tone="amber" title="Enhanced DBS vetted" detail="Every handyman is checked against active safeguarding and insurance requirements." label="Safeguarding compliant" />
              <StudioPillar icon={<Store />} tone="indigo" title="Private vetted networks" detail="Work is routed through controlled provider pools rather than public task feeds." label="Trusted trade panel" />
              <StudioPillar icon={<LockKeyhole />} tone="green" title="Resident details protected" detail="Home access details and direct resident contacts remain shielded from operatives." label="GDPR & cyber secure" />
            </div>
          </div>
        </section>

        <section className="section site-width intro-grid">
          <div className="section-heading">
            <span className="eyebrow">A clearer route from concern to completion</span>
            <h2>Practical help, without adding another coordination burden.</h2>
          </div>
          <div className="intro-copy">
            <p>TaskBridge helps care teams act on everyday hazards before they become serious incidents. One note can contain several needs; each is identified, checked and followed through as its own task.</p>
            <a className="inline-link" href="/how-it-works">Explore the full process <ArrowRight size={17} /></a>
          </div>
        </section>

        <CoordinatorDemoVideo />

        <section className="process-band" id="safeguarding">
          <div className="site-width">
            <div className="section-heading section-heading-centered">
              <span className="eyebrow">Safeguarding built into the journey</span>
              <h2>Every visit passes through the right controls.</h2>
              <p>Care-team approval comes first. TaskBridge then handles suitability, verified cover, Enhanced DBS status and secure visit evidence.</p>
            </div>
            <div className="process-grid">
              <ProcessStep number="01" icon={<MessageSquareText />} title="Describe the concern" detail="A coordinator records the resident's practical home-safety need in plain language." />
              <ProcessStep number="02" icon={<Sparkles />} title="Review clear tasks" detail="The note is organised into one or more suggested tasks for care-team approval." />
              <ProcessStep number="03" icon={<UsersRound />} title="Safely match" detail="TaskBridge checks service fit, distance, availability, insurance and safeguarding status." />
              <ProcessStep number="04" icon={<Camera />} title="Confirm the outcome" detail="Geofenced arrival and completion evidence return the result to the care team." />
            </div>
          </div>
        </section>

        <section className="section site-width services-section" id="services">
          <div className="services-copy">
            <span className="eyebrow">Everyday support that matters</span>
            <h2>One trusted route to a safer home.</h2>
            <p>From a loose handle to an overgrown path, TaskBridge helps teams coordinate the small jobs that can make a meaningful difference to independence and wellbeing.</p>
            <ul className="service-list">
              {services.map((service) => <li key={service}><Check size={17} /> {service}</li>)}
            </ul>
          </div>
          <div className="outcome-panel">
            <span className="outcome-icon"><HeartPulse size={27} /></span>
            <p className="outcome-label">Built around prevention</p>
            <h3>Spot the hazard. Coordinate the fix. Keep the care record connected.</h3>
            <div className="outcome-stats">
              <div><Clock3 /><strong>Less chasing</strong><span>Clear ownership and task status</span></div>
              <div><FileCheck2 /><strong>Better evidence</strong><span>Visit activity recorded end to end</span></div>
              <div><ShieldCheck /><strong>Stronger safeguards</strong><span>Controls applied before dispatch</span></div>
            </div>
          </div>
        </section>

        <section className="section site-width faq-section" id="faq">
          <div className="section-heading section-heading-centered">
            <span className="eyebrow">Questions, answered clearly</span>
            <h2>What care teams need to know.</h2>
            <p>Practical detail about onboarding, safeguarding, compliance and secure visits.</p>
          </div>
          <div className="faq-list">
            {faqs.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}
          </div>
        </section>

        <StudioCallout onDemo={() => setDemoOpen(true)} />
      </main>
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

function ProcessStep({ number, icon, title, detail }: { number: string; icon: React.ReactNode; title: string; detail: string }) {
  return <article className="process-step"><span className="process-number">{number}</span><span className="process-icon">{icon}</span><h3>{title}</h3><p>{detail}</p></article>;
}

function StudioPillar({ icon, tone, title, detail, label }: { icon: React.ReactNode; tone: string; title: string; detail: string; label: string }) {
  return <article className="studio-pillar"><span className={`studio-pillar-icon ${tone}`}>{icon}</span><h3>{title}</h3><p>{detail}</p><footer><span>{label}</span><i /></footer></article>;
}

const demoScenes = [
  { title: "Care coordinator dashboard", subtitle: "Start inside a personalised care workspace.", nav: "Dashboard", badge: "Primrose Care workspace", screen: "dashboard" },
  { title: "Create a task from a care note", subtitle: "Paste the daily note and select the service user.", nav: "Create task", badge: "AI ingestion", screen: "create" },
  { title: "Review suggested safety tasks", subtitle: "One note can become multiple care-approved actions.", nav: "Create task", badge: "Review before dispatch", screen: "review" },
  { title: "Check progress on the status board", subtitle: "Care teams see progress without seeing hidden candidate scoring.", nav: "Status board", badge: "Pending assignment", screen: "status" }
];

function CoordinatorDemoVideo() {
  const [playing, setPlaying] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = demoScenes[sceneIndex];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setSceneIndex((current) => current === demoScenes.length - 1 ? 0 : current + 1);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [playing, sceneIndex]);
  function stop() {
    setPlaying(false);
    setSceneIndex(0);
  }
  return <section className="demo-video-section">
    <div className="site-width demo-video-grid">
      <div className="demo-video-copy">
        <span className="eyebrow">Portal walkthrough</span>
        <h2>Watch how a coordinator creates and tracks a home-safety task.</h2>
        <p>This guided demo shows the care workspace journey from navigation to care-note evaluation, task approval and progress tracking.</p>
      </div>
      <div className="demo-video-player" aria-label="Care coordinator portal demo video">
        <div className="demo-video-topbar"><span>{scene.badge}</span><small>{sceneIndex + 1} / {demoScenes.length}</small></div>
        <div className="demo-video-stage">
          <aside>{["Dashboard", "Create task", "Status board", "Service users"].map((item) => <span key={item} className={scene.nav === item ? "active" : ""}>{item}</span>)}</aside>
          <div className="demo-video-screen">
            <header><small>{scene.subtitle}</small><h3>{scene.title}</h3></header>
            <DemoScreen type={scene.screen} />
          </div>
        </div>
        <div className="demo-video-progress"><span style={{ width: `${((sceneIndex + 1) / demoScenes.length) * 100}%` }} /></div>
        <div className="demo-video-controls">
          <button aria-label={playing ? "Pause demo" : "Play demo"} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          <button aria-label="Stop demo" onClick={stop}><Square size={16} /></button>
          <strong>{scene.title}</strong>
        </div>
      </div>
    </div>
  </section>;
}

function DemoScreen({ type }: { type: string }) {
  if (type === "dashboard") return <div className="demo-dashboard">
    <div><strong>18</strong><span>Open tasks</span></div><div><strong>5</strong><span>Pending assignment</span></div><div><strong>9</strong><span>Completed</span></div>
    <article><h4>Loose rail repair</h4><p>Ring-Fence enforced · Awaiting assignment</p></article>
  </div>;
  if (type === "create") return <div className="demo-create">
    <label>Service user<input readOnly value="Mary W. · vulnerable adult" /></label>
    <label>Care note<textarea readOnly value={"Back path is slippery with moss. Kitchen cupboard handle loose. Carer on site Tuesday 10:00."} /></label>
    <button>Evaluate care note</button>
  </div>;
  if (type === "review") return <div className="demo-review">
    <article><BadgeCheck size={18} /><div><h4>Path clearing</h4><p>High urgency · Enhanced DBS required</p></div></article>
    <article><BadgeCheck size={18} /><div><h4>Minor repair</h4><p>Medium urgency · Carer window recorded</p></div></article>
    <button>Approve tasks for TaskBridge</button>
  </div>;
  return <div className="demo-status-board">
    {["Pending assignment", "Assigned", "Checked in", "Completed"].map((status, index) => <article key={status} className={index === 0 ? "active" : ""}><span>{status}</span><strong>{index === 0 ? "2" : index === 1 ? "4" : index === 2 ? "1" : "11"}</strong></article>)}
    <p>Open the task drawer to see before/after photos, secure timeline events and completion status.</p>
  </div>;
}

export function HowItWorks() {
  return <GuidelinePage><HowItWorksGuideline /></GuidelinePage>;
}

export function OurServices() {
  return <GuidelinePage><ServicesGuideline /></GuidelinePage>;
}

export function SafeguardingProtocol() {
  return <GuidelinePage><SafeguardingGuideline /></GuidelinePage>;
}

export function SystemIntegrations() {
  return <GuidelinePage><IntegrationsGuideline /></GuidelinePage>;
}

const apiEndpoints = [
  {
    method: "POST",
    path: "/api/webhooks/incoming-care-task",
    title: "Inbound care task webhook",
    description: "Used by care management tools to send a care note or safety concern into TaskBridge for AI task planning and care-team approval."
  },
  {
    method: "POST",
    path: "/api/webhooks/dbs-callback",
    title: "DBS verification callback",
    description: "Receives normalised DBS provider events. Amiqus-specific events can also be sent to /api/webhooks/amiqus-callback."
  },
  {
    method: "GET",
    path: "/api/health",
    title: "Health check",
    description: "Simple availability endpoint for uptime monitoring."
  },
  {
    method: "GET",
    path: "/api/readiness",
    title: "Readiness check",
    description: "Checks application, configuration and database readiness before routing production traffic."
  }
];

const careTaskCurl = `curl -X POST "https://www.growingfig.com/api/webhooks/incoming-care-task" \\
  -H "Authorization: Bearer tb_live_your_agency_key" \\
  -H "Idempotency-Key: birdie-note-83921" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service_user_id": "birdie-resident-123",
    "notes": "Mrs Higgins rear path is slippery with moss. Kitchen cupboard handle is loose.",
    "preferred_window_start": "2026-07-10T09:00:00.000Z",
    "preferred_window_end": "2026-07-10T12:00:00.000Z",
    "carer_on_site": true
  }'`;

const careTaskJs = `async function sendTaskBridgeCareNote(note) {
  const response = await fetch("https://www.growingfig.com/api/webhooks/incoming-care-task", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.TASKBRIDGE_API_KEY}\`,
      "Idempotency-Key": note.id,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      service_user_id: note.serviceUserId,
      notes: note.body,
      preferred_window_start: note.visitWindowStart,
      preferred_window_end: note.visitWindowEnd,
      carer_on_site: note.carerOnSite
    })
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}`;

const serviceUserJson = `{
  "externalServiceUserId": "pass-client-44881",
  "fullName": "Mary Williams",
  "address": "Encrypted by TaskBridge after receipt",
  "town": "Croydon",
  "county": "Greater London",
  "postcode": "CR0 1AA",
  "latitude": 51.3762,
  "longitude": -0.0982,
  "riskLevel": "vulnerable",
  "keySafeInfo": "Only share with authorised visit workflow"
}`;

const completionCallback = `{
  "event": "task.completed",
  "taskId": "tsk_8K2M1Q",
  "sourceTaskId": "birdie-note-83921",
  "status": "completed",
  "completedAt": "2026-07-10T11:42:00.000Z",
  "evidence": {
    "beforePhotoUrl": "https://signed-storage.example/before.jpg",
    "afterPhotoUrl": "https://signed-storage.example/after.jpg",
    "checkInTime": "2026-07-10T10:03:00.000Z",
    "checkOutTime": "2026-07-10T11:42:00.000Z"
  }
}`;

const dbsCallback = `{
  "event": "session.completed",
  "data": {
    "session": {
      "id": "amiqus_sess_123",
      "status": "completed",
      "outcome": "clear",
      "report_url": "https://provider.example/reports/amiqus_sess_123"
    }
  }
}`;

export function ApiDocumentation() {
  const [demoOpen, setDemoOpen] = useState(false);
  return <div className="marketing-page">
    <PublicHeader onDemo={() => setDemoOpen(true)} />
    <main className="api-doc-main">
      <section className="site-width api-doc-hero">
        <span className="eyebrow">Developer documentation</span>
        <h1>TaskBridge API for care management integrations.</h1>
        <p>Use these examples to connect third-party care management platforms such as Birdie, PASS, Cera DCP or an internal care system to TaskBridge. Production access is issued during onboarding by a TaskBridge super admin.</p>
      </section>

      <section className="site-width api-doc-layout">
        <aside className="api-doc-sidebar">
          <a href="#authentication">Authentication</a>
          <a href="#endpoints">Endpoints</a>
          <a href="#care-task">Create care task</a>
          <a href="#service-user">Service user mapping</a>
          <a href="#callbacks">Callbacks</a>
          <a href="#errors">Errors</a>
        </aside>

        <div className="api-doc-content">
          <section id="authentication" className="api-doc-section">
            <h2>Authentication</h2>
            <p>Care systems authenticate with an agency API key. Send it as a bearer token and include a unique idempotency key for every inbound event.</p>
            <CodeBlock language="http" code={`Authorization: Bearer tb_live_your_agency_key\nIdempotency-Key: source-event-or-note-id\nContent-Type: application/json`} />
            <div className="api-note"><ShieldCheck size={18} /><span>Never send service-user contact numbers, direct resident contact details or unrestricted keysafe details to contractor-facing systems.</span></div>
          </section>

          <section id="endpoints" className="api-doc-section">
            <h2>Core endpoints</h2>
            <div className="api-endpoint-grid">
              {apiEndpoints.map((endpoint) => <article key={endpoint.path} className="api-endpoint-card">
                <span>{endpoint.method}</span>
                <code>{endpoint.path}</code>
                <h3>{endpoint.title}</h3>
                <p>{endpoint.description}</p>
              </article>)}
            </div>
          </section>

          <section id="care-task" className="api-doc-section">
            <h2>Create a care task from a care note</h2>
            <p>This is the main integration used by care platforms. TaskBridge receives the note, finds one or more home-safety tasks, stores them as awaiting care approval, and applies safeguarding controls.</p>
            <CodeBlock language="bash" title="cURL" code={careTaskCurl} />
            <CodeBlock language="ts" title="Node / JavaScript" code={careTaskJs} />
            <div className="api-response-grid">
              <div><strong>201 Created</strong><p>TaskBridge accepted the note and returned one or more `taskIds`.</p></div>
              <div><strong>200 Duplicate</strong><p>The same `Idempotency-Key` was already processed.</p></div>
              <div><strong>404 Not found</strong><p>The service user is not registered for that agency.</p></div>
            </div>
          </section>

          <section id="service-user" className="api-doc-section">
            <h2>Service user mapping</h2>
            <p>Each care platform should maintain a stable external service-user ID. TaskBridge uses that ID to match inbound notes to encrypted resident records inside the agency workspace.</p>
            <CodeBlock language="json" title="Recommended mapping object" code={serviceUserJson} />
          </section>

          <section id="callbacks" className="api-doc-section">
            <h2>Callbacks and provider events</h2>
            <p>TaskBridge can send completion data back to the parent care application once the care coordinator approves the completed visit. DBS providers can also post verification completion events into TaskBridge.</p>
            <CodeBlock language="json" title="Outbound completion callback example" code={completionCallback} />
            <CodeBlock language="json" title="Amiqus Enhanced DBS callback example" code={dbsCallback} />
          </section>

          <section id="errors" className="api-doc-section">
            <h2>Error codes</h2>
            <div className="api-table">
              <div><strong>400</strong><span>Malformed request body or unsupported payload.</span></div>
              <div><strong>401</strong><span>Missing, invalid or revoked API key.</span></div>
              <div><strong>403</strong><span>API key does not have the required scope.</span></div>
              <div><strong>404</strong><span>Agency, service user, task or provider session not found.</span></div>
              <div><strong>409</strong><span>Task state conflict or duplicate operational action.</span></div>
              <div><strong>422</strong><span>Validation failed. Check required fields and date formats.</span></div>
              <div><strong>503</strong><span>Provider or required integration secret is not configured.</span></div>
            </div>
          </section>
        </div>
      </section>

      <StudioCallout onDemo={() => setDemoOpen(true)} />
    </main>
    <Footer />
    <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
  </div>;
}

function CodeBlock({ code, language, title }: { code: string; language: string; title?: string }) {
  return <figure className="api-code-block">
    <figcaption><span>{title || "Example"}</span><small>{language}</small></figcaption>
    <pre><code>{code}</code></pre>
  </figure>;
}

export function JoinHandymanPage() {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>(["Minor repairs"]);

  function toggleService(service: string) {
    setSelectedServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedServices.length) return setError("Choose at least one service you can offer.");
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/handyman-join-request", {
        method: "POST",
        body: JSON.stringify({
          fullName: values.get("fullName"),
          businessName: values.get("businessName"),
          email: values.get("email"),
          phone: values.get("phone"),
          postcode: values.get("postcode"),
          services: selectedServices,
          hasEnhancedDbs: values.get("hasEnhancedDbs") === "on",
          hasPublicLiability: values.get("hasPublicLiability") === "on",
          message: values.get("message")
        })
      });
      setSubmitted(true);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send your join request");
    } finally {
      setBusy(false);
    }
  }

  return <div className="marketing-page">
    <PublicHeader onDemo={() => undefined} />
    <main>
      <section className="join-handyman-hero">
        <div className="site-width join-handyman-grid">
          <div className="join-handyman-copy">
            <span className="studio-trust-pill"><ShieldCheck size={16} /> Trusted home-safety network</span>
            <h1>Join TaskBridge as a vetted handyman.</h1>
            <p>Work with care organisations to complete practical home-safety tasks for older and vulnerable service users. Every visit is structured, approved and evidenced through TaskBridge.</p>
            <div className="join-handyman-points">
              <span><BadgeCheck size={18} /> Enhanced DBS-led safeguarding</span>
              <span><FileCheck2 size={18} /> Insurance and document review</span>
              <span><Camera size={18} /> Secure visit evidence workflow</span>
            </div>
          </div>
          <section className="join-handyman-card">
            {!submitted ? <form onSubmit={submit}>
              <header><span className="eyebrow">Apply to join</span><h2>Handyman interest form</h2><p>TaskBridge admin will review your details before sending a secure onboarding link.</p></header>
              <div className="field-row"><label>Full name<input name="fullName" required autoComplete="name" /></label><label>Business name<input name="businessName" autoComplete="organization" /></label></div>
              <div className="field-row"><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Mobile number<input name="phone" required autoComplete="tel" /></label></div>
              <label>Primary postcode<input name="postcode" required autoComplete="postal-code" /></label>
              <fieldset className="join-service-picker"><legend>Services you can offer</legend>{handymanServices.map((service) => <label key={service} className={selectedServices.includes(service) ? "selected" : ""}><input type="checkbox" checked={selectedServices.includes(service)} onChange={() => toggleService(service)} />{service}</label>)}</fieldset>
              <div className="join-checks"><label><input name="hasEnhancedDbs" type="checkbox" /> I currently hold an Enhanced DBS certificate</label><label><input name="hasPublicLiability" type="checkbox" /> I have public liability insurance</label></div>
              <label>Anything else we should know?<textarea name="message" rows={3} placeholder="Trade experience, regions covered, availability or relevant qualifications" /></label>
              {error && <p className="form-error">{error}</p>}
              <button className="button button-primary button-full" disabled={busy} type="submit">{busy ? "Sending..." : "Submit join request"} <ArrowRight size={17} /></button>
            </form> : <div className="join-handyman-success">
              <CheckCircle2 size={46} />
              <h2>Join request received</h2>
              <p>Thank you. TaskBridge admin will review your services, location and safeguarding readiness. If suitable, you will receive a secure onboarding link to upload documents.</p>
              <a className="button button-primary" href="/">Return home</a>
            </div>}
          </section>
        </div>
      </section>
      <section className="site-width join-handyman-process">
        <div><strong>1</strong><h2>Apply</h2><p>Share your contact details, service coverage and trade categories.</p></div>
        <div><strong>2</strong><h2>Review</h2><p>TaskBridge checks suitability before sending the secure registration link.</p></div>
        <div><strong>3</strong><h2>Verify</h2><p>Upload insurance and Enhanced DBS evidence for admin review.</p></div>
        <div><strong>4</strong><h2>Receive tasks</h2><p>Approved operatives receive tokenised task links for accepted work.</p></div>
      </section>
    </main>
    <Footer />
  </div>;
}

export function AdultSafeguardingPolicy() {
  return <PolicyPage
    eyebrow="Safeguarding"
    title="Safeguarding Policy"
    intro="TaskBridge by Growing Fig is committed to safeguarding and promoting the welfare, dignity, rights and wellbeing of adults at risk when practical home-safety work is coordinated on behalf of care providers."
    sections={[
      {
        title: "Policy statement",
        body: "TaskBridge does not provide personal care. However, employees, contractors and approved operatives may visit homes where vulnerable adults live. Everyone acting on behalf of TaskBridge must behave responsibly, maintain professional boundaries and follow the safeguarding procedures of the relevant care provider."
      },
      {
        title: "Purpose",
        body: "This policy protects adults at risk from abuse, neglect, exploitation and harm. It gives workers clear expectations for recognising concerns, reporting them promptly, respecting confidentiality and supporting effective partnership working with care providers and statutory agencies."
      },
      {
        title: "Who this applies to",
        body: "This policy applies to directors, managers, supervisors, employees, temporary workers, agency workers, contractors, ground maintenance operatives and any other person carrying out work on behalf of TaskBridge or Growing Fig."
      },
      {
        title: "Adults at risk",
        body: "An adult at risk is a person aged 18 or over who has care and support needs, is experiencing or may be at risk of abuse or neglect, and may be unable to protect themselves because of those needs. Abuse may include physical, emotional, sexual, financial, discriminatory, organisational or domestic abuse, neglect, self-neglect or modern slavery."
      },
      {
        title: "Care-provider approval",
        body: "A clear written task must be approved by the care provider before TaskBridge deploys a worker to a service user's property. Workers must only complete the authorised work and must not expand the visit into personal care, medical support or unrelated private arrangements."
      },
      {
        title: "Company responsibilities",
        body: "TaskBridge promotes safeguarding as everyone's responsibility. We provide safeguarding awareness, maintain appropriate checks where required, work cooperatively with partner care providers, protect confidential information and keep accurate records of safeguarding concerns, reports and actions taken."
      },
      {
        title: "Worker responsibilities",
        body: "Workers must treat every service user with dignity and respect, wear company identification, maintain professional boundaries, report concerns immediately and cooperate with safeguarding investigations. They must not accept gifts or money, borrow possessions, share personal contact details, provide personal care, handle medication or enter a property unless authorised for work."
      },
      {
        title: "Recognising concerns",
        body: "Concerns may include unexplained injuries, visible neglect, poor hygiene or unsafe living conditions, distress, fear of another person, signs of financial exploitation, significant behavioural change, unsafe property conditions, unusual confusion or concerns raised by neighbours, carers or family members. Workers are not expected to investigate."
      },
      {
        title: "Reporting procedure",
        body: "If a service user or worker is in immediate danger, emergency services must be contacted immediately by calling 999. The worker must then inform their line manager. Non-emergency concerns must be reported to the line manager, who will notify the relevant care provider so that its safeguarding procedure and any local authority referral can be followed."
      },
      {
        title: "Recording concerns",
        body: "Records should include the date, time, place, what was observed, who was present and the exact words used where possible. Workers must not investigate, question the service user extensively, promise confidentiality or confront any alleged perpetrator."
      },
      {
        title: "Partnership working",
        body: "As a contractor supporting care providers, TaskBridge follows safeguarding requirements in service contracts, cooperates with safeguarding investigations, shares information appropriately and respects the safeguarding policies of partner organisations."
      },
      {
        title: "Professional boundaries and lone working",
        body: "Workers must not enter financial arrangements, provide transport, buy items for service users, offer medical advice, become involved in family disputes or undertake tasks outside their authorised role. Lone workers must follow company procedure, carry a charged mobile phone, leave if they feel unsafe and report aggressive or concerning behaviour."
      },
      {
        title: "Health, safety and training",
        body: "TaskBridge expects safe operation of tools and machinery, appropriate PPE, risk-aware working, secured work areas and minimised disruption from noise or debris. Safeguarding awareness training covers recognising abuse, reporting concerns, confidentiality, professional boundaries and working with vulnerable adults."
      },
      {
        title: "Confidentiality, whistleblowing and review",
        body: "Safeguarding information is stored securely, shared only with appropriate people and processed in line with data protection requirements. Confidentiality must never prevent a safeguarding concern from being reported. Workers may raise concerns without detriment. This policy is reviewed annually or sooner if legislation, guidance, incidents or contract requirements change."
      }
    ]}
  />;
}

export function GDPRShieldPolicy() {
  return <PolicyPage
    eyebrow="Privacy and data protection"
    title="GDPR Shield Policy"
    intro="TaskBridge is designed to minimise resident data exposure while helping care organisations coordinate approved home-safety tasks. This policy explains the practical privacy controls used across the platform."
    sections={[
      {
        title: "Data minimisation",
        body: "TaskBridge asks care teams to share only the information needed to identify the service user, understand the practical task, coordinate the visit and evidence completion. Clinical notes, unnecessary medical details and unrelated family information should not be entered into task summaries."
      },
      {
        title: "Protected resident identity",
        body: "Service user names, addresses, postcode details, keysafe notes and safeguarding notes are encrypted at rest. Handymen receive a limited secure visit workflow and do not receive unrestricted resident contact details."
      },
      {
        title: "Role-based access",
        body: "Care coordinators can view their own organisation's service users, tasks and evidence. TaskBridge administrators can review assignment and compliance information required for safe operations. Super-admin access is restricted to privileged operational and governance functions."
      },
      {
        title: "Visit evidence",
        body: "GPS check-in data, before-and-after photos, completion notes and visit timestamps are used to evidence attendance and task completion. Access to this evidence is restricted to authorised users and retained only for operational, safeguarding, audit or dispute needs."
      },
      {
        title: "Care-platform integrations",
        body: "Inbound and outbound integrations use API keys, idempotency controls, retry logs and audit records. Completion callbacks should contain the minimum operational information needed to update the originating care record."
      },
      {
        title: "Data rights and contact",
        body: "Care organisations, handymen and relevant data subjects may raise privacy questions through privacy@growingfig.com. Production deployment should be supported by a Data Processing Agreement, retention schedule and solicitor-reviewed privacy notice."
      }
    ]}
  />;
}

export function DataProtectionPolicy() {
  return <PolicyPage
    eyebrow="Privacy and data protection"
    title="Data Protection Policy"
    intro="TaskBridge by Growing Fig is committed to protecting personal data and privacy, particularly for vulnerable individuals whose homes may be visited for approved repair, maintenance and home-safety work. Compliance with the UK GDPR and Data Protection Act 2018 is central to how the service operates."
    sections={[
      {
        title: "Scope",
        body: "This policy applies to employees, subcontractors, temporary workers, approved handymen, administrators and anyone working on behalf of TaskBridge by Growing Fig."
      },
      {
        title: "Personal data we collect",
        body: "We may collect customer or service-user names, addresses, telephone numbers, email addresses, property details relevant to repair work, appointment dates and times, emergency contact details where provided, before-and-after photographs where necessary, and staff or contractor employment and compliance records."
      },
      {
        title: "Sensitive and access information",
        body: "Where necessary to complete work safely, we may process limited information about disabilities, medical conditions, vulnerability, access requirements, safeguarding requirements or keysafe instructions. This information must be limited to what is required for safe coordination and must be protected from unnecessary disclosure."
      },
      {
        title: "How we use personal data",
        body: "Personal data is used to arrange appointments, coordinate repair and maintenance work, communicate with care organisations, landlords, housing providers, contractors and authorised contacts, support safe working practices, meet legal or contractual obligations, respond to complaints or queries, and protect the safety and welfare of customers, service users and workers."
      },
      {
        title: "Lawful basis for processing",
        body: "TaskBridge processes personal data under one or more lawful bases, including performance of a contract, compliance with legal obligations, legitimate interests, consent where required, and protection of vital interests where necessary."
      },
      {
        title: "Working in homes",
        body: "Workers must respect privacy and dignity, access only areas needed to complete authorised work, avoid handling personal belongings unless required and authorised, avoid discussing personal information outside work, report safeguarding concerns immediately, and avoid taking photographs that include personal possessions unless essential for recording the repair or safety issue."
      },
      {
        title: "Confidentiality",
        body: "Personal information must only be shared with authorised colleagues, care organisations, housing providers, contractors, safeguarding authorities or other organisations where necessary to provide services, meet legal obligations or protect welfare."
      },
      {
        title: "Data security",
        body: "Electronic records are stored using protected systems, access is restricted to authorised users, paper records must be held securely where used, confidential documents must be disposed of securely, and company devices must be protected against unauthorised access."
      },
      {
        title: "Information sharing",
        body: "Information is shared only where necessary to complete contracted work, comply with law, support safeguarding procedures or protect individuals. Only the minimum information necessary should be disclosed."
      },
      {
        title: "Retention",
        body: "Personal information is kept only for as long as necessary to meet legal, contractual, safeguarding, audit and business requirements. Records are then securely deleted or destroyed in line with the retention schedule."
      },
      {
        title: "Individual rights",
        body: "Individuals have rights to be informed, access their personal information, request correction, request deletion where applicable, restrict or object to certain processing, and complain to the Information Commissioner's Office if they believe their data has been handled improperly."
      },
      {
        title: "Breaches, training and review",
        body: "Any loss, theft, unauthorised disclosure or suspected personal-data breach must be reported immediately to management. Staff must complete GDPR and confidentiality training, keep passwords secure, protect customer information on site and report suspected breaches or safeguarding concerns. This policy is reviewed annually or sooner if legislation or operations change."
      }
    ]}
  />;
}

export function CookiePolicy() {
  return <PolicyPage
    eyebrow="Privacy and website cookies"
    title="Cookie Policy"
    intro="This Cookie Policy explains how TaskBridge by Growing Fig uses cookies and similar technologies on its public website, secure portals and operational workflows."
    sections={[
      {
        title: "What cookies are",
        body: "Cookies are small text files placed on a device when a person visits a website or uses an online service. They help the service remember information about the visit, maintain secure sessions, improve reliability and understand how the service is being used."
      },
      {
        title: "How TaskBridge uses cookies",
        body: "TaskBridge uses cookies and similar browser storage only where needed to operate the website and secure portals, maintain sign-in sessions, protect against unauthorised access, remember basic interface state and support service monitoring."
      },
      {
        title: "Strictly necessary cookies",
        body: "These cookies are required for the platform to function. They may be used for authentication, session security, CSRF or origin protection, load balancing, fraud prevention, secure visit links and remembering whether a user is signed in. These cookies cannot be switched off through TaskBridge because the service would not work safely without them."
      },
      {
        title: "Preference cookies",
        body: "Preference cookies or local browser storage may be used to remember non-sensitive choices, such as selected portal views, filters, dismissed notices or interface preferences. These do not give contractors access to resident details and should not store confidential care information."
      },
      {
        title: "Analytics cookies",
        body: "TaskBridge may use privacy-conscious analytics to understand website performance, page usage and errors. Where analytics cookies are used, they should be configured to avoid collecting unnecessary personal data and should not be used to profile service users or expose care records."
      },
      {
        title: "Third-party services",
        body: "Some parts of TaskBridge may connect to trusted service providers, such as hosting, email delivery, SMS delivery, object storage, care-platform integrations, DBS verification and operational monitoring. These providers may set cookies or process technical identifiers only where needed to deliver their service."
      },
      {
        title: "Cookies in secure portals",
        body: "Care coordinator, TaskBridge administrator and handyman visit workflows may use secure cookies to keep the user authenticated and protect access to the correct workspace or tokenised visit. Users should sign out when using shared devices."
      },
      {
        title: "Managing cookies",
        body: "Users can manage or delete cookies through their browser settings. Blocking all cookies may prevent sign-in, secure visit links, upload flows or protected portal pages from working correctly."
      },
      {
        title: "Changes to this policy",
        body: "TaskBridge may update this Cookie Policy as the platform, integrations or legal requirements change. The latest version will be published on the TaskBridge website."
      },
      {
        title: "Contact",
        body: "Questions about cookies, privacy or data protection can be sent to integrations@growingfig.com. Care organisations may also request the wider privacy, safeguarding and data-processing pack during onboarding."
      }
    ]}
  />;
}

export function SafeguardingSLA() {
  return <PolicyPage
    eyebrow="Operational safeguarding"
    title="Safeguarding SLA"
    intro="TaskBridge operates as a safeguarded coordination layer for practical home-safety tasks. This SLA sets expectations for review, escalation, visit controls and evidence handling during pilot operations."
    sections={[
      {
        title: "Care-team approval",
        body: "Tasks must be reviewed and approved by the care organisation before TaskBridge releases them for assignment. AI-generated suggestions remain editable and must not replace professional judgement."
      },
      {
        title: "Enhanced DBS and insurance controls",
        body: "Vulnerable-adult work is assigned only to handymen who meet TaskBridge policy requirements, including active Enhanced DBS status where required, verified identity, verified insurance, service suitability and proximity checks."
      },
      {
        title: "Target operational response",
        body: "New care-approved tasks should be reviewed by TaskBridge operations during business hours, with urgent safeguarding-sensitive items prioritised for same-day review where possible. Failed dispatches, missing compliance records and unclear task scope are held for admin decision."
      },
      {
        title: "Secure visit workflow",
        body: "Handymen use a tokenised visit link for check-in, evidence upload and checkout. They must present identification to the resident or attending caregiver and must not request direct payment, personal contact details or unrelated work."
      },
      {
        title: "Incident escalation",
        body: "Safeguarding concerns, property damage, poor workmanship, failed attendance or data concerns are escalated to TaskBridge administration. Serious safeguarding concerns should also be escalated through the care agency's safeguarding route without delay."
      },
      {
        title: "Completion and payout hold",
        body: "Tasks are not treated as fully complete until visit evidence is submitted and the care team confirms the outcome. Payment and payout records may remain on hold where evidence, complaints, disputes or safeguarding concerns require review."
      }
    ]}
  />;
}

function PolicyPage({ eyebrow, title, intro, sections }: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}) {
  const [demoOpen, setDemoOpen] = useState(false);
  return <div className="marketing-page">
    <PublicHeader onDemo={() => setDemoOpen(true)} />
    <main className="policy-main">
      <section className="site-width policy-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </section>
      <section className="site-width policy-grid">
        {sections.map((section) => <article key={section.title} className="policy-card">
          <span><ShieldCheck size={18} /></span>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </article>)}
      </section>
      <section className="site-width policy-contact">
        <div><h2>Need the formal pack?</h2><p>For agency onboarding, request the full privacy, safeguarding, DPA and operational policy pack from TaskBridge.</p></div>
        <a className="button button-primary" href="mailto:privacy@growingfig.com">Contact privacy team <ArrowRight size={17} /></a>
      </section>
    </main>
    <Footer />
    <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
  </div>;
}

function GuidelinePage({ children }: { children: ReactNode }) {
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <div className="marketing-page">
      <PublicHeader onDemo={() => setDemoOpen(true)} />
      <main className="guideline-main">
        {children}
        <StudioCallout onDemo={() => setDemoOpen(true)} />
      </main>
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

function StudioCallout({ onDemo }: { onDemo: () => void }) {
  return <section className="studio-callout-section">
    <div className="site-width studio-callout">
      <span className="studio-callout-badge"><ShieldCheck size={14} /> Secure operational care middleware</span>
      <h2>Ready to transform safe resident care?</h2>
      <p>See how the TaskBridge by Growing Fig secure gateway connects with your existing care management systems to coordinate approved, vetted home-safety support.</p>
      <div className="studio-callout-actions">
        <button onClick={onDemo}>Book personal demonstration <ArrowRight size={18} /></button>
        <a href="/sign-in"><LogIn size={18} /> Care coordinator sign in</a>
      </div>
      <div className="studio-callout-trust">
        <span><Star size={19} /> Designed around UK care-quality expectations</span>
        <span><Heart size={19} /> Enhanced DBS controls enforced</span>
        <span><LockKeyhole size={19} /> Resident identity data shielded</span>
      </div>
    </div>
  </section>;
}

function Footer() {
  return <footer className="footer">
    <div className="site-width footer-main">
      <section className="footer-about" aria-label="About TaskBridge by Growing Fig">
        <a className="footer-brand" href="/" aria-label="TaskBridge by Growing Fig home">
          <span className="footer-brand-mark"><ShieldCheck size={24} /></span>
          <span><strong>Task<span>Bridge</span></strong><small>by Growing Fig</small></span>
        </a>
        <p>Connecting home care managers and safeguarding coordinators with verified, Enhanced DBS-vetted home support professionals.</p>
        <blockquote>“Making home safer for our vulnerable”</blockquote>
      </section>

      <nav className="footer-links" aria-label="System guidelines">
        <h2>System guidelines</h2>
        <a href="/how-it-works">How it works</a>
        <a href="/services">Our services</a>
        <a href="/safeguarding">Safeguarding protocol</a>
        <a href="/integrations">System integrations</a>
        <a href="/api-documentation">API documentation</a>
        <a href="/join-handyman">Join as a Handyman</a>
      </nav>

      <section className="footer-contact" aria-label="Inquiries and support">
        <h2>Inquiries &amp; support</h2>
        <a className="footer-contact-row" href="tel:+442080501234">
          <Phone size={19} />
          <span><strong>+44 (0) 20 8050 1234</strong><small>Mon - Fri: 8:00 AM - 6:00 PM GMT</small></span>
        </a>
        <a className="footer-contact-row" href="mailto:integrations@growingfig.com">
          <Mail size={19} /><span><strong>integrations@growingfig.com</strong></span>
        </a>
        <div className="footer-contact-row">
          <MapPin size={19} />
          <address>Growing Fig,<br />Brightfield Business Hub,<br />Bakewell Road,<br />Orton Southgate,<br />Peterborough, PE2 6XU</address>
        </div>
      </section>
    </div>

    <div className="site-width footer-bottom">
      <div><p>© 2026 Growing Fig. All rights reserved.</p><small>TaskBridge by Growing Fig is a HealthTech and care operations middleware platform. Enhanced DBS validation supports vulnerable-adult safeguarding controls.</small></div>
      <nav aria-label="Security and legal">
        <a href="/how-it-works#security">Security standards</a>
        <a href="/safeguarding-policy">Safeguarding policy</a>
        <a href="/data-protection-policy">Data protection policy</a>
        <a href="/gdpr-shield-policy">GDPR shield policy</a>
        <a href="/cookie-policy">Cookie policy</a>
        <a href="/safeguarding-sla">Safeguarding SLA</a>
      </nav>
    </div>
  </footer>;
}
