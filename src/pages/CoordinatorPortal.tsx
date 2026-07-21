import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Command,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  UploadCloud,
  UserPlus,
  UserRoundCheck,
  UsersRound,
  Wrench,
  X
} from "lucide-react";
import { api, formatDate, humanize } from "../api";
import { EmptyState, PortalShell, StatusBadge } from "../components";
import type { CoordinatorTask, PaymentRoute, TaskSuggestion, User } from "../types";

interface DashboardData {
  agencyName: string;
  metrics: { open: number; pendingAssignment: number; assigned: number; awaitingConfirmation: number; completed: number };
  recentTasks: CoordinatorTask[];
}

interface ServiceUser {
  id: string;
  reference: string;
  name: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  riskLevel: "standard" | "vulnerable_adult" | "high_risk";
  vulnerabilityNotes: string;
  createdAt: string;
}

interface PortalNotification {
  id: string;
  taskId: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
}

interface TaskDetail {
  id: string;
  serviceUserAddress: { address: string; town: string; county: string; postcode: string };
  location: { latitude: number | null; longitude: number | null };
  keysafePasscode: string;
  timeline: Array<{ id: string; previousStatus: string | null; status: string; reason: string | null; actor: string; createdAt: string }>;
  evidence: Array<{ type: string; url: string | null; createdAt: string }>;
}

interface AnalyticsDashboard {
  enabled: boolean;
  summary: { serviceUsersTracked: number; observations: number; deteriorating: number; stable: number; improving: number };
  uploads: Array<{ id: string; fileName: string; rowCount: number; createdAt: string }>;
  serviceUsers: Array<{
    serviceUserId: string;
    reference: string;
    name: string;
    overallTrend: "deteriorating" | "stable" | "improving";
    latestObservationDate: string;
    metrics: Array<{
      metricType: string;
      trend: "deteriorating" | "stable" | "improving";
      first: number | null;
      latest: number | null;
      unit: string;
      points: Array<{ date: string; value: number | null; unit: string; outcome: string; notes: string }>;
    }>;
  }>;
}

interface AgencyInvoiceDashboard {
  pending: { count: number; totalAmount: number };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    currency: string;
    status: string;
    issuedAt: string | null;
    paidAt: string | null;
    lineCount: number;
  }>;
}

type AnalyticsFilter = "all" | "deteriorating" | "improving" | "observations";

type TaskFilter = "all" | "open" | "pending" | "assigned" | "confirmation" | "completed";
type CoordinatorSection = "overview" | "new-task" | "tasks" | "service-users" | "analytics" | "rota-planner" | "billing" | "notifications";

const taskFilterLabels: Record<TaskFilter, string> = {
  all: "All tasks",
  open: "Open",
  pending: "Pending assignment",
  assigned: "Handyman assigned",
  confirmation: "Needs confirmation",
  completed: "Completed"
};

const analyticsFilterLabels: Record<AnalyticsFilter, string> = {
  all: "All tracked service users",
  deteriorating: "Showing deterioration",
  improving: "Improving outcomes",
  observations: "All health observations"
};

const coordinatorSections: CoordinatorSection[] = ["overview", "new-task", "tasks", "service-users", "analytics", "rota-planner", "billing", "notifications"];

function initialTaskFilter(): TaskFilter {
  const value = new URLSearchParams(window.location.search).get("taskFilter");
  return value && value in taskFilterLabels ? value as TaskFilter : "all";
}

function initialCoordinatorSection(filter: TaskFilter): CoordinatorSection {
  const section = new URLSearchParams(window.location.search).get("section");
  if (section && coordinatorSections.includes(section as CoordinatorSection)) return section as CoordinatorSection;
  return filter === "all" ? "overview" : "tasks";
}

export function CoordinatorPortal({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const initialFilter = initialTaskFilter();
  const [active, setActive] = useState<CoordinatorSection>(initialCoordinatorSection(initialFilter));
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(initialFilter);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<CoordinatorTask[]>([]);
  const [serviceUsers, setServiceUsers] = useState<ServiceUser[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [selectedTask, setSelectedTask] = useState<CoordinatorTask | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [dashboardResult, taskResult, serviceUserResult, notificationResult] = await Promise.all([
        api<DashboardData>("/api/coordinator/dashboard"),
        api<{ tasks: CoordinatorTask[] }>("/api/coordinator/tasks"),
        api<{ serviceUsers: ServiceUser[] }>("/api/coordinator/service-users"),
        api<{ notifications: PortalNotification[] }>("/api/coordinator/notifications")
      ]);
      setDashboard(dashboardResult);
      setTasks(taskResult.tasks);
      setServiceUsers(serviceUserResult.serviceUsers);
      setNotifications(notificationResult.notifications);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the workspace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (!isTyping && event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (isTyping || event.ctrlKey || event.metaKey || event.altKey) return;
      const destinations: Record<string, string> = { d: "overview", c: "new-task", s: "tasks", r: "rota-planner", n: "notifications" };
      const destination = destinations[event.key.toLowerCase()];
      if (destination) openSection(destination);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function openSection(section: string) {
    const nextSection = coordinatorSections.includes(section as CoordinatorSection) ? section as CoordinatorSection : "overview";
    setActive(nextSection);
    setNotificationDrawerOpen(false);
    if (nextSection === "tasks") setTaskFilter("all");
    window.history.replaceState({}, "", nextSection === "overview" ? "/portal" : `/portal?section=${nextSection}`);
  }

  function openTaskFilter(filter: TaskFilter) {
    setTaskFilter(filter);
    setActive("tasks");
    window.history.replaceState({}, "", filter === "all" ? "/portal" : `/portal?taskFilter=${filter}`);
  }

  async function openTask(task: CoordinatorTask) {
    setSelectedTask(task);
    setTaskDetail(null);
    setDetailLoading(true);
    try {
      const result = await api<{ detail: TaskDetail }>(`/api/coordinator/tasks/${task.id}`);
      setTaskDetail(result.detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load task details");
    } finally {
      setDetailLoading(false);
    }
  }

  function openNotification(notification: PortalNotification) {
    const task = tasks.find((item) => item.id === notification.taskId);
    if (task) void openTask(task);
    setNotificationDrawerOpen(false);
  }

  return (
    <PortalShell
      user={user}
      area="care"
      active={active}
      onActive={openSection}
      onSignOut={onSignOut}
      workspaceName={dashboard?.agencyName}
      notificationCount={notifications.length}
      onNotifications={() => setNotificationDrawerOpen(true)}
    >
      {error && <div className="alert alert-danger">{error}<button onClick={load}><RefreshCw size={16} /> Retry</button></div>}
      {loading && !dashboard ? <Loading /> : active === "overview"
        ? <CoordinatorOverview user={user} dashboard={dashboard} onNew={() => openSection("new-task")} onOpenFilter={openTaskFilter} onOpenTask={openTask} />
        : active === "new-task"
          ? <TaskIntake serviceUsers={serviceUsers} onCreated={async () => { await load(); openTaskFilter("all"); }} />
          : active === "service-users"
            ? <ServiceUserDirectory serviceUsers={serviceUsers} onChanged={load} />
            : active === "analytics"
              ? <CareAnalyticsDashboard serviceUsers={serviceUsers} />
              : active === "rota-planner"
                ? <RotaPlannerDashboard serviceUsers={serviceUsers} />
                : active === "billing"
                  ? <AgencyInvoices />
                  : active === "notifications"
                    ? <NotificationsHub notifications={notifications} onOpen={openNotification} />
                    : <StatusBoard tasks={tasks} filter={taskFilter} onFilter={openTaskFilter} onOpenTask={openTask} />}
      {notificationDrawerOpen && <NotificationDrawer notifications={notifications} onClose={() => setNotificationDrawerOpen(false)} onOpen={openNotification} onViewAll={() => openSection("notifications")} />}
      {selectedTask && <TaskDetailsDrawer task={selectedTask} detail={taskDetail} loading={detailLoading} onClose={() => { setSelectedTask(null); setTaskDetail(null); }} onChanged={async () => { setSelectedTask(null); setTaskDetail(null); await load(); }} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onChoose={openSection} />}
    </PortalShell>
  );
}

function CoordinatorOverview({ user, dashboard, onNew, onOpenFilter, onOpenTask }: {
  user: User;
  dashboard: DashboardData | null;
  onNew: () => void;
  onOpenFilter: (filter: TaskFilter) => void;
  onOpenTask: (task: CoordinatorTask) => void;
}) {
  const metrics = dashboard?.metrics || { open: 0, pendingAssignment: 0, assigned: 0, awaitingConfirmation: 0, completed: 0 };
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Regional care coordination</span><h1>Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {user.fullName.split(" ")[0]}.</h1><p>Review home-safety work across {dashboard?.agencyName || "your care organisation"}.</p></div><button className="button button-primary" onClick={onNew}><Plus size={18} /> Create task</button></div>
    <div className="metric-grid coordinator-metrics">
      <Metric icon={<ClipboardList />} label="Open safety tasks" value={metrics.open} filter="open" onOpen={onOpenFilter} />
      <Metric icon={<Clock3 />} label="Pending assignment" value={metrics.pendingAssignment} filter="pending" tone="amber" onOpen={onOpenFilter} />
      <Metric icon={<UserRoundCheck />} label="Dispatched visits" value={metrics.assigned} filter="assigned" tone="blue" onOpen={onOpenFilter} />
      <Metric icon={<CheckCircle2 />} label="Completed verification" value={metrics.completed} filter="completed" tone="green" onOpen={onOpenFilter} />
    </div>
    {metrics.awaitingConfirmation > 0 && <button className="attention-strip" onClick={() => onOpenFilter("confirmation")}><ShieldAlert size={20} /><span><strong>{metrics.awaitingConfirmation} completion{metrics.awaitingConfirmation === 1 ? "" : "s"} need care-team confirmation</strong><small>Review photographic evidence before closing the work.</small></span><ArrowRight size={18} /></button>}
    <section className="panel">
      <div className="panel-heading"><div><h2>Recent safety activity</h2><p>The latest tasks and visit updates in your workspace.</p></div></div>
      {dashboard?.recentTasks.length ? <div className="task-rows">{dashboard.recentTasks.map((task) => <TaskRow key={task.id} task={task} onOpen={() => onOpenTask(task)} />)}</div> : <EmptyState icon={<Wrench />} title="No tasks yet" detail="Create a task from a care note to begin." />}
    </section>
  </>;
}

function Metric({ icon, label, value, filter, onOpen, tone = "navy" }: { icon: React.ReactNode; label: string; value: number; filter: TaskFilter; onOpen: (filter: TaskFilter) => void; tone?: string }) {
  return <a className={`metric metric-link metric-${tone}`} href={`/portal?taskFilter=${filter}`} onClick={(event) => { event.preventDefault(); onOpen(filter); }}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div><ArrowRight className="metric-arrow" size={18} /></a>;
}

function AgencyInvoices() {
  const [billing, setBilling] = useState<AgencyInvoiceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadInvoices() {
    setLoading(true);
    setError("");
    try {
      setBilling(await api<AgencyInvoiceDashboard>("/api/coordinator/billing/invoices"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load agency invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadInvoices(); }, []);

  if (loading && !billing) return <Loading />;
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Agency finance</span><h1>Invoices and billing records</h1><p>Review TaskBridge task charges that have been included in care-agency invoice exports.</p></div><button className="button button-secondary" onClick={loadInvoices}><RefreshCw size={16} /> Refresh</button></div>
    {error && <div className="alert alert-danger">{error}<button onClick={loadInvoices}><RefreshCw size={16} /> Retry</button></div>}
    <div className="metric-grid coordinator-metrics">
      <div className="metric metric-blue"><span><FileText /></span><div><strong>{billing?.pending.count || 0}</strong><small>Charges awaiting invoice</small></div></div>
      <div className="metric metric-amber"><span><Clock3 /></span><div><strong>GBP {(billing?.pending.totalAmount || 0).toFixed(2)}</strong><small>Pending uninvoiced value</small></div></div>
      <div className="metric metric-green"><span><CheckCircle2 /></span><div><strong>{billing?.invoices.filter((invoice) => invoice.status === "paid").length || 0}</strong><small>Paid invoices</small></div></div>
      <div className="metric metric-navy"><span><ClipboardList /></span><div><strong>{billing?.invoices.length || 0}</strong><small>Total invoice exports</small></div></div>
    </div>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Agency invoice history</h2><p>CSV exports are generated by TaskBridge administration and made visible here for the agency workspace.</p></div></div>
      <div className="responsive-table"><table><thead><tr><th>Invoice</th><th>Period</th><th>Lines</th><th>Total</th><th>Status</th><th>Export</th></tr></thead><tbody>{billing?.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small>{invoice.issuedAt ? `Issued ${formatDate(invoice.issuedAt, true)}` : "Draft"}</small></td><td><strong>{formatDate(invoice.periodStart)}</strong><small>to {formatDate(invoice.periodEnd)}</small></td><td>{invoice.lineCount}</td><td><strong>{invoice.currency} {invoice.totalAmount.toFixed(2)}</strong></td><td><StatusBadge status={invoice.status}>{humanize(invoice.status)}</StatusBadge>{invoice.paidAt && <small>Paid {formatDate(invoice.paidAt, true)}</small>}</td><td><a className="button button-secondary button-small" href={`/api/coordinator/billing/invoices/${invoice.id}/export.csv`}>CSV</a></td></tr>)}</tbody></table></div>
      {!billing?.invoices.length && <EmptyState icon={<FileText />} title="No invoices yet" detail="TaskBridge admin invoice exports will appear here once created for your agency." />}
    </section>
  </>;
}

function ServiceUserDirectory({ serviceUsers, onChanged }: { serviceUsers: ServiceUser[]; onChanged: () => Promise<void> }) {
  const emptyForm = { fullName: "", address: "", town: "", county: "", postcode: "", riskLevel: "standard" as ServiceUser["riskLevel"], vulnerabilityNotes: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function edit(serviceUser: ServiceUser) {
    setEditingId(serviceUser.id);
    setForm({
      fullName: serviceUser.name,
      address: serviceUser.address,
      town: serviceUser.town,
      county: serviceUser.county,
      postcode: serviceUser.postcode,
      riskLevel: serviceUser.riskLevel,
      vulnerabilityNotes: serviceUser.vulnerabilityNotes
    });
    setError("");
    setSuccess("");
  }

  function reset() {
    setEditingId("");
    setForm(emptyForm);
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const path = editingId ? `/api/coordinator/service-users/${editingId}` : "/api/coordinator/service-users";
      const result = await api<{ serviceUser: ServiceUser }>(path, { method: editingId ? "PATCH" : "POST", body: JSON.stringify(form) });
      setSuccess(`${result.serviceUser.name} was ${editingId ? "updated" : "added"} securely.`);
      setEditingId("");
      setForm(emptyForm);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the service-user record");
    } finally {
      setSaving(false);
    }
  }

  async function remove(serviceUser: ServiceUser) {
    if (!window.confirm(`Remove ${serviceUser.name} from the active service-user directory?`)) return;
    setError("");
    try {
      await api(`/api/coordinator/service-users/${serviceUser.id}`, { method: "DELETE" });
      if (editingId === serviceUser.id) reset();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove the service user");
    }
  }

  return <>
    <div className="page-title-row"><div><span className="eyebrow">Secure people directory</span><h1>Service users</h1><p>Maintain the people, addresses and safeguarding controls used for home-safety work.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Encrypted at rest</span></div>
    <div className="resident-layout">
      <section className="panel resident-register">
        <div className="panel-heading"><div><h2>Service-user directory</h2><p>{serviceUsers.length} active record{serviceUsers.length === 1 ? "" : "s"}, organised by town and county.</p></div></div>
        {serviceUsers.length ? <div className="resident-list">{serviceUsers.map((serviceUser) => <article className="resident-record service-user-record" key={serviceUser.id}>
          <span className="resident-avatar">{initials(serviceUser.name)}</span>
          <div className="resident-record-main"><div><h3>{serviceUser.name}</h3><StatusBadge status={serviceUser.riskLevel === "standard" ? "active" : serviceUser.riskLevel === "high_risk" ? "failed" : "pending"}>{humanize(serviceUser.riskLevel)}</StatusBadge></div><p><MapPin size={14} /> {formatAddress(serviceUser)}</p><small>{serviceUser.reference} / Added {formatDate(serviceUser.createdAt)}</small></div>
          <div className="record-actions"><button className="icon-button" onClick={() => edit(serviceUser)} aria-label={`Edit ${serviceUser.name}`} title="Edit service user"><Pencil size={17} /></button><button className="icon-button danger-icon" onClick={() => remove(serviceUser)} aria-label={`Delete ${serviceUser.name}`} title="Delete service user"><Trash2 size={17} /></button></div>
        </article>)}</div> : <EmptyState icon={<UsersRound />} title="No service users registered" detail="Add the first service user to make them available for task creation." />}
      </section>
      <aside className="resident-create-panel">
        <div className="resident-create-heading"><span>{editingId ? <Pencil size={21} /> : <UserPlus size={21} />}</span><div><h2>{editingId ? "Edit service user" : "Add a service user"}</h2><p>The record is limited to your agency workspace.</p></div></div>
        <form className="stack" onSubmit={save}>
          <label>Service-user full name<input required minLength={2} maxLength={160} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} autoComplete="off" /></label>
          <label>Street address<textarea required minLength={5} maxLength={500} rows={3} value={form.address} onChange={(event) => update("address", event.target.value)} autoComplete="street-address" /></label>
          <div className="field-row"><label>Town<input required minLength={2} maxLength={120} value={form.town} onChange={(event) => update("town", event.target.value)} autoComplete="address-level2" /></label><label>County<input required minLength={2} maxLength={120} value={form.county} onChange={(event) => update("county", event.target.value)} autoComplete="address-level1" /></label></div>
          <label>Postcode<input required minLength={5} maxLength={12} value={form.postcode} onChange={(event) => update("postcode", event.target.value.toUpperCase())} autoComplete="postal-code" /></label>
          <label>Safeguarding status<select value={form.riskLevel} onChange={(event) => update("riskLevel", event.target.value as ServiceUser["riskLevel"])}><option value="standard">Standard</option><option value="vulnerable_adult">Vulnerable adult</option><option value="high_risk">High risk</option></select></label>
          {form.riskLevel !== "standard" && <label>Safeguarding notes<textarea maxLength={2000} rows={3} value={form.vulnerabilityNotes} onChange={(event) => update("vulnerabilityNotes", event.target.value)} placeholder="Record only information needed to apply the correct visit controls." /></label>}
          <div className="resident-privacy-note"><ShieldAlert size={18} /><p>Identity, address and safeguarding details are encrypted and are never sent to handyman marketplaces.</p></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="form-success" role="status">{success}</p>}
          <div className="form-actions">{editingId && <button className="button button-secondary" type="button" onClick={reset}>Cancel</button>}<button className="button button-primary" disabled={saving} type="submit">{saving ? <><LoaderCircle className="spin" size={18} /> Saving...</> : editingId ? <><Pencil size={17} /> Update service user</> : <><UserPlus size={18} /> Add service user</>}</button></div>
        </form>
      </aside>
    </div>
  </>;
}

function TaskIntake({ serviceUsers, onCreated }: { serviceUsers: ServiceUser[]; onCreated: () => Promise<void> }) {
  const [serviceUserId, setServiceUserId] = useState(serviceUsers[0]?.id || "");
  const [note, setNote] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [carerOnSite, setCarerOnSite] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [vulnerable, setVulnerable] = useState(false);
  const [keysafeInfo, setKeysafeInfo] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [review, setReview] = useState({ fullName: "", address: "", town: "", county: "", postcode: "" });
  const [paymentRoute, setPaymentRoute] = useState<PaymentRoute>("agency");
  const [familyPayer, setFamilyPayer] = useState({ name: "", email: "", phone: "" });
  const [funding, setFunding] = useState({ reference: "", notes: "" });
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const selected = serviceUsers.find((item) => item.id === serviceUserId) || serviceUsers[0];
    if (selected && selected.id !== serviceUserId) setServiceUserId(selected.id);
    if (selected) setReview({ fullName: selected.name, address: selected.address, town: selected.town, county: selected.county, postcode: selected.postcode });
  }, [serviceUserId, serviceUsers]);

  async function plan(event: FormEvent) {
    event.preventDefault();
    setPlanning(true);
    setError("");
    try {
      const result = await api<{ suggestions: TaskSuggestion[]; vulnerableAdult: boolean; keysafeInfo: string | null; safeguardingWarnings: string[] }>("/api/coordinator/task-plan", {
        method: "POST",
        body: JSON.stringify({ serviceUserId, note })
      });
      setSuggestions(result.suggestions);
      setVulnerable(result.vulnerableAdult);
      setKeysafeInfo(result.keysafeInfo || "");
      setWarnings(result.safeguardingWarnings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to evaluate the care note");
    } finally {
      setPlanning(false);
    }
  }

  async function approve() {
    setSaving(true);
    setError("");
    try {
      if (paymentRoute === "family_representative" && (!familyPayer.name.trim() || !familyPayer.email.trim())) {
        throw new Error("Add the family or representative payer name and email before approving.");
      }
      if (paymentRoute === "council_personal_budget" && !funding.reference.trim()) {
        throw new Error("Add the council, personal budget or funding reference before approving.");
      }
      await api("/api/coordinator/tasks", {
        method: "POST",
        body: JSON.stringify({
          serviceUserId,
          serviceUser: review,
          note,
          keysafeInfo: keysafeInfo || null,
          carerOnSite,
          preferredWindowStart: start ? new Date(start).toISOString() : null,
          preferredWindowEnd: end ? new Date(end).toISOString() : null,
          paymentRoute: paymentRoute === "agency"
            ? { route: "agency" }
            : paymentRoute === "family_representative"
              ? { route: "family_representative", payerName: familyPayer.name, payerEmail: familyPayer.email, payerPhone: familyPayer.phone || null }
              : { route: "council_personal_budget", fundingReference: funding.reference, fundingNotes: funding.notes || null },
          suggestions: suggestions.map(({ category, summary, urgency }) => ({ category, summary, urgency }))
        })
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to approve the tasks");
    } finally {
      setSaving(false);
    }
  }

  function updateReview(field: keyof typeof review, value: string) {
    setReview((current) => ({ ...current, [field]: value }));
  }

  return <div className="intake-layout coordinator-intake">
    <section>
      <div className="page-title-row compact"><div><span className="eyebrow">AI-assisted safety intake</span><h1>Translate a care note into clear work.</h1><p>Evaluate the note, review each task and approve only when the details are right.</p></div></div>
      <form className="panel intake-form stack" onSubmit={plan}>
        <label>Service user<select required value={serviceUserId} onChange={(event) => { setServiceUserId(event.target.value); setSuggestions([]); }}><option value="" disabled>Select service user</option>{serviceUsers.map((item) => <option key={item.id} value={item.id}>{item.name} / {humanize(item.riskLevel)}</option>)}</select></label>
        <label>Care note<textarea required minLength={10} rows={9} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Paste the daily care note. Include every home hazard, preferred timing, keysafe information and whether a carer will be present." /><small className="field-hint">Multiple hazards are separated into individual tasks for your review.</small></label>
        <label className="toggle-row"><input type="checkbox" checked={carerOnSite} onChange={(event) => setCarerOnSite(event.target.checked)} /><span><strong>Carer will be on site</strong><small>This supports visit coordination and never bypasses Enhanced DBS controls.</small></span></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary" disabled={planning || !serviceUserId} type="submit">{planning ? <><LoaderCircle className="spin" size={18} /> Evaluating care note...</> : <><Sparkles size={18} /> Evaluate care note</>}</button>
      </form>
    </section>
    <aside className="suggestion-panel intake-review-panel">
      <div className="suggestion-heading"><span className="process-icon"><Sparkles /></span><div><h2>Structured safety review</h2><p>All fields remain under care-team control before approval.</p></div></div>
      {suggestions.length ? <>
        {vulnerable && <div className="safeguard-note"><ShieldCheck size={20} /><div><strong>Safeguarding controls apply</strong><span>Enhanced DBS and verified insurance are mandatory for assignment.</span></div></div>}
        {warnings.length > 0 && <div className="warning-list">{warnings.map((warning) => <p key={warning}><ShieldAlert size={16} /> {warning}</p>)}</div>}
        <section className="review-fields"><h3>Service-user and visit details</h3><div className="field-row"><label>Service-user name<input value={review.fullName} onChange={(event) => updateReview("fullName", event.target.value)} /></label><label>Postcode<input value={review.postcode} onChange={(event) => updateReview("postcode", event.target.value.toUpperCase())} /></label></div><label>Full street address<textarea rows={2} value={review.address} onChange={(event) => updateReview("address", event.target.value)} /></label><div className="field-row"><label>Town<input value={review.town} onChange={(event) => updateReview("town", event.target.value)} /></label><label>County<input value={review.county} onChange={(event) => updateReview("county", event.target.value)} /></label></div><div className="field-row"><label>Visit window start<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Visit window end<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div><label>Extracted keysafe information<div className="input-with-icon"><KeyRound size={16} /><input value={keysafeInfo} onChange={(event) => setKeysafeInfo(event.target.value)} placeholder="No keysafe code identified" /></div><small className="field-hint">Encrypted separately and visible only to authorised care users.</small></label></section>
        <section className="payment-route-panel">
          <h3>Payment route</h3>
          <p>Choose how this work should be funded before TaskBridge releases it for assignment.</p>
          <div className="payment-route-options">
            <button type="button" className={paymentRoute === "agency" ? "active" : ""} onClick={() => setPaymentRoute("agency")}><FileText size={17} /><span><strong>Agency pays</strong><small>Included in agency invoice controls.</small></span></button>
            <button type="button" className={paymentRoute === "family_representative" ? "active" : ""} onClick={() => setPaymentRoute("family_representative")}><CreditCard size={17} /><span><strong>Family or representative pays</strong><small>Admin clears payment before dispatch.</small></span></button>
            <button type="button" className={paymentRoute === "council_personal_budget" ? "active" : ""} onClick={() => setPaymentRoute("council_personal_budget")}><Landmark size={17} /><span><strong>Council / funded support</strong><small>Funding approval is checked first.</small></span></button>
          </div>
          {paymentRoute === "family_representative" && <div className="payment-detail-grid"><label>Payer name<input value={familyPayer.name} onChange={(event) => setFamilyPayer((current) => ({ ...current, name: event.target.value }))} placeholder="Family member or representative" /></label><label>Payer email<input type="email" value={familyPayer.email} onChange={(event) => setFamilyPayer((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" /></label><label>Payer phone<input value={familyPayer.phone} onChange={(event) => setFamilyPayer((current) => ({ ...current, phone: event.target.value }))} placeholder="+44..." /></label></div>}
          {paymentRoute === "council_personal_budget" && <div className="payment-detail-grid"><label>Funding reference<input value={funding.reference} onChange={(event) => setFunding((current) => ({ ...current, reference: event.target.value }))} placeholder="Council PO, direct payment or personal budget ref" /></label><label>Funding notes<textarea rows={2} value={funding.notes} onChange={(event) => setFunding((current) => ({ ...current, notes: event.target.value }))} placeholder="Any funding authorisation note" /></label></div>}
        </section>
        <div className="suggestion-list">{suggestions.map((suggestion, index) => <article className="suggestion-card" key={`${suggestion.category}-${index}`}>
          <div className="suggestion-top"><span>Task {index + 1}</span><button className="icon-button" type="button" onClick={() => setSuggestions(suggestions.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove suggestion"><Trash2 size={17} /></button></div>
          <label>Suggested category<input value={suggestion.category} onChange={(event) => setSuggestions(suggestions.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value } : item))} /></label>
          <label>Clear task summary<textarea rows={3} value={suggestion.summary} onChange={(event) => setSuggestions(suggestions.map((item, itemIndex) => itemIndex === index ? { ...item, summary: event.target.value } : item))} /></label>
          <label>Urgency level<select value={suggestion.urgency} onChange={(event) => setSuggestions(suggestions.map((item, itemIndex) => itemIndex === index ? { ...item, urgency: event.target.value as TaskSuggestion["urgency"] } : item))}><option value="low">Routine</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        </article>)}</div>
        <button className="button button-primary button-full" disabled={saving || !suggestions.length} onClick={approve}>{saving ? <><LoaderCircle className="spin" size={17} /> Approving...</> : <>Approve {suggestions.length} task{suggestions.length > 1 ? "s" : ""} <ArrowRight size={18} /></>}</button>
      </> : <EmptyState icon={<FileText />} title="Evaluation appears here" detail="Select a service user, paste the care note and choose Evaluate care note." />}
    </aside>
  </div>;
}

interface RotaPlan {
  enabled: boolean;
  summary: {
    caregivers: number;
    calls: number;
    assignedCalls: number;
    unassignedCalls: number;
    estimatedTravelMinutes: number;
    estimatedMinutesSaved: number;
    riskWarnings: number;
    totalCareMinutes: number;
    idleMinutes: number;
    averageUtilisationPercent: number;
    routeEfficiencyScore: number;
    continuityMatches: number;
    longTravelAlerts: number;
    estimatedCostSavingPounds: number;
    careHoursRecovered: number;
    optimisationGoal: string;
    ownerValue: string;
  };
  schedules: Array<{
    caregiverId: string;
    caregiverName: string;
    available: string;
    calls: Array<{
      serviceUserName: string;
      reference: string;
      postcode: string;
      window: string;
      arrive: string;
      leave: string;
      travelMinutes: number;
      waitMinutes: number;
      durationMinutes: number;
      priority: string;
      riskLevel: string;
      continuityMatched: boolean;
      continuityCaregiver: string;
      warnings: string[];
    }>;
    assignedMinutes: number;
    travelMinutes: number;
    workingMinutes: number;
    idleMinutes: number;
    utilisationPercent: number;
    routeEfficiencyScore: number;
    riskLoad: number;
    warnings: string[];
  }>;
  unassigned: Array<{ serviceUserName: string; reference: string; reason: string }>;
  recommendations: string[];
  method: string;
}

function RotaPlannerDashboard({ serviceUsers }: { serviceUsers: ServiceUser[] }) {
  const [branchPostcode, setBranchPostcode] = useState(serviceUsers[0]?.postcode || "");
  const [optimisationGoal, setOptimisationGoal] = useState("balanced");
  const [targetUtilisationPercent, setTargetUtilisationPercent] = useState(82);
  const [maxTravelMinutesBetweenCalls, setMaxTravelMinutesBetweenCalls] = useState(35);
  const [caregivers, setCaregivers] = useState([{ name: "Morning carer", startPostcode: serviceUsers[0]?.postcode || "", availableFrom: "08:00", availableTo: "14:00", skills: "personal care, medication" }]);
  const [calls, setCalls] = useState([
    { serviceUserId: serviceUsers[0]?.id || "", earliest: "09:00", latest: "11:00", durationMinutes: 30, priority: "medium", requiredSkill: "personal care" }
  ]);
  const [continuity, setContinuity] = useState<Array<{ serviceUserId: string; preferredCaregiverName: string }>>([]);
  const [plan, setPlan] = useState<RotaPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setPlan(null); setLocked(false);
    try {
      const result = await api<RotaPlan>("/api/coordinator/rota-planner/plan", {
        method: "POST",
        body: JSON.stringify({
          branchPostcode,
          optimisationGoal,
          targetUtilisationPercent,
          maxTravelMinutesBetweenCalls,
          caregivers,
          calls: calls.filter((call) => call.serviceUserId),
          continuity: continuity.filter((item) => item.serviceUserId && item.preferredCaregiverName.trim())
        })
      });
      setPlan(result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to generate rota plan";
      setLocked(message.toLowerCase().includes("not unlocked"));
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function updateCaregiver(index: number, key: keyof typeof caregivers[number], value: string) {
    setCaregivers((current) => current.map((caregiver, itemIndex) => itemIndex === index ? { ...caregiver, [key]: value } : caregiver));
  }

  function updateCall(index: number, key: keyof typeof calls[number], value: string | number) {
    setCalls((current) => current.map((call, itemIndex) => itemIndex === index ? { ...call, [key]: value } : call));
  }

  function updateContinuity(index: number, key: keyof typeof continuity[number], value: string) {
    setContinuity((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  if (locked) return <section className="panel analytics-locked">
    <span><Navigation size={30} /></span>
    <h1>Premium AI rota planner is locked for this agency</h1>
    <p>This low-budget route optimisation module can be unlocked by a TaskBridge super admin from Agency onboarding settings.</p>
  </section>;

  return <form className="rota-planner-page" onSubmit={generatePlan}>
    <div className="page-title-row"><div><span className="eyebrow">Premium rota intelligence</span><h1>AI rota planner</h1><p>Arrange calls by proximity, time windows and care risk to reduce travel time before the coordinator approves the rota.</p></div><button className="button button-primary" disabled={loading || !serviceUsers.length} type="submit">{loading ? <><LoaderCircle className="spin" size={17} /> Planning...</> : <><Sparkles size={17} /> Generate route plan</>}</button></div>
    {error && !locked && <div className="alert alert-danger">{error}</div>}
    <section className="panel rota-premium-hero">
      <div><span className="eyebrow">Workforce value cockpit</span><h2>Plan safer visits while proving travel, capacity and continuity gains.</h2><p>TaskBridge turns the day list into a coordinator-ready rota with route efficiency, care hours recovered, long-travel alerts and continuity checks before the rota is approved.</p></div>
      <div className="rota-owner-value">
        <strong>{plan ? `${plan.summary.routeEfficiencyScore}%` : "Ready"}</strong>
        <span>{plan ? "Route efficiency" : "Premium planner"}</span>
        <small>{plan?.summary.ownerValue || "Generate a plan to see the care-owner value in pounds, hours and risk controls."}</small>
      </div>
    </section>
    <section className="panel rota-premium-controls">
      <label>Branch postcode<input value={branchPostcode} onChange={(event) => setBranchPostcode(event.target.value.toUpperCase())} placeholder="PE2 6XU" /></label>
      <label>Optimisation goal<select value={optimisationGoal} onChange={(event) => setOptimisationGoal(event.target.value)}><option value="balanced">Balanced rota</option><option value="minimise_travel">Minimise travel</option><option value="protect_continuity">Protect continuity</option><option value="risk_first">High-risk first</option></select></label>
      <label>Target utilisation %<input type="number" min={50} max={95} value={targetUtilisationPercent} onChange={(event) => setTargetUtilisationPercent(Number(event.target.value))} /></label>
      <label>Max travel segment<input type="number" min={5} max={120} value={maxTravelMinutesBetweenCalls} onChange={(event) => setMaxTravelMinutesBetweenCalls(Number(event.target.value))} /></label>
    </section>
    <div className="rota-planner-grid">
      <section className="panel">
        <div className="panel-heading"><div><h2>Caregivers</h2><p>Add the carers available for this planning run.</p></div><button className="button button-secondary button-small" type="button" onClick={() => setCaregivers((current) => [...current, { name: `Carer ${current.length + 1}`, startPostcode: branchPostcode, availableFrom: "08:00", availableTo: "18:00", skills: "" }])}><Plus size={15} /> Add</button></div>
        <div className="rota-input-list">{caregivers.map((caregiver, index) => <article key={index}>
          <label>Name<input value={caregiver.name} onChange={(event) => updateCaregiver(index, "name", event.target.value)} /></label>
          <label>Start postcode<input value={caregiver.startPostcode} onChange={(event) => updateCaregiver(index, "startPostcode", event.target.value.toUpperCase())} /></label>
          <div className="field-row"><label>From<input type="time" value={caregiver.availableFrom} onChange={(event) => updateCaregiver(index, "availableFrom", event.target.value)} /></label><label>To<input type="time" value={caregiver.availableTo} onChange={(event) => updateCaregiver(index, "availableTo", event.target.value)} /></label></div>
          <label>Skills<input value={caregiver.skills} onChange={(event) => updateCaregiver(index, "skills", event.target.value)} placeholder="personal care, medication" /></label>
        </article>)}</div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Calls</h2><p>Select service users and preferred call windows.</p></div><button className="button button-secondary button-small" type="button" onClick={() => setCalls((current) => [...current, { serviceUserId: serviceUsers[0]?.id || "", earliest: "09:00", latest: "12:00", durationMinutes: 30, priority: "routine", requiredSkill: "" }])}><Plus size={15} /> Add</button></div>
        <div className="rota-input-list">{calls.map((call, index) => <article key={index}>
          <label>Service user<select value={call.serviceUserId} onChange={(event) => updateCall(index, "serviceUserId", event.target.value)}><option value="">Select service user</option>{serviceUsers.map((serviceUser) => <option key={serviceUser.id} value={serviceUser.id}>{serviceUser.name} / {serviceUser.postcode}</option>)}</select></label>
          <div className="field-row"><label>Earliest<input type="time" value={call.earliest} onChange={(event) => updateCall(index, "earliest", event.target.value)} /></label><label>Latest<input type="time" value={call.latest} onChange={(event) => updateCall(index, "latest", event.target.value)} /></label></div>
          <div className="field-row"><label>Minutes<input type="number" min={5} max={240} value={call.durationMinutes} onChange={(event) => updateCall(index, "durationMinutes", Number(event.target.value))} /></label><label>Priority<select value={call.priority} onChange={(event) => updateCall(index, "priority", event.target.value)}><option value="routine">Routine</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
          <label>Required skill<input value={call.requiredSkill} onChange={(event) => updateCall(index, "requiredSkill", event.target.value)} placeholder="personal care" /></label>
        </article>)}</div>
      </section>
      <section className="panel rota-continuity-panel">
        <div className="panel-heading"><div><h2>Continuity of care</h2><p>Optional preferences for people who benefit from a familiar caregiver.</p></div><button className="button button-secondary button-small" type="button" onClick={() => setContinuity((current) => [...current, { serviceUserId: serviceUsers[0]?.id || "", preferredCaregiverName: caregivers[0]?.name || "" }])}><Plus size={15} /> Add</button></div>
        <div className="rota-input-list">{continuity.length ? continuity.map((item, index) => <article key={index}>
          <label>Service user<select value={item.serviceUserId} onChange={(event) => updateContinuity(index, "serviceUserId", event.target.value)}><option value="">Select service user</option>{serviceUsers.map((serviceUser) => <option key={serviceUser.id} value={serviceUser.id}>{serviceUser.name} / {serviceUser.reference}</option>)}</select></label>
          <label>Preferred caregiver<select value={item.preferredCaregiverName} onChange={(event) => updateContinuity(index, "preferredCaregiverName", event.target.value)}><option value="">Select caregiver</option>{caregivers.map((caregiver, caregiverIndex) => <option key={`${caregiver.name}-${caregiverIndex}`} value={caregiver.name}>{caregiver.name}</option>)}</select></label>
        </article>) : <p className="muted-copy">Add continuity preferences where familiarity reduces anxiety, refusal risk or safeguarding concern.</p>}</div>
      </section>
    </div>
    {plan && <section className="rota-plan-results">
      <div className="metric-grid coordinator-metrics">
        <div className="metric"><span><Navigation /></span><div><strong>{plan.summary.routeEfficiencyScore}%</strong><small>Route efficiency</small></div></div>
        <div className="metric metric-green"><span><TrendingUp /></span><div><strong>£{plan.summary.estimatedCostSavingPounds}</strong><small>Estimated saving</small></div></div>
        <div className="metric metric-amber"><span><Clock3 /></span><div><strong>{plan.summary.assignedCalls}/{plan.summary.calls}</strong><small>Calls assigned</small></div></div>
        <div className="metric metric-blue"><span><ShieldAlert /></span><div><strong>{plan.summary.careHoursRecovered}</strong><small>Care hours recovered</small></div></div>
      </div>
      <section className="rota-value-grid">
        <article><strong>{plan.summary.averageUtilisationPercent}%</strong><span>Average utilisation</span><p>Target {targetUtilisationPercent}% so managers can protect contingency time.</p></article>
        <article><strong>{plan.summary.estimatedTravelMinutes}</strong><span>Travel minutes</span><p>{plan.summary.estimatedMinutesSaved} minutes saved against manual sequencing.</p></article>
        <article><strong>{plan.summary.continuityMatches}</strong><span>Continuity matches</span><p>Matched preferred caregiver requests where capacity allowed.</p></article>
        <article><strong>{plan.summary.longTravelAlerts}</strong><span>Long travel alerts</span><p>Segments above {maxTravelMinutesBetweenCalls} minutes are flagged before approval.</p></article>
      </section>
      <section className="panel rota-recommendations"><div className="panel-heading"><div><h2>Manager recommendations</h2><p>{plan.method}</p></div><StatusBadge status={plan.summary.riskWarnings || plan.summary.unassignedCalls ? "pending" : "approved"}>{plan.summary.riskWarnings || plan.summary.unassignedCalls ? "Needs review" : "Ready"}</StatusBadge></div>{plan.recommendations.map((recommendation) => <p key={recommendation}><Sparkles size={15} /> {recommendation}</p>)}</section>
      <section className="panel"><div className="panel-heading"><div><h2>Suggested rota</h2><p>Review each caregiver route, utilisation and safeguarding warnings before confirming.</p></div></div><div className="rota-schedule-list">{plan.schedules.map((schedule) => <article key={schedule.caregiverId} className="rota-schedule-card"><header><div><h3>{schedule.caregiverName}</h3><p>{schedule.available} / {schedule.travelMinutes} travel / {schedule.assignedMinutes} care minutes</p></div><StatusBadge status={schedule.warnings.length ? "pending" : "approved"}>{schedule.warnings.length ? "Review" : "Ready"}</StatusBadge></header><div className="rota-efficiency-strip"><span>{schedule.utilisationPercent}% utilisation</span><span>{schedule.routeEfficiencyScore}% efficient</span><span>{schedule.idleMinutes} mins contingency</span><span>{schedule.riskLoad} risk calls</span></div>{schedule.warnings.length > 0 && <div className="rota-schedule-warnings">{schedule.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div>}{schedule.calls.map((call, index) => <div key={`${call.reference}-${index}`} className="rota-call-row"><span>{call.arrive}</span><div><strong>{call.serviceUserName}</strong><p>{call.postcode} / {call.window} / {call.durationMinutes} mins / {humanize(call.priority)} / leaves {call.leave}</p><p>{call.travelMinutes} mins travel{call.waitMinutes ? ` / ${call.waitMinutes} mins waiting` : ""}{call.continuityMatched ? " / continuity matched" : ""}</p>{call.warnings.length > 0 && <small>{call.warnings.join(" · ")}</small>}</div></div>)}{!schedule.calls.length && <p className="muted-copy">No calls assigned to this caregiver.</p>}</article>)}</div>{plan.unassigned.length > 0 && <div className="rota-unassigned">{plan.unassigned.map((call) => <p key={call.reference}><strong>{call.serviceUserName}</strong>: {call.reason}</p>)}</div>}</section>
    </section>}
  </form>;
}

function CareAnalyticsDashboard({ serviceUsers }: { serviceUsers: ServiceUser[] }) {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [analyticsFilter, setAnalyticsFilter] = useState<AnalyticsFilter>("all");
  const [selectedAnalyticsServiceUserId, setSelectedAnalyticsServiceUserId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      setAnalytics(await api<AnalyticsDashboard>("/api/coordinator/analytics"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load care analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAnalytics(); }, []);

  useEffect(() => {
    if (!analytics || selectedAnalyticsServiceUserId === "all") return;
    const selectedStillExists = analytics.serviceUsers.some((serviceUser) => serviceUser.serviceUserId === selectedAnalyticsServiceUserId);
    if (!selectedStillExists) setSelectedAnalyticsServiceUserId("all");
  }, [analytics, selectedAnalyticsServiceUserId]);

  const selectedAnalyticsServiceUsers = useMemo(() => {
    if (!analytics) return [];
    if (selectedAnalyticsServiceUserId === "all") return analytics.serviceUsers;
    return analytics.serviceUsers.filter((serviceUser) => serviceUser.serviceUserId === selectedAnalyticsServiceUserId);
  }, [analytics, selectedAnalyticsServiceUserId]);

  const selectedSummary = useMemo(() => ({
    serviceUsersTracked: selectedAnalyticsServiceUsers.length,
    observations: selectedAnalyticsServiceUsers.reduce((total, serviceUser) => total + serviceUser.metrics.reduce((metricTotal, metric) => metricTotal + metric.points.length, 0), 0),
    deteriorating: selectedAnalyticsServiceUsers.filter((serviceUser) => serviceUser.overallTrend === "deteriorating").length,
    stable: selectedAnalyticsServiceUsers.filter((serviceUser) => serviceUser.overallTrend === "stable").length,
    improving: selectedAnalyticsServiceUsers.filter((serviceUser) => serviceUser.overallTrend === "improving").length
  }), [selectedAnalyticsServiceUsers]);

  const filteredServiceUsers = useMemo(() => {
    if (analyticsFilter === "all" || analyticsFilter === "observations") return selectedAnalyticsServiceUsers;
    return selectedAnalyticsServiceUsers.filter((serviceUser) => serviceUser.overallTrend === analyticsFilter);
  }, [selectedAnalyticsServiceUsers, analyticsFilter]);

  const selectedAnalyticsName = useMemo(() => {
    if (selectedAnalyticsServiceUserId === "all") return "all service users";
    return selectedAnalyticsServiceUsers[0]?.name || "selected service user";
  }, [selectedAnalyticsServiceUserId, selectedAnalyticsServiceUsers]);

  const analyticsScopeCopy = selectedAnalyticsServiceUserId === "all"
    ? "Select a service user to focus the trend dashboard on one person's observations."
    : `Showing analytics for ${selectedAnalyticsName} only.`;

  const analyticsPanelCopy = analyticsFilter === "observations"
    ? `${selectedSummary.observations} imported health observation row${selectedSummary.observations === 1 ? "" : "s"} for ${selectedAnalyticsName}.`
    : `Potential deterioration is highlighted first for ${selectedAnalyticsName}.`;

  const analyticsInsights = useMemo(() => {
    const allMetrics = selectedAnalyticsServiceUsers.flatMap((serviceUser) => serviceUser.metrics.map((metric) => ({
      ...metric,
      serviceUserName: serviceUser.name,
      serviceUserReference: serviceUser.reference,
      latestObservationDate: serviceUser.latestObservationDate
    })));
    const deterioratingMetrics = allMetrics.filter((metric) => metric.trend === "deteriorating");
    const metricTypes = Array.from(new Set(allMetrics.map((metric) => metric.metricType))).sort();
    const latestServiceUser = [...selectedAnalyticsServiceUsers]
      .sort((left, right) => new Date(right.latestObservationDate).getTime() - new Date(left.latestObservationDate).getTime())[0] || null;
    const latestMetric = latestServiceUser?.metrics
      .flatMap((metric) => metric.points.map((point) => ({ ...point, metricType: metric.metricType })))
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0] || null;
    const observationDensity = selectedSummary.serviceUsersTracked
      ? Math.round(selectedSummary.observations / selectedSummary.serviceUsersTracked)
      : 0;
    return {
      deterioratingMetrics,
      metricTypes,
      latestServiceUser,
      latestMetric,
      observationDensity
    };
  }, [selectedAnalyticsServiceUsers, selectedSummary.observations, selectedSummary.serviceUsersTracked]);

  const selectedServiceUserProfile = selectedAnalyticsServiceUserId === "all"
    ? null
    : selectedAnalyticsServiceUsers[0] || null;

  const coordinatorActions = useMemo(() => {
    const actions: Array<{ title: string; detail: string; tone: "red" | "amber" | "green" | "blue" }> = [];
    if (analyticsInsights.deterioratingMetrics.length) {
      actions.push({
        title: "Review deterioration",
        detail: `${analyticsInsights.deterioratingMetrics.length} metric${analyticsInsights.deterioratingMetrics.length === 1 ? "" : "s"} should be checked against recent care notes.`,
        tone: "red"
      });
    }
    if (selectedSummary.observations === 0) {
      actions.push({ title: "Upload observations", detail: "Import a CSV file to activate trend visualisation.", tone: "blue" });
    }
    if (selectedSummary.improving > 0) {
      actions.push({ title: "Capture positive outcomes", detail: `${selectedSummary.improving} service user${selectedSummary.improving === 1 ? "" : "s"} showing improvement can be used for outcome reporting.`, tone: "green" });
    }
    if (analyticsInsights.observationDensity > 0 && analyticsInsights.observationDensity < 3) {
      actions.push({ title: "Add more readings", detail: "Trend confidence improves after three or more observations per metric.", tone: "amber" });
    }
    return actions.length ? actions : [{ title: "No immediate analytics action", detail: "Current imported observations do not show deterioration signals.", tone: "green" }];
  }, [analyticsInsights.deterioratingMetrics.length, analyticsInsights.observationDensity, selectedSummary.improving, selectedSummary.observations]);

  const analyticsUploadCount = analytics?.uploads.length || 0;
  const cqcIntelligence = useMemo(() => {
    const safeScore = selectedSummary.serviceUsersTracked
      ? Math.max(0, Math.round(((selectedSummary.serviceUsersTracked - selectedSummary.deteriorating) / selectedSummary.serviceUsersTracked) * 100))
      : 0;
    const evidenceReadiness = Math.min(100, Math.round((analyticsInsights.observationDensity / 4) * 100));
    const responsiveScore = selectedSummary.observations
      ? Math.max(0, 100 - Math.round((analyticsInsights.deterioratingMetrics.length / Math.max(1, selectedSummary.observations)) * 100))
      : 0;
    const milestones = [
      {
        title: "Safe",
        detail: `${selectedSummary.deteriorating} service user${selectedSummary.deteriorating === 1 ? "" : "s"} currently show deterioration signals.`,
        score: safeScore,
        status: selectedSummary.deteriorating ? "action_needed" : "ready"
      },
      {
        title: "Effective",
        detail: `${analyticsInsights.metricTypes.length} monitored outcome area${analyticsInsights.metricTypes.length === 1 ? "" : "s"} across the selected scope.`,
        score: analyticsInsights.metricTypes.length >= 3 ? 85 : analyticsInsights.metricTypes.length ? 55 : 15,
        status: analyticsInsights.metricTypes.length >= 3 ? "ready" : "building"
      },
      {
        title: "Responsive",
        detail: `${analyticsInsights.deterioratingMetrics.length} deteriorating metric${analyticsInsights.deterioratingMetrics.length === 1 ? "" : "s"} require review evidence.`,
        score: responsiveScore,
        status: analyticsInsights.deterioratingMetrics.length ? "action_needed" : "ready"
      },
      {
        title: "Well-led",
        detail: `${analyticsUploadCount} recent upload${analyticsUploadCount === 1 ? "" : "s"} available for audit traceability.`,
        score: analyticsUploadCount ? 80 : 20,
        status: analyticsUploadCount ? "ready" : "building"
      }
    ];
    return { safeScore, evidenceReadiness, responsiveScore, milestones };
  }, [analyticsInsights.deterioratingMetrics.length, analyticsInsights.metricTypes.length, analyticsInsights.observationDensity, analyticsUploadCount, selectedSummary.deteriorating, selectedSummary.observations, selectedSummary.serviceUsersTracked]);

  function selectAnalyticsServiceUser(value: string) {
    setSelectedAnalyticsServiceUserId(value);
    setAnalyticsFilter("all");
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("csv") as File | null;
    if (!file || file.size === 0) return setError("Choose a CSV file to upload.");
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const csvText = await file.text();
      const result = await api<{ id: string; rowCount: number }>("/api/coordinator/analytics/uploads", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, csvText })
      });
      setSuccess(`${result.rowCount} health observation${result.rowCount === 1 ? "" : "s"} imported.`);
      event.currentTarget.reset();
      await loadAnalytics();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload the CSV file");
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const rows = [
      ["service_user_reference", "date", "metric", "value", "unit", "outcome", "notes"],
      ...serviceUsers.flatMap((serviceUser, index) => {
        const baseRisk = serviceUser.riskLevel === "standard" ? 3 : 6 + index;
        const mobility = serviceUser.riskLevel === "standard" ? 72 : 58 - index;
        return [
          [serviceUser.reference, "2026-06-01", "falls_risk_score", String(baseRisk), "score", "stable", "Baseline observation"],
          [serviceUser.reference, "2026-06-08", "falls_risk_score", String(baseRisk + 1), "score", serviceUser.riskLevel === "standard" ? "stable" : "deteriorating", "Weekly care-note review"],
          [serviceUser.reference, "2026-06-15", "mobility_score", String(mobility), "score", serviceUser.riskLevel === "standard" ? "improving" : "deteriorating", "Coordinator trend sample"]
        ];
      })
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "taskbridge-care-analytics-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCqcPack() {
    const rows = [
      ["TaskBridge Premium Care Intelligence"],
      ["Scope", selectedAnalyticsName],
      ["Generated", new Date().toISOString()],
      [],
      ["CQC area", "Readiness score", "Status", "Evidence note"],
      ...cqcIntelligence.milestones.map((milestone) => [milestone.title, `${milestone.score}%`, humanize(milestone.status), milestone.detail]),
      [],
      ["Service user", "Reference", "Overall trend", "Latest observation", "Metric", "Metric trend", "First", "Latest", "Unit"],
      ...selectedAnalyticsServiceUsers.flatMap((serviceUser) => serviceUser.metrics.map((metric) => [
        serviceUser.name,
        serviceUser.reference,
        humanize(serviceUser.overallTrend),
        serviceUser.latestObservationDate,
        humanize(metric.metricType),
        humanize(metric.trend),
        metric.first ?? "",
        metric.latest ?? "",
        metric.unit
      ]))
    ];
    const csv = rows.map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ""))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "taskbridge-premium-cqc-evidence-pack.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !analytics) return <Loading />;
  if (!analytics?.enabled) return <AnalyticsLocked />;
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Premium care intelligence</span><h1>CQC-ready analytics dashboard</h1><p>Turn service-user observations into deterioration insight, outcome evidence, audit milestones and leadership-ready CQC reporting.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Premium unlocked</span></div>
    {error && <div className="alert alert-danger">{error}<button onClick={loadAnalytics}><RefreshCw size={16} /> Retry</button></div>}
    <section className="panel analytics-premium-hero">
      <div>
        <span className="eyebrow">CQC evidence cockpit</span>
        <h2>Spot risk earlier and show the evidence when inspectors ask.</h2>
        <p>TaskBridge links uploaded observations to CQC-style domains, highlights milestone gaps and gives coordinators a clean audit pack for supervision, provider meetings and quality reviews.</p>
      </div>
      <div className="premium-score-ring" aria-label={`Evidence readiness ${cqcIntelligence.evidenceReadiness}%`}>
        <strong>{cqcIntelligence.evidenceReadiness}%</strong>
        <span>Evidence readiness</span>
      </div>
      <div className="analytics-export-actions">
        <button className="button button-primary" type="button" onClick={downloadCqcPack}><FileText size={17} /> Export analytics pack</button>
        <a className="button button-secondary" href="/api/coordinator/cqc/evidence-pack.csv"><FileText size={17} /> Export task evidence</a>
      </div>
    </section>
    <section className="panel analytics-focus-panel">
      <label>Focus analytics by service user
        <select value={selectedAnalyticsServiceUserId} onChange={(event) => selectAnalyticsServiceUser(event.target.value)}>
          <option value="all">All service users</option>
          {analytics.serviceUsers.map((serviceUser) => <option key={serviceUser.serviceUserId} value={serviceUser.serviceUserId}>{serviceUser.name} / {serviceUser.reference}</option>)}
        </select>
      </label>
      <p>{analyticsScopeCopy}</p>
    </section>
    <div className="metric-grid coordinator-metrics analytics-metrics">
      <AnalyticsMetric icon={<UsersRound />} label="Service users tracked" value={selectedSummary.serviceUsersTracked} tone="blue" filter="all" active={analyticsFilter === "all"} onSelect={setAnalyticsFilter} />
      <AnalyticsMetric icon={<TrendingDown />} label="Showing deterioration" value={selectedSummary.deteriorating} tone="amber" filter="deteriorating" active={analyticsFilter === "deteriorating"} onSelect={setAnalyticsFilter} />
      <AnalyticsMetric icon={<TrendingUp />} label="Improving outcomes" value={selectedSummary.improving} tone="green" filter="improving" active={analyticsFilter === "improving"} onSelect={setAnalyticsFilter} />
      <AnalyticsMetric icon={<Activity />} label="Health observations" value={selectedSummary.observations} tone="navy" filter="observations" active={analyticsFilter === "observations"} onSelect={setAnalyticsFilter} />
    </div>
    <section className="analytics-insight-grid">
      <article className="panel analytics-summary-card">
        <span><Activity size={20} /></span>
        <div><strong>{analyticsInsights.observationDensity}</strong><small>Avg observations per tracked service user</small></div>
      </article>
      <article className="panel analytics-summary-card">
        <span><BarChart3 size={20} /></span>
        <div><strong>{analyticsInsights.metricTypes.length}</strong><small>Metric type{analyticsInsights.metricTypes.length === 1 ? "" : "s"} being monitored</small></div>
      </article>
      <article className="panel analytics-summary-card">
        <span><Clock3 size={20} /></span>
        <div><strong>{analyticsInsights.latestServiceUser ? formatDate(analyticsInsights.latestServiceUser.latestObservationDate) : "No data"}</strong><small>Latest imported observation date</small></div>
      </article>
    </section>
    <section className="panel analytics-owner-value">
      <div>
        <span className="eyebrow">For care owners</span>
        <h2>Turn care records into quality oversight, risk control and evidence.</h2>
        <p>Owners can see where outcomes are improving, where deterioration needs management attention, and what evidence is ready for inspections, family conversations and contract reviews.</p>
      </div>
      <div className="analytics-owner-value-grid">
        <article><span><ShieldCheck size={18} /></span><strong>CQC readiness</strong><p>Keep an exportable trail of observations, actions and evidence without searching through separate notes.</p></article>
        <article><span><TrendingDown size={18} /></span><strong>Earlier risk detection</strong><p>Spot deterioration patterns before they become missed-care, safeguarding or complaint issues.</p></article>
        <article><span><BarChart3 size={18} /></span><strong>Business visibility</strong><p>Compare outcomes by service user and show commissioners or families that risks are being acted on.</p></article>
        <article><span><FileText size={18} /></span><strong>Audit confidence</strong><p>Download practical evidence packs for supervision, provider meetings and internal governance.</p></article>
      </div>
    </section>
    <section className="analytics-cqc-grid">
      {cqcIntelligence.milestones.map((milestone) => <article key={milestone.title} className={`panel cqc-milestone cqc-${milestone.status}`}>
        <div>
          <span>{milestone.status === "ready" ? <CheckCircle2 size={19} /> : milestone.status === "action_needed" ? <ShieldAlert size={19} /> : <CalendarDays size={19} />}</span>
          <strong>{milestone.title}</strong>
        </div>
        <p>{milestone.detail}</p>
        <footer><b>{milestone.score}%</b><small>{humanize(milestone.status)}</small></footer>
      </article>)}
    </section>
    <section className="panel analytics-milestone-board">
      <div className="panel-heading"><div><h2>Quality milestones</h2><p>Evidence prompts care leaders can use in supervision, governance meetings and CQC preparation.</p></div></div>
      <div>
        <article><span><ClipboardList size={18} /></span><strong>Monthly evidence review</strong><p>Confirm each high-risk service user has recent health observations and action notes.</p></article>
        <article><span><TrendingDown size={18} /></span><strong>Deterioration escalation</strong><p>Review deteriorating metrics against care notes, family feedback and recent home-safety tasks.</p></article>
        <article><span><CheckCircle2 size={18} /></span><strong>Outcome confirmation</strong><p>Record where interventions reduce falls risk, improve mobility or support independence.</p></article>
      </div>
    </section>
    <div className="analytics-decision-grid">
      <section className="panel analytics-action-panel">
        <div className="panel-heading"><div><h2>Coordinator action prompts</h2><p>Suggested next steps from the selected analytics scope.</p></div></div>
        <div className="analytics-action-list">
          {coordinatorActions.map((action) => <article key={`${action.title}-${action.detail}`} className={`analytics-action analytics-action-${action.tone}`}>
            <strong>{action.title}</strong>
            <p>{action.detail}</p>
          </article>)}
        </div>
      </section>
      <section className="panel analytics-profile-panel">
        <div className="panel-heading"><div><h2>{selectedServiceUserProfile ? "Selected service-user profile" : "Analytics coverage"}</h2><p>{selectedServiceUserProfile ? "Focused view for one service user." : "Current coverage across all selected service users."}</p></div></div>
        {selectedServiceUserProfile ? <div className="analytics-profile-card">
          <h3>{selectedServiceUserProfile.name}</h3>
          <p>{selectedServiceUserProfile.reference}</p>
          <dl>
            <div><dt>Overall trend</dt><dd>{humanize(selectedServiceUserProfile.overallTrend)}</dd></div>
            <div><dt>Latest observation</dt><dd>{formatDate(selectedServiceUserProfile.latestObservationDate)}</dd></div>
            <div><dt>Metrics</dt><dd>{selectedServiceUserProfile.metrics.length}</dd></div>
            <div><dt>Rows</dt><dd>{selectedServiceUserProfile.metrics.reduce((total, metric) => total + metric.points.length, 0)}</dd></div>
          </dl>
        </div> : <div className="analytics-metric-cloud">
          {analyticsInsights.metricTypes.map((metricType) => <span key={metricType}>{humanize(metricType)}</span>)}
          {!analyticsInsights.metricTypes.length && <p className="muted-copy">No metric types imported yet.</p>}
        </div>}
      </section>
    </div>
    <div className="analytics-layout">
      <section className="panel analytics-panel">
        <div className="panel-heading"><div><h2>{analyticsFilterLabels[analyticsFilter]}</h2><p>{analyticsPanelCopy}</p></div></div>
        <div className="analytics-filter-strip"><span>{filteredServiceUsers.length} service user{filteredServiceUsers.length === 1 ? "" : "s"} shown</span>{analyticsFilter !== "all" && <button type="button" onClick={() => setAnalyticsFilter("all")}>Clear filter</button>}</div>
        <div className="analytics-service-list">{filteredServiceUsers.map((serviceUser) => <article key={serviceUser.serviceUserId} className={`analytics-card trend-${serviceUser.overallTrend}`}>
          <header><div><h3>{serviceUser.name}</h3><p>{serviceUser.reference} / Latest {formatDate(serviceUser.latestObservationDate)}</p></div><StatusBadge status={serviceUser.overallTrend === "deteriorating" ? "failed" : serviceUser.overallTrend === "improving" ? "approved" : "pending"}>{humanize(serviceUser.overallTrend)}</StatusBadge></header>
          <div className="metric-trend-list">{serviceUser.metrics.map((metric) => <MetricTrend key={metric.metricType} metric={metric} />)}</div>
        </article>)}</div>
        {!analytics.serviceUsers.length && <EmptyState icon={<BarChart3 />} title="No analytics data yet" detail="Upload a CSV file to begin health trend visualisation." />}
        {analytics.serviceUsers.length > 0 && !filteredServiceUsers.length && <EmptyState icon={<BarChart3 />} title="No service users match this filter" detail="Choose another analytics card or clear the filter to see all tracked service users." />}
      </section>
      <aside className="analytics-upload-panel">
        <section className="panel">
          <div className="resident-create-heading"><span><UploadCloud size={21} /></span><div><h2>Upload CSV health data</h2><p>Use the exact service-user references from this agency workspace.</p></div></div>
          <button className="button button-secondary button-full" type="button" disabled={!serviceUsers.length} onClick={downloadTemplate}><FileText size={17} /> Download agency CSV template</button>
          <form className="stack" onSubmit={uploadCsv}>
            <label>CSV file<input name="csv" type="file" accept=".csv,text/csv" required /></label>
            <div className="resident-privacy-note"><ShieldAlert size={18} /><p>Rows are agency-scoped. Notes are encrypted at rest and only visible to authorised care users.</p></div>
            {success && <p className="form-success">{success}</p>}
            <button className="button button-primary button-full" disabled={uploading} type="submit">{uploading ? <><LoaderCircle className="spin" size={17} /> Importing...</> : <><UploadCloud size={17} /> Import health CSV</>}</button>
          </form>
        </section>
        <section className="panel uploads-panel">
          <div className="panel-heading"><div><h2>Recent uploads</h2><p>Latest imported health data files.</p></div></div>
          {analytics.uploads.map((upload) => <article key={upload.id}><strong>{upload.fileName}</strong><span>{upload.rowCount} rows / {formatDate(upload.createdAt, true)}</span></article>)}
          {!analytics.uploads.length && <p className="muted-copy">No CSV uploads yet.</p>}
        </section>
        <section className="panel analytics-watchlist-panel">
          <div className="panel-heading"><div><h2>Deterioration watchlist</h2><p>Metrics that may need review before the next visit.</p></div></div>
          {analyticsInsights.deterioratingMetrics.slice(0, 6).map((metric) => <article key={`${metric.serviceUserReference}-${metric.metricType}`}>
            <strong>{metric.serviceUserName}</strong>
            <span>{humanize(metric.metricType)} / {metric.first ?? "n/a"} to {metric.latest ?? "n/a"}{metric.unit ? ` ${metric.unit}` : ""}</span>
          </article>)}
          {!analyticsInsights.deterioratingMetrics.length && <p className="muted-copy">No deterioration metrics in the current view.</p>}
        </section>
      </aside>
    </div>
  </>;
}

function AnalyticsMetric({ icon, label, value, tone, filter, active, onSelect }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
  filter: AnalyticsFilter;
  active: boolean;
  onSelect: (filter: AnalyticsFilter) => void;
}) {
  return <button className={`metric metric-link analytics-filter-card metric-${tone} ${active ? "active" : ""}`} type="button" onClick={() => onSelect(filter)} aria-pressed={active}>
    <span>{icon}</span>
    <div><strong>{value}</strong><small>{label}</small></div>
    <ArrowRight className="metric-arrow" size={18} />
  </button>;
}

function AnalyticsLocked() {
  return <section className="panel analytics-locked">
    <span><BarChart3 size={30} /></span>
    <h1>Premium care intelligence is locked for this agency</h1>
    <p>This premium CQC analytics module can be unlocked by a TaskBridge super admin from Agency onboarding settings.</p>
  </section>;
}

function MetricTrend({ metric }: { metric: AnalyticsDashboard["serviceUsers"][number]["metrics"][number] }) {
  const numeric = metric.points.filter((point) => typeof point.value === "number") as Array<{ date: string; value: number; unit: string; outcome: string; notes: string }>;
  const values = numeric.map((point) => point.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  return <div className="metric-trend">
    <div className="metric-trend-heading"><strong>{humanize(metric.metricType)}</strong><span className={`trend-pill trend-${metric.trend}`}>{humanize(metric.trend)}</span></div>
    <div className="sparkline" aria-label={`${humanize(metric.metricType)} trend`}>
      {numeric.map((point, index) => <i key={`${point.date}-${index}`} style={{ height: `${18 + ((point.value - min) / range) * 52}px` }} title={`${point.date}: ${point.value}${point.unit ? ` ${point.unit}` : ""}`} />)}
      {!numeric.length && <span>No numeric readings</span>}
    </div>
    <footer><span>{metric.first ?? "n/a"}{metric.unit ? ` ${metric.unit}` : ""}</span><ArrowRight size={14} /><span>{metric.latest ?? "n/a"}{metric.unit ? ` ${metric.unit}` : ""}</span></footer>
  </div>;
}

function escapeCsvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

function StatusBoard({ tasks, filter, onFilter, onOpenTask }: { tasks: CoordinatorTask[]; filter: TaskFilter; onFilter: (filter: TaskFilter) => void; onOpenTask: (task: CoordinatorTask) => void }) {
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState("all");
  const filtered = useMemo(() => tasks.filter((task) => {
    const matchesStatus = taskMatchesFilter(task, filter);
    const matchesUrgency = urgency === "all" || task.urgency === urgency;
    const text = `${task.id} ${task.category} ${task.summary} ${task.resident.displayName}`.toLowerCase();
    return matchesStatus && matchesUrgency && text.includes(query.trim().toLowerCase());
  }), [tasks, filter, urgency, query]);
  const columns = [
    { key: "pending", title: "Awaiting assignment", statuses: ["pending_taskbridge_assignment", "assignment_review", "failed_dispatch"] },
    { key: "assigned", title: "Dispatched", statuses: ["dispatched", "visit_scheduled"] },
    { key: "visit", title: "Visit in progress", statuses: ["checked_in", "awaiting_evidence_review"] },
    { key: "verify", title: "Care verification", statuses: ["awaiting_care_confirmation"] },
    { key: "complete", title: "Completed", statuses: ["completed"] }
  ];
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Live task lifecycle</span><h1>Status board</h1><p>Track every approved task from secure assignment through care-team verification.</p></div></div>
    <nav className="task-filter-links" aria-label="Filter tasks by status">{(Object.keys(taskFilterLabels) as TaskFilter[]).map((item) => <a key={item} className={filter === item ? "active" : ""} href={item === "all" ? "/portal" : `/portal?taskFilter=${item}`} aria-current={filter === item ? "page" : undefined} onClick={(event) => { event.preventDefault(); onFilter(item); }}>{taskFilterLabels[item]}<span>{tasks.filter((task) => taskMatchesFilter(task, item)).length}</span></a>)}</nav>
    <div className="board-toolbar"><label className="search-control"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task, service user or reference" /></label><label className="filter-control"><span className="sr-only">Urgency</span><select value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Routine</option></select></label></div>
    <section className="status-board" aria-label="Task status board">{columns.map((column) => {
      const items = filtered.filter((task) => column.statuses.includes(task.status));
      return <div className="board-column" key={column.key}><header><h2>{column.title}</h2><span>{items.length}</span></header><div className="board-column-items">{items.map((task) => <button className="board-task" key={task.id} onClick={() => onOpenTask(task)}><div><span className={`urgency urgency-${task.urgency}`}>{task.urgency === "low" ? "Routine" : humanize(task.urgency)}</span>{task.ringFenceRequired && <ShieldCheck size={16} />}</div><h3>{task.category}</h3><p>{task.summary}</p><small>{task.resident.displayName}</small><footer><span>{task.id}</span><ChevronRight size={15} /></footer></button>)}{!items.length && <div className="board-empty">No matching tasks</div>}</div></div>;
    })}</section>
  </>;
}

function NotificationsHub({ notifications, onOpen }: { notifications: PortalNotification[]; onOpen: (notification: PortalNotification) => void }) {
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Operational alerts</span><h1>Notifications</h1><p>Assignment, arrival, evidence and completion events for your service users.</p></div></div>
    <section className="panel notification-hub">{notifications.length ? notifications.map((notification) => <button key={notification.id} className="notification-row" onClick={() => onOpen(notification)}><span className={`notification-icon notification-${notification.status}`}><BellRing size={18} /></span><div><div><h3>{notification.title}</h3><small>{formatDate(notification.createdAt, true)}</small></div><p>{notification.message}</p><span>{notification.taskId}</span></div><ChevronRight size={18} /></button>) : <EmptyState icon={<BellRing />} title="No notifications yet" detail="Task and visit developments will appear here." />}</section>
  </>;
}

function NotificationDrawer({ notifications, onClose, onOpen, onViewAll }: { notifications: PortalNotification[]; onClose: () => void; onOpen: (item: PortalNotification) => void; onViewAll: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="side-drawer notification-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label="Recent notifications"><header><div><span className="eyebrow">Live updates</span><h2>Notifications</h2></div><button className="icon-button" onClick={onClose} aria-label="Close notifications"><X size={20} /></button></header><div className="drawer-scroll">{notifications.slice(0, 12).map((item) => <button className="drawer-notification" key={item.id} onClick={() => onOpen(item)}><span><BellRing size={16} /></span><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatDate(item.createdAt, true)}</small></div></button>)}{!notifications.length && <EmptyState icon={<BellRing />} title="No recent updates" detail="New task and visit events will appear here." />}</div><footer><button className="button button-secondary button-full" onClick={onViewAll}>View notification history</button></footer></aside></div>;
}

function TaskDetailsDrawer({ task, detail, loading, onClose, onChanged }: { task: CoordinatorTask; detail: TaskDetail | null; loading: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [showKeysafe, setShowKeysafe] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/coordinator/tasks/${task.id}/confirm`, { method: "POST" });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to confirm completion");
      setBusy(false);
    }
  }

  async function reverseAssignment() {
    if (reason.trim().length < 5) return setError("Record a clear reason for requesting reassignment.");
    setBusy(true);
    setError("");
    try {
      await api(`/api/coordinator/tasks/${task.id}/reverse-assignment`, { method: "POST", body: JSON.stringify({ reason }) });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request reassignment");
      setBusy(false);
    }
  }

  const beforePhoto = task.completion?.beforePhotoUrl || detail?.evidence.find((item) => item.type === "before_photo")?.url || null;
  const afterPhoto = task.completion?.afterPhotoUrl || detail?.evidence.find((item) => item.type === "after_photo")?.url || null;
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="side-drawer task-detail-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label={`Task details for ${task.id}`}><header><div><span className="eyebrow">{task.id}</span><h2>{task.category}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close task details"><X size={20} /></button></header><div className="drawer-scroll">
    <div className="drawer-task-heading"><span className="resident-avatar">{task.resident.initials}</span><div><strong>{task.resident.displayName}</strong><p>{task.summary}</p></div><StatusBadge status={task.status}>{humanize(task.status)}</StatusBadge></div>
    {task.ringFenceRequired && <div className="safeguard-note"><ShieldCheck size={20} /><div><strong>Ring-Fence Enforced</strong><span>Enhanced DBS and verified insurance controls apply.</span></div></div>}
    {task.safeguardingRisk && <div className="risk-score-card"><strong>Safeguarding risk {task.safeguardingRisk.score}/100</strong><StatusBadge status={task.safeguardingRisk.band}>{humanize(task.safeguardingRisk.band)}</StatusBadge><p>{task.safeguardingRisk.factors.join(", ") || "Standard controls"}</p></div>}
    <section className="drawer-section payment-summary"><h3><CreditCard size={17} /> Payment route</h3><p><strong>{paymentRouteLabel(task.payment.route)}</strong><br />{humanize(task.payment.status)}</p>{task.payment.payerName && <span className="geo-tag">{task.payment.payerName}{task.payment.payerEmail ? ` / ${task.payment.payerEmail}` : ""}</span>}{task.payment.fundingReference && <span className="geo-tag">{task.payment.fundingReference}</span>}</section>
    {loading ? <Loading /> : detail && <>
      <section className="drawer-section"><h3><MapPin size={17} /> Service-user location</h3><p>{formatDetailedAddress(detail.serviceUserAddress)}</p><span className="geo-tag"><Navigation size={14} /> {detail.location.latitude === null ? "Geolocation not yet recorded" : `${detail.location.latitude.toFixed(5)}, ${detail.location.longitude?.toFixed(5)}`}</span></section>
      <section className="drawer-section secure-keysafe"><h3><KeyRound size={17} /> Secure keysafe record</h3>{detail.keysafePasscode ? <div><code>{showKeysafe ? detail.keysafePasscode : "••••••"}</code><button className="icon-button" onClick={() => setShowKeysafe(!showKeysafe)} aria-label={showKeysafe ? "Hide keysafe code" : "Reveal keysafe code"}>{showKeysafe ? <EyeOff size={18} /> : <Eye size={18} />}</button></div> : <p>No keysafe information was recorded for this task.</p>}</section>
      <section className="drawer-section"><h3><Camera size={17} /> Visit evidence</h3><div className="evidence-grid"><EvidencePhoto label="Before work" url={beforePhoto} /><EvidencePhoto label="After work" url={afterPhoto} /></div>{task.completion?.notes && <p className="completion-notes">{task.completion.notes}</p>}</section>
      <section className="drawer-section"><h3><Clock3 size={17} /> Task timeline</h3><div className="task-timeline">{detail.timeline.map((event) => <article key={event.id}><span></span><div><strong>{humanize(event.status)}</strong><p>{event.reason || "Status updated"}</p><small>{event.actor} / {formatDate(event.createdAt, true)}</small></div></article>)}</div></section>
    </>}
    {task.assignedHandyman && <section className="drawer-section"><h3><UserRoundCheck size={17} /> Assigned handyman</h3><p><strong>{task.assignedHandyman.displayName}</strong><br />{task.assignedHandyman.network || "Verified TaskBridge network"}</p>{task.assignedHandyman.scheduledStart && <span className="geo-tag"><CalendarDays size={14} /> {formatDate(task.assignedHandyman.scheduledStart, true)}</span>}</section>}
    {error && <p className="form-error">{error}</p>}
    {task.status === "awaiting_care_confirmation" && <button className="button button-success button-full" disabled={busy} onClick={confirm}><CheckCircle2 size={17} /> Confirm completed work</button>}
    {task.assignedHandyman && ["dispatched", "visit_scheduled"].includes(task.status) && (reassigning ? <div className="drawer-reassignment"><label>Reason for reassignment<textarea rows={3} minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div><button className="button button-secondary" onClick={() => setReassigning(false)}>Keep assignment</button><button className="button button-primary" disabled={busy} onClick={reverseAssignment}><RotateCcw size={16} /> Return to pending</button></div></div> : <button className="button button-secondary button-full" onClick={() => setReassigning(true)}><RotateCcw size={16} /> Request reassignment</button>)}
  </div></aside></div>;
}

function EvidencePhoto({ label, url }: { label: string; url: string | null }) {
  return <figure className={!url ? "evidence-empty" : ""}>{url ? <img src={url} alt={`${label} evidence`} /> : <span><Camera size={24} /></span>}<figcaption>{label}</figcaption></figure>;
}

function CommandPalette({ onClose, onChoose }: { onClose: () => void; onChoose: (section: string) => void }) {
  const [query, setQuery] = useState("");
  const commands = [
    { section: "overview", label: "Open dashboard", icon: <LayoutDashboard size={18} /> },
    { section: "new-task", label: "Create a safety task", icon: <Sparkles size={18} /> },
    { section: "tasks", label: "Open status board", icon: <ClipboardList size={18} /> },
    { section: "service-users", label: "Manage service users", icon: <UsersRound size={18} /> },
    { section: "analytics", label: "Open care analytics", icon: <BarChart3 size={18} /> },
    { section: "rota-planner", label: "Open AI rota planner", icon: <Navigation size={18} /> },
    { section: "notifications", label: "Review notifications", icon: <BellRing size={18} /> }
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="command-backdrop" onMouseDown={onClose}><section className="command-palette" onMouseDown={(event) => event.stopPropagation()}><label><Command size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace commands" /><button className="icon-button" onClick={onClose} aria-label="Close command palette"><X size={18} /></button></label><div>{commands.map((item) => <button key={item.section} onClick={() => { onChoose(item.section); onClose(); }}>{item.icon}<span>{item.label}</span><ChevronRight size={17} /></button>)}{!commands.length && <p>No matching commands</p>}</div></section></div>;
}

function TaskRow({ task, onOpen }: { task: CoordinatorTask; onOpen: () => void }) {
  return <button className="task-row task-row-button" onClick={onOpen}>
    <span className="resident-avatar">{task.resident.initials}</span>
    <div className="task-main"><div className="task-title-line"><h3>{task.category}</h3>{task.ringFenceRequired && <span className="ring-badge"><ShieldCheck size={14} /> Ring-Fence Enforced</span>}</div><p>{task.summary}</p><small>{task.id} / {task.resident.displayName} / {formatDate(task.createdAt, true)}</small></div>
    <div className="task-assignee">{task.assignedHandyman ? <><UserRoundCheck size={17} /><span><strong>{task.assignedHandyman.displayName}</strong><small>{task.assignedHandyman.network || "Verified network"}</small></span></> : <><Clock3 size={17} /><span><strong>Pending assignment</strong><small>TaskBridge is handling this</small></span></>}</div>
    <div className="task-status"><StatusBadge status={task.status}>{humanize(task.status)}</StatusBadge><span className={`urgency urgency-${task.urgency}`}>{task.urgency === "low" ? "Routine" : humanize(task.urgency)}</span></div>
  </button>;
}

function taskMatchesFilter(task: CoordinatorTask, filter: TaskFilter) {
  if (filter === "all") return true;
  if (filter === "open") return !["completed", "cancelled"].includes(task.status);
  if (filter === "pending") return ["pending_taskbridge_assignment", "assignment_review", "failed_dispatch"].includes(task.status);
  if (filter === "assigned") return ["dispatched", "visit_scheduled", "checked_in", "awaiting_evidence_review"].includes(task.status);
  if (filter === "confirmation") return task.status === "awaiting_care_confirmation";
  return task.status === "completed";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatAddress(serviceUser: ServiceUser) {
  return [serviceUser.address, serviceUser.town, serviceUser.county, serviceUser.postcode].filter(Boolean).join(", ");
}

function formatDetailedAddress(address: TaskDetail["serviceUserAddress"]) {
  return [address.address, address.town, address.county, address.postcode].filter(Boolean).join(", ");
}

function paymentRouteLabel(route: PaymentRoute) {
  if (route === "family_representative") return "Family or representative pays";
  if (route === "council_personal_budget") return "Council / personal budget / funded support";
  return "Agency pays";
}

function Loading() {
  return <div className="app-loading"><LoaderCircle className="spin" /> Loading your workspace...</div>;
}
