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

interface CareOsDashboard {
  enabled: boolean;
  summary?: {
    monitoredServiceUsers: number;
    immediateReview: number;
    reviewToday: number;
    stable: number;
    unresolvedEscalations: number;
    outcomeCompletionRate: number;
  };
  signals?: Array<{
    id: string;
    serviceUserName: string;
    serviceUserReference: string;
    priority: "green" | "amber" | "red";
    domain: string;
    status: string;
    generatedAt: string;
    owner: string;
    reasonSummary: string;
    explanation: string[];
    confidence: string;
    recommendedReview: string;
    nextActionDue: string;
    outcomeRecorded: boolean;
  }>;
  baselines?: Array<{
    serviceUserId: string;
    serviceUserName: string;
    cohort: string;
    baselineConfidence: string;
    usualPattern: string;
    lastRecalculated: string;
  }>;
  governance?: string[];
}

interface AgencyInvoiceDashboard {
  pending: { count: number; totalAmount: number };
  summary: { totalCharges: number; invoicedAmount: number; disputedAmount: number; familyOrFundedAmount: number };
  charges: Array<{
    id: string;
    taskId: string;
    category: string;
    taskStatus: string;
    paymentRoute: PaymentRoute;
    paymentStatus: string;
    handymanName: string | null;
    handymanAmount: number;
    agencyCoordinationFee: number;
    platformFee: number;
    totalAmount: number;
    currency: string;
    status: string;
    settlementStatus: string;
    settlementReference: string | null;
    settlementDueAt: string | null;
    settlementNotes: string | null;
    createdAt: string;
  }>;
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
type CoordinatorSection = "overview" | "new-task" | "tasks" | "service-users" | "analytics" | "care-os" | "rota-planner" | "billing" | "notifications";

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

const coordinatorSections: CoordinatorSection[] = ["overview", "new-task", "tasks", "service-users", "analytics", "care-os", "rota-planner", "billing", "notifications"];

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
      const destinations: Record<string, string> = { d: "overview", c: "new-task", s: "tasks", i: "care-os", r: "rota-planner", n: "notifications" };
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
              : active === "care-os"
                ? <CareOsIntelligenceDashboard />
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
  const [chargeFilter, setChargeFilter] = useState<"awaiting" | "pending-value" | "invoiced" | "all">("awaiting");

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
  const charges = billing?.charges || [];
  const filteredCharges = charges.filter((charge) => {
    if (chargeFilter === "all") return true;
    if (chargeFilter === "awaiting" || chargeFilter === "pending-value") return charge.status === "pending_invoice";
    if (chargeFilter === "invoiced") return charge.status === "invoiced" || charge.status === "paid";
    return true;
  });
  const filterCopy = {
    awaiting: "Charges waiting to be added to an agency invoice.",
    "pending-value": "Uninvoiced task value still waiting for invoice batching.",
    invoiced: "Charges already invoiced or marked as paid.",
    all: "All task charges visible to this care agency."
  }[chargeFilter];
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Agency finance</span><h1>Invoices and billing records</h1><p>Review live task charges, payment routes, settlement status and monthly invoice exports for your agency.</p></div><div className="row-actions"><a className="button button-secondary" href="/api/coordinator/billing/task-charges/export.csv"><FileText size={16} /> Export charges</a><button className="button button-secondary" onClick={loadInvoices}><RefreshCw size={16} /> Refresh</button></div></div>
    {error && <div className="alert alert-danger">{error}<button onClick={loadInvoices}><RefreshCw size={16} /> Retry</button></div>}
    <div className="metric-grid coordinator-metrics">
      <BillingMetric icon={<FileText />} label="Charges awaiting invoice" value={billing?.pending.count || 0} active={chargeFilter === "awaiting"} tone="blue" onClick={() => setChargeFilter("awaiting")} />
      <BillingMetric icon={<Clock3 />} label="Pending uninvoiced value" value={money(billing?.pending.totalAmount || 0)} active={chargeFilter === "pending-value"} tone="amber" onClick={() => setChargeFilter("pending-value")} />
      <BillingMetric icon={<CheckCircle2 />} label="Invoiced or paid value" value={money(billing?.summary.invoicedAmount || 0)} active={chargeFilter === "invoiced"} tone="green" onClick={() => setChargeFilter("invoiced")} />
      <BillingMetric icon={<ClipboardList />} label="Total task charges" value={billing?.summary.totalCharges || 0} active={chargeFilter === "all"} tone="navy" onClick={() => setChargeFilter("all")} />
    </div>
    <section className="panel billing-explainer">
      <div><Landmark size={20} /><span><strong>Agency invoice</strong><small>Included in monthly invoice exports after TaskBridge admin creates the invoice batch.</small></span></div>
      <div><CreditCard size={20} /><span><strong>Family or funded route</strong><small>Shown here for visibility, but dispatch depends on payment or funding clearance.</small></span></div>
      <div><ShieldCheck size={20} /><span><strong>Payout protection</strong><small>Handyman payout remains linked to care-team completion confirmation and dispute holds.</small></span></div>
    </section>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Task charge ledger</h2><p>{filterCopy}</p></div><button className="button button-secondary button-small" onClick={() => setChargeFilter("all")}>Show all</button></div>
      <div className="responsive-table"><table><thead><tr><th>Task</th><th>Payment route</th><th>Amounts</th><th>Settlement</th><th>Handyman</th></tr></thead><tbody>{filteredCharges.map((charge) => <tr key={charge.id}><td><strong>{charge.taskId}</strong><small>{charge.category} / {humanize(charge.taskStatus)} / {formatDate(charge.createdAt, true)}</small></td><td><strong>{paymentRouteLabel(charge.paymentRoute)}</strong><small>{humanize(charge.paymentStatus)}</small></td><td><strong>{money(charge.totalAmount, charge.currency)}</strong><small>Work {money(charge.handymanAmount, charge.currency)} / Coordination {money(charge.agencyCoordinationFee, charge.currency)} / Platform {money(charge.platformFee, charge.currency)}</small></td><td><StatusBadge status={charge.settlementStatus}>{humanize(charge.settlementStatus)}</StatusBadge>{charge.settlementReference && <small>{charge.settlementReference}</small>}{charge.settlementDueAt && <small>Due {formatDate(charge.settlementDueAt)}</small>}</td><td><strong>{charge.handymanName || "Not recorded"}</strong>{charge.settlementNotes && <small>{charge.settlementNotes}</small>}</td></tr>)}</tbody></table></div>
      {!filteredCharges.length && <EmptyState icon={<FileText />} title="No matching task charges" detail="Choose a different billing summary card or wait for TaskBridge admin to dispatch approved work." />}
    </section>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Agency invoice history</h2><p>CSV exports are generated by TaskBridge administration and made visible here for the agency workspace.</p></div></div>
      <div className="responsive-table"><table><thead><tr><th>Invoice</th><th>Period</th><th>Lines</th><th>Total</th><th>Status</th><th>Export</th></tr></thead><tbody>{billing?.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small>{invoice.issuedAt ? `Issued ${formatDate(invoice.issuedAt, true)}` : "Draft"}</small></td><td><strong>{formatDate(invoice.periodStart)}</strong><small>to {formatDate(invoice.periodEnd)}</small></td><td>{invoice.lineCount}</td><td><strong>{money(invoice.totalAmount, invoice.currency)}</strong></td><td><StatusBadge status={invoice.status}>{humanize(invoice.status)}</StatusBadge>{invoice.paidAt && <small>Paid {formatDate(invoice.paidAt, true)}</small>}</td><td><a className="button button-secondary button-small" href={`/api/coordinator/billing/invoices/${invoice.id}/export.csv`}>CSV</a></td></tr>)}</tbody></table></div>
      {!billing?.invoices.length && <EmptyState icon={<FileText />} title="No invoices yet" detail="TaskBridge admin invoice exports will appear here once created for your agency." />}
    </section>
  </>;
}

function BillingMetric({ icon, label, value, active, onClick, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; active: boolean; onClick: () => void; tone: string }) {
  return <button type="button" className={`metric metric-link billing-metric metric-${tone}${active ? " active" : ""}`} onClick={onClick}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div><ArrowRight className="metric-arrow" size={18} /></button>;
}

function ServiceUserDirectory({ serviceUsers, onChanged }: { serviceUsers: ServiceUser[]; onChanged: () => Promise<void> }) {
  const emptyForm = { fullName: "", address: "", town: "", county: "", postcode: "", riskLevel: "standard" as ServiceUser["riskLevel"], vulnerabilityNotes: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
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

  function downloadTemplate() {
    window.location.assign("/api/coordinator/service-users/template.csv");
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("serviceUserCsv");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a populated service-user CSV file.");
      setSuccess("");
      return;
    }
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const csvText = await file.text();
      const result = await api<{ imported: number; skipped: number; errors: string[]; duplicateReferences: string[] }>("/api/coordinator/service-users/import", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, csvText })
      });
      const skippedCopy = result.skipped ? ` ${result.skipped} row${result.skipped === 1 ? " was" : "s were"} skipped.` : "";
      const duplicateCopy = result.duplicateReferences.length ? ` Duplicate references: ${result.duplicateReferences.slice(0, 5).join(", ")}.` : "";
      setSuccess(`${result.imported} service user${result.imported === 1 ? "" : "s"} imported securely.${skippedCopy}${duplicateCopy}`);
      if (result.errors.length) setError(result.errors.slice(0, 3).join(" "));
      event.currentTarget.reset();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import the service-user CSV");
    } finally {
      setImporting(false);
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
        <div className="service-user-import-panel">
          <button className="button button-secondary button-full" type="button" onClick={downloadTemplate}><FileText size={17} /> Download CSV template</button>
          <form className="stack" onSubmit={importCsv}>
            <label>Upload populated CSV<input name="serviceUserCsv" type="file" accept=".csv,text/csv" /></label>
            <button className="button button-primary button-full" disabled={importing} type="submit">{importing ? <><LoaderCircle className="spin" size={17} /> Importing...</> : <><UploadCloud size={17} /> Import service users</>}</button>
          </form>
        </div>
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
        <label>Care note<textarea required minLength={10} rows={9} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Paste the daily care note. Include every home hazard, preferred timing and whether a carer will be present." /><small className="field-hint">Multiple hazards are separated into individual tasks. Key-safe/access details are entered by the coordinator below when needed.</small></label>
        <label className="toggle-row"><input type="checkbox" checked={carerOnSite} onChange={(event) => setCarerOnSite(event.target.checked)} /><span><strong>Carer will be on site</strong><small>This enables the supervised-visit route for vulnerable-adult work.</small></span></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary" disabled={planning || !serviceUserId} type="submit">{planning ? <><LoaderCircle className="spin" size={18} /> Evaluating care note...</> : <><Sparkles size={18} /> Evaluate care note</>}</button>
      </form>
    </section>
    <aside className="suggestion-panel intake-review-panel">
      <div className="suggestion-heading"><span className="process-icon"><Sparkles /></span><div><h2>Structured safety review</h2><p>All fields remain under care-team control before approval.</p></div></div>
      {suggestions.length ? <>
        {vulnerable && <div className="safeguard-note"><ShieldCheck size={20} /><div><strong>Safeguarding controls apply</strong><span>DBS, insurance and supervision rules are checked before assignment.</span></div></div>}
        {warnings.length > 0 && <div className="warning-list">{warnings.map((warning) => <p key={warning}><ShieldAlert size={16} /> {warning}</p>)}</div>}
        <section className="review-fields"><h3>Service-user and visit details</h3><div className="field-row"><label>Service-user name<input value={review.fullName} onChange={(event) => updateReview("fullName", event.target.value)} /></label><label>Postcode<input value={review.postcode} onChange={(event) => updateReview("postcode", event.target.value.toUpperCase())} /></label></div><label>Full street address<textarea rows={2} value={review.address} onChange={(event) => updateReview("address", event.target.value)} /></label><div className="field-row"><label>Town<input value={review.town} onChange={(event) => updateReview("town", event.target.value)} /></label><label>County<input value={review.county} onChange={(event) => updateReview("county", event.target.value)} /></label></div><div className="field-row"><label>Visit window start<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Visit window end<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div><label>Coordinator-entered building access / key-safe instructions<div className="input-with-icon"><KeyRound size={16} /><input value={keysafeInfo} onChange={(event) => setKeysafeInfo(event.target.value)} placeholder="Enter only if needed, for example: Key safe by rear porch. Code 4182." /></div><small className="field-hint">Not extracted from caregiver notes. Encrypted separately and shown only in the authorised visit workflow.</small></label></section>
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

interface RotaCaregiver {
  id: string;
  name: string;
  startPostcode: string;
  availableFrom: string;
  availableTo: string;
  skills: string;
  createdAt?: string;
}

function CareOsIntelligenceDashboard() {
  const [dashboard, setDashboard] = useState<CareOsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [layer, setLayer] = useState("signals");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("48h");

  async function loadCareOs() {
    setLoading(true); setError("");
    try {
      setDashboard(await api<CareOsDashboard>("/api/coordinator/care-os/dashboard"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load CareOS Intelligence");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCareOs(); }, []);

  if (loading) return <div className="app-loading"><LoaderCircle className="spin" /> Loading CareOS Intelligence...</div>;
  if (!dashboard?.enabled) return <section className="panel analytics-locked">
    <span><Sparkles size={30} /></span>
    <h1>CareOS Intelligence is locked for this agency</h1>
    <p>This AI-supported care coordination and deterioration review layer must be unlocked by TaskBridge. Please contact TaskBridge Admin for support.</p>
  </section>;

  const signals = dashboard.signals || [];
  const domains = Array.from(new Set(signals.map((signal) => signal.domain)));
  const filteredSignals = signals.filter((signal) => (priorityFilter === "all" || signal.priority === priorityFilter) && (domainFilter === "all" || signal.domain === domainFilter));
  const layers = [
    { key: "signals", label: "Signal queue", detail: `${filteredSignals.length} visible`, icon: ShieldAlert },
    { key: "baselines", label: "Baselines", detail: `${dashboard.baselines?.length || 0} profiles`, icon: TrendingUp },
    { key: "workflow", label: "Escalation workflow", detail: "Human review", icon: ClipboardList },
    { key: "outcomes", label: "Actions and outcomes", detail: `${dashboard.summary?.outcomeCompletionRate || 0}% complete`, icon: CheckCircle2 },
    { key: "governance", label: "Governance", detail: "UK care controls", icon: ShieldCheck }
  ];

  return <div className="careos-page">
    <section className="careos-hero">
      <div><span className="eyebrow">CareOS Intelligence</span><h1>AI-supported care coordination and deterioration review.</h1><p>CareOS sits above TaskBridge care records to highlight possible changes, explain the evidence, and keep every important signal tied to a human decision and outcome.</p></div>
      <aside><strong>{dashboard.summary?.immediateReview || 0}</strong><span>Immediate reviews</span><small>This is not diagnosis or autonomous care decision-making.</small></aside>
    </section>
    {error && <div className="alert alert-danger">{error}<button onClick={loadCareOs}><RefreshCw size={16} /> Retry</button></div>}
    <section className="careos-metrics">
      <div><strong>{dashboard.summary?.monitoredServiceUsers || 0}</strong><span>Monitored service users</span></div>
      <div><strong>{dashboard.summary?.reviewToday || 0}</strong><span>Review today</span></div>
      <div><strong>{dashboard.summary?.stable || 0}</strong><span>Stable baseline</span></div>
      <div><strong>{dashboard.summary?.unresolvedEscalations || 0}</strong><span>Open escalations</span></div>
      <div><strong>{dashboard.summary?.outcomeCompletionRate || 0}%</strong><span>Outcome recorded</span></div>
    </section>
    <section className="careos-workspace">
      <aside className="careos-layer-menu">
        <label>CareOS layer<select value={layer} onChange={(event) => setLayer(event.target.value)}>{layers.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        {layers.map((item) => {
          const Icon = item.icon;
          return <button key={item.key} className={layer === item.key ? "active" : ""} onClick={() => setLayer(item.key)}><Icon size={18} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>;
        })}
      </aside>
      <main className="careos-layer-content">
        {layer === "signals" && <><div className="careos-toolbar"><label>Priority<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="red">Red</option><option value="amber">Amber</option><option value="green">Green</option></select></label><label>Risk domain<select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}><option value="all">All domains</option>{domains.map((domain) => <option key={domain} value={domain}>{humanize(domain)}</option>)}</select></label><label>Period<select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}><option value="24h">Last 24 hours</option><option value="48h">Last 48 hours</option><option value="7d">Last 7 days</option><option value="all">Full period</option></select></label></div><div className="careos-signal-list">{filteredSignals.map((signal) => <article key={signal.id} className={`careos-signal careos-${signal.priority}`}><header><div><span>{signal.priority.toUpperCase()}</span><h3>{signal.serviceUserName}</h3><p>{signal.reasonSummary}</p></div><StatusBadge status={signal.status}>{humanize(signal.status)}</StatusBadge></header><dl><div><dt>Domain</dt><dd>{humanize(signal.domain)}</dd></div><div><dt>Review</dt><dd>{signal.recommendedReview}</dd></div><div><dt>Owner</dt><dd>{signal.owner}</dd></div><div><dt>Confidence</dt><dd>{humanize(signal.confidence)}</dd></div></dl><ul>{signal.explanation.map((item) => <li key={item}>{item}</li>)}</ul><footer><button className="button button-secondary button-small">Acknowledge</button><button className="button button-secondary button-small">Escalate</button><button className="button button-primary button-small">Record outcome</button></footer></article>)}</div>{!filteredSignals.length && <EmptyState icon={<ShieldCheck />} title="No signals in this view" detail="Adjust the filters or import more care observations." />}</>}
        {layer === "baselines" && <div className="careos-card-grid">{(dashboard.baselines || []).map((baseline) => <article key={baseline.serviceUserId}><h3>{baseline.serviceUserName}</h3><p>{baseline.usualPattern}</p><dl><div><dt>Risk cohort</dt><dd>{humanize(baseline.cohort)}</dd></div><div><dt>Confidence</dt><dd>{humanize(baseline.baselineConfidence)}</dd></div><div><dt>Last recalculated</dt><dd>{formatDate(baseline.lastRecalculated)}</dd></div></dl></article>)}</div>}
        {layer === "workflow" && <div className="careos-flow">{["Ingest note or observation", "Extract structured observations", "Compare against personal baseline", "Generate explainable signal", "Human reviewer decides action", "Record outcome and learning"].map((step, index) => <article key={step}><span>{index + 1}</span><strong>{step}</strong><small>{index < 4 ? "System support" : "Human-in-the-loop control"}</small></article>)}</div>}
        {layer === "outcomes" && <div className="careos-card-grid">{filteredSignals.slice(0, 6).map((signal) => <article key={signal.id}><h3>{signal.serviceUserName}</h3><p>{signal.outcomeRecorded ? "Outcome recorded from TaskBridge workflow evidence." : "Outcome required before this signal can be closed."}</p><dl><div><dt>Decision</dt><dd>{signal.outcomeRecorded ? "Valid concern / action completed" : "Awaiting reviewer decision"}</dd></div><div><dt>Follow-up</dt><dd>{signal.nextActionDue}</dd></div></dl></article>)}</div>}
        {layer === "governance" && <div className="careos-governance">{(dashboard.governance || []).map((item) => <article key={item}><ShieldCheck size={18} /><p>{item}</p></article>)}<article><FileText size={18} /><p>Evidence pack areas: DPIA, DCB0129/DCB0160 readiness, audit logs, data minimisation, access review and safeguarding escalation evidence.</p></article></div>}
      </main>
    </section>
  </div>;
}

function RotaPlannerDashboard({ serviceUsers }: { serviceUsers: ServiceUser[] }) {
  const [branchPostcode, setBranchPostcode] = useState(serviceUsers[0]?.postcode || "");
  const [optimisationGoal, setOptimisationGoal] = useState("balanced");
  const [targetUtilisationPercent, setTargetUtilisationPercent] = useState(82);
  const [maxTravelMinutesBetweenCalls, setMaxTravelMinutesBetweenCalls] = useState(35);
  const [rosterView, setRosterView] = useState("day");
  const [rosterFilter, setRosterFilter] = useState("all");
  const [activeRotaPage, setActiveRotaPage] = useState("carers");
  const [activeRotaStep, setActiveRotaStep] = useState("caregivers");
  const [activeRotaLayer, setActiveRotaLayer] = useState("manual-board");
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(30);
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({});
  const [caregivers, setCaregivers] = useState<RotaCaregiver[]>([]);
  const [draftCaregiver, setDraftCaregiver] = useState({ name: "", startPostcode: serviceUsers[0]?.postcode || "", availableFrom: "08:00", availableTo: "18:00", skills: "" });
  const [editingCaregiverIndex, setEditingCaregiverIndex] = useState<number | null>(null);
  const [calls, setCalls] = useState([
    { serviceUserId: serviceUsers[0]?.id || "", earliest: "09:00", latest: "11:00", durationMinutes: 30, priority: "medium", requiredSkill: "personal care", carersRequired: 1 }
  ]);
  const [continuity, setContinuity] = useState<Array<{ serviceUserId: string; preferredCaregiverName: string }>>([]);
  const [plan, setPlan] = useState<RotaPlan | null>(null);
  const [publishedRotaAt, setPublishedRotaAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [caregiverSaving, setCaregiverSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  async function loadRotaCaregivers() {
    try {
      const result = await api<{ caregivers: RotaCaregiver[] }>("/api/coordinator/rota-planner/caregivers");
      setCaregivers(result.caregivers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load saved carers");
    }
  }

  useEffect(() => { void loadRotaCaregivers(); }, []);

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
          calls: calls.filter((call) => call.serviceUserId).map(({ carersRequired: _carersRequired, ...call }) => call),
          continuity: continuity.filter((item) => item.serviceUserId && item.preferredCaregiverName.trim())
        })
      });
      setPlan(result);
      setActiveRotaStep("review");
      setActiveRotaPage("review");
      window.setTimeout(() => document.getElementById("rota-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to generate rota plan";
      setLocked(message.toLowerCase().includes("not unlocked"));
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function updateDraftCaregiver(key: keyof typeof draftCaregiver, value: string) {
    setDraftCaregiver((current) => ({ ...current, [key]: value }));
  }

  function resetDraftCaregiver() {
    setDraftCaregiver({ name: "", startPostcode: branchPostcode || serviceUsers[0]?.postcode || "", availableFrom: "08:00", availableTo: "18:00", skills: "" });
    setEditingCaregiverIndex(null);
  }

  async function saveDraftCaregiver() {
    const caregiver = {
      ...draftCaregiver,
      name: draftCaregiver.name.trim() || `Carer ${editingCaregiverIndex === null ? caregivers.length + 1 : editingCaregiverIndex + 1}`,
      startPostcode: draftCaregiver.startPostcode.trim().toUpperCase()
    };
    setCaregiverSaving(true);
    setError("");
    try {
      if (editingCaregiverIndex === null) {
        const result = await api<{ caregiver: RotaCaregiver }>("/api/coordinator/rota-planner/caregivers", { method: "POST", body: JSON.stringify(caregiver) });
        setCaregivers((current) => [...current, result.caregiver]);
      } else {
        const existing = caregivers[editingCaregiverIndex];
        const result = await api<{ caregiver: RotaCaregiver }>(`/api/coordinator/rota-planner/caregivers/${existing.id}`, { method: "PATCH", body: JSON.stringify(caregiver) });
        setCaregivers((current) => current.map((item, index) => index === editingCaregiverIndex ? result.caregiver : item));
      }
      resetDraftCaregiver();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save carer");
    } finally {
      setCaregiverSaving(false);
    }
  }

  function editCaregiver(index: number) {
    const { name, startPostcode, availableFrom, availableTo, skills } = caregivers[index];
    setDraftCaregiver({ name, startPostcode, availableFrom, availableTo, skills });
    setEditingCaregiverIndex(index);
    document.getElementById("rota-caregivers")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteCaregiver(index: number) {
    const caregiver = caregivers[index];
    setCaregiverSaving(true);
    setError("");
    try {
      await api(`/api/coordinator/rota-planner/caregivers/${caregiver.id}`, { method: "DELETE" });
      setCaregivers((current) => current.filter((_, itemIndex) => itemIndex !== index));
      setManualAssignments((current) => Object.fromEntries(Object.entries(current).flatMap(([slotKey, callId]) => {
        const [caregiverIndexValue, timeSlot] = slotKey.split("-");
        const caregiverIndex = Number(caregiverIndexValue);
        if (caregiverIndex === index) return [];
        const nextIndex = caregiverIndex > index ? caregiverIndex - 1 : caregiverIndex;
        return [[`${nextIndex}-${timeSlot}`, callId]];
      })));
      if (editingCaregiverIndex === index) resetDraftCaregiver();
      else if (editingCaregiverIndex !== null && editingCaregiverIndex > index) setEditingCaregiverIndex(editingCaregiverIndex - 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete carer");
    } finally {
      setCaregiverSaving(false);
    }
  }

  function updateCall(index: number, key: keyof typeof calls[number], value: string | number) {
    setCalls((current) => current.map((call, itemIndex) => itemIndex === index ? { ...call, [key]: value } : call));
  }

  function ensureCallForServiceUser(serviceUserId: string) {
    setCalls((current) => current.some((call) => call.serviceUserId === serviceUserId)
      ? current
      : [...current, { serviceUserId, earliest: "06:00", latest: "23:00", durationMinutes: slotIntervalMinutes, priority: "routine", requiredSkill: "", carersRequired: 1 }]);
  }

  function setServiceUserCarerRequirement(serviceUserId: string, carersRequired: number) {
    setCalls((current) => current.some((call) => call.serviceUserId === serviceUserId)
      ? current.map((call) => call.serviceUserId === serviceUserId ? { ...call, carersRequired } : call)
      : [...current, { serviceUserId, earliest: "06:00", latest: "23:00", durationMinutes: slotIntervalMinutes, priority: "routine", requiredSkill: "", carersRequired }]);
  }

  function updateContinuity(index: number, key: keyof typeof continuity[number], value: string) {
    setContinuity((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function assignManualCall(callId: string, caregiverIndex: number, timeSlot: string) {
    const slotKey = `${caregiverIndex}-${timeSlot}`;
    const serviceUserId = callId.replace("manual-call-", "");
    ensureCallForServiceUser(serviceUserId);
    const serviceUser = serviceUsers.find((item) => item.id === serviceUserId);
    const call = manualCallCards.find((item) => item.id === callId) || {
      id: callId,
      sourceIndex: -1,
      serviceUserId,
      serviceUserName: serviceUser?.name || "Service user",
      reference: serviceUser?.reference || "Visit",
      postcode: serviceUser?.postcode || "",
      window: "06:00-23:00",
      durationMinutes: slotIntervalMinutes,
      priority: "routine",
      requiredSkill: "",
      carersRequired: 1
    };
    const carersRequired = call?.carersRequired || 1;
    setManualAssignments((current) => {
      const next = { ...current };
      const existingSlots = Object.entries(next).filter(([, value]) => value === callId).map(([key]) => key);
      delete next[slotKey];
      if (carersRequired <= 1) {
        existingSlots.forEach((key) => { if (key !== slotKey) delete next[key]; });
      } else if (!existingSlots.includes(slotKey) && existingSlots.length >= carersRequired) {
        delete next[existingSlots[0]];
      }
      next[slotKey] = callId;
      return next;
    });
  }

  function clearManualSlot(caregiverIndex: number, timeSlot: string) {
    const slotKey = `${caregiverIndex}-${timeSlot}`;
    setManualAssignments((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== slotKey)));
  }

  function openRotaStep(step: string) {
    setActiveRotaStep(step);
    setActiveRotaPage(step === "review" ? "review" : step === "caregivers" ? "carers" : "planner");
    if (step === "review" && !plan) {
      document.querySelector<HTMLFormElement>(".rota-planner-page")?.requestSubmit();
      return;
    }
    const targetId = step === "caregivers" ? "rota-caregivers"
      : step === "visits" ? "rota-visits"
        : step === "rules" ? "rota-rules" : "rota-review";
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (locked) return <section className="panel analytics-locked">
    <span><Navigation size={30} /></span>
    <h1>Premium AI rota planner is locked for this agency</h1>
    <p>This low-budget route optimisation module can be unlocked by a TaskBridge super admin from Agency onboarding settings.</p>
  </section>;

  const rotaSteps = [
    { key: "caregivers", label: "Add caregivers", detail: `${caregivers.length} available today`, icon: UsersRound },
    { key: "visits", label: "Select visits", detail: `${calls.filter((call) => call.serviceUserId).length} planned calls`, icon: CalendarDays },
    { key: "rules", label: "Set rules", detail: humanize(optimisationGoal), icon: ShieldCheck },
    { key: "review", label: "Review rota", detail: plan ? `${plan.summary.routeEfficiencyScore}% efficient` : "Generate plan", icon: Navigation }
  ];
  const visibleCalls = calls.filter((call) => call.serviceUserId);
  const unallocatedPreview = plan?.unassigned.length
    ? plan.unassigned.map((call) => ({ name: call.serviceUserName, meta: call.reason, priority: "high" }))
    : visibleCalls.map((call) => {
      const serviceUser = serviceUsers.find((item) => item.id === call.serviceUserId);
      return { name: serviceUser?.name || "Unselected service user", meta: `${call.earliest}-${call.latest} / ${call.durationMinutes} mins`, priority: call.priority };
    });
  const boardSchedules = plan?.schedules.length
    ? plan.schedules
    : caregivers.map((caregiver, index) => ({
      caregiverId: `draft-${index}`,
      caregiverName: caregiver.name,
      available: `${caregiver.availableFrom}-${caregiver.availableTo}`,
      travelMinutes: 0,
      assignedMinutes: 0,
      utilisationPercent: 0,
      routeEfficiencyScore: 0,
      riskLoad: 0,
      warnings: [] as string[],
      calls: [] as RotaPlan["schedules"][number]["calls"]
    }));
  const conflictCount = plan ? plan.summary.riskWarnings + plan.summary.unassignedCalls : 0;
  const selectedCalls = calls.filter((call) => call.serviceUserId);
  const totalDraftMinutes = selectedCalls.reduce((total, call) => total + Number(call.durationMinutes || 0), 0);
  const capacityMinutes = caregivers.reduce((total, caregiver) => total + Math.max(minutesFromTimeValue(caregiver.availableTo) - minutesFromTimeValue(caregiver.availableFrom), 0), 0);
  const capacityPercent = capacityMinutes ? Math.min(100, Math.round((totalDraftMinutes / capacityMinutes) * 100)) : 0;
  const highPriorityDraftCalls = selectedCalls.filter((call) => call.priority === "high").length;
  const continuityCoverage = selectedCalls.length ? Math.round((continuity.length / selectedCalls.length) * 100) : 0;
  const manualTimeSlots = Array.from({ length: Math.floor(((23 - 6) * 60) / slotIntervalMinutes) + 1 }, (_, index) => {
    const totalMinutes = 6 * 60 + index * slotIntervalMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  });
  const manualGridStyle = { gridTemplateColumns: `170px repeat(${manualTimeSlots.length}, minmax(${slotIntervalMinutes === 15 ? 56 : slotIntervalMinutes === 30 ? 72 : 96}px, 1fr))` };
  const manualCallCards = selectedCalls.map((call, index) => {
    const serviceUser = serviceUsers.find((item) => item.id === call.serviceUserId);
    return {
      id: `manual-call-${call.serviceUserId}`,
      sourceIndex: index,
      serviceUserId: call.serviceUserId,
      serviceUserName: serviceUser?.name || "Unselected service user",
      reference: serviceUser?.reference || `Visit ${index + 1}`,
      postcode: serviceUser?.postcode || "",
      window: `${call.earliest}-${call.latest}`,
      durationMinutes: call.durationMinutes,
      priority: call.priority,
      requiredSkill: call.requiredSkill,
      carersRequired: Number(call.carersRequired || 1)
    };
  });
  const registeredServiceUserVisitCards = serviceUsers.map((serviceUser) => {
    const configuredCall = selectedCalls.find((call) => call.serviceUserId === serviceUser.id);
    return {
      id: `manual-call-${serviceUser.id}`,
      serviceUserId: serviceUser.id,
      serviceUserName: serviceUser.name,
      reference: serviceUser.reference,
      postcode: serviceUser.postcode,
      window: configuredCall ? `${configuredCall.earliest}-${configuredCall.latest}` : "06:00-23:00",
      durationMinutes: configuredCall?.durationMinutes || slotIntervalMinutes,
      priority: configuredCall?.priority || "routine",
      requiredSkill: configuredCall?.requiredSkill || "",
      carersRequired: Number(configuredCall?.carersRequired || 1)
    };
  });
  const manualAssignedCount = (callId: string) => Object.values(manualAssignments).filter((assignedCallId) => assignedCallId === callId).length;
  const manualUnassignedCalls = manualCallCards.filter((call) => manualAssignedCount(call.id) < call.carersRequired);
  const manualPlacements = Object.entries(manualAssignments).map(([slotKey, callId]) => {
    const [caregiverIndexValue, timeSlot] = slotKey.split("-");
    const caregiverIndex = Number(caregiverIndexValue);
    const call = manualCallCards.find((item) => item.id === callId);
    const caregiver = caregivers[caregiverIndex];
    return call && caregiver ? { slotKey, timeSlot, caregiverIndex, caregiverName: caregiver.name, call } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const groupedManualVisits = manualCallCards.map((call) => {
    const placements = manualPlacements.filter((placement) => placement.call.id === call.id);
    return { call, placements, isReady: placements.length >= call.carersRequired };
  });
  const carerPublishedViews = caregivers.map((caregiver, caregiverIndex) => ({
    caregiver,
    visits: manualPlacements
      .filter((placement) => placement.caregiverIndex === caregiverIndex)
      .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot))
      .map((placement) => ({
        ...placement,
        partners: manualPlacements
          .filter((partner) => partner.call.id === placement.call.id && partner.caregiverIndex !== caregiverIndex)
          .map((partner) => partner.caregiverName)
      }))
  }));
  const rotaPageTabs = [
    { key: "carers", label: "Carers", detail: "Add carers and review call history", icon: UsersRound },
    { key: "planner", label: "Plan slots", detail: "Drag service users into times", icon: CalendarDays },
    { key: "review", label: "Review rota", detail: "Check single and double-up calls", icon: LayoutDashboard },
    { key: "publish", label: "Publish", detail: "Send rota to accounts", icon: CheckCircle2 }
  ];
  const activeRotaLayerLabel = activeRotaLayer === "live-board" ? "Live board"
    : activeRotaLayer === "manual-board" ? "Manual scheduler"
      : activeRotaLayer === "capacity" ? "Capacity"
        : activeRotaLayer === "continuity" ? "Continuity"
          : activeRotaLayer === "conflicts" ? "Conflicts"
            : activeRotaLayer === "approvals" ? "Approvals" : "Evidence";
  const rotaLayers = [
    { key: "live-board", label: "Live board", detail: `${boardSchedules.length} carer runs`, icon: LayoutDashboard },
    { key: "manual-board", label: "Manual scheduler", detail: `${manualUnassignedCalls.length} unplaced`, icon: CalendarDays },
    { key: "capacity", label: "Capacity", detail: `${capacityPercent}% draft use`, icon: Activity },
    { key: "continuity", label: "Continuity", detail: `${continuity.length} preferences`, icon: UserRoundCheck },
    { key: "conflicts", label: "Conflicts", detail: `${conflictCount} to review`, icon: ShieldAlert },
    { key: "approvals", label: "Approvals", detail: plan ? "Plan ready" : "Generate first", icon: CheckCircle2 },
    { key: "evidence", label: "Evidence", detail: "Audit pack", icon: FileText }
  ];
  const rosterTimeLabels = rosterView === "week"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Weekend"]
    : rosterView === "runs"
      ? ["Run 1", "Run 2", "Run 3", "Run 4", "Cover", "Review"]
      : ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  const visibleBoardSchedules = boardSchedules.filter((schedule) => {
    if (rosterFilter === "conflicts") return Boolean(schedule.warnings.length || schedule.riskLoad);
    if (rosterFilter === "unallocated" && plan) return false;
    return true;
  });

  return <form className="rota-planner-page" onSubmit={generatePlan}>
    <section className="rota-planday-hero">
      <div>
        <span className="eyebrow">Premium rota intelligence</span>
        <h1>Build a safer homecare rota in minutes.</h1>
        <p>Plan caregiver visits around proximity, time windows, continuity, skill mix and safeguarding risk before the coordinator approves the day.</p>
        <div className="rota-hero-actions">
          <button className="button button-primary" disabled={loading || !serviceUsers.length} type="submit">{loading ? <><LoaderCircle className="spin" size={17} /> Planning...</> : <><Sparkles size={17} /> Generate route plan</>}</button>
          <span><ShieldCheck size={16} /> Built for care-owner visibility and CQC evidence</span>
        </div>
      </div>
      <aside className="rota-hero-preview">
        <strong>{plan ? `${plan.summary.routeEfficiencyScore}%` : `${calls.length}`}</strong>
        <span>{plan ? "Route efficiency" : "Visits ready to plan"}</span>
        <p>{plan?.summary.ownerValue || "Add caregivers, select service users and generate a practical rota proposal."}</p>
      </aside>
    </section>
    {error && !locked && <div className="alert alert-danger">{error}</div>}
    <section className="rota-page-tabs" aria-label="Rota planner pages">
      {rotaPageTabs.map((page) => {
        const Icon = page.icon;
        return <button key={page.key} type="button" className={activeRotaPage === page.key ? "active" : ""} onClick={() => setActiveRotaPage(page.key)}>
          <Icon size={18} />
          <span><strong>{page.label}</strong><small>{page.detail}</small></span>
        </button>;
      })}
    </section>
    {activeRotaPage === "planner" && <section className="rota-command-centre" aria-label="Rota planner internal menu">
      <aside className="rota-internal-menu">
        <label>Planner layer<select value={activeRotaLayer} onChange={(event) => setActiveRotaLayer(event.target.value)}>{rotaLayers.map((layer) => <option key={layer.key} value={layer.key}>{layer.label}</option>)}</select></label>
        {rotaLayers.map((layer) => {
          const Icon = layer.icon;
          return <button key={layer.key} type="button" className={activeRotaLayer === layer.key ? "active" : ""} onClick={() => setActiveRotaLayer(layer.key)}><Icon size={18} /><span><strong>{layer.label}</strong><small>{layer.detail}</small></span></button>;
        })}
      </aside>
      <main className="rota-layer-stage">
        <div className="rota-layer-heading">
          <div><span className="eyebrow">{activeRotaLayerLabel}</span><h2>{activeRotaLayer === "live-board" ? "Operational rota control" : activeRotaLayer === "manual-board" ? "Drag visits into carer time slots" : activeRotaLayer === "capacity" ? "Capacity and travel planning" : activeRotaLayer === "continuity" ? "Continuity of care" : activeRotaLayer === "conflicts" ? "Risk and conflict review" : activeRotaLayer === "approvals" ? "Approval workflow" : "CQC-ready rota evidence"}</h2></div>
          <button type="submit" className="button button-primary button-small" disabled={loading || !serviceUsers.length}>{loading ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Generate</button>
        </div>
        {activeRotaLayer === "live-board" && <div className="rota-layer-grid">
          <article><LayoutDashboard size={18} /><strong>{selectedCalls.length}</strong><span>Selected visits</span><button type="button" onClick={() => openRotaStep("visits")}>Edit visits <ChevronRight size={15} /></button></article>
          <article><UsersRound size={18} /><strong>{caregivers.length}</strong><span>Available caregivers</span><button type="button" onClick={() => openRotaStep("caregivers")}>Edit team <ChevronRight size={15} /></button></article>
          <article><Navigation size={18} /><strong>{plan ? `${plan.summary.routeEfficiencyScore}%` : humanize(optimisationGoal)}</strong><span>Planning result</span><button type="button" onClick={() => setActiveRotaLayer("approvals")}>Review plan <ChevronRight size={15} /></button></article>
        </div>}
        {activeRotaLayer === "manual-board" && <div className="rota-manual-scheduler">
          <section className="rota-manual-grid" aria-label="Manual rota scheduler">
            <div className="rota-slot-toolbar">
              <div><strong>Place visits</strong><span>06:00-23:00 rota board</span></div>
              <label>Slot size<select value={slotIntervalMinutes} onChange={(event) => {
                setSlotIntervalMinutes(Number(event.target.value));
                setManualAssignments({});
              }}><option value={15}>15 mins</option><option value={30}>30 mins</option><option value={60}>1 hour</option></select></label>
            </div>
            <div className="rota-manual-header" style={manualGridStyle}><span>Carer</span>{manualTimeSlots.map((slot) => <span key={slot}>{slot}</span>)}</div>
            {caregivers.map((caregiver, caregiverIndex) => <div className="rota-manual-row" style={manualGridStyle} key={`${caregiver.name}-${caregiverIndex}`}>
              <div className="rota-manual-carer"><strong>{caregiver.name}</strong><span>{caregiver.availableFrom}-{caregiver.availableTo}</span><small>{caregiver.startPostcode || branchPostcode || "No postcode"}</small></div>
              {manualTimeSlots.map((slot) => {
                const slotKey = `${caregiverIndex}-${slot}`;
                const assignedCall = manualCallCards.find((call) => call.id === manualAssignments[slotKey]) || registeredServiceUserVisitCards.find((call) => call.id === manualAssignments[slotKey]);
                return <div key={slot} className={`rota-manual-slot ${assignedCall ? "filled" : ""} ${assignedCall?.carersRequired === 2 ? "double-up" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                  event.preventDefault();
                  const callId = event.dataTransfer.getData("text/plain");
                  if (callId) assignManualCall(callId, caregiverIndex, slot);
                }}>
                  {assignedCall ? <article draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", assignedCall.id)} className={`rota-slot-card urgency-${assignedCall.priority} ${assignedCall.carersRequired === 2 ? "double-up" : ""}`}>
                    <button type="button" aria-label={`Remove ${assignedCall.serviceUserName} from ${slot}`} onClick={() => clearManualSlot(caregiverIndex, slot)}><X size={13} /></button>
                    <strong>{assignedCall.serviceUserName}</strong>
                    <small>{assignedCall.durationMinutes} mins / {assignedCall.postcode || assignedCall.reference}</small>
                    {assignedCall.carersRequired === 2 && <em>Double-up</em>}
                  </article> : <span>Drop</span>}
                </div>;
              })}
            </div>)}
          </section>
          <aside className="rota-manual-pool">
            <header><strong>Registered service users</strong><span>{manualUnassignedCalls.length} unmet</span></header>
            <div>
              {registeredServiceUserVisitCards.map((call) => <article key={call.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", call.id)} className={`rota-draggable-visit urgency-${call.priority}`}>
                <strong>{call.serviceUserName}</strong>
                <small>{call.window} / {call.durationMinutes} mins{call.requiredSkill ? ` / ${call.requiredSkill}` : ""}</small>
                <label>Requirement<select value={call.carersRequired} onChange={(event) => setServiceUserCarerRequirement(call.serviceUserId, Number(event.target.value))}><option value={1}>1 carer</option><option value={2}>2 carers</option></select></label>
                <span>{call.carersRequired === 2 ? `Double-up: ${manualAssignedCount(call.id)} of 2 carers placed` : `${manualAssignedCount(call.id)} placed`}</span>
              </article>)}
              {!registeredServiceUserVisitCards.length && <p>No service users have been registered yet.</p>}
            </div>
          </aside>
        </div>}
        {activeRotaLayer === "capacity" && <div className="rota-capacity-view">
          <article><strong>{totalDraftMinutes}</strong><span>Draft care minutes</span><p>{capacityMinutes} staff minutes available across this planning run.</p></article>
          <article><strong>{capacityPercent}%</strong><span>Capacity used</span><div className="rota-progress"><span style={{ width: `${capacityPercent}%` }} /></div><p>Target utilisation is {targetUtilisationPercent}%.</p></article>
          <article><strong>{plan ? plan.summary.estimatedTravelMinutes : maxTravelMinutesBetweenCalls}</strong><span>{plan ? "Estimated travel minutes" : "Max travel segment"}</span><p>{plan ? `${plan.summary.estimatedMinutesSaved} minutes saved after sequencing.` : "This limit is applied during route generation."}</p></article>
        </div>}
        {activeRotaLayer === "continuity" && <div className="rota-continuity-view">
          <article><strong>{continuityCoverage}%</strong><span>Draft continuity coverage</span><p>{continuity.length} continuity preference{continuity.length === 1 ? "" : "s"} against {selectedCalls.length || 0} selected visit{selectedCalls.length === 1 ? "" : "s"}.</p><button type="button" onClick={() => openRotaStep("continuity")}>Manage continuity <ChevronRight size={15} /></button></article>
          <div>{continuity.length ? continuity.map((item, index) => {
            const serviceUser = serviceUsers.find((user) => user.id === item.serviceUserId);
            return <p key={`${item.serviceUserId}-${index}`}><UserRoundCheck size={15} /> {serviceUser?.name || "Service user"} should stay with {item.preferredCaregiverName || "preferred caregiver"}</p>;
          }) : <p><UserRoundCheck size={15} /> No continuity rules set yet.</p>}</div>
        </div>}
        {activeRotaLayer === "conflicts" && <div className="rota-conflict-view">
          <article className={conflictCount ? "needs-review" : "ready"}><ShieldAlert size={20} /><strong>{conflictCount}</strong><span>Generated conflicts</span><p>{plan ? "Unassigned calls and risk warnings from the latest plan." : "Generate a plan to calculate conflicts."}</p></article>
          <article><Clock3 size={20} /><strong>{highPriorityDraftCalls}</strong><span>High priority draft visits</span><p>These should remain visible during assignment and route approval.</p></article>
          <article><MapPin size={20} /><strong>{plan ? plan.summary.longTravelAlerts : 0}</strong><span>Long travel alerts</span><p>Segments above the selected travel limit are flagged here.</p></article>
        </div>}
        {activeRotaLayer === "approvals" && <div className="rota-approval-flow">
          {["Generate safe route", "Review warnings", "Confirm continuity", "Approve rota", "Export evidence"].map((step, index) => <article key={step} className={plan || index === 0 ? "active" : ""}><span>{index + 1}</span><strong>{step}</strong><small>{index < 3 ? "Coordinator check" : "Manager control"}</small></article>)}
        </div>}
        {activeRotaLayer === "evidence" && <div className="rota-evidence-view">
          {["Input data captured", "Rules applied", "Warnings explained", "Human approval retained", "Outcome ready for audit"].map((item) => <article key={item}><FileText size={17} /><p>{item}</p></article>)}
        </div>}
      </main>
    </section>}
    {activeRotaPage === "planner" && <section className="rota-how-strip" aria-label="Rota planning steps">
      {rotaSteps.map((step, index) => {
        const Icon = step.icon;
        return <button key={step.label} type="button" className={activeRotaStep === step.key || (plan && index === 3 && activeRotaStep === "review") ? "active" : ""} onClick={() => openRotaStep(step.key)} aria-pressed={activeRotaStep === step.key}><span><Icon size={19} /></span><div><strong>{step.label}</strong><small>{step.detail}</small></div></button>;
      })}
    </section>}
    {activeRotaPage === "review" && <section className="rota-roster-board">
      <div className="rota-board-toolbar">
        <div><span className="eyebrow">Rostering dashboard</span><h2>See every visit, gap and carer run before approval.</h2><p>Built for homecare coordination: unallocated visits, continuity, travel, utilisation and safeguarding conflicts stay visible in one workspace.</p></div>
        <div className="rota-board-controls" aria-label="Rota board controls">
          <button type="button" className={rosterView === "day" ? "active" : ""} onClick={() => setRosterView("day")}>Day</button>
          <button type="button" className={rosterView === "week" ? "active" : ""} onClick={() => setRosterView("week")}>Week</button>
          <button type="button" className={rosterView === "runs" ? "active" : ""} onClick={() => setRosterView("runs")}>Runs</button>
        </div>
      </div>
      <div className="rota-board-action-row">
        <button type="submit" disabled={loading || !serviceUsers.length}><Sparkles size={16} /> Auto-assign safe rota</button>
        <button type="button" onClick={() => setOptimisationGoal("protect_continuity")}><UsersRound size={16} /> Schedule by continuity</button>
        <button type="button" onClick={() => setRosterFilter(rosterFilter === "conflicts" ? "all" : "conflicts")}><ShieldAlert size={16} /> {conflictCount} conflict{conflictCount === 1 ? "" : "s"}</button>
        <button type="button" onClick={() => setRosterFilter(rosterFilter === "unallocated" ? "all" : "unallocated")}><Clock3 size={16} /> {unallocatedPreview.length} unallocated</button>
      </div>
      <div className="rota-unallocated-lane">
        <header><strong>Unallocated visits</strong><span>{unallocatedPreview.length} visit{unallocatedPreview.length === 1 ? "" : "s"} needing allocation or review</span></header>
        <div>
          {unallocatedPreview.slice(0, 8).map((call, index) => <article key={`${call.name}-${index}`} className={`urgency-${call.priority}`}><strong>{call.name}</strong><small>{call.meta}</small></article>)}
          {!unallocatedPreview.length && <article className="rota-empty-visit"><strong>No unallocated visits</strong><small>The generated plan covers all selected calls.</small></article>}
        </div>
      </div>
      <div className="rota-board-grid">
        <div className="rota-time-header"><span>Carer</span>{rosterTimeLabels.map((label) => <span key={label}>{label}</span>)}</div>
        {visibleBoardSchedules.map((schedule) => <div className="rota-board-row" key={schedule.caregiverId}>
            <div className="rota-carer-cell"><strong>{schedule.caregiverName}</strong><span>{schedule.available}</span><small>{schedule.utilisationPercent || 0}% utilised / {schedule.travelMinutes || 0} mins travel</small></div>
            <div className="rota-timeline-cell">
              {schedule.calls.length ? schedule.calls.map((call, index) => <article key={`${call.reference}-${index}`} className={`rota-visit-block urgency-${call.priority}`}>
                <strong>{call.arrive}-{call.leave}</strong>
                <span>{call.serviceUserName}</span>
                <small>{call.travelMinutes} mins travel{call.continuityMatched ? " / continuity" : ""}</small>
              </article>) : <span className="rota-empty-run">No visits assigned yet</span>}
            </div>
          </div>)}
        {!visibleBoardSchedules.length && <div className="rota-board-empty"><strong>No matching carer runs</strong><span>Clear the active board filter or generate a rota with conflicts to review.</span></div>}
      </div>
      <section className="rota-review-summary">
        <header><span className="eyebrow">Manual rota review</span><h2>Single and double-up call display</h2></header>
        <div>{groupedManualVisits.map(({ call, placements, isReady }) => <article key={call.id} className={call.carersRequired === 2 ? "double-up" : "single-call"}>
          <strong>{call.serviceUserName}</strong>
          <span>{call.window} / {call.durationMinutes} mins / {call.carersRequired === 2 ? "Double-up" : "Single call"}</span>
          <p>{placements.length ? placements.map((placement) => `${placement.timeSlot} ${placement.caregiverName}`).join(" + ") : "Not placed yet"}</p>
          <StatusBadge status={isReady ? "approved" : "pending"}>{isReady ? "Ready" : "Needs slot"}</StatusBadge>
        </article>)}</div>
      </section>
    </section>}
    {(activeRotaPage === "carers" || activeRotaPage === "planner") && <div className="rota-planday-layout">
      <section className="rota-builder-panel">
        <div className="rota-section-heading"><span>01</span><div><h2>Build the day plan</h2><p>Use this workspace to capture staff availability, visit windows and safeguarding planning rules.</p></div></div>
        {activeRotaPage === "planner" && <section className="rota-premium-controls" id="rota-rules">
          <label>Branch postcode<input value={branchPostcode} onChange={(event) => setBranchPostcode(event.target.value.toUpperCase())} placeholder="PE2 6XU" /></label>
          <label>Optimisation goal<select value={optimisationGoal} onChange={(event) => setOptimisationGoal(event.target.value)}><option value="balanced">Balanced rota</option><option value="minimise_travel">Minimise travel</option><option value="protect_continuity">Protect continuity</option><option value="risk_first">High-risk first</option></select></label>
          <label>Target utilisation %<input type="number" min={50} max={95} value={targetUtilisationPercent} onChange={(event) => setTargetUtilisationPercent(Number(event.target.value))} /></label>
          <label>Max travel segment<input type="number" min={5} max={120} value={maxTravelMinutesBetweenCalls} onChange={(event) => setMaxTravelMinutesBetweenCalls(Number(event.target.value))} /></label>
        </section>}
        <div className="rota-planner-grid">
          {activeRotaPage === "carers" && <section className="panel" id="rota-caregivers">
            <div className="panel-heading"><div><h2>{editingCaregiverIndex === null ? "Add carer" : "Edit carer"}</h2><p>Use one entry point, then manage carers from the list on the right.</p></div></div>
            <div className="rota-single-carer-form">
              <label>Name<input value={draftCaregiver.name} onChange={(event) => updateDraftCaregiver("name", event.target.value)} placeholder="Carer name" /></label>
              <label>Start postcode<input value={draftCaregiver.startPostcode} onChange={(event) => updateDraftCaregiver("startPostcode", event.target.value.toUpperCase())} placeholder="PE2 6XU" /></label>
              <div className="field-row"><label>From<input type="time" value={draftCaregiver.availableFrom} onChange={(event) => updateDraftCaregiver("availableFrom", event.target.value)} /></label><label>To<input type="time" value={draftCaregiver.availableTo} onChange={(event) => updateDraftCaregiver("availableTo", event.target.value)} /></label></div>
              <label>Skills<input value={draftCaregiver.skills} onChange={(event) => updateDraftCaregiver("skills", event.target.value)} placeholder="personal care, medication" /></label>
              <div className="rota-form-actions">
                <button className="button button-primary" type="button" disabled={caregiverSaving} onClick={saveDraftCaregiver}><Plus size={15} /> {caregiverSaving ? "Saving..." : editingCaregiverIndex === null ? "Add carer" : "Update carer"}</button>
                {editingCaregiverIndex !== null && <button className="button button-secondary" type="button" disabled={caregiverSaving} onClick={resetDraftCaregiver}>Cancel edit</button>}
              </div>
            </div>
          </section>}
          {activeRotaPage === "carers" && <aside className="panel rota-added-carers-panel">
            <div className="panel-heading"><div><h2>Added carers</h2><p>{caregivers.length} carer{caregivers.length === 1 ? "" : "s"} ready for rota planning.</p></div></div>
            <div className="rota-added-carers-list">{caregivers.map((caregiver, index) => {
              const visits = carerPublishedViews[index]?.visits || [];
              return <article key={`${caregiver.name}-${index}`}>
                <span><UsersRound size={16} /></span>
                <div>
                  <strong>{caregiver.name || `Carer ${index + 1}`}</strong>
                  <small>{caregiver.availableFrom}-{caregiver.availableTo} / {caregiver.startPostcode || branchPostcode || "No postcode"}</small>
                  <p>{caregiver.skills || "No skills added yet"}</p>
                  <em>{visits.length} planned call{visits.length === 1 ? "" : "s"}</em>
                  <div className="rota-carer-actions">
                    <button type="button" disabled={caregiverSaving} onClick={() => editCaregiver(index)}><Pencil size={13} /> Edit</button>
                    <button type="button" disabled={caregiverSaving} onClick={() => deleteCaregiver(index)}><Trash2 size={13} /> Delete</button>
                  </div>
                </div>
              </article>;
            })}</div>
          </aside>}
          {activeRotaPage === "carers" && <section className="panel rota-carer-records">
            <div className="panel-heading"><div><h2>Carer call records</h2><p>See today&apos;s calls, previous call context and notes by carer.</p></div></div>
            <div className="rota-carer-directory">{carerPublishedViews.map(({ caregiver, visits }) => <article key={caregiver.name}>
              <header><UsersRound size={17} /><div><strong>{caregiver.name}</strong><span>{caregiver.availableFrom}-{caregiver.availableTo}</span></div></header>
              {visits.length ? visits.map((visit) => <p key={visit.slotKey}><Clock3 size={14} /> {visit.timeSlot}: {visit.call.serviceUserName} {visit.partners.length ? `(partner: ${visit.partners.join(", ")})` : ""}</p>) : <p><Clock3 size={14} /> No calls placed yet.</p>}
              <small>Previous notes will appear here from completed carer visits once rota publishing and visit completion are used.</small>
            </article>)}</div>
          </section>}
          {activeRotaPage === "planner" && <section className="panel" id="rota-visits">
            <div className="panel-heading"><div><h2>Calls</h2><p>Select service users and preferred call windows.</p></div><button className="button button-secondary button-small" type="button" onClick={() => setCalls((current) => [...current, { serviceUserId: serviceUsers[0]?.id || "", earliest: "09:00", latest: "12:00", durationMinutes: 30, priority: "routine", requiredSkill: "", carersRequired: 1 }])}><Plus size={15} /> Add</button></div>
            <div className="rota-input-list">{calls.map((call, index) => <article key={index}>
              <label>Service user<select value={call.serviceUserId} onChange={(event) => updateCall(index, "serviceUserId", event.target.value)}><option value="">Select service user</option>{serviceUsers.map((serviceUser) => <option key={serviceUser.id} value={serviceUser.id}>{serviceUser.name} / {serviceUser.postcode}</option>)}</select></label>
              <div className="field-row"><label>Earliest<input type="time" value={call.earliest} onChange={(event) => updateCall(index, "earliest", event.target.value)} /></label><label>Latest<input type="time" value={call.latest} onChange={(event) => updateCall(index, "latest", event.target.value)} /></label></div>
              <div className="field-row"><label>Minutes<input type="number" min={5} max={240} value={call.durationMinutes} onChange={(event) => updateCall(index, "durationMinutes", Number(event.target.value))} /></label><label>Priority<select value={call.priority} onChange={(event) => updateCall(index, "priority", event.target.value)}><option value="routine">Routine</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
              <label>Call type<select value={String(call.carersRequired || 1)} onChange={(event) => updateCall(index, "carersRequired", Number(event.target.value))}><option value="1">Single call</option><option value="2">Double-up call</option></select></label>
              <label>Required skill<input value={call.requiredSkill} onChange={(event) => updateCall(index, "requiredSkill", event.target.value)} placeholder="personal care" /></label>
            </article>)}</div>
          </section>}
          {activeRotaPage === "planner" && <section className="panel rota-continuity-panel" id="rota-continuity">
            <div className="panel-heading"><div><h2>Continuity of care</h2><p>Optional preferences for people who benefit from a familiar caregiver.</p></div><button className="button button-secondary button-small" type="button" onClick={() => setContinuity((current) => [...current, { serviceUserId: serviceUsers[0]?.id || "", preferredCaregiverName: caregivers[0]?.name || "" }])}><Plus size={15} /> Add</button></div>
            <div className="rota-input-list">{continuity.length ? continuity.map((item, index) => <article key={index}>
              <label>Service user<select value={item.serviceUserId} onChange={(event) => updateContinuity(index, "serviceUserId", event.target.value)}><option value="">Select service user</option>{serviceUsers.map((serviceUser) => <option key={serviceUser.id} value={serviceUser.id}>{serviceUser.name} / {serviceUser.reference}</option>)}</select></label>
              <label>Preferred caregiver<select value={item.preferredCaregiverName} onChange={(event) => updateContinuity(index, "preferredCaregiverName", event.target.value)}><option value="">Select caregiver</option>{caregivers.map((caregiver, caregiverIndex) => <option key={`${caregiver.name}-${caregiverIndex}`} value={caregiver.name}>{caregiver.name}</option>)}</select></label>
            </article>) : <p className="muted-copy">Add continuity preferences where familiarity reduces anxiety, refusal risk or safeguarding concern.</p>}</div>
          </section>}
        </div>
      </section>
      {activeRotaPage === "planner" && <aside className="rota-live-preview">
        <div className="rota-section-heading"><span>02</span><div><h2>Live planning value</h2><p>The proposal updates after you generate the rota.</p></div></div>
        <div className="rota-preview-card">
          <span><Clock3 size={18} /> Planning window</span>
          <strong>{calls[0]?.earliest || "09:00"}-{calls[calls.length - 1]?.latest || "12:00"}</strong>
          <p>{calls.filter((call) => call.serviceUserId).length} calls, {caregivers.length} caregivers, {continuity.length} continuity preference{continuity.length === 1 ? "" : "s"}.</p>
        </div>
        <div className="rota-preview-list">
          <article><span><Navigation size={17} /></span><div><strong>{plan ? `${plan.summary.estimatedTravelMinutes} mins` : `Max ${maxTravelMinutesBetweenCalls} mins`}</strong><p>{plan ? "Estimated travel" : "Travel segment rule"}</p></div></article>
          <article><span><TrendingUp size={17} /></span><div><strong>{plan ? `£${plan.summary.estimatedCostSavingPounds}` : `${targetUtilisationPercent}%`}</strong><p>{plan ? "Estimated saving" : "Target utilisation"}</p></div></article>
          <article><span><ShieldAlert size={17} /></span><div><strong>{plan ? plan.summary.riskWarnings : humanize(optimisationGoal)}</strong><p>{plan ? "Review warnings" : "Optimisation goal"}</p></div></article>
        </div>
      </aside>}
    </div>}
    {activeRotaPage === "publish" && <section className="rota-publish-page">
      <div className="panel-heading"><div><h2>Publish rota</h2><p>Release the reviewed rota to service-user and carer accounts.</p></div><button className="button button-primary" type="button" onClick={() => setPublishedRotaAt(new Date().toISOString())}><CheckCircle2 size={16} /> Publish rota</button></div>
      {publishedRotaAt && <div className="alert alert-success">Rota published at {new Date(publishedRotaAt).toLocaleString()}.</div>}
      <div className="rota-publish-grid">
        <section className="panel"><h3>Service-user account view</h3>{groupedManualVisits.map(({ call, placements }) => <article key={call.id} className={call.carersRequired === 2 ? "double-up" : "single-call"}><strong>{call.serviceUserName}</strong><p>{placements[0]?.timeSlot || call.window}: {placements.length ? placements.map((placement) => placement.caregiverName).join(" and ") : "Awaiting carer assignment"}</p><small>{call.carersRequired === 2 ? "Double-up visit" : "Single-carer visit"}</small></article>)}</section>
        <section className="panel"><h3>Carer account view</h3>{carerPublishedViews.map(({ caregiver, visits }) => <article key={caregiver.name}><strong>{caregiver.name}</strong>{visits.length ? visits.map((visit) => <p key={visit.slotKey}>{visit.timeSlot}: {visit.call.serviceUserName}{visit.partners.length ? ` with ${visit.partners.join(", ")}` : ""}</p>) : <p>No calls assigned.</p>}</article>)}</section>
      </div>
    </section>}
    {activeRotaPage === "review" && plan && <section className="rota-plan-results" id="rota-review">
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

function minutesFromTimeValue(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function CareAnalyticsDashboard({ serviceUsers }: { serviceUsers: ServiceUser[] }) {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [analyticsFilter, setAnalyticsFilter] = useState<AnalyticsFilter>("all");
  const [selectedAnalyticsServiceUserId, setSelectedAnalyticsServiceUserId] = useState("all");
  const [dashboardView, setDashboardView] = useState("overview");
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
    const latestDates = selectedAnalyticsServiceUsers
      .map((serviceUser) => new Date(`${serviceUser.latestObservationDate}T00:00:00Z`).getTime())
      .filter(Number.isFinite);
    const latestDatasetDate = latestDates.length ? new Date(Math.max(...latestDates)) : null;
    const staleBefore = latestDatasetDate ? latestDatasetDate.getTime() - 28 * 24 * 60 * 60 * 1000 : null;
    const serviceUsersWithObservations = new Set(analytics?.serviceUsers.map((serviceUser) => serviceUser.serviceUserId) || []);
    const selectedDirectoryUsers = selectedAnalyticsServiceUserId === "all"
      ? serviceUsers
      : serviceUsers.filter((serviceUser) => serviceUser.id === selectedAnalyticsServiceUserId);
    const missingObservationUsers = selectedDirectoryUsers.filter((serviceUser) => !serviceUsersWithObservations.has(serviceUser.id));
    const highRiskMissingUsers = missingObservationUsers.filter((serviceUser) => serviceUser.riskLevel !== "standard");
    const staleServiceUsers = staleBefore === null ? [] : selectedAnalyticsServiceUsers.filter((serviceUser) => {
      const latest = new Date(`${serviceUser.latestObservationDate}T00:00:00Z`).getTime();
      return Number.isFinite(latest) && latest < staleBefore;
    });
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
      observationDensity,
      latestDatasetDate,
      missingObservationUsers,
      highRiskMissingUsers,
      staleServiceUsers,
      selectedDirectoryUsers,
      coveragePercent: selectedDirectoryUsers.length ? Math.round(((selectedDirectoryUsers.length - missingObservationUsers.length) / selectedDirectoryUsers.length) * 100) : 0
    };
  }, [analytics?.serviceUsers, selectedAnalyticsServiceUserId, selectedAnalyticsServiceUsers, selectedSummary.observations, selectedSummary.serviceUsersTracked, serviceUsers]);

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
    if (analyticsInsights.highRiskMissingUsers.length) {
      actions.push({
        title: "Close high-risk evidence gaps",
        detail: `${analyticsInsights.highRiskMissingUsers.length} vulnerable or high-risk service user${analyticsInsights.highRiskMissingUsers.length === 1 ? "" : "s"} have no imported observations.`,
        tone: "red"
      });
    }
    if (analyticsInsights.staleServiceUsers.length) {
      actions.push({
        title: "Refresh stale observations",
        detail: `${analyticsInsights.staleServiceUsers.length} service user${analyticsInsights.staleServiceUsers.length === 1 ? "" : "s"} have not had observations refreshed within the current 28-day review window.`,
        tone: "amber"
      });
    }
    if (selectedSummary.observations === 0) {
      actions.push({ title: "Upload observations", detail: "Import a CSV file to activate trend visualisation.", tone: "blue" });
    }
    if (analyticsInsights.coveragePercent > 0 && analyticsInsights.coveragePercent < 90) {
      actions.push({ title: "Improve dataset coverage", detail: `${analyticsInsights.coveragePercent}% of service users in this view have imported observations. Aim for at least 90% for stronger governance evidence.`, tone: "amber" });
    }
    if (selectedSummary.improving > 0) {
      actions.push({ title: "Capture positive outcomes", detail: `${selectedSummary.improving} service user${selectedSummary.improving === 1 ? "" : "s"} showing improvement can be used for outcome reporting.`, tone: "green" });
    }
    if (analyticsInsights.observationDensity > 0 && analyticsInsights.observationDensity < 3) {
      actions.push({ title: "Add more readings", detail: "Trend confidence improves after three or more observations per metric.", tone: "amber" });
    }
    return actions.length ? actions : [{ title: "No immediate analytics action", detail: "Current imported observations do not show deterioration signals.", tone: "green" }];
  }, [analyticsInsights.coveragePercent, analyticsInsights.deterioratingMetrics.length, analyticsInsights.highRiskMissingUsers.length, analyticsInsights.observationDensity, analyticsInsights.staleServiceUsers.length, selectedSummary.improving, selectedSummary.observations]);

  const analyticsUploadCount = analytics?.uploads.length || 0;
  const cqcIntelligence = useMemo(() => {
    const safeScore = selectedSummary.serviceUsersTracked
      ? Math.max(0, Math.round(((selectedSummary.serviceUsersTracked - selectedSummary.deteriorating) / selectedSummary.serviceUsersTracked) * 100))
      : 0;
    const densityScore = Math.min(100, Math.round((analyticsInsights.observationDensity / 4) * 100));
    const uploadScore = analyticsUploadCount ? 100 : 0;
    const freshnessScore = selectedSummary.serviceUsersTracked
      ? Math.max(0, Math.round(((selectedSummary.serviceUsersTracked - analyticsInsights.staleServiceUsers.length) / selectedSummary.serviceUsersTracked) * 100))
      : 0;
    const highRiskScore = analyticsInsights.selectedDirectoryUsers.filter((serviceUser) => serviceUser.riskLevel !== "standard").length
      ? Math.max(0, Math.round(((analyticsInsights.selectedDirectoryUsers.filter((serviceUser) => serviceUser.riskLevel !== "standard").length - analyticsInsights.highRiskMissingUsers.length) / Math.max(1, analyticsInsights.selectedDirectoryUsers.filter((serviceUser) => serviceUser.riskLevel !== "standard").length)) * 100))
      : analyticsInsights.coveragePercent;
    const evidenceReadiness = Math.round((densityScore * 0.25) + (analyticsInsights.coveragePercent * 0.25) + (freshnessScore * 0.2) + (highRiskScore * 0.15) + (uploadScore * 0.15));
    const responsiveScore = selectedSummary.observations
      ? Math.max(0, 100 - Math.round((analyticsInsights.deterioratingMetrics.length / Math.max(1, selectedSummary.observations)) * 100))
      : 0;
    const safeAdjustedScore = Math.max(0, safeScore - (analyticsInsights.highRiskMissingUsers.length * 15) - (analyticsInsights.staleServiceUsers.length * 5));
    const caringScore = selectedSummary.serviceUsersTracked
      ? Math.round(((selectedSummary.improving / selectedSummary.serviceUsersTracked) * 45) + (analyticsInsights.metricTypes.length ? 35 : 0) + (analyticsInsights.coveragePercent * 0.2))
      : 0;
    const milestones = [
      {
        title: "Safe",
        detail: `${selectedSummary.deteriorating} deterioration signal${selectedSummary.deteriorating === 1 ? "" : "s"}, ${analyticsInsights.highRiskMissingUsers.length} high-risk evidence gap${analyticsInsights.highRiskMissingUsers.length === 1 ? "" : "s"}.`,
        score: safeAdjustedScore,
        status: selectedSummary.deteriorating || analyticsInsights.highRiskMissingUsers.length ? "action_needed" : "ready"
      },
      {
        title: "Effective",
        detail: `${analyticsInsights.metricTypes.length} outcome area${analyticsInsights.metricTypes.length === 1 ? "" : "s"} monitored, ${analyticsInsights.coveragePercent}% service-user coverage.`,
        score: Math.round(((analyticsInsights.metricTypes.length >= 3 ? 85 : analyticsInsights.metricTypes.length ? 55 : 15) + analyticsInsights.coveragePercent) / 2),
        status: analyticsInsights.metricTypes.length >= 3 && analyticsInsights.coveragePercent >= 90 ? "ready" : "building"
      },
      {
        title: "Caring",
        detail: `${selectedSummary.improving} improving outcome${selectedSummary.improving === 1 ? "" : "s"} and ${analyticsInsights.metricTypes.length} person-centred outcome area${analyticsInsights.metricTypes.length === 1 ? "" : "s"} tracked.`,
        score: Math.min(100, caringScore),
        status: selectedSummary.improving || analyticsInsights.metricTypes.length >= 3 ? "ready" : "building"
      },
      {
        title: "Responsive",
        detail: `${analyticsInsights.deterioratingMetrics.length} deteriorating metric${analyticsInsights.deterioratingMetrics.length === 1 ? "" : "s"} and ${analyticsInsights.staleServiceUsers.length} stale review${analyticsInsights.staleServiceUsers.length === 1 ? "" : "s"} require action evidence.`,
        score: Math.max(0, responsiveScore - (analyticsInsights.staleServiceUsers.length * 8)),
        status: analyticsInsights.deterioratingMetrics.length || analyticsInsights.staleServiceUsers.length ? "action_needed" : "ready"
      },
      {
        title: "Well-led",
        detail: `${analyticsUploadCount} upload${analyticsUploadCount === 1 ? "" : "s"}, ${analyticsInsights.missingObservationUsers.length} missing service-user observation set${analyticsInsights.missingObservationUsers.length === 1 ? "" : "s"}.`,
        score: Math.round(((analyticsUploadCount ? 80 : 20) + analyticsInsights.coveragePercent) / 2),
        status: analyticsUploadCount && analyticsInsights.coveragePercent >= 90 ? "ready" : "building"
      }
    ];
    const readinessFactors = [
      { label: "Observation depth", score: densityScore, detail: `${analyticsInsights.observationDensity} average readings per tracked person` },
      { label: "Directory coverage", score: analyticsInsights.coveragePercent, detail: `${analyticsInsights.missingObservationUsers.length} missing observation set${analyticsInsights.missingObservationUsers.length === 1 ? "" : "s"}` },
      { label: "Freshness", score: freshnessScore, detail: `${analyticsInsights.staleServiceUsers.length} stale review${analyticsInsights.staleServiceUsers.length === 1 ? "" : "s"}` },
      { label: "High-risk coverage", score: highRiskScore, detail: `${analyticsInsights.highRiskMissingUsers.length} vulnerable/high-risk gap${analyticsInsights.highRiskMissingUsers.length === 1 ? "" : "s"}` },
      { label: "Upload traceability", score: uploadScore, detail: `${analyticsUploadCount} imported file${analyticsUploadCount === 1 ? "" : "s"} logged` }
    ];
    const readinessStatus = evidenceReadiness >= 85 ? "Inspection strong" : evidenceReadiness >= 65 ? "Needs targeted evidence" : "Evidence gaps need action";
    return { safeScore, evidenceReadiness, responsiveScore, milestones, readinessFactors, readinessStatus };
  }, [analyticsInsights.coveragePercent, analyticsInsights.deterioratingMetrics.length, analyticsInsights.highRiskMissingUsers.length, analyticsInsights.metricTypes.length, analyticsInsights.missingObservationUsers.length, analyticsInsights.observationDensity, analyticsInsights.selectedDirectoryUsers, analyticsInsights.staleServiceUsers.length, analyticsUploadCount, selectedSummary.deteriorating, selectedSummary.improving, selectedSummary.observations, selectedSummary.serviceUsersTracked]);
  const dashboardViews = [
    { id: "overview", label: "Overview", detail: "Live performance summary" },
    { id: "safe", label: "Safe", detail: "Deterioration and risk" },
    { id: "effective", label: "Effective", detail: "Outcome coverage" },
    { id: "caring", label: "Caring", detail: "Person-centred outcomes" },
    { id: "responsive", label: "Responsive", detail: "Actions needed" },
    { id: "well-led", label: "Well-led", detail: "Audit readiness" }
  ];
  const activeMilestone = cqcIntelligence.milestones.find((milestone) => milestone.title.toLowerCase().replace("-", "") === dashboardView.replace("-", "")) || null;
  const canvasSubtitle = activeMilestone
    ? `${activeMilestone.title}: ${activeMilestone.detail}`
    : "A live care-intelligence canvas for spotting deterioration, proving action and preparing evidence.";
  const inspectionRisks = useMemo(() => {
    const risks: Array<{ title: string; detail: string; owner: string; due: string; severity: "high" | "medium" | "low" }> = [];
    analyticsInsights.highRiskMissingUsers.slice(0, 3).forEach((serviceUser) => risks.push({
      title: `${serviceUser.name} has no observation evidence`,
      detail: `${humanize(serviceUser.riskLevel)} / ${serviceUser.reference}. Import recent observations before the next governance review.`,
      owner: "Care coordinator",
      due: "Next 7 days",
      severity: "high"
    }));
    analyticsInsights.deterioratingMetrics.slice(0, 4).forEach((metric) => risks.push({
      title: `${metric.serviceUserName}: ${humanize(metric.metricType)} deteriorating`,
      detail: `${metric.first ?? "n/a"} to ${metric.latest ?? "n/a"}${metric.unit ? ` ${metric.unit}` : ""}. Check the care note and record follow-up action.`,
      owner: "Registered manager",
      due: "Today",
      severity: "high"
    }));
    analyticsInsights.staleServiceUsers.slice(0, 3).forEach((serviceUser) => risks.push({
      title: `${serviceUser.name} needs refreshed observations`,
      detail: `Latest dataset is ${formatDate(serviceUser.latestObservationDate)}. Refresh within the 28-day evidence window.`,
      owner: "Care coordinator",
      due: "This week",
      severity: "medium"
    }));
    if (!risks.length) {
      risks.push({
        title: "No priority CQC evidence gap in this view",
        detail: "Current observations do not show high-risk missing coverage, deterioration, or stale review prompts.",
        owner: "Quality lead",
        due: "Monitor",
        severity: "low"
      });
    }
    return risks.slice(0, 6);
  }, [analyticsInsights.deterioratingMetrics, analyticsInsights.highRiskMissingUsers, analyticsInsights.staleServiceUsers]);
  const inspectionSummary = useMemo(() => {
    const high = inspectionRisks.filter((risk) => risk.severity === "high").length;
    const medium = inspectionRisks.filter((risk) => risk.severity === "medium").length;
    return {
      high,
      medium,
      label: high ? "High priority" : medium ? "Watchlist active" : "No urgent gaps",
      detail: high ? `${high} high-priority evidence gap${high === 1 ? "" : "s"} need named owner follow-up.` : medium ? `${medium} medium-priority refresh action${medium === 1 ? "" : "s"} should be scheduled.` : "Keep the dataset current and export the pack for governance."
    };
  }, [inspectionRisks]);

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
      ["Dataset assurance"],
      ["Service-user coverage", `${analyticsInsights.coveragePercent}%`],
      ["Missing observation records", analyticsInsights.missingObservationUsers.length],
      ["High-risk evidence gaps", analyticsInsights.highRiskMissingUsers.length],
      ["Stale observation reviews", analyticsInsights.staleServiceUsers.length],
      ["Latest dataset date", analyticsInsights.latestDatasetDate?.toISOString().slice(0, 10) || ""],
      [],
      ["Readiness factor", "Score", "Detail"],
      ...cqcIntelligence.readinessFactors.map((factor) => [factor.label, `${factor.score}%`, factor.detail]),
      [],
      ["Inspection priority register"],
      ["Priority", "Severity", "Owner", "Due", "Detail"],
      ...inspectionRisks.map((risk) => [risk.title, humanize(risk.severity), risk.owner, risk.due, risk.detail]),
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
    link.download = "taskbridge-cqc-care-intelligence-pack.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !analytics) return <Loading />;
  if (!analytics?.enabled) return <AnalyticsLocked />;
  return <>
    <div className="page-title-row analytics-title-row"><div><span className="eyebrow">Included care intelligence</span><h1>CQC-ready analytics dashboard</h1><p>Turn service-user observations into deterioration insight, outcome evidence, audit milestones and leadership-ready CQC reporting.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Included feature</span></div>
    {error && <div className="alert alert-danger">{error}<button onClick={loadAnalytics}><RefreshCw size={16} /> Retry</button></div>}
    <section className="panel analytics-workspace">
      <div className="analytics-toolbar">
        <div>
          <span className="eyebrow">Care intelligence studio</span>
          <h2>Spot risk earlier and show the evidence when inspectors ask.</h2>
          <p>{canvasSubtitle}</p>
        </div>
        <div className="analytics-export-actions">
          <button className="button button-primary" type="button" onClick={downloadCqcPack}><FileText size={17} /> Export analytics pack</button>
          <a className="button button-secondary" href="/api/coordinator/cqc/evidence-pack.csv"><FileText size={17} /> Export task evidence</a>
        </div>
      </div>

      <div className="analytics-dashboard-tabs" role="tablist" aria-label="CQC dashboard views">
        {dashboardViews.map((view) => <button key={view.id} type="button" role="tab" aria-selected={dashboardView === view.id} className={dashboardView === view.id ? "active" : ""} onClick={() => setDashboardView(view.id)}><strong>{view.label}</strong><span>{view.detail}</span></button>)}
      </div>

      <div className="analytics-command-strip">
        <label>Focus service user
          <select value={selectedAnalyticsServiceUserId} onChange={(event) => selectAnalyticsServiceUser(event.target.value)}>
            <option value="all">All service users</option>
            {analytics.serviceUsers.map((serviceUser) => <option key={serviceUser.serviceUserId} value={serviceUser.serviceUserId}>{serviceUser.name} / {serviceUser.reference}</option>)}
          </select>
        </label>
        <span>{analyticsScopeCopy}</span>
        <button className="button button-secondary button-small" type="button" onClick={loadAnalytics}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="analytics-canvas-grid">
        <div className="analytics-main-canvas">
          <div className="analytics-kpi-board">
            <AnalyticsMetric icon={<UsersRound />} label="Service users tracked" value={selectedSummary.serviceUsersTracked} tone="blue" filter="all" active={analyticsFilter === "all"} onSelect={setAnalyticsFilter} />
            <AnalyticsMetric icon={<TrendingDown />} label="Showing deterioration" value={selectedSummary.deteriorating} tone="amber" filter="deteriorating" active={analyticsFilter === "deteriorating"} onSelect={setAnalyticsFilter} />
            <AnalyticsMetric icon={<TrendingUp />} label="Improving outcomes" value={selectedSummary.improving} tone="green" filter="improving" active={analyticsFilter === "improving"} onSelect={setAnalyticsFilter} />
            <AnalyticsMetric icon={<Activity />} label="Health observations" value={selectedSummary.observations} tone="navy" filter="observations" active={analyticsFilter === "observations"} onSelect={setAnalyticsFilter} />
          </div>

          <div className="analytics-visual-grid">
            <article className="analytics-tile analytics-readiness-tile">
              <header><div><span className="eyebrow">Evidence readiness</span><h3>{cqcIntelligence.evidenceReadiness}% ready</h3></div><ShieldCheck size={22} /></header>
              <div className="analytics-readiness-bar"><i style={{ width: `${cqcIntelligence.evidenceReadiness}%` }} /></div>
              <p>Based on observation density, upload activity and CQC-style evidence coverage for {selectedAnalyticsName}.</p>
            </article>
            <article className="analytics-tile">
              <header><div><span className="eyebrow">Outcome mix</span><h3>Trend distribution</h3></div><BarChart3 size={22} /></header>
              <div className="analytics-distribution">
                <span style={{ height: `${Math.max(10, selectedSummary.deteriorating * 28)}px` }}><b>{selectedSummary.deteriorating}</b><small>Deteriorating</small></span>
                <span style={{ height: `${Math.max(10, selectedSummary.stable * 28)}px` }}><b>{selectedSummary.stable}</b><small>Stable</small></span>
                <span style={{ height: `${Math.max(10, selectedSummary.improving * 28)}px` }}><b>{selectedSummary.improving}</b><small>Improving</small></span>
              </div>
            </article>
            <article className="analytics-tile">
              <header><div><span className="eyebrow">Coverage</span><h3>Observation depth</h3></div><Activity size={22} /></header>
              <div className="analytics-depth-number"><strong>{analyticsInsights.observationDensity}</strong><span>avg readings per service user</span></div>
              <p>{analyticsInsights.metricTypes.length} monitored outcome area{analyticsInsights.metricTypes.length === 1 ? "" : "s"} in the selected scope.</p>
            </article>
          </div>

          <section className="analytics-inspection-cockpit">
            <article className="analytics-inspection-summary">
              <span className={`inspection-severity inspection-${inspectionSummary.high ? "high" : inspectionSummary.medium ? "medium" : "low"}`}>{inspectionSummary.label}</span>
              <h3>{cqcIntelligence.readinessStatus}</h3>
              <p>{inspectionSummary.detail}</p>
              <div>
                <strong>{inspectionRisks.length}</strong><small>priority prompt{inspectionRisks.length === 1 ? "" : "s"}</small>
                <strong>{cqcIntelligence.milestones.filter((milestone) => milestone.status === "ready").length}/{cqcIntelligence.milestones.length}</strong><small>CQC themes ready</small>
              </div>
            </article>
            <article className="analytics-readiness-breakdown">
              <header><h3>Readiness breakdown</h3><p>What drives the inspection score.</p></header>
              {cqcIntelligence.readinessFactors.map((factor) => <div key={factor.label} className="readiness-factor">
                <div><strong>{factor.label}</strong><span>{factor.score}%</span></div>
                <i><b style={{ width: `${factor.score}%` }} /></i>
                <p>{factor.detail}</p>
              </div>)}
            </article>
          </section>

          <section className="panel analytics-risk-register">
            <div className="panel-heading"><div><h2>Inspection priority register</h2><p>Named follow-ups for evidence gaps, deterioration and stale review prompts.</p></div></div>
            <div>
              {inspectionRisks.map((risk) => <article key={`${risk.title}-${risk.detail}`} className={`inspection-risk inspection-risk-${risk.severity}`}>
                <span>{risk.severity === "high" ? <ShieldAlert size={18} /> : risk.severity === "medium" ? <Clock3 size={18} /> : <CheckCircle2 size={18} />}</span>
                <div><strong>{risk.title}</strong><p>{risk.detail}</p></div>
                <small>{risk.owner}<b>{risk.due}</b></small>
              </article>)}
            </div>
          </section>

          <section className="analytics-assurance-grid">
            <article>
              <span><UsersRound size={18} /></span>
              <div><strong>{analyticsInsights.coveragePercent}%</strong><small>Directory coverage</small><p>{analyticsInsights.missingObservationUsers.length} service user{analyticsInsights.missingObservationUsers.length === 1 ? "" : "s"} still need observation data.</p></div>
            </article>
            <article>
              <span><ShieldAlert size={18} /></span>
              <div><strong>{analyticsInsights.highRiskMissingUsers.length}</strong><small>High-risk gaps</small><p>Vulnerable or high-risk people without imported observations should be prioritised.</p></div>
            </article>
            <article>
              <span><Clock3 size={18} /></span>
              <div><strong>{analyticsInsights.staleServiceUsers.length}</strong><small>Stale reviews</small><p>Observation records older than the 28-day review window need refreshing.</p></div>
            </article>
            <article>
              <span><CalendarDays size={18} /></span>
              <div><strong>{analyticsInsights.latestDatasetDate ? formatDate(analyticsInsights.latestDatasetDate.toISOString()) : "None"}</strong><small>Latest dataset date</small><p>Use this as the audit anchor for governance and provider review meetings.</p></div>
            </article>
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
        </div>

        <aside className="analytics-right-rail">
          <section className="analytics-owner-card">
            <span className="eyebrow">For care owners</span>
            <h3>Quality oversight without hunting through care notes.</h3>
            <p>Owners can see who is deteriorating, which outcomes are improving and what evidence is ready for inspection, family conversations and contract reviews.</p>
          </section>
          <section className="analytics-action-panel">
            <div className="panel-heading"><div><h2>Action queue</h2><p>Suggested next steps from this view.</p></div></div>
            <div className="analytics-action-list">
              {coordinatorActions.map((action) => <article key={`${action.title}-${action.detail}`} className={`analytics-action analytics-action-${action.tone}`}>
                <strong>{action.title}</strong>
                <p>{action.detail}</p>
              </article>)}
            </div>
          </section>
          <section className="analytics-profile-panel">
            <div className="panel-heading"><div><h2>{selectedServiceUserProfile ? "Selected service user" : "Metric coverage"}</h2><p>{selectedServiceUserProfile ? "Focused view for one person." : "Current dataset coverage."}</p></div></div>
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
        </aside>
      </div>
    </section>
    <section className="panel analytics-milestone-board">
      <div className="panel-heading"><div><h2>Quality milestones</h2><p>Evidence prompts care leaders can use in supervision, governance meetings and CQC preparation.</p></div></div>
      <div>
        <article><span><ClipboardList size={18} /></span><strong>Monthly evidence review</strong><p>Confirm each high-risk service user has recent health observations and action notes.</p></article>
        <article><span><TrendingDown size={18} /></span><strong>Deterioration escalation</strong><p>Review deteriorating metrics against care notes, family feedback and recent home-safety tasks.</p></article>
        <article><span><CheckCircle2 size={18} /></span><strong>Outcome confirmation</strong><p>Record where interventions reduce falls risk, improve mobility or support independence.</p></article>
      </div>
    </section>
    <section className="panel analytics-evidence-map">
      <div className="panel-heading"><div><h2>CQC evidence map</h2><p>What this free dashboard should help a care owner prove without manual spreadsheet work.</p></div></div>
      <div>
        <article><strong>Safe</strong><p>Deterioration, high-risk evidence gaps and overdue observation reviews are visible before work is approved.</p><span>{selectedSummary.deteriorating + analyticsInsights.highRiskMissingUsers.length} current prompt{selectedSummary.deteriorating + analyticsInsights.highRiskMissingUsers.length === 1 ? "" : "s"}</span></article>
        <article><strong>Effective</strong><p>Outcome coverage shows whether falls risk, mobility, nutrition, hydration and independence data are actually being captured.</p><span>{analyticsInsights.metricTypes.length} outcome area{analyticsInsights.metricTypes.length === 1 ? "" : "s"}</span></article>
        <article><strong>Caring</strong><p>Improving outcomes and person-centred observations show whether support is making daily life safer and more independent.</p><span>{selectedSummary.improving} improving profile{selectedSummary.improving === 1 ? "" : "s"}</span></article>
        <article><strong>Responsive</strong><p>The action queue converts trend changes into follow-up prompts for coordinator review.</p><span>{coordinatorActions.length} next action{coordinatorActions.length === 1 ? "" : "s"}</span></article>
        <article><strong>Well-led</strong><p>Upload traceability, coverage percentage and exportable evidence packs support governance meetings.</p><span>{analyticsUploadCount} upload{analyticsUploadCount === 1 ? "" : "s"}</span></article>
      </div>
    </section>
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
    <h1>Care intelligence is not enabled for this agency</h1>
    <p>This included CQC-ready analytics module can be enabled by a TaskBridge super admin from Agency onboarding settings.</p>
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
    {task.ringFenceRequired && <div className="safeguard-note"><ShieldCheck size={20} /><div><strong>Safeguarded Visit Controls</strong><span>DBS, insurance and supervision controls apply.</span></div></div>}
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
    { section: "care-os", label: "Open CareOS Intelligence", icon: <Sparkles size={18} /> },
    { section: "rota-planner", label: "Open AI rota planner", icon: <Navigation size={18} /> },
    { section: "billing", label: "Open invoices and billing", icon: <CreditCard size={18} /> },
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
    <div className="task-main"><div className="task-title-line"><h3>{task.category}</h3>{task.ringFenceRequired && <span className="ring-badge"><ShieldCheck size={14} /> Safeguarded controls</span>}</div><p>{task.summary}</p><small>{task.id} / {task.resident.displayName} / {formatDate(task.createdAt, true)}</small></div>
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

function money(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function Loading() {
  return <div className="app-loading"><LoaderCircle className="spin" /> Loading your workspace...</div>;
}
