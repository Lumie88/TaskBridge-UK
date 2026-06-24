import { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Building2,
  CircleAlert,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileWarning,
  KeyRound,
  LoaderCircle,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Send,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  Wrench
} from "lucide-react";
import { api, formatDate, humanize } from "../api";
import { EmptyState, PortalShell, StatusBadge } from "../components";
import type { AdminTask, Candidate, User } from "../types";

interface AdminDashboard {
  tasks: Record<string, number>;
  traders: Record<string, number>;
  integrationFailures: number;
}

interface Trader {
  id: string;
  displayName: string;
  email: string | null;
  network: string | null;
  hourlyRate: number;
  qualityScore: number;
  status: string;
  dbsStatus: string;
  dbsExpiryDate: string | null;
  insuranceStatus: string;
  insuranceExpiryDate: string | null;
  onboardingStatus: string;
  invitationExpiresAt: string | null;
  emailDeliveryStatus: string | null;
  services: string[];
}

interface Agency {
  id: string;
  public_id: string;
  name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  work_email_domain: string;
  status: string;
  created_at: string;
  activeWorkorders: number;
  secretApiKey: null | {
    masked: string;
    length: number;
    encryptionRepresentation: string;
    issuedAt: string;
  };
}

export function AdminPortal({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [active, setActive] = useState("overview");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AdminTask | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [summary, taskResult, traderResult, agencyResult] = await Promise.all([
        api<AdminDashboard>("/api/admin/dashboard"),
        api<{ tasks: AdminTask[] }>("/api/admin/tasks"),
        api<{ traders: Trader[] }>("/api/admin/traders"),
        user.role === "taskbridge_super_admin" ? api<{ agencies: Agency[] }>("/api/admin/agencies") : Promise.resolve({ agencies: [] })
      ]);
      setDashboard(summary); setTasks(taskResult.tasks); setTraders(traderResult.traders); setAgencies(agencyResult.agencies);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load administration"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return <PortalShell user={user} area="admin" active={active} onActive={setActive} onSignOut={onSignOut}>
    {error && <div className="alert alert-danger">{error}<button onClick={load}><RefreshCw size={16} /> Retry</button></div>}
    {loading && !dashboard ? <div className="app-loading"><LoaderCircle className="spin" /> Loading secure operations...</div> : active === "overview"
      ? <AdminOverview dashboard={dashboard} tasks={tasks} onReview={(task) => { setSelectedTask(task); setActive("tasks"); }} />
      : active === "tasks"
        ? <AssignmentDesk tasks={tasks} selectedTask={selectedTask} onSelect={setSelectedTask} onChanged={load} />
        : active === "agencies" && user.role === "taskbridge_super_admin"
          ? <AgencyOnboarding agencies={agencies} onChanged={load} />
          : <ComplianceHub traders={traders} user={user} onChanged={load} />}
  </PortalShell>;
}

function AdminOverview({ dashboard, tasks, onReview }: { dashboard: AdminDashboard | null; tasks: AdminTask[]; onReview: (task: AdminTask) => void }) {
  const taskCounts = dashboard?.tasks || {};
  const pending = (taskCounts.pending_taskbridge_assignment || 0) + (taskCounts.assignment_review || 0);
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Operations control centre</span><h1>Safeguarding and dispatch overview</h1><p>Review exceptions, verify compliance and release approved assignments.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Restricted workspace</span></div>
    <div className="metric-grid admin-metrics">
      <MetricAdmin icon={<ClipboardCheck />} label="Awaiting assignment" value={pending} tone="amber" />
      <MetricAdmin icon={<BadgeCheck />} label="DBS approved" value={dashboard?.traders.approved || 0} tone="green" />
      <MetricAdmin icon={<FileWarning />} label="DBS action needed" value={(dashboard?.traders.pending || 0) + (dashboard?.traders.unclear || 0)} tone="blue" />
      <MetricAdmin icon={<CircleAlert />} label="Integration failures" value={dashboard?.integrationFailures || 0} tone="red" />
    </div>
    <section className="panel">
      <div className="panel-heading"><div><h2>Assignment queue</h2><p>Tasks waiting for secure candidate evaluation.</p></div></div>
      <div className="admin-task-list">{tasks.filter((task) => ["pending_taskbridge_assignment", "assignment_review"].includes(task.status)).slice(0, 6).map((task) => <AdminTaskRow key={task.id} task={task} action={<button className="button button-secondary button-small" onClick={() => onReview(task)}>Review match</button>} />)}</div>
      {!tasks.some((task) => ["pending_taskbridge_assignment", "assignment_review"].includes(task.status)) && <EmptyState icon={<Activity />} title="Assignment queue is clear" detail="New care-approved tasks will appear here." />}
    </section>
  </>;
}

function MetricAdmin({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <article className={`metric metric-${tone}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function AssignmentDesk({ tasks, selectedTask, onSelect, onChanged }: { tasks: AdminTask[]; selectedTask: AdminTask | null; onSelect: (task: AdminTask) => void; onChanged: () => Promise<void> }) {
  return <div className="assignment-layout">
    <section>
      <div className="page-title-row compact"><div><span className="eyebrow">Secure assignment desk</span><h1>Review and release work</h1><p>Only eligible handymen can be approved for dispatch.</p></div></div>
      <div className="panel admin-task-list selectable">{tasks.map((task) => <AdminTaskRow key={task.id} task={task} selected={selectedTask?.id === task.id} action={<button className="icon-button" onClick={() => onSelect(task)} aria-label={`Review ${task.id}`}><Search size={18} /></button>} />)}</div>
    </section>
    <CandidatePanel task={selectedTask} onChanged={onChanged} />
  </div>;
}

function AdminTaskRow({ task, action, selected = false }: { task: AdminTask; action: React.ReactNode; selected?: boolean }) {
  return <article className={`admin-task-row ${selected ? "selected" : ""}`}>
    <span className="resident-avatar">{task.residentInitials}</span>
    <div><div className="task-title-line"><h3>{task.category}</h3>{task.ringFenceRequired && <span className="ring-badge"><ShieldCheck size={13} /> Ring-Fence</span>}</div><p>{task.summary}</p><small>{task.agencyName} · {task.id} · {formatDate(task.createdAt, true)}</small></div>
    <StatusBadge status={task.status}>{humanize(task.status)}</StatusBadge>{action}
  </article>;
}

function CandidatePanel({ task, onChanged }: { task: AdminTask | null; onChanged: () => Promise<void> }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dispatching, setDispatching] = useState("");
  const [visitUrl, setVisitUrl] = useState("");

  useEffect(() => {
    if (!task || !["pending_taskbridge_assignment", "assignment_review"].includes(task.status)) { setCandidates([]); return; }
    setLoading(true); setError(""); setVisitUrl("");
    api<{ candidates: Candidate[] }>(`/api/admin/tasks/${task.id}/candidates`)
      .then((result) => setCandidates(result.candidates))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to evaluate candidates"))
      .finally(() => setLoading(false));
  }, [task?.id]);

  async function dispatch(candidate: Candidate) {
    if (!task) return;
    setDispatching(candidate.id); setError("");
    try {
      const result = await api<{ visitUrl: string }>(`/api/admin/tasks/${task.id}/dispatch`, { method: "POST", body: JSON.stringify({ traderId: candidate.id }) });
      setVisitUrl(result.visitUrl); await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Dispatch failed"); }
    finally { setDispatching(""); }
  }

  return <aside className="candidate-panel">
    {!task ? <EmptyState icon={<UsersRound />} title="Select a task" detail="Choose a task to run the safeguarding and suitability checks." /> : <>
      <div className="candidate-heading"><div><span className="eyebrow">Candidate decision</span><h2>{task.category}</h2><p>{task.agencyName} · Resident {task.residentInitials}</p></div>{task.vulnerableAdult && <ShieldCheck size={26} />}</div>
      {error && <p className="form-error">{error}</p>}
      {visitUrl && <div className="alert alert-success"><span>Dispatch complete. The secure link is shown once.</span><a href={visitUrl} target="_blank" rel="noreferrer">Open visit link <ExternalLink size={15} /></a></div>}
      {loading ? <div className="app-loading"><LoaderCircle className="spin" /> Evaluating eligibility...</div> : <div className="candidate-list">{candidates.map((candidate) => <article key={candidate.id} className={`candidate ${candidate.eligible ? "eligible" : "ineligible"}`}>
        <div className="candidate-name"><span className="avatar"><Wrench size={18} /></span><div><h3>{candidate.displayName}</h3><p>{candidate.network || "Direct network"}</p></div><StatusBadge status={candidate.eligible ? "approved" : "rejected"}>{candidate.eligible ? "Eligible" : "Blocked"}</StatusBadge></div>
        <div className="candidate-facts"><span><MapPin size={15} /> {candidate.distanceMiles} mi</span><span><Star size={15} /> {candidate.qualityScore}</span><span>£{candidate.hourlyRate}/hr</span></div>
        <div className="candidate-checks"><span><BadgeCheck size={15} /> DBS: {humanize(candidate.dbsStatus)}</span><span><ShieldCheck size={15} /> Insurance: {humanize(candidate.insuranceStatus)}</span></div>
        {!candidate.eligible && <ul className="reason-list">{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        <button className="button button-primary button-full button-small" disabled={!candidate.eligible || Boolean(dispatching)} onClick={() => dispatch(candidate)}>{dispatching === candidate.id ? "Dispatching..." : "Approve and dispatch"}</button>
      </article>)}</div>}
      {!loading && !candidates.length && <EmptyState icon={<UserCheck />} title="No candidates to show" detail={task.status === "dispatched" ? "This task has already been assigned." : "No matching handyman records were returned."} />}
    </>}
  </aside>;
}

function ComplianceHub({ traders, user, onChanged }: { traders: Trader[]; user: User; onChanged: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ invitationUrl: string; expiresAt: string; emailDeliveryStatus: string } | null>(null);
  async function startCheck(trader: Trader) {
    setBusy(trader.id); setError("");
    try { await api(`/api/admin/traders/${trader.id}/dbs-check`, { method: "POST" }); await onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start DBS check"); }
    finally { setBusy(""); }
  }
  async function review(trader: Trader, status: "approved" | "rejected") {
    const reason = window.prompt(`Record the reason for ${status} status`);
    if (!reason || reason.length < 5) return;
    const expiryDate = status === "approved" ? window.prompt("DBS expiry date (YYYY-MM-DD)") : null;
    setBusy(trader.id); setError("");
    try { await api(`/api/admin/traders/${trader.id}/dbs-review`, { method: "POST", body: JSON.stringify({ status, expiryDate: expiryDate || null, reason }) }); await onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to record review"); }
    finally { setBusy(""); }
  }
  async function inviteHandyman(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy("invite"); setError(""); setInviteResult(null);
    try {
      const result = await api<{ invitationUrl: string; expiresAt: string; emailDeliveryStatus: string }>("/api/admin/traders/invitations", {
        method: "POST",
        body: JSON.stringify({ fullName: values.get("fullName"), email: values.get("email") })
      });
      setInviteResult(result);
      event.currentTarget.reset();
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to invite handyman"); }
    finally { setBusy(""); }
  }
  async function copyInvitationLink() {
    if (inviteResult) await navigator.clipboard.writeText(inviteResult.invitationUrl);
  }
  async function revokeInvitation(trader: Trader) {
    if (!window.confirm(`Revoke the registration invitation for ${trader.displayName}?`)) return;
    setBusy(trader.id); setError("");
    try { await api(`/api/admin/traders/${trader.id}/invitation`, { method: "DELETE" }); await onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to revoke invitation"); }
    finally { setBusy(""); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Handyman compliance</span><h1>Verification registry</h1><p>Enhanced DBS and insurance checks are enforced by the assignment engine.</p></div>{user.role === "taskbridge_super_admin" && <button className="button button-primary" onClick={() => { setInviteOpen(!inviteOpen); setInviteResult(null); }}><UserPlus size={18} /> Register handyman</button>}</div>
    {error && <div className="alert alert-danger">{error}</div>}
    {inviteOpen && <section className="panel invite-handyman-panel">
      <div className="panel-heading"><div><h2>Register and invite a handyman</h2><p>An expiring one-use registration link will be sent to their email address.</p></div></div>
      <form className="invite-handyman-form" onSubmit={inviteHandyman}><label>Full name<input required name="fullName" minLength={2} autoComplete="off" /></label><label>Email address<input required name="email" type="email" autoComplete="off" /></label><button className="button button-primary" disabled={busy === "invite"} type="submit">{busy === "invite" ? <><LoaderCircle className="spin" size={17} /> Sending...</> : <><Send size={17} /> Send registration link</>}</button></form>
      {inviteResult && <div className={`invitation-result ${inviteResult.emailDeliveryStatus === "sent" ? "sent" : "attention"}`}><div><strong>{inviteResult.emailDeliveryStatus === "sent" ? "Invitation email sent" : "Invitation created; email delivery needs configuration"}</strong><span>Expires {formatDate(inviteResult.expiresAt, true)}</span></div><div className="invitation-link"><input readOnly value={inviteResult.invitationUrl} aria-label="Handyman invitation URL" /><button className="icon-button" onClick={copyInvitationLink} type="button" aria-label="Copy invitation link"><Copy size={18} /></button><a className="icon-button" href={inviteResult.invitationUrl} target="_blank" rel="noreferrer" aria-label="Open invitation"><ExternalLink size={18} /></a></div></div>}
    </section>}
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Handyman</th><th>Onboarding</th><th>Services</th><th>Enhanced DBS</th><th>Insurance</th><th>Quality</th><th>Action</th></tr></thead><tbody>{traders.map((trader) => <tr key={trader.id}><td><strong>{trader.displayName}</strong><small>{trader.email || trader.network || "Direct network"}</small></td><td><StatusBadge status={trader.onboardingStatus}>{humanize(trader.onboardingStatus)}</StatusBadge><small>{trader.emailDeliveryStatus ? `Email: ${humanize(trader.emailDeliveryStatus)}` : "Marketplace record"}</small></td><td><span className="service-summary">{trader.services.length ? `${trader.services.slice(0, 2).join(", ")}${trader.services.length > 2 ? ` +${trader.services.length - 2}` : ""}` : "Awaiting registration"}</span></td><td><StatusBadge status={trader.dbsStatus}>{humanize(trader.dbsStatus)}</StatusBadge><small>{trader.dbsExpiryDate ? `Expires ${formatDate(trader.dbsExpiryDate)}` : "No active expiry"}</small></td><td><StatusBadge status={trader.insuranceStatus}>{humanize(trader.insuranceStatus)}</StatusBadge><small>{trader.insuranceExpiryDate ? `Expires ${formatDate(trader.insuranceExpiryDate)}` : "No active expiry"}</small></td><td><span className="rating"><Star size={15} /> {trader.qualityScore}</span></td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={busy === trader.id || trader.onboardingStatus === "pending"} onClick={() => startCheck(trader)}>Start check</button>{user.role === "taskbridge_super_admin" && trader.onboardingStatus === "pending" ? <button className="icon-button danger-icon" disabled={busy === trader.id} onClick={() => revokeInvitation(trader)} aria-label="Revoke invitation"><Trash2 size={18} /></button> : user.role === "taskbridge_super_admin" && <><button className="icon-button success-icon" onClick={() => review(trader, "approved")} aria-label="Approve DBS"><BadgeCheck size={18} /></button><button className="icon-button danger-icon" onClick={() => review(trader, "rejected")} aria-label="Reject DBS"><CircleAlert size={18} /></button></>}</div></td></tr>)}</tbody></table></div></section>
  </>;
}

function AgencyOnboarding({ agencies, onChanged }: { agencies: Agency[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [issuedKey, setIssuedKey] = useState("");
  async function createAgency(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess(""); setIssuedKey("");
    const values = new FormData(event.currentTarget);
    try {
      const result = await api<{ apiKey: string }>("/api/admin/agencies", { method: "POST", body: JSON.stringify({
        name: values.get("name"),
        primaryContactName: values.get("primaryContactName"),
        primaryContactEmail: values.get("primaryContactEmail"),
        workEmailDomain: values.get("workEmailDomain")
      }) });
      setSuccess("Care agency added to onboarding.");
      setIssuedKey(result.apiKey);
      event.currentTarget.reset();
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to onboard care agency"); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Super-admin control</span><h1>Care agency onboarding</h1><p>Only TaskBridge super administrators can create a care-organisation workspace.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Super admin only</span></div>
    <div className="agency-onboarding-layout">
      <section className="panel"><div className="panel-heading"><div><h2>Care agencies</h2><p>{agencies.length} organisation{agencies.length === 1 ? "" : "s"} registered.</p></div></div><div className="agency-list agency-key-list">{agencies.map((agency) => <article key={agency.id}><span><Building2 size={19} /></span><div><h3>{agency.name}</h3><p><Mail size={14} /> {agency.primary_contact_email}</p><small>{agency.public_id} / {agency.work_email_domain}</small><div className="agency-operational-meta"><span><ClipboardCheck size={14} /> {agency.activeWorkorders} active workorder{agency.activeWorkorders === 1 ? "" : "s"}</span>{agency.secretApiKey ? <span title={agency.secretApiKey.encryptionRepresentation}><KeyRound size={14} /> {agency.secretApiKey.masked} / {agency.secretApiKey.length} characters / {agency.secretApiKey.encryptionRepresentation}</span> : <span><KeyRound size={14} /> Integration key not issued</span>}</div></div><StatusBadge status={agency.status}>{humanize(agency.status)}</StatusBadge></article>)}</div></section>
      <aside className="agency-create-panel"><div className="resident-create-heading"><span><Plus size={20} /></span><div><h2>Onboard a care agency</h2><p>Create the tenant before issuing coordinator access.</p></div></div><form className="stack" onSubmit={createAgency}><label>Agency name<input required name="name" minLength={2} /></label><label>Primary contact name<input required name="primaryContactName" minLength={2} /></label><label>Primary contact work email<input required name="primaryContactEmail" type="email" /></label><label>Approved work email domain<input required name="workEmailDomain" placeholder="careagency.co.uk" /></label>{error && <p className="form-error">{error}</p>}{success && <p className="form-success">{success}</p>}{issuedKey && <div className="issued-api-key"><strong>Copy the integration key now</strong><p>For security, the full secret is shown only once.</p><div><input readOnly value={issuedKey} aria-label="New agency API key" /><button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(issuedKey)} aria-label="Copy API key"><Copy size={18} /></button></div></div>}<button className="button button-primary button-full" disabled={busy} type="submit">{busy ? <><LoaderCircle className="spin" size={17} /> Creating...</> : <><Building2 size={17} /> Create agency workspace</>}</button></form></aside>
    </div>
  </>;
}
