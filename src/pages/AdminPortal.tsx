import { useEffect, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Building2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileCheck2,
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
  demoRequests: number;
  paymentHolds: number;
}

interface IntegrationFailure {
  id: string;
  agencyName: string | null;
  direction: string;
  endpoint: string;
  eventType: string;
  status: string;
  responseStatus: number | null;
  errorMessage: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  createdAt: string;
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

interface ComplianceDocument {
  id: string;
  documentType: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  reference: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  createdAt: string;
  reviewUrl: string | null;
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
  settings?: {
    vulnerableAdultRequiresEnhancedDbs: boolean;
    completionRequiresCareConfirmation: boolean;
    supervisedVisitExceptionAllowed: boolean;
    taskbridgeAssignmentRequiresAdminReview: boolean;
    healthAnalyticsEnabled: boolean;
    defaultVisitRadiusMiles: number;
    goLiveStatus: string;
    monthlyCap: number;
    billingStatus: string;
  };
  secretApiKey: null | {
    masked: string;
    length: number;
    encryptionRepresentation: string;
    issuedAt: string;
  };
}

interface DemoRequest {
  id: string;
  fullName: string;
  organisationName: string;
  workEmail: string;
  message: string | null;
  status: string;
  internalNotes: string | null;
  ownerName: string | null;
  lastContactedAt: string | null;
  createdAt: string;
}

interface BillingCharge {
  id: string;
  taskId: string;
  agencyId: string;
  agencyName: string;
  handymanName: string | null;
  handymanAmount: number;
  agencyCoordinationFee: number;
  platformFee: number;
  totalAmount: number;
  status: string;
  settlementStatus: string;
  settlementReference: string | null;
  settlementDueAt: string | null;
  settlementNotes: string | null;
  payoutStatus: string | null;
  payableAfter: string | null;
  createdAt: string;
}

interface AdminInvoice {
  id: string;
  agencyName: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  paidAt: string | null;
  lineCount: number;
}

interface AccessUser {
  id: string; full_name: string; email: string; role: string; status: string;
  last_login_at: string | null; created_at: string; agency_name: string | null;
}

interface AccessInvitation {
  id: string; full_name: string; email: string; role: string; status: string;
  expires_at: string; email_delivery_status: string; agency_name: string | null;
}

export function AdminPortal({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [active, setActive] = useState("overview");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [accessInvitations, setAccessInvitations] = useState<AccessInvitation[]>([]);
  const [integrationFailures, setIntegrationFailures] = useState<IntegrationFailure[]>([]);
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [billingCharges, setBillingCharges] = useState<BillingCharge[]>([]);
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AdminTask | null>(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [traderFilter, setTraderFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [summary, taskResult, traderResult, agencyResult, accessResult, integrationResult, demoResult, billingResult, invoiceResult] = await Promise.all([
        api<AdminDashboard>("/api/admin/dashboard"),
        api<{ tasks: AdminTask[] }>("/api/admin/tasks"),
        api<{ traders: Trader[] }>("/api/admin/traders"),
        user.role === "taskbridge_super_admin" ? api<{ agencies: Agency[] }>("/api/admin/agencies") : Promise.resolve({ agencies: [] }),
        user.role === "taskbridge_super_admin" ? api<{ users: AccessUser[]; invitations: AccessInvitation[] }>("/api/admin/access/users") : Promise.resolve({ users: [], invitations: [] }),
        api<{ failures: IntegrationFailure[] }>("/api/admin/integrations/failures"),
        api<{ requests: DemoRequest[] }>("/api/admin/demo-requests"),
        api<{ charges: BillingCharge[] }>("/api/admin/billing/task-charges"),
        api<{ invoices: AdminInvoice[] }>("/api/admin/billing/invoices")
      ]);
      setDashboard(summary); setTasks(taskResult.tasks); setTraders(traderResult.traders); setAgencies(agencyResult.agencies);
      setAccessUsers(accessResult.users); setAccessInvitations(accessResult.invitations);
      setIntegrationFailures(integrationResult.failures);
      setDemoRequests(demoResult.requests);
      setBillingCharges(billingResult.charges);
      setInvoices(invoiceResult.invoices);
      setSelectedTask((current) => current ? taskResult.tasks.find((task) => task.id === current.id) || null : null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load administration"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function openOperationalView(view: string, filter = "all") {
    if (view === "tasks") taskFilter !== filter && setTaskFilter(filter);
    if (view === "traders") traderFilter !== filter && setTraderFilter(filter);
    setActive(view);
  }

  function changeActive(view: string) {
    if (view === "tasks") setTaskFilter("all");
    if (view === "traders") setTraderFilter("all");
    setActive(view);
  }

  return <PortalShell user={user} area="admin" active={active} onActive={changeActive} onSignOut={onSignOut}>
    {error && <div className="alert alert-danger">{error}<button onClick={load}><RefreshCw size={16} /> Retry</button></div>}
    {loading && !dashboard ? <div className="app-loading"><LoaderCircle className="spin" /> Loading secure operations...</div> : active === "overview"
      ? <AdminOverview dashboard={dashboard} tasks={tasks} onOpenView={openOperationalView} onReview={(task) => { setSelectedTask(task); setTaskFilter("awaiting"); setActive("tasks"); }} />
      : active === "demo-requests"
        ? <DemoRequestDesk requests={demoRequests} onChanged={load} />
        : active === "tasks"
        ? <AssignmentDesk tasks={tasks} filter={taskFilter} onFilter={setTaskFilter} selectedTask={selectedTask} onSelect={setSelectedTask} onChanged={load} />
        : active === "integrations"
          ? <IntegrationMonitor failures={integrationFailures} onRefresh={load} />
        : active === "billing"
          ? <FinanceControls charges={billingCharges} invoices={invoices} onChanged={load} />
        : active === "agencies" && user.role === "taskbridge_super_admin"
          ? <AgencyOnboarding agencies={agencies} onChanged={load} />
          : active === "access" && user.role === "taskbridge_super_admin"
            ? <AccessControl currentUser={user} users={accessUsers} invitations={accessInvitations} agencies={agencies} onChanged={load} />
          : <ComplianceHub traders={traders} filter={traderFilter} onFilter={setTraderFilter} user={user} onChanged={load} />}
  </PortalShell>;
}

function AdminOverview({ dashboard, tasks, onReview, onOpenView }: {
  dashboard: AdminDashboard | null;
  tasks: AdminTask[];
  onReview: (task: AdminTask) => void;
  onOpenView: (view: string, filter?: string) => void;
}) {
  const taskCounts = dashboard?.tasks || {};
  const pending = (taskCounts.pending_taskbridge_assignment || 0) + (taskCounts.assignment_review || 0);
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Operations control centre</span><h1>Safeguarding and dispatch overview</h1><p>Review exceptions, verify compliance and release approved assignments.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Restricted workspace</span></div>
    <div className="metric-grid admin-metrics">
      <MetricAdmin icon={<ClipboardCheck />} label="Awaiting assignment" value={pending} tone="amber" onClick={() => onOpenView("tasks", "awaiting")} />
      <MetricAdmin icon={<BadgeCheck />} label="DBS approved" value={dashboard?.traders.approved || 0} tone="green" onClick={() => onOpenView("traders", "approved")} />
      <MetricAdmin icon={<FileWarning />} label="DBS action needed" value={(dashboard?.traders.pending || 0) + (dashboard?.traders.unclear || 0) + (dashboard?.traders.rejected || 0) + (dashboard?.traders.not_started || 0)} tone="blue" onClick={() => onOpenView("traders", "action-needed")} />
      <MetricAdmin icon={<CircleAlert />} label="Integration failures" value={dashboard?.integrationFailures || 0} tone="red" onClick={() => onOpenView("integrations")} />
      <MetricAdmin icon={<Mail />} label="Demo follow-ups" value={dashboard?.demoRequests || 0} tone="blue" onClick={() => onOpenView("demo-requests")} />
      <MetricAdmin icon={<FileWarning />} label="Payout holds" value={dashboard?.paymentHolds || 0} tone="amber" onClick={() => onOpenView("billing")} />
    </div>
    <section className="panel">
      <div className="panel-heading"><div><h2>Assignment queue</h2><p>Tasks waiting for secure candidate evaluation.</p></div></div>
      <div className="admin-task-list">{tasks.filter((task) => ["pending_taskbridge_assignment", "assignment_review"].includes(task.status)).slice(0, 6).map((task) => <AdminTaskRow key={task.id} task={task} action={<button className="button button-secondary button-small" onClick={() => onReview(task)}>Review match</button>} />)}</div>
      {!tasks.some((task) => ["pending_taskbridge_assignment", "assignment_review"].includes(task.status)) && <EmptyState icon={<Activity />} title="Assignment queue is clear" detail="New care-approved tasks will appear here." />}
    </section>
  </>;
}

function MetricAdmin({ icon, label, value, tone, onClick }: { icon: React.ReactNode; label: string; value: number; tone: string; onClick: () => void }) {
  return <button className={`metric metric-link metric-${tone}`} onClick={onClick} aria-label={`Open ${label.toLowerCase()}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div><ChevronRight className="metric-arrow" size={19} /></button>;
}

function taskMatchesAdminFilter(task: AdminTask, filter: string) {
  if (filter === "awaiting") return ["pending_taskbridge_assignment", "assignment_review"].includes(task.status);
  if (filter === "in-progress") return ["dispatched", "visit_scheduled", "checked_in", "awaiting_evidence_review", "awaiting_care_confirmation"].includes(task.status);
  if (filter === "completed") return task.status === "completed";
  return true;
}

function AssignmentDesk({ tasks, filter, onFilter, selectedTask, onSelect, onChanged }: {
  tasks: AdminTask[];
  filter: string;
  onFilter: (filter: string) => void;
  selectedTask: AdminTask | null;
  onSelect: (task: AdminTask) => void;
  onChanged: () => Promise<void>;
}) {
  const filteredTasks = tasks.filter((task) => taskMatchesAdminFilter(task, filter));
  useEffect(() => {
    if (selectedTask && filteredTasks.some((task) => task.id === selectedTask.id)) return;
    const nextTask = filteredTasks.find((task) => ["pending_taskbridge_assignment", "assignment_review"].includes(task.status)) || filteredTasks[0];
    if (nextTask) onSelect(nextTask);
  }, [filter, tasks, selectedTask?.id]);
  return <div className="assignment-layout">
    <section>
      <div className="page-title-row compact"><div><span className="eyebrow">Secure assignment desk</span><h1>Review and release work</h1><p>Only eligible handymen can be approved for dispatch.</p></div></div>
      <nav className="task-filter-links" aria-label="Filter assignment tasks">{[
        ["all", "All tasks"], ["awaiting", "Awaiting review"], ["in-progress", "In progress"], ["completed", "Completed"]
      ].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => onFilter(key)} aria-pressed={filter === key}>{label}<span>{tasks.filter((task) => taskMatchesAdminFilter(task, key)).length}</span></button>)}</nav>
      <div className="panel admin-task-list selectable">{filteredTasks.map((task) => <AdminTaskRow key={task.id} task={task} selected={selectedTask?.id === task.id} onSelect={() => onSelect(task)} action={<button className="button button-secondary button-small" onClick={(event) => { event.stopPropagation(); onSelect(task); }}>Review task</button>} />)}{!filteredTasks.length && <EmptyState icon={<ClipboardCheck />} title="No tasks in this view" detail="Choose another status filter to review other work." />}</div>
    </section>
    <CandidatePanel task={selectedTask && filteredTasks.some((task) => task.id === selectedTask.id) ? selectedTask : null} onChanged={onChanged} />
  </div>;
}

function AdminTaskRow({ task, action, selected = false, onSelect }: { task: AdminTask; action: React.ReactNode; selected?: boolean; onSelect?: () => void }) {
  return <article className={`admin-task-row ${selected ? "selected" : ""} ${onSelect ? "interactive" : ""}`} onClick={onSelect}>
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
  }, [task?.id, task?.status]);

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

function IntegrationMonitor({ failures, onRefresh }: { failures: IntegrationFailure[]; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }
  async function runRetries() {
    setRunning(true);
    try {
      await api("/api/admin/integrations/retry/run", { method: "POST", body: JSON.stringify({ limit: 10 }) });
      await onRefresh();
    } finally { setRunning(false); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Integration operations</span><h1>Delivery failures</h1><p>Review failed and retrying care-platform callbacks and inbound events.</p></div><div className="row-actions"><button className="button button-secondary" onClick={runRetries} disabled={running}>{running ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Run retries</button><button className="button button-secondary" onClick={refresh} disabled={refreshing}>{refreshing ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Refresh</button></div></div>
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Care agency</th><th>Event</th><th>Endpoint</th><th>Status</th><th>Attempts</th><th>Received</th></tr></thead><tbody>{failures.map((failure) => <tr key={failure.id}><td><strong>{failure.agencyName || "Platform"}</strong><small>{humanize(failure.direction)}</small></td><td><strong>{humanize(failure.eventType)}</strong><small>{failure.errorMessage || (failure.responseStatus ? `HTTP ${failure.responseStatus}` : "Provider response unavailable")}</small></td><td><span className="integration-endpoint">{failure.endpoint}</span></td><td><StatusBadge status={failure.status}>{humanize(failure.status)}</StatusBadge>{failure.nextRetryAt && <small>Next retry {formatDate(failure.nextRetryAt, true)}</small>}</td><td>{failure.retryCount}</td><td>{formatDate(failure.createdAt, true)}</td></tr>)}</tbody></table></div>{!failures.length && <EmptyState icon={<BadgeCheck />} title="No integration failures" detail="Inbound events and care-platform callbacks are currently clear." />}</section>
  </>;
}

function DemoRequestDesk({ requests, onChanged }: { requests: DemoRequest[]; onChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState("");
  const filtered = requests.filter((item) => filter === "open" ? item.status !== "closed" : filter === "all" ? true : item.status === filter);
  async function update(item: DemoRequest, status: string) {
    const notes = window.prompt("Add an internal note for this demo request", item.internalNotes || "");
    setBusy(item.id);
    try {
      await api(`/api/admin/demo-requests/${item.id}`, { method: "PATCH", body: JSON.stringify({ status, internalNotes: notes || "" }) });
      await onChanged();
    } finally { setBusy(""); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Landing-page enquiries</span><h1>Demo request queue</h1><p>Track new care-company interest from request through qualification.</p></div></div>
    <nav className="task-filter-links" aria-label="Filter demo requests">{[["open", "Open"], ["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["closed", "Closed"], ["all", "All"]].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}<span>{requests.filter((item) => key === "open" ? item.status !== "closed" : key === "all" ? true : item.status === key).length}</span></button>)}</nav>
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Organisation</th><th>Contact</th><th>Status</th><th>Need</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.organisationName}</strong><small>{formatDate(item.createdAt, true)}</small></td><td><strong>{item.fullName}</strong><small>{item.workEmail}</small></td><td><StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge>{item.ownerName && <small>Owner: {item.ownerName}</small>}</td><td><span className="integration-endpoint">{item.message || "No extra note"}</span>{item.internalNotes && <small>Internal: {item.internalNotes}</small>}</td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={busy === item.id} onClick={() => update(item, "contacted")}>Contacted</button><button className="button button-secondary button-small" disabled={busy === item.id} onClick={() => update(item, "qualified")}>Qualify</button><button className="button button-secondary button-small" disabled={busy === item.id} onClick={() => update(item, "closed")}>Close</button></div></td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState icon={<Mail />} title="No demo requests in this view" detail="New book-demo submissions will appear here." />}</section>
  </>;
}

function FinanceControls({ charges, invoices, onChanged }: { charges: BillingCharge[]; invoices: AdminInvoice[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const agencies = Array.from(new Map(charges.map((charge) => [charge.agencyId, charge.agencyName])).entries()).map(([id, name]) => ({ id, name }));
  const [invoiceForm, setInvoiceForm] = useState({ agencyId: agencies[0]?.id || "", periodStart: defaultStart, periodEnd: defaultEnd, dueDate: "" });
  useEffect(() => {
    if (!invoiceForm.agencyId && agencies[0]?.id) setInvoiceForm((current) => ({ ...current, agencyId: agencies[0].id }));
  }, [agencies.map((agency) => agency.id).join("|")]);
  async function settlement(charge: BillingCharge) {
    const settlementStatus = window.prompt("Settlement status: not_invoiced, invoiced, agency_paid, disputed, written_off", charge.settlementStatus);
    if (!settlementStatus) return;
    const settlementReference = window.prompt("Invoice or settlement reference", charge.settlementReference || "");
    setBusy(charge.id);
    try {
      await api(`/api/admin/billing/task-charges/${charge.id}/settlement`, {
        method: "PATCH",
        body: JSON.stringify({ settlementStatus, settlementReference, settlementDueAt: charge.settlementDueAt, settlementNotes: charge.settlementNotes })
      });
      await onChanged();
    } finally { setBusy(""); }
  }
  async function dispute(charge: BillingCharge) {
    const reason = window.prompt("Why is this task disputed or on payment hold?");
    if (!reason || reason.length < 5) return;
    setBusy(charge.id);
    try {
      await api(`/api/admin/billing/task-charges/${charge.id}/disputes`, { method: "POST", body: JSON.stringify({ reason, refundAmount: 0 }) });
      await onChanged();
    } finally { setBusy(""); }
  }
  async function createInvoice() {
    if (!invoiceForm.agencyId) return window.alert("Choose a care agency with uninvoiced charges.");
    setBusy("invoice-create");
    try {
      const result = await api<{ invoiceNumber: string; lineCount: number; totalAmount: number }>("/api/admin/billing/invoices", {
        method: "POST",
        body: JSON.stringify({ ...invoiceForm, dueDate: invoiceForm.dueDate || null })
      });
      window.alert(`Invoice ${result.invoiceNumber} created with ${result.lineCount} charge line${result.lineCount === 1 ? "" : "s"}.`);
      await onChanged();
    } finally { setBusy(""); }
  }
  async function updateInvoiceStatus(invoice: AdminInvoice, status: "paid" | "void") {
    setBusy(invoice.id);
    try {
      await api(`/api/admin/billing/invoices/${invoice.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await onChanged();
    } finally { setBusy(""); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Pilot finance control</span><h1>Invoices, settlement and payout holds</h1><p>Generate care-agency invoice exports, track settlements and hold payouts when evidence or disputes require review.</p></div></div>
    <section className="panel invoice-create-panel">
      <div className="panel-heading"><div><h2>Generate agency invoice export</h2><p>Create an issued invoice from uninvoiced task charges for one care agency and billing period.</p></div></div>
      <div className="invoice-create-grid">
        <label>Care agency<select value={invoiceForm.agencyId} onChange={(event) => setInvoiceForm((current) => ({ ...current, agencyId: event.target.value }))}><option value="">Choose agency</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}</select></label>
        <label>Period start<input type="date" value={invoiceForm.periodStart} onChange={(event) => setInvoiceForm((current) => ({ ...current, periodStart: event.target.value }))} /></label>
        <label>Period end<input type="date" value={invoiceForm.periodEnd} onChange={(event) => setInvoiceForm((current) => ({ ...current, periodEnd: event.target.value }))} /></label>
        <label>Due date<input type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
        <button className="button button-primary" disabled={busy === "invoice-create"} onClick={createInvoice}>{busy === "invoice-create" ? <LoaderCircle className="spin" size={17} /> : <FileCheck2 size={17} />} Generate invoice</button>
      </div>
    </section>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Invoice exports</h2><p>Issued invoice batches grouped by agency and period.</p></div></div><div className="responsive-table"><table><thead><tr><th>Invoice</th><th>Agency</th><th>Period</th><th>Lines</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small>{invoice.issuedAt ? `Issued ${formatDate(invoice.issuedAt, true)}` : "Draft"}</small></td><td>{invoice.agencyName}</td><td><strong>{formatDate(invoice.periodStart)}</strong><small>to {formatDate(invoice.periodEnd)}</small></td><td>{invoice.lineCount}</td><td><strong>{invoice.currency} {invoice.totalAmount.toFixed(2)}</strong></td><td><StatusBadge status={invoice.status}>{humanize(invoice.status)}</StatusBadge>{invoice.paidAt && <small>Paid {formatDate(invoice.paidAt, true)}</small>}</td><td><div className="row-actions"><a className="button button-secondary button-small" href={`/api/admin/billing/invoices/${invoice.id}/export.csv`}>CSV</a><button className="button button-secondary button-small" disabled={busy === invoice.id || invoice.status === "paid"} onClick={() => updateInvoiceStatus(invoice, "paid")}>Mark paid</button><button className="button button-secondary button-small document-reject" disabled={busy === invoice.id || invoice.status === "void" || invoice.status === "paid"} onClick={() => updateInvoiceStatus(invoice, "void")}>Void</button></div></td></tr>)}</tbody></table></div>{!invoices.length && <EmptyState icon={<FileCheck2 />} title="No invoices generated yet" detail="Create an invoice export from uninvoiced task charges." />}</section>
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Task</th><th>Agency</th><th>Amounts</th><th>Settlement</th><th>Payout</th><th>Actions</th></tr></thead><tbody>{charges.map((charge) => <tr key={charge.id}><td><strong>{charge.taskId}</strong><small>{formatDate(charge.createdAt, true)}</small></td><td><strong>{charge.agencyName}</strong><small>{charge.handymanName || "No handyman"}</small></td><td><strong>£{charge.totalAmount.toFixed(2)}</strong><small>Handyman £{charge.handymanAmount.toFixed(2)} · Agency £{charge.agencyCoordinationFee.toFixed(2)} · Platform £{charge.platformFee.toFixed(2)}</small></td><td><StatusBadge status={charge.settlementStatus}>{humanize(charge.settlementStatus)}</StatusBadge>{charge.settlementReference && <small>{charge.settlementReference}</small>}</td><td><StatusBadge status={charge.payoutStatus || "pending"}>{humanize(charge.payoutStatus || "pending")}</StatusBadge>{charge.payableAfter && <small>Eligible {formatDate(charge.payableAfter, true)}</small>}</td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={busy === charge.id} onClick={() => settlement(charge)}>Settlement</button><button className="button button-secondary button-small document-reject" disabled={busy === charge.id} onClick={() => dispute(charge)}>Dispute / hold</button></div></td></tr>)}</tbody></table></div>{!charges.length && <EmptyState icon={<FileCheck2 />} title="No charge records yet" detail="Charges are created when a TaskBridge admin dispatches a handyman." />}</section>
  </>;
}

function ComplianceHub({ traders, filter, onFilter, user, onChanged }: { traders: Trader[]; filter: string; onFilter: (filter: string) => void; user: User; onChanged: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ invitationUrl: string; expiresAt: string; emailDeliveryStatus: string } | null>(null);
  const [reviewingTrader, setReviewingTrader] = useState<Trader | null>(null);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const filteredTraders = traders.filter((trader) => filter === "approved" ? trader.dbsStatus === "approved" : filter === "action-needed" ? trader.dbsStatus !== "approved" : true);
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
  async function openDocuments(trader: Trader) {
    setReviewingTrader(trader); setDocumentsLoading(true); setError("");
    try {
      const result = await api<{ documents: ComplianceDocument[] }>(`/api/admin/traders/${trader.id}/documents`);
      setDocuments(result.documents);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load compliance documents"); setDocuments([]); }
    finally { setDocumentsLoading(false); }
  }
  async function reviewDocument(document: ComplianceDocument, status: "approved" | "rejected") {
    if (!reviewingTrader) return;
    const reason = window.prompt(`Record the reason for ${status === "approved" ? "approval" : "rejection"}`);
    if (!reason || reason.trim().length < 5) return;
    const dbsExpiryDate = document.documentType === "enhanced_dbs" && status === "approved"
      ? window.prompt("DBS review expiry date (YYYY-MM-DD)") : null;
    if (document.documentType === "enhanced_dbs" && status === "approved" && !dbsExpiryDate) return;
    setBusy(document.id); setError("");
    try {
      await api(`/api/admin/traders/${reviewingTrader.id}/documents/${document.id}/review`, {
        method: "POST", body: JSON.stringify({ status, reason, dbsExpiryDate: dbsExpiryDate || null })
      });
      await openDocuments(reviewingTrader); await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to record document review"); }
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
    <div className="page-title-row"><div><span className="eyebrow">Handyman compliance</span><h1>Verification registry</h1><p>Review offered services, Enhanced DBS evidence and public liability insurance before activation.</p></div>{user.role === "taskbridge_super_admin" && <button className="button button-primary" onClick={() => { setInviteOpen(!inviteOpen); setInviteResult(null); }}><UserPlus size={18} /> Register handyman</button>}</div>
    {error && <div className="alert alert-danger">{error}</div>}
    {inviteOpen && <section className="panel invite-handyman-panel">
      <div className="panel-heading"><div><h2>Register and invite a handyman</h2><p>An expiring one-use registration link will be sent to their email address.</p></div></div>
      <form className="invite-handyman-form" onSubmit={inviteHandyman}><label>Full name<input required name="fullName" minLength={2} autoComplete="off" /></label><label>Email address<input required name="email" type="email" autoComplete="off" /></label><button className="button button-primary" disabled={busy === "invite"} type="submit">{busy === "invite" ? <><LoaderCircle className="spin" size={17} /> Sending...</> : <><Send size={17} /> Send registration link</>}</button></form>
      {inviteResult && <div className={`invitation-result ${inviteResult.emailDeliveryStatus === "sent" ? "sent" : "attention"}`}><div><strong>{inviteResult.emailDeliveryStatus === "sent" ? "Invitation email sent" : "Invitation created; email delivery needs configuration"}</strong><span>Expires {formatDate(inviteResult.expiresAt, true)}</span></div><div className="invitation-link"><input readOnly value={inviteResult.invitationUrl} aria-label="Handyman invitation URL" /><button className="icon-button" onClick={copyInvitationLink} type="button" aria-label="Copy invitation link"><Copy size={18} /></button><a className="icon-button" href={inviteResult.invitationUrl} target="_blank" rel="noreferrer" aria-label="Open invitation"><ExternalLink size={18} /></a></div></div>}
    </section>}
    <nav className="task-filter-links" aria-label="Filter handyman compliance">{[["all", "All handymen"], ["approved", "DBS approved"], ["action-needed", "Action needed"]].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => onFilter(key)} aria-pressed={filter === key}>{label}<span>{traders.filter((trader) => key === "approved" ? trader.dbsStatus === "approved" : key === "action-needed" ? trader.dbsStatus !== "approved" : true).length}</span></button>)}</nav>
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Handyman</th><th>Onboarding</th><th>Services</th><th>Enhanced DBS</th><th>Insurance</th><th>Quality</th><th>Action</th></tr></thead><tbody>{filteredTraders.map((trader) => <tr key={trader.id}><td><strong>{trader.displayName}</strong><small>{trader.email || trader.network || "Direct network"}</small></td><td><StatusBadge status={trader.onboardingStatus}>{humanize(trader.onboardingStatus)}</StatusBadge><small>{trader.emailDeliveryStatus ? `Email: ${humanize(trader.emailDeliveryStatus)}` : "Marketplace record"}</small></td><td><span className="service-summary" title={trader.services.join(", ")}>{trader.services.length ? `${trader.services.slice(0, 2).join(", ")}${trader.services.length > 2 ? ` +${trader.services.length - 2}` : ""}` : "Awaiting registration"}</span></td><td><StatusBadge status={trader.dbsStatus}>{humanize(trader.dbsStatus)}</StatusBadge><small>{trader.dbsExpiryDate ? `Expires ${formatDate(trader.dbsExpiryDate)}` : "No active expiry"}</small></td><td><StatusBadge status={trader.insuranceStatus}>{humanize(trader.insuranceStatus)}</StatusBadge><small>{trader.insuranceExpiryDate ? `Expires ${formatDate(trader.insuranceExpiryDate)}` : "No active expiry"}</small></td><td><span className="rating"><Star size={15} /> {trader.qualityScore}</span></td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={documentsLoading && reviewingTrader?.id === trader.id} onClick={() => openDocuments(trader)}><FileCheck2 size={15} /> Review documents</button><button className="button button-secondary button-small" disabled={busy === trader.id || trader.onboardingStatus === "pending"} onClick={() => startCheck(trader)}>Start check</button>{user.role === "taskbridge_super_admin" && trader.onboardingStatus === "pending" ? <button className="icon-button danger-icon" disabled={busy === trader.id} onClick={() => revokeInvitation(trader)} aria-label="Revoke invitation"><Trash2 size={18} /></button> : user.role === "taskbridge_super_admin" && <><button className="icon-button success-icon" onClick={() => review(trader, "approved")} aria-label="Approve DBS"><BadgeCheck size={18} /></button><button className="icon-button danger-icon" onClick={() => review(trader, "rejected")} aria-label="Reject DBS"><CircleAlert size={18} /></button></>}</div></td></tr>)}</tbody></table></div>{!filteredTraders.length && <EmptyState icon={<BadgeCheck />} title="No handymen in this view" detail="Choose another compliance filter to review the registry." />}</section>
    {reviewingTrader && <ComplianceDocumentReview trader={reviewingTrader} documents={documents} loading={documentsLoading} busy={busy} onClose={() => { setReviewingTrader(null); setDocuments([]); }} onReview={reviewDocument} />}
  </>;
}

function ComplianceDocumentReview({ trader, documents, loading, busy, onClose, onReview }: {
  trader: Trader;
  documents: ComplianceDocument[];
  loading: boolean;
  busy: string;
  onClose: () => void;
  onReview: (document: ComplianceDocument, status: "approved" | "rejected") => Promise<void>;
}) {
  return <section className="panel compliance-review-panel">
    <div className="panel-heading"><div><span className="eyebrow">Submitted evidence</span><h2>{trader.displayName}</h2><p>Services: {trader.services.length ? trader.services.join(", ") : "No services selected"}</p></div><button className="button button-secondary button-small" onClick={onClose}>Close</button></div>
    {loading ? <div className="app-loading"><LoaderCircle className="spin" /> Loading secure documents...</div> : <div className="compliance-document-grid">{documents.map((document) => <article key={document.id} className="compliance-document-card">
      <div className="compliance-document-heading"><span><FileCheck2 size={19} /></span><div><h3>{humanize(document.documentType)}</h3><p>{document.originalFilename}</p></div><StatusBadge status={document.reviewStatus}>{humanize(document.reviewStatus)}</StatusBadge></div>
      <dl><div><dt>Submitted</dt><dd>{formatDate(document.createdAt, true)}</dd></div>{document.reference && <div><dt>Reference</dt><dd>{document.reference}</dd></div>}{document.issueDate && <div><dt>Issue date</dt><dd>{formatDate(document.issueDate)}</dd></div>}{document.expiryDate && <div><dt>Expiry date</dt><dd>{formatDate(document.expiryDate)}</dd></div>}<div><dt>File size</dt><dd>{Math.max(1, Math.round(document.sizeBytes / 1024))} KB</dd></div></dl>
      {document.reviewNotes && <p className="review-note"><strong>Review note:</strong> {document.reviewNotes}</p>}
      <div className="compliance-document-actions">{document.reviewUrl ? <a className="button button-secondary button-small" href={document.reviewUrl} target="_blank" rel="noreferrer">Open evidence <ExternalLink size={15} /></a> : <span className="document-unavailable">Secure preview unavailable</span>}{document.reviewStatus === "pending" && <><button className="button button-success button-small" disabled={busy === document.id || !document.reviewUrl} onClick={() => onReview(document, "approved")}>Approve</button><button className="button button-secondary button-small document-reject" disabled={busy === document.id} onClick={() => onReview(document, "rejected")}>Reject</button></>}</div>
    </article>)}</div>}
    {!loading && !documents.length && <EmptyState icon={<FileCheck2 />} title="No documents submitted" detail="The handyman has not completed document registration." />}
  </section>;
}

function AgencyOnboarding({ agencies, onChanged }: { agencies: Agency[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [issuedKey, setIssuedKey] = useState("");
  const [staffInvitation, setStaffInvitation] = useState<{ url: string; delivery: string } | null>(null);
  async function createAgency(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess(""); setIssuedKey(""); setStaffInvitation(null);
    const values = new FormData(event.currentTarget);
    try {
      const result = await api<{ apiKey: string; invitationUrl: string; emailDeliveryStatus: string }>("/api/admin/agencies", { method: "POST", body: JSON.stringify({
        name: values.get("name"),
        primaryContactName: values.get("primaryContactName"),
        primaryContactEmail: values.get("primaryContactEmail"),
        workEmailDomain: values.get("workEmailDomain")
      }) });
      setSuccess(result.emailDeliveryStatus === "sent" ? "Care agency created and manager invitation sent." : "Care agency created. Email delivery requires configuration.");
      setIssuedKey(result.apiKey);
      setStaffInvitation({ url: result.invitationUrl, delivery: result.emailDeliveryStatus });
      event.currentTarget.reset();
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to onboard care agency"); }
    finally { setBusy(false); }
  }
  async function updateSettings(agency: Agency) {
    const current = agency.settings;
    const monthlyCap = Number(window.prompt("Monthly cap in GBP", String(current?.monthlyCap || 500)));
    if (!Number.isFinite(monthlyCap)) return;
    const goLiveStatus = window.prompt("Go-live status: pilot_setup, pilot_live, paused, suspended", current?.goLiveStatus || "pilot_setup");
    if (!goLiveStatus) return;
    const analytics = window.prompt("Free care analytics access: unlocked or locked", current?.healthAnalyticsEnabled ? "unlocked" : "locked");
    if (!analytics) return;
    const healthAnalyticsEnabled = analytics.trim().toLowerCase() === "unlocked";
    setSettingsBusy(agency.id); setError("");
    try {
      await api(`/api/admin/agencies/${agency.id}/settings`, { method: "PATCH", body: JSON.stringify({
        vulnerableAdultRequiresEnhancedDbs: current?.vulnerableAdultRequiresEnhancedDbs ?? true,
        completionRequiresCareConfirmation: current?.completionRequiresCareConfirmation ?? true,
        supervisedVisitExceptionAllowed: current?.supervisedVisitExceptionAllowed ?? false,
        taskbridgeAssignmentRequiresAdminReview: current?.taskbridgeAssignmentRequiresAdminReview ?? true,
        healthAnalyticsEnabled,
        defaultVisitRadiusMiles: current?.defaultVisitRadiusMiles ?? 15,
        goLiveStatus,
        monthlyCap
      }) });
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update agency settings"); }
    finally { setSettingsBusy(""); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Super-admin control</span><h1>Care agency onboarding</h1><p>Only TaskBridge super administrators can create a care-organisation workspace.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Super admin only</span></div>
    <div className="agency-onboarding-layout">
      <section className="panel"><div className="panel-heading"><div><h2>Care agencies</h2><p>{agencies.length} organisation{agencies.length === 1 ? "" : "s"} registered.</p></div></div><div className="agency-list agency-key-list">{agencies.map((agency) => <article key={agency.id}><span><Building2 size={19} /></span><div><h3>{agency.name}</h3><p><Mail size={14} /> {agency.primary_contact_email}</p><small>{agency.public_id} / {agency.work_email_domain}</small><div className="agency-operational-meta"><span><ClipboardCheck size={14} /> {agency.activeWorkorders} active workorder{agency.activeWorkorders === 1 ? "" : "s"}</span><span><ShieldCheck size={14} /> {humanize(agency.settings?.goLiveStatus || "pilot_setup")} · £{(agency.settings?.monthlyCap || 500).toFixed(0)} cap</span>{agency.secretApiKey ? <span title={agency.secretApiKey.encryptionRepresentation}><KeyRound size={14} /> {agency.secretApiKey.masked} / {agency.secretApiKey.length} characters / {agency.secretApiKey.encryptionRepresentation}</span> : <span><KeyRound size={14} /> Integration key not issued</span>}</div></div><div className="row-actions"><StatusBadge status={agency.status}>{humanize(agency.status)}</StatusBadge><button className="button button-secondary button-small" disabled={settingsBusy === agency.id} onClick={() => updateSettings(agency)}>Settings</button></div></article>)}</div></section>
      <aside className="agency-create-panel"><div className="resident-create-heading"><span><Plus size={20} /></span><div><h2>Onboard a care agency</h2><p>Create the tenant and invite its first care manager.</p></div></div><form className="stack" onSubmit={createAgency}><label>Agency name<input required name="name" minLength={2} /></label><label>Primary contact name<input required name="primaryContactName" minLength={2} /></label><label>Primary contact work email<input required name="primaryContactEmail" type="email" /></label><label>Approved work email domain<input required name="workEmailDomain" placeholder="careagency.co.uk" /></label>{error && <p className="form-error">{error}</p>}{success && <p className="form-success">{success}</p>}{staffInvitation && <div className="invitation-link"><input readOnly value={staffInvitation.url} aria-label="Care manager invitation URL" /><button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(staffInvitation.url)} aria-label="Copy manager invitation"><Copy size={18} /></button></div>}{issuedKey && <div className="issued-api-key"><strong>Copy the integration key now</strong><p>For security, the full secret is shown only once.</p><div><input readOnly value={issuedKey} aria-label="New agency API key" /><button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(issuedKey)} aria-label="Copy API key"><Copy size={18} /></button></div></div>}<button className="button button-primary button-full" disabled={busy} type="submit">{busy ? <><LoaderCircle className="spin" size={17} /> Creating...</> : <><Building2 size={17} /> Create agency workspace</>}</button></form></aside>
    </div>
  </>;
}

function AccessControl({ currentUser, users, invitations, agencies, onChanged }: {
  currentUser: User; users: AccessUser[]; invitations: AccessInvitation[]; agencies: Agency[]; onChanged: () => Promise<void>;
}) {
  const [role, setRole] = useState("taskbridge_admin");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [inviteResult, setInviteResult] = useState<{ invitationUrl: string; emailDeliveryStatus: string } | null>(null);
  const taskbridgeUsers = users.filter((entry) => entry.role.startsWith("taskbridge_"));

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("invite"); setError(""); setInviteResult(null);
    try {
      const result = await api<{ invitationUrl: string; emailDeliveryStatus: string }>("/api/admin/access/invitations", {
        method: "POST",
        body: JSON.stringify({
          fullName: values.get("fullName"), email: values.get("email"), role,
          agencyId: role.startsWith("care_") ? values.get("agencyId") : null
        })
      });
      setInviteResult(result); form.reset(); await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send invitation"); }
    finally { setBusy(""); }
  }

  async function changeRole(target: AccessUser) {
    const nextRole = target.role === "taskbridge_super_admin" ? "taskbridge_admin" : "taskbridge_super_admin";
    if (!window.confirm(`${nextRole === "taskbridge_super_admin" ? "Promote" : "Demote"} ${target.full_name}? Their active sessions will be signed out.`)) return;
    setBusy(target.id); setError("");
    try { await api(`/api/admin/access/users/${target.id}/role`, { method: "PATCH", body: JSON.stringify({ role: nextRole }) }); await onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change role"); }
    finally { setBusy(""); }
  }

  async function changeStatus(target: AccessUser) {
    const status = target.status === "active" ? "suspended" : "active";
    if (!window.confirm(`${status === "suspended" ? "Suspend" : "Reactivate"} ${target.full_name}?`)) return;
    setBusy(target.id); setError("");
    try { await api(`/api/admin/access/users/${target.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change account status"); }
    finally { setBusy(""); }
  }

  async function remove(target: AccessUser) {
    if (!window.confirm(`Permanently remove TaskBridge access for ${target.full_name}?`)) return;
    setBusy(target.id); setError("");
    try { await api(`/api/admin/access/users/${target.id}`, { method: "DELETE" }); await onChanged(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove account"); }
    finally { setBusy(""); }
  }

  return <>
    <div className="page-title-row"><div><span className="eyebrow">Super-admin control</span><h1>People and privileges</h1><p>Invite staff and manage TaskBridge administrator access with a complete audit trail.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Super admin only</span></div>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="access-control-layout">
      <section className="panel table-panel"><div className="panel-heading"><div><h2>TaskBridge administrators</h2><p>Promotion, demotion and account changes require a fresh sign-in.</p></div></div><div className="responsive-table"><table><thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Last sign in</th><th>Actions</th></tr></thead><tbody>{taskbridgeUsers.map((entry) => <tr key={entry.id}><td><strong>{entry.full_name}</strong><small>{entry.email}</small></td><td><StatusBadge status={entry.role}>{humanize(entry.role)}</StatusBadge></td><td><StatusBadge status={entry.status}>{humanize(entry.status)}</StatusBadge></td><td>{entry.last_login_at ? formatDate(entry.last_login_at, true) : "Not yet"}</td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={entry.id === currentUser.id || busy === entry.id} onClick={() => changeRole(entry)}>{entry.role === "taskbridge_super_admin" ? "Demote" : "Promote"}</button><button className="button button-secondary button-small" disabled={entry.id === currentUser.id || busy === entry.id} onClick={() => changeStatus(entry)}>{entry.status === "active" ? "Suspend" : "Activate"}</button><button className="icon-button danger-icon" disabled={entry.id === currentUser.id || busy === entry.id} onClick={() => remove(entry)} aria-label={`Delete ${entry.full_name}`}><Trash2 size={17} /></button></div></td></tr>)}</tbody></table></div></section>
      <aside className="agency-create-panel access-invite-panel"><div className="resident-create-heading"><span><UserPlus size={20} /></span><div><h2>Invite a staff member</h2><p>Send an expiring one-use account setup link.</p></div></div><form className="stack" onSubmit={invite}><label>Full name<input name="fullName" required minLength={2} /></label><label>Work email<input name="email" required type="email" /></label><label>Access role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="taskbridge_admin">TaskBridge admin</option><option value="taskbridge_super_admin">TaskBridge super admin</option><option value="care_manager">Care manager</option><option value="care_coordinator">Care coordinator</option></select></label>{role.startsWith("care_") && <label>Care agency<select name="agencyId" required defaultValue=""><option value="" disabled>Select agency</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}</select></label>}<button className="button button-primary button-full" disabled={busy === "invite"} type="submit">{busy === "invite" ? <><LoaderCircle className="spin" size={17} /> Sending...</> : <><Send size={17} /> Send invitation</>}</button></form>{inviteResult && <div className="invitation-result"><strong>{inviteResult.emailDeliveryStatus === "sent" ? "Invitation sent" : "Invitation created"}</strong><div className="invitation-link"><input readOnly value={inviteResult.invitationUrl} aria-label="Staff invitation URL" /><button className="icon-button" onClick={() => navigator.clipboard.writeText(inviteResult.invitationUrl)} aria-label="Copy invitation"><Copy size={17} /></button></div></div>}</aside>
    </div>
    {invitations.length > 0 && <section className="panel pending-access-panel"><div className="panel-heading"><div><h2>Pending staff invitations</h2><p>Links expire automatically after seven days.</p></div></div><div className="agency-list">{invitations.map((entry) => <article key={entry.id}><span><Mail size={18} /></span><div><h3>{entry.full_name}</h3><p>{entry.email}</p><small>{entry.agency_name || "TaskBridge"} · {humanize(entry.role)} · expires {formatDate(entry.expires_at, true)}</small></div><StatusBadge status={entry.email_delivery_status}>{humanize(entry.email_delivery_status)}</StatusBadge></article>)}</div></section>}
  </>;
}
