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
  Eye,
  EyeOff,
  FileText,
  KeyRound,
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
import type { CoordinatorTask, TaskSuggestion, User } from "../types";

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

type AnalyticsFilter = "all" | "deteriorating" | "improving" | "observations";

type TaskFilter = "all" | "open" | "pending" | "assigned" | "confirmation" | "completed";
type CoordinatorSection = "overview" | "new-task" | "tasks" | "service-users" | "analytics" | "notifications";

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

const coordinatorSections: CoordinatorSection[] = ["overview", "new-task", "tasks", "service-users", "analytics", "notifications"];

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
      const destinations: Record<string, string> = { d: "overview", c: "new-task", s: "tasks", n: "notifications" };
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

function CareAnalyticsDashboard({ serviceUsers }: { serviceUsers: ServiceUser[] }) {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [analyticsFilter, setAnalyticsFilter] = useState<AnalyticsFilter>("all");
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

  const filteredServiceUsers = useMemo(() => {
    if (!analytics) return [];
    if (analyticsFilter === "all" || analyticsFilter === "observations") return analytics.serviceUsers;
    return analytics.serviceUsers.filter((serviceUser) => serviceUser.overallTrend === analyticsFilter);
  }, [analytics, analyticsFilter]);

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

  if (loading && !analytics) return <Loading />;
  if (!analytics?.enabled) return <AnalyticsLocked />;
  const summary = analytics.summary;
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Free feature</span><h1>Care analytics dashboard</h1><p>Upload service-user health CSV data and review deterioration, stability and outcome trends.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Agency unlocked</span></div>
    {error && <div className="alert alert-danger">{error}<button onClick={loadAnalytics}><RefreshCw size={16} /> Retry</button></div>}
    <div className="metric-grid coordinator-metrics analytics-metrics">
      <AnalyticsMetric icon={<UsersRound />} label="Service users tracked" value={summary.serviceUsersTracked} tone="blue" filter="all" active={analyticsFilter === "all"} onSelect={setAnalyticsFilter} />
      <AnalyticsMetric icon={<TrendingDown />} label="Showing deterioration" value={summary.deteriorating} tone="amber" filter="deteriorating" active={analyticsFilter === "deteriorating"} onSelect={setAnalyticsFilter} />
      <AnalyticsMetric icon={<TrendingUp />} label="Improving outcomes" value={summary.improving} tone="green" filter="improving" active={analyticsFilter === "improving"} onSelect={setAnalyticsFilter} />
      <AnalyticsMetric icon={<Activity />} label="Health observations" value={summary.observations} tone="navy" filter="observations" active={analyticsFilter === "observations"} onSelect={setAnalyticsFilter} />
    </div>
    <div className="analytics-layout">
      <section className="panel analytics-panel">
        <div className="panel-heading"><div><h2>{analyticsFilterLabels[analyticsFilter]}</h2><p>{analyticsFilter === "observations" ? `${summary.observations} imported health observation rows across ${summary.serviceUsersTracked} service user${summary.serviceUsersTracked === 1 ? "" : "s"}.` : "Potential deterioration is highlighted first for coordinator review."}</p></div></div>
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
    <h1>Care analytics is locked for this agency</h1>
    <p>This free feature can be unlocked by a TaskBridge super admin from Agency onboarding settings.</p>
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

function Loading() {
  return <div className="app-loading"><LoaderCircle className="spin" /> Loading your workspace...</div>;
}
