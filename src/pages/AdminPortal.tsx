import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Building2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Copy,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileWarning,
  KeyRound,
  Landmark,
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
  Wrench,
  X
} from "lucide-react";
import { api, formatDate, humanize } from "../api";
import { EmptyState, PortalShell, StatusBadge } from "../components";
import type { AdminTask, Candidate, User } from "../types";

interface AdminDashboard {
  tasks: Record<string, number>;
  traders: Record<string, number>;
  integrationFailures: number;
  demoRequests: number;
  handymanJoinRequests: number;
  paymentHolds: number;
}

interface Trader {
  id: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  network: string | null;
  hourlyRate: number;
  postcodeArea: string | null;
  rateCards: TraderRateCard[];
  qualityScore: number;
  status: string;
  dbsStatus: string;
  dbsExpiryDate: string | null;
  dbsOutcome: string | null;
  dbsRoute: string | null;
  updateServiceStatus: string | null;
  insuranceStatus: string;
  insuranceExpiryDate: string | null;
  onboardingStatus: string;
  invitationExpiresAt: string | null;
  emailDeliveryStatus: string | null;
  businessName: string | null;
  tradingStatus: string;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  leadId: string | null;
  leadStatus: string | null;
  leadCreatedAt: string | null;
  leadMessage: string | null;
  services: string[];
}

interface TraderRateCard {
  id: string;
  serviceCategory: string;
  postcodeArea: string | null;
  callOutFee: string | number;
  hourlyRate: string | number | null;
  fixedPrice: string | number | null;
  minimumHours: string | number;
  materialsRule: string;
  materialsCap: string | number | null;
  emergencyUpliftPercent: string | number;
  vatRegistered: boolean;
  status: string;
  adminNotes: string | null;
  approvedAt: string | null;
}

interface RateCardPayload {
  serviceCategory: string;
  postcodeArea: string;
  callOutFee: number;
  hourlyRate: number | null;
  fixedPrice: number | null;
  minimumHours: number;
  materialsRule: "included" | "charged_with_receipt" | "capped" | "not_included";
  materialsCap: number | null;
  emergencyUpliftPercent: number;
  vatRegistered: boolean;
  status: "approved";
  adminNotes: string;
}

const defaultRateCards: Record<string, {
  fixedPrice: number | null;
  hourlyRate: number | null;
  minimumHours: number;
  callOutFee: number;
  materialsRule: "included" | "charged_with_receipt" | "capped" | "not_included";
}> = {
  "Lawn mowing": { fixedPrice: 35, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Garden clearance": { fixedPrice: 80, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Window cleaning": { fixedPrice: 35, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Gutter cleaning": { fixedPrice: 85, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Pressure washing": { fixedPrice: 85, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Path clearing": { fixedPrice: 55, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Loose rail repair": { fixedPrice: 65, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Lock repairs": { fixedPrice: 70, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Door and handle repairs": { fixedPrice: 60, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Minor plumbing": { fixedPrice: 65, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Painting and decorating": { fixedPrice: 120, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Furniture assembly": { fixedPrice: 60, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Curtain and blind fitting": { fixedPrice: 55, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Smoke and carbon monoxide alarm fitting": { fixedPrice: 40, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "not_included" },
  "Deep cleaning": { fixedPrice: 65, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Appliance safety checks": { fixedPrice: 45, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Trip hazard removal": { fixedPrice: 60, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Key safe installation": { fixedPrice: 60, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "not_included" },
  "Home safety inspection": { fixedPrice: 45, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Minor adaptations": { fixedPrice: 75, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" },
  "Grab rail fitting": { fixedPrice: 50, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "not_included" },
  "Seasonal safety checks": { fixedPrice: 45, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Repeat visit reviews": { fixedPrice: 35, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "included" },
  "Electrical safety checks": { fixedPrice: 85, hourlyRate: null, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" }
};

const fallbackRateCard = { fixedPrice: null, hourlyRate: 35, minimumHours: 1, callOutFee: 0, materialsRule: "charged_with_receipt" as const };
const TASKBRIDGE_MARGIN_RATE = 0.15;
const STANDARD_LABOUR_MINUTES = 60;
const HOME_OFFICE_DBS_CHECK_URL = "https://disclosure.homeoffice.gov.uk/HomeOfficeExternalPortal/faces/wcnav_defaultSelection";

function splitIncludedMargin(customerPrice: number) {
  const handymanPayout = Number((customerPrice / (1 + TASKBRIDGE_MARGIN_RATE)).toFixed(2));
  const taskbridgeMargin = Number((customerPrice - handymanPayout).toFixed(2));
  return { handymanPayout, taskbridgeMargin };
}

function materialRuleLabel(rule: string | null) {
  if (rule === "included") return "Materials included where stated";
  if (rule === "not_included") return "Materials are separate";
  if (rule === "capped") return "Materials capped and agreed";
  if (rule === "charged_with_receipt") return "Materials separate with receipt";
  return "Materials rule required";
}

function chargeMarginTotal(charge: { agencyCoordinationFee: number; platformFee: number }) {
  return Number((Number(charge.agencyCoordinationFee || 0) + Number(charge.platformFee || 0)).toFixed(2));
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
  dbsCheck: {
    certificateNumber: string;
    issueDate: string | null;
    currentSurname: string;
    dateOfBirth: string;
    homeOfficeCheckUrl: string;
  } | null;
}

interface AdminDocumentUploadInput {
  documentType: "identity" | "public_liability_insurance" | "enhanced_dbs" | "qualification";
  file: File;
  reference: string;
  issueDate: string;
  expiryDate: string;
  dbsCurrentSurname: string;
  dbsDateOfBirth: string;
  dbsWorkforceType: "adult" | "child" | "adult_and_child" | "unknown";
}

interface DdcPack {
  title: string;
  forename: string;
  middleNames: string;
  surname: string;
  dateOfBirth: string;
  nationalInsuranceNumber: string;
  mobile: string;
  daytimeTelephone: string;
  email: string | null;
  confirmEmail: string | null;
  role: string;
  applicantReference: string;
  locationReference: string;
  applicantEntryMode: string;
  status: string;
  adminNotes: string;
  ddcComment: string;
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
    rotaPlannerEnabled: boolean;
    careOsEnabled: boolean;
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
  integrations?: Array<{
    provider: "birdie" | "pass" | "cera" | "generic";
    enabled: boolean;
    externalAccountId: string | null;
    providerApiBaseUrl: string | null;
    providerAccessTokenSet: boolean;
    callbackUrl: string | null;
    webhookSigningSecretSet: boolean;
    callbackSigningSecretSet: boolean;
    updatedAt: string;
  }>;
}

const CARE_INTEGRATION_PROVIDERS: Array<{ value: "birdie" | "pass" | "cera" | "generic"; label: string }> = [
  { value: "birdie", label: "Birdie" },
  { value: "pass", label: "PASS" },
  { value: "cera", label: "Cera" },
  { value: "generic", label: "Other / generic API" }
];

const CARE_INTEGRATION_SANDBOX_EVENTS = [
  { value: "risk_hazard.logged", label: "Risk or hazard logged" },
  { value: "care_note.created", label: "Care note created" },
  { value: "service_user.updated", label: "Service user updated" },
  { value: "visit.completed", label: "Visit completed" }
];

const AGENCY_GO_LIVE_OPTIONS = [
  { value: "pilot_setup", label: "Setup" },
  { value: "pilot_live", label: "Live" },
  { value: "paused", label: "Paused" },
  { value: "suspended", label: "Suspended" }
];

const ACCESS_STATE_OPTIONS = [
  { value: "unlocked", label: "Unlocked" },
  { value: "locked", label: "Locked" }
];

function agencyGoLiveLabel(value?: string) {
  return AGENCY_GO_LIVE_OPTIONS.find((option) => option.value === value)?.label || "Live";
}

const INCIDENT_TYPE_OPTIONS = [
  { value: "failed_visit", label: "Failed visit" },
  { value: "handyman_declined", label: "Handyman declined" },
  { value: "family_complaint", label: "Family complaint" },
  { value: "missing_evidence", label: "Missing evidence" },
  { value: "safeguarding_concern", label: "Safeguarding concern" },
  { value: "payment_dispute", label: "Payment dispute" }
];

const INCIDENT_SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" }
];

const SETTLEMENT_STATUS_OPTIONS = [
  { value: "not_invoiced", label: "Not invoiced" },
  { value: "invoiced", label: "Invoiced" },
  { value: "agency_paid", label: "Agency paid" },
  { value: "disputed", label: "Disputed" },
  { value: "written_off", label: "Written off" }
];

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

interface HandymanJoinRequest {
  id: string;
  fullName: string;
  businessName: string | null;
  tradingStatus: string;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  email: string;
  phone: string;
  postcode: string;
  services: string[];
  hasEnhancedDbs: boolean;
  hasPublicLiability: boolean;
  dbsRoute: string;
  dbsEligibilityNotes: string | null;
  message: string | null;
  status: string;
  source: string;
  traderId: string | null;
  traderStatus: string | null;
  onboardingStatus: string | null;
  emailDeliveryStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HandymanInviteResult {
  fullName: string;
  invitationUrl: string;
  expiresAt: string;
  emailDeliveryStatus: string;
  smsDeliveryStatus?: string;
  smsProviderError?: string | null;
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

interface Incident {
  id: string;
  publicId: string;
  taskId: string | null;
  agencyName: string | null;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
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
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [handymanJoinRequests, setHandymanJoinRequests] = useState<HandymanJoinRequest[]>([]);
  const [billingCharges, setBillingCharges] = useState<BillingCharge[]>([]);
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AdminTask | null>(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [traderFilter, setTraderFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [summary, taskResult, traderResult, agencyResult, accessResult, demoResult, handymanJoinResult, billingResult, invoiceResult, incidentResult] = await Promise.all([
        api<AdminDashboard>("/api/admin/dashboard"),
        api<{ tasks: AdminTask[] }>("/api/admin/tasks"),
        api<{ traders: Trader[] }>("/api/admin/traders"),
        user.role === "taskbridge_super_admin" ? api<{ agencies: Agency[] }>("/api/admin/agencies") : Promise.resolve({ agencies: [] }),
        user.role === "taskbridge_super_admin" ? api<{ users: AccessUser[]; invitations: AccessInvitation[] }>("/api/admin/access/users") : Promise.resolve({ users: [], invitations: [] }),
        api<{ requests: DemoRequest[] }>("/api/admin/demo-requests"),
        api<{ requests: HandymanJoinRequest[] }>("/api/admin/handyman-join-requests"),
        api<{ charges: BillingCharge[] }>("/api/admin/billing/task-charges"),
        api<{ invoices: AdminInvoice[] }>("/api/admin/billing/invoices"),
        api<{ incidents: Incident[] }>("/api/admin/incidents")
      ]);
      setDashboard(summary); setTasks(taskResult.tasks); setTraders(traderResult.traders); setAgencies(agencyResult.agencies);
      setAccessUsers(accessResult.users); setAccessInvitations(accessResult.invitations);
      setDemoRequests(demoResult.requests);
      setHandymanJoinRequests(handymanJoinResult.requests);
      setBillingCharges(billingResult.charges);
      setInvoices(invoiceResult.invoices);
      setIncidents(incidentResult.incidents);
      setSelectedTask((current) => current ? taskResult.tasks.find((task) => task.id === current.id) || null : null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load administration"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function openOperationalView(view: string, filter = "all") {
    if (view === "handyman-join-requests") {
      setTraderFilter("leads");
      setActive("traders");
      return;
    }
    if (view === "incidents") {
      setTaskFilter("incidents");
      setActive("tasks");
      return;
    }
    if (view === "access") {
      setActive("access");
      return;
    }
    if (view === "tasks") taskFilter !== filter && setTaskFilter(filter);
    if (view === "traders") traderFilter !== filter && setTraderFilter(filter);
    setActive(view);
  }

  function changeActive(view: string) {
    if (view === "handyman-join-requests") {
      setTraderFilter("leads");
      setActive("traders");
      return;
    }
    if (view === "incidents") {
      setTaskFilter("incidents");
      setActive("tasks");
      return;
    }
    if (view === "access") {
      setActive("access");
      return;
    }
    if (view === "tasks") setTaskFilter("all");
    if (view === "traders") setTraderFilter("all");
    setActive(view);
  }

  return <PortalShell user={user} area="admin" active={active} onActive={changeActive} onSignOut={onSignOut} navBadges={{ "demo-requests": dashboard?.demoRequests || 0 }}>
    {error && <div className="alert alert-danger">{error}<button onClick={load}><RefreshCw size={16} /> Retry</button></div>}
    {loading && !dashboard ? <div className="app-loading"><LoaderCircle className="spin" /> Loading secure operations...</div> : active === "overview"
      ? <AdminOverview dashboard={dashboard} tasks={tasks} onOpenView={openOperationalView} onReview={(task) => { setSelectedTask(task); setTaskFilter("awaiting"); setActive("tasks"); }} />
      : active === "demo-requests"
        ? <DemoRequestDesk requests={demoRequests} onChanged={load} />
        : active === "tasks"
        ? <AssignmentDesk tasks={tasks} incidents={incidents} filter={taskFilter} onFilter={setTaskFilter} selectedTask={selectedTask} onSelect={setSelectedTask} onChanged={load} />
        : active === "billing"
          ? <FinanceControls charges={billingCharges} invoices={invoices} onChanged={load} />
        : active === "agencies" && user.role === "taskbridge_super_admin"
          ? <AgencyOnboarding agencies={agencies} onChanged={load} />
        : active === "access" && user.role === "taskbridge_super_admin"
          ? <AccessControl currentUser={user} users={accessUsers} invitations={accessInvitations} agencies={agencies} onChanged={load} />
          : <ComplianceHub traders={traders} joinRequests={handymanJoinRequests} filter={traderFilter} onFilter={setTraderFilter} user={user} onChanged={load} />}
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
      <MetricAdmin icon={<Mail />} label="Enquiries" value={dashboard?.demoRequests || 0} tone="blue" onClick={() => onOpenView("demo-requests")} />
      <MetricAdmin icon={<Wrench />} label="Handyman" value={dashboard?.handymanJoinRequests || 0} tone="green" onClick={() => onOpenView("traders", "leads")} />
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

function paymentRouteLabel(route: AdminTask["payment"]["route"]) {
  if (route === "family_representative") return "Family or representative pays";
  if (route === "council_personal_budget") return "Council / personal budget / funded support";
  return "Agency pays";
}

function paymentRouteDetail(task: AdminTask) {
  if (task.payment.route === "family_representative") {
    return [task.payment.payerName, task.payment.payerEmail, task.payment.payerPhone].filter(Boolean).join(" / ") || "Payment details are awaiting completion.";
  }
  if (task.payment.route === "council_personal_budget") {
    return [task.payment.fundingReference, task.payment.fundingNotes].filter(Boolean).join(" / ") || "Funding details are awaiting completion.";
  }
  return "This work will be included in the care-agency invoice process.";
}

function AssignmentDesk({ tasks, incidents, filter, onFilter, selectedTask, onSelect, onChanged }: {
  tasks: AdminTask[];
  incidents: Incident[];
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
  return <>
  <div className="assignment-layout">
    <section>
      <div className="page-title-row compact"><div><span className="eyebrow">Operations</span><h1>Assignments and incidents</h1><p>Review work, release dispatches and manage operational exceptions from one place.</p></div></div>
      <nav className="task-filter-links" aria-label="Filter assignment tasks">{[
        ["all", "All tasks"], ["awaiting", "Awaiting review"], ["in-progress", "In progress"], ["completed", "Completed"], ["incidents", "Incidents"]
      ].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => onFilter(key)} aria-pressed={filter === key}>{label}<span>{key === "incidents" ? incidents.filter((incident) => !["resolved", "closed"].includes(incident.status)).length : tasks.filter((task) => taskMatchesAdminFilter(task, key)).length}</span></button>)}</nav>
      {filter === "incidents"
        ? <IncidentDesk incidents={incidents} tasks={tasks} onChanged={onChanged} embedded />
        : <div className="panel admin-task-list selectable">{filteredTasks.map((task) => <AdminTaskRow key={task.id} task={task} selected={selectedTask?.id === task.id} onSelect={() => onSelect(task)} action={<button className="button button-secondary button-small" onClick={(event) => { event.stopPropagation(); onSelect(task); }}>Review task</button>} />)}{!filteredTasks.length && <EmptyState icon={<ClipboardCheck />} title="No tasks in this view" detail="Choose another status filter to review other work." />}</div>}
    </section>
    {filter === "incidents" ? <aside className="candidate-panel"><EmptyState icon={<FileWarning />} title="Incident mode" detail="Select another operations filter to review task candidates and dispatch decisions." /></aside> : <CandidatePanel task={selectedTask && filteredTasks.some((task) => task.id === selectedTask.id) ? selectedTask : null} onChanged={onChanged} />}
  </div>
  {filter !== "incidents" && incidents.some((incident) => !["resolved", "closed"].includes(incident.status)) && <section className="panel pending-access-panel"><div className="panel-heading"><div><h2>Open operational incidents</h2><p>Unresolved exceptions linked to assignment, visit evidence, safeguarding or payment disputes.</p></div><button className="button button-secondary button-small" onClick={() => onFilter("incidents")}>Open incidents</button></div><div className="agency-list">{incidents.filter((incident) => !["resolved", "closed"].includes(incident.status)).slice(0, 4).map((incident) => <article key={incident.id}><span><FileWarning size={18} /></span><div><h3>{incident.title}</h3><p>{incident.taskId || "Unlinked"} · {humanize(incident.type)}</p><small>{formatDate(incident.createdAt, true)}</small></div><StatusBadge status={incident.severity}>{humanize(incident.severity)}</StatusBadge></article>)}</div></section>}
  </>;
}

function AdminTaskRow({ task, action, selected = false, onSelect }: { task: AdminTask; action: React.ReactNode; selected?: boolean; onSelect?: () => void }) {
  return <article className={`admin-task-row ${selected ? "selected" : ""} ${onSelect ? "interactive" : ""}`} onClick={onSelect}>
    <span className="resident-avatar">{task.residentInitials}</span>
    <div><div className="task-title-line"><h3>{task.category}</h3>{task.ringFenceRequired && <span className="ring-badge"><ShieldCheck size={13} /> Safeguarded</span>}</div><p>{task.summary}</p><small>{task.agencyName} · {task.id} · {formatDate(task.createdAt, true)}</small></div>
    <span className={`payment-pill payment-${task.payment.status}`}>{paymentRouteLabel(task.payment.route)} / {humanize(task.payment.status)}</span>
    <StatusBadge status={task.status}>{humanize(task.status)}</StatusBadge>{action}
  </article>;
}

function CandidatePanel({ task, onChanged }: { task: AdminTask | null; onChanged: () => Promise<void> }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dispatching, setDispatching] = useState("");
  const [paymentBusy, setPaymentBusy] = useState("");
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
    const largerJobApproved = candidate.largerJobApprovalRequired
      ? window.confirm("This job may take longer than the standard 60-minute visit. Confirm that the larger-job scope and price have been approved before release.")
      : false;
    if (candidate.largerJobApprovalRequired && !largerJobApproved) return;
    setDispatching(candidate.id); setError("");
    try {
      const result = await api<{ visitUrl: string }>(`/api/admin/tasks/${task.id}/dispatch`, { method: "POST", body: JSON.stringify({ traderId: candidate.id, largerJobApproved }) });
      setVisitUrl(result.visitUrl); await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Dispatch failed"); }
    finally { setDispatching(""); }
  }

  async function markPayment(paymentStatus: "family_paid" | "funding_approved" | "payment_waived") {
    if (!task) return;
    setPaymentBusy(paymentStatus); setError("");
    try {
      await api(`/api/admin/tasks/${task.id}/payment-status`, { method: "POST", body: JSON.stringify({ paymentStatus }) });
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update payment status"); }
    finally { setPaymentBusy(""); }
  }

  async function createFamilyPaymentLink() {
    if (!task) return;
    const amount = Number(window.prompt("Unit price to request from family / representative in GBP, excluding VAT", "75"));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setPaymentBusy("payment-link"); setError("");
    try {
      const result = await api<{ paymentUrl: string; smsDeliveryStatus?: string; smsProviderError?: string | null }>(`/api/admin/tasks/${task.id}/family-payment-link`, {
        method: "POST",
        body: JSON.stringify({ amount })
      });
      await navigator.clipboard.writeText(result.paymentUrl);
      const smsStatus = humanize(result.smsDeliveryStatus || "not_configured");
      const smsError = result.smsProviderError ? `\n\nSMS provider reason: ${result.smsProviderError}` : "";
      window.alert(`Secure family payment link copied to clipboard.\n\nSMS: ${smsStatus}.${smsError}`);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create family payment link"); }
    finally { setPaymentBusy(""); }
  }

  async function createFamilyUpdateLink() {
    if (!task) return;
    const recipientEmail = window.prompt("Family or representative email address");
    if (!recipientEmail) return;
    const recipientName = window.prompt("Recipient name", "") || "";
    setPaymentBusy("update-link"); setError("");
    try {
      const result = await api<{ updateUrl: string }>(`/api/admin/tasks/${task.id}/family-update-link`, {
        method: "POST",
        body: JSON.stringify({ recipientEmail, recipientName })
      });
      await navigator.clipboard.writeText(result.updateUrl);
      window.alert("Secure family update link copied to clipboard.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create family update link"); }
    finally { setPaymentBusy(""); }
  }

  return <aside className="candidate-panel">
    {!task ? <EmptyState icon={<UsersRound />} title="Select a task" detail="Choose a task to run the safeguarding and suitability checks." /> : <>
      <div className="candidate-heading"><div><span className="eyebrow">Candidate decision</span><h2>{task.category}</h2><p>{task.agencyName} · Resident {task.residentInitials}</p></div>{task.vulnerableAdult && <ShieldCheck size={26} />}</div>
      <div className="payment-clearance-card">
        <span>{task.payment.route === "council_personal_budget" ? <Landmark size={18} /> : <CreditCard size={18} />}</span>
        <div><strong>{paymentRouteLabel(task.payment.route)}</strong><p>{paymentRouteDetail(task)}</p><StatusBadge status={task.payment.status}>{humanize(task.payment.status)}</StatusBadge></div>
        {task.payment.status === "awaiting_family_payment" && <button className="button button-secondary button-small" disabled={Boolean(paymentBusy)} onClick={() => markPayment("family_paid")}>{paymentBusy ? "Saving..." : "Mark paid"}</button>}
        {task.payment.status === "awaiting_family_payment" && <button className="button button-secondary button-small" disabled={Boolean(paymentBusy)} onClick={createFamilyPaymentLink}>{paymentBusy === "payment-link" ? "Creating..." : "Create pay link"}</button>}
        {task.payment.status === "funding_pending" && <button className="button button-secondary button-small" disabled={Boolean(paymentBusy)} onClick={() => markPayment("funding_approved")}>{paymentBusy ? "Saving..." : "Approve funding"}</button>}
        {["awaiting_family_payment", "funding_pending"].includes(task.payment.status) && <button className="button button-secondary button-small document-reject" disabled={Boolean(paymentBusy)} onClick={() => markPayment("payment_waived")}>Waive hold</button>}
      </div>
      {task.safeguardingRisk && <div className="risk-score-card"><strong>Safeguarding risk {task.safeguardingRisk.score}/100</strong><StatusBadge status={task.safeguardingRisk.band}>{humanize(task.safeguardingRisk.band)}</StatusBadge><p>{task.safeguardingRisk.factors.join(", ") || "Standard controls"}</p></div>}
      {["awaiting_care_confirmation", "completed"].includes(task.status) && <button className="button button-secondary button-full" disabled={Boolean(paymentBusy)} onClick={createFamilyUpdateLink}>{paymentBusy === "update-link" ? "Creating update..." : "Create family update link"}</button>}
      {error && <p className="form-error">{error}</p>}
      {visitUrl && <div className="alert alert-success"><span>Dispatch complete. The secure link is shown once.</span><a href={visitUrl} target="_blank" rel="noreferrer">Open visit link <ExternalLink size={15} /></a></div>}
      {loading ? <div className="app-loading"><LoaderCircle className="spin" /> Evaluating eligibility...</div> : <div className="candidate-list">{candidates.map((candidate) => <article key={candidate.id} className={`candidate ${candidate.eligible ? "eligible" : "ineligible"}`}>
        <div className="candidate-name"><span className="avatar"><Wrench size={18} /></span><div><h3>{candidate.displayName}</h3><p>{candidate.network || "Direct network"}</p></div><StatusBadge status={candidate.eligible ? "approved" : "rejected"}>{candidate.eligible ? "Eligible" : "Blocked"}</StatusBadge></div>
        <div className="candidate-facts"><span><MapPin size={15} /> {candidate.distanceMiles} mi</span><span><Star size={15} /> {candidate.qualityScore}</span><span className={candidate.agreedQuote ? "agreed-quote" : "missing-quote"}>{candidate.agreedQuote ? `Unit price GBP ${candidate.agreedQuote.toFixed(2)}` : "No agreed price"}</span></div>
        <div className="candidate-price-note"><strong>{candidate.rateCardLabel || "Rate card required"}</strong><span>Fixed price covers up to {candidate.fixedPriceCoversMinutes || STANDARD_LABOUR_MINUTES} minutes. {materialRuleLabel(candidate.materialsRule)}. TaskBridge margin is included{candidate.vatRegistered ? " / VAT registered" : ""}.</span>{candidate.handymanPayout !== null && candidate.taskbridgeMargin !== null && <small>Handyman payout: GBP {candidate.handymanPayout.toFixed(2)} / TaskBridge margin: GBP {candidate.taskbridgeMargin.toFixed(2)}</small>}{candidate.largerJobApprovalRequired && <small className="table-note">Larger-job approval required before release.</small>}</div>
        <div className="candidate-checks"><span><BadgeCheck size={15} /> DBS: {humanize(candidate.dbsStatus)}</span><span><ShieldCheck size={15} /> Insurance: {humanize(candidate.insuranceStatus)}</span></div>
        {!candidate.eligible && <ul className="reason-list">{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        <button className="button button-primary button-full button-small" disabled={!candidate.eligible || Boolean(dispatching)} onClick={() => dispatch(candidate)}>{dispatching === candidate.id ? "Dispatching..." : "Approve and dispatch"}</button>
      </article>)}</div>}
      {!loading && !candidates.length && <EmptyState icon={<UserCheck />} title="No candidates to show" detail={task.status === "dispatched" ? "This task has already been assigned." : "No matching handyman records were returned."} />}
    </>}
  </aside>;
}

function IncidentDesk({ incidents, tasks, onChanged, embedded = false }: { incidents: Incident[]; tasks: AdminTask[]; onChanged: () => Promise<void>; embedded?: boolean }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  async function createIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const taskPublicId = String(values.get("taskPublicId") || "");
    const type = String(values.get("type") || "");
    const severity = String(values.get("severity") || "");
    const title = String(values.get("title") || "");
    const description = String(values.get("description") || "");
    if (!type || !severity || !title || !description) return;
    setBusy("create"); setError("");
    try {
      await api("/api/admin/incidents", {
        method: "POST",
        body: JSON.stringify({ taskPublicId: taskPublicId || null, type, severity, title, description })
      });
      form?.reset?.();
      setCreateOpen(false);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create incident"); }
    finally { setBusy(""); }
  }
  async function updateIncident(incident: Incident, status: string) {
    const resolutionNotes = ["resolved", "closed"].includes(status) ? window.prompt("Resolution notes", "") || "" : "";
    setBusy(incident.id); setError("");
    try {
      await api(`/api/admin/incidents/${incident.id}`, { method: "PATCH", body: JSON.stringify({ status, resolutionNotes }) });
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update incident"); }
    finally { setBusy(""); }
  }
  return <>
    {embedded ? <div className="panel-heading"><div><h2>Incident and complaint workflow</h2><p>Track failed visits, family complaints, evidence gaps, safeguarding concerns and payment disputes.</p></div><button className="button button-primary" disabled={busy === "create"} onClick={() => setCreateOpen((open) => !open)}><Plus size={17} /> New incident</button></div> : <div className="page-title-row"><div><span className="eyebrow">Safeguarding operations</span><h1>Incident and complaint workflow</h1><p>Track failed visits, family complaints, evidence gaps, safeguarding concerns and payment disputes.</p></div><button className="button button-primary" disabled={busy === "create"} onClick={() => setCreateOpen((open) => !open)}><Plus size={17} /> New incident</button></div>}
    {error && <div className="alert alert-danger">{error}</div>}
    {createOpen && <section className="panel inline-admin-form"><form className="stack" onSubmit={createIncident}><div className="field-row"><label>Linked task<select name="taskPublicId" defaultValue=""><option value="">No linked task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.id} - {task.category}</option>)}</select></label><label>Incident type<select name="type" defaultValue="safeguarding_concern">{INCIDENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><div className="field-row"><label>Severity<select name="severity" defaultValue="medium">{INCIDENT_SEVERITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Short incident title<input required name="title" minLength={3} /></label></div><label>What happened and what needs to be done<textarea required name="description" rows={3} minLength={5} /></label><div className="row-actions"><button className="button button-primary button-small" disabled={busy === "create"} type="submit">{busy === "create" ? "Creating..." : "Create incident"}</button><button className="button button-secondary button-small" type="button" onClick={() => setCreateOpen(false)}>Cancel</button></div></form></section>}
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Incident</th><th>Task / Agency</th><th>Severity</th><th>Status</th><th>Owner</th><th>Actions</th></tr></thead><tbody>{incidents.map((incident) => <tr key={incident.id}><td><strong>{incident.title}</strong><small>{incident.publicId} · {humanize(incident.type)} · {formatDate(incident.createdAt, true)}</small><p className="table-note">{incident.description}</p></td><td><strong>{incident.taskId || "Unlinked"}</strong><small>{incident.agencyName || "Platform"}</small></td><td><StatusBadge status={incident.severity}>{humanize(incident.severity)}</StatusBadge></td><td><StatusBadge status={incident.status}>{humanize(incident.status)}</StatusBadge>{incident.resolvedAt && <small>Resolved {formatDate(incident.resolvedAt, true)}</small>}</td><td>{incident.ownerName || "TaskBridge operations"}</td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={busy === incident.id} onClick={() => updateIncident(incident, "investigating")}>Investigate</button><button className="button button-secondary button-small" disabled={busy === incident.id} onClick={() => updateIncident(incident, "escalated")}>Escalate</button><button className="button button-secondary button-small" disabled={busy === incident.id} onClick={() => updateIncident(incident, "resolved")}>Resolve</button></div></td></tr>)}</tbody></table></div>{!incidents.length && <EmptyState icon={<FileWarning />} title="No incidents recorded" detail="Operational exceptions and complaints will appear here." />}</section>
  </>;
}

function DemoRequestDesk({ requests, onChanged }: { requests: DemoRequest[]; onChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState("");
  const filtered = requests.filter((item) => filter === "open" ? item.status !== "closed" : filter === "all" ? true : item.status === filter);
  async function update(item: DemoRequest, status: string) {
    const notes = window.prompt("Add an internal note for this enquiry", item.internalNotes || "");
    setBusy(item.id);
    try {
      await api(`/api/admin/demo-requests/${item.id}`, { method: "PATCH", body: JSON.stringify({ status, internalNotes: notes || "" }) });
      await onChanged();
    } finally { setBusy(""); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Landing-page enquiries</span><h1>Enquiry queue</h1><p>Track new care-company interest from request through qualification.</p></div></div>
    <nav className="task-filter-links" aria-label="Filter enquiries">{[["open", "Open"], ["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["closed", "Closed"], ["all", "All"]].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}<span>{requests.filter((item) => key === "open" ? item.status !== "closed" : key === "all" ? true : item.status === key).length}</span></button>)}</nav>
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Organisation</th><th>Contact</th><th>Status</th><th>Need</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.organisationName}</strong><small>{formatDate(item.createdAt, true)}</small></td><td><strong>{item.fullName}</strong><small>{item.workEmail}</small></td><td><StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge>{item.ownerName && <small>Owner: {item.ownerName}</small>}</td><td><span className="integration-endpoint">{item.message || "No extra note"}</span>{item.internalNotes && <small>Internal: {item.internalNotes}</small>}</td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={busy === item.id} onClick={() => update(item, "contacted")}>Contacted</button><button className="button button-secondary button-small" disabled={busy === item.id} onClick={() => update(item, "qualified")}>Qualify</button><button className="button button-secondary button-small" disabled={busy === item.id} onClick={() => update(item, "closed")}>Close</button></div></td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState icon={<Mail />} title="No enquiries in this view" detail="New website enquiries will appear here." />}</section>
  </>;
}

function handymanLeadScore(item: HandymanJoinRequest) {
  let score = 20;
  if (item.hasPublicLiability) score += 25;
  if (item.hasEnhancedDbs || item.dbsRoute === "already_enhanced") score += 15;
  if (item.services.length >= 3) score += 15;
  else score += item.services.length * 4;
  if (item.businessName) score += 6;
  if (item.companyRegistrationNumber || ["sole_trader", "partnership"].includes(item.tradingStatus)) score += 6;
  if (/care|housing|older|vulnerable|council|maintenance|safety/i.test(item.message || "")) score += 8;
  if (/referral|council|care|agency|approved|facebook|google|directory/i.test(item.source)) score += 5;
  if (!item.hasPublicLiability) score -= 18;
  if (item.status === "declined") score -= 30;
  if (item.status === "closed") score -= 20;
  return Math.max(0, Math.min(100, score));
}

function scoreBand(score: number) {
  if (score >= 75) return "strong";
  if (score >= 55) return "medium";
  return "weak";
}

function compactSource(source: string) {
  if (source.startsWith("referral:")) return `Referral: ${source.slice("referral:".length)}`;
  return humanize(source);
}

function HandymanJoinRequestDesk({ requests, onChanged, embedded = false }: { requests: HandymanJoinRequest[]; onChanged: () => Promise<void>; embedded?: boolean }) {
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState("");
  const [inviteResult, setInviteResult] = useState<HandymanInviteResult | null>(null);
  const filtered = requests.filter((item) => filter === "open" ? ["new", "reviewing"].includes(item.status) : filter === "all" ? true : item.status === filter);
  async function update(item: HandymanJoinRequest, status: string) {
    const rejectionReason = ["declined", "closed"].includes(status)
      ? window.prompt(`Reason for marking ${item.fullName} as ${status}?`, "") || ""
      : "";
    setBusy(item.id); setInviteResult(null);
    try {
      await api(`/api/admin/handyman-join-requests/${item.id}`, { method: "PATCH", body: JSON.stringify({ status, rejectionReason }) });
      await onChanged();
    } finally { setBusy(""); }
  }
  async function invite(item: HandymanJoinRequest) {
    if (!window.confirm(`Send a secure onboarding invitation to ${item.fullName}?`)) return;
    setBusy(item.id); setInviteResult(null);
    try {
      const result = await api<Omit<HandymanInviteResult, "fullName">>(`/api/admin/handyman-join-requests/${item.id}/invite`, { method: "POST" });
      setInviteResult({ fullName: item.fullName, ...result });
      await onChanged();
    } finally { setBusy(""); }
  }
  async function copyLeadInviteLink() {
    if (inviteResult) await navigator.clipboard.writeText(inviteResult.invitationUrl);
  }
  return <>
    {!embedded && <div className="page-title-row"><div><span className="eyebrow">Website applications</span><h1>Handyman join requests</h1><p>Review public applications before inviting suitable handymen into secure onboarding.</p></div></div>}
    {embedded && <div className="panel-heading"><div><h2>Lead intake</h2><p>Review website applications, then invite suitable handymen into onboarding and compliance.</p></div></div>}
    {!embedded && <nav className="task-filter-links" aria-label="Filter handyman join requests">{[["open", "Open"], ["new", "New"], ["reviewing", "Reviewing"], ["invited", "Invited"], ["declined", "Declined"], ["closed", "Closed"], ["all", "All"]].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}<span>{requests.filter((item) => key === "open" ? ["new", "reviewing"].includes(item.status) : key === "all" ? true : item.status === key).length}</span></button>)}</nav>}
    <section className="panel table-panel">
      {inviteResult && <div className={`invitation-result ${inviteResult.emailDeliveryStatus === "sent" ? "sent" : "attention"}`}><div><strong>{inviteResult.fullName} moved into onboarding</strong><span>Email: {humanize(inviteResult.emailDeliveryStatus)} / SMS: {humanize(inviteResult.smsDeliveryStatus || "not_configured")} / expires {formatDate(inviteResult.expiresAt, true)}</span>{inviteResult.smsProviderError && <small>SMS reason: {inviteResult.smsProviderError}</small>}</div><div className="invitation-link"><input readOnly value={inviteResult.invitationUrl} aria-label="Handyman onboarding invitation URL" /><button className="icon-button" type="button" onClick={copyLeadInviteLink} aria-label="Copy invitation link"><Copy size={18} /></button><a className="icon-button" href={inviteResult.invitationUrl} target="_blank" rel="noreferrer" aria-label="Open onboarding invitation"><ExternalLink size={18} /></a></div></div>}
      <div className="responsive-table"><table><thead><tr><th>Applicant</th><th>Source / score</th><th>Business</th><th>Contact</th><th>Services</th><th>Safeguarding</th><th>Message</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => {
        const score = handymanLeadScore(item);
        return <tr key={item.id}>
        <td><strong>{item.fullName}</strong><small>{formatDate(item.createdAt, true)}</small><StatusBadge status={item.status}>{humanize(item.status)}</StatusBadge>{item.traderId && <small>Compliance: {humanize(item.traderStatus || "inactive")} / {humanize(item.onboardingStatus || "not_invited")}</small>}</td>
        <td><strong>{compactSource(item.source)}</strong><small className={`lead-score lead-score-${scoreBand(score)}`}>{score}/100 {humanize(scoreBand(score))}</small></td>
        <td><strong>{item.businessName || "No business name"}</strong><small>{humanize(item.tradingStatus)}</small>{item.companyRegistrationNumber && <small>Company reg: {item.companyRegistrationNumber}</small>}{item.vatNumber && <small>VAT: {item.vatNumber}</small>}</td>
        <td><strong>{item.email}</strong><small>{item.phone} · {item.postcode}</small></td>
        <td><span className="service-summary" title={item.services.join(", ")}>{item.services.join(", ") || "No services selected"}</span></td>
        <td><StatusBadge status={item.dbsRoute}>{humanize(item.dbsRoute)}</StatusBadge><small>{item.hasPublicLiability ? "Public liability declared" : "No public liability declared"}</small><small>{item.hasEnhancedDbs ? "Enhanced DBS declared" : "Enhanced DBS not declared"}</small></td>
        <td><span className="integration-endpoint">{item.message || "No extra note"}</span>{item.dbsEligibilityNotes && <small>{item.dbsEligibilityNotes}</small>}</td>
        <td><div className="row-actions"><button className="button button-secondary button-small" disabled={busy === item.id || Boolean(item.traderId)} onClick={() => update(item, "reviewing")}>Reviewing</button><button className="button button-secondary button-small" disabled={busy === item.id || item.status === "invited" || Boolean(item.traderId)} onClick={() => invite(item)}>{item.traderId ? "In compliance" : "Invite"}</button><button className="button button-secondary button-small document-reject" disabled={busy === item.id || item.status === "invited" || Boolean(item.traderId)} onClick={() => update(item, "declined")}>Decline</button><button className="button button-secondary button-small" disabled={busy === item.id} onClick={() => update(item, "closed")}>Close</button></div></td>
      </tr>;
      })}</tbody></table></div>
      {!filtered.length && <EmptyState icon={<Wrench />} title="No handyman leads in this view" detail="New join form submissions will appear here." />}
    </section>
  </>;
}

function FinanceControls({ charges, invoices, onChanged }: { charges: BillingCharge[]; invoices: AdminInvoice[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [settlementEditing, setSettlementEditing] = useState("");
  const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const agencies = Array.from(new Map(charges.map((charge) => [charge.agencyId, charge.agencyName])).entries()).map(([id, name]) => ({ id, name }));
  const [invoiceForm, setInvoiceForm] = useState({ agencyId: agencies[0]?.id || "", periodStart: defaultStart, periodEnd: defaultEnd, dueDate: "" });
  useEffect(() => {
    if (!invoiceForm.agencyId && agencies[0]?.id) setInvoiceForm((current) => ({ ...current, agencyId: agencies[0].id }));
  }, [agencies.map((agency) => agency.id).join("|")]);
  async function settlement(event: React.FormEvent<HTMLFormElement>, charge: BillingCharge) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const settlementStatus = String(values.get("settlementStatus") || charge.settlementStatus);
    const settlementReference = String(values.get("settlementReference") || "");
    setBusy(charge.id);
    try {
      await api(`/api/admin/billing/task-charges/${charge.id}/settlement`, {
        method: "PATCH",
        body: JSON.stringify({ settlementStatus, settlementReference, settlementDueAt: charge.settlementDueAt, settlementNotes: charge.settlementNotes })
      });
      setSettlementEditing("");
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
    <div className="page-title-row"><div><span className="eyebrow">Care Agency Finance</span><h1>Invoices, settlements, disputes and payouts</h1><p>Generate care-agency invoice exports, track settlement, and hold payouts when evidence, complaints or payment disputes require review.</p></div></div>
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
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Invoice exports</h2><p>Issued invoice batches grouped by agency and period. VAT is added at invoice stage where applicable.</p></div></div><div className="responsive-table"><table><thead><tr><th>Invoice</th><th>Agency</th><th>Period</th><th>Lines</th><th>Total ex VAT</th><th>Status</th><th>Actions</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small>{invoice.issuedAt ? `Issued ${formatDate(invoice.issuedAt, true)}` : "Draft"}</small></td><td>{invoice.agencyName}</td><td><strong>{formatDate(invoice.periodStart)}</strong><small>to {formatDate(invoice.periodEnd)}</small></td><td>{invoice.lineCount}</td><td><strong>{invoice.currency} {invoice.totalAmount.toFixed(2)}</strong></td><td><StatusBadge status={invoice.status}>{humanize(invoice.status)}</StatusBadge>{invoice.paidAt && <small>Paid {formatDate(invoice.paidAt, true)}</small>}</td><td><div className="row-actions"><a className="button button-secondary button-small" href={`/api/admin/billing/invoices/${invoice.id}/export.csv`}>CSV</a><button className="button button-secondary button-small" disabled={busy === invoice.id || invoice.status === "paid"} onClick={() => updateInvoiceStatus(invoice, "paid")}>Mark paid</button><button className="button button-secondary button-small document-reject" disabled={busy === invoice.id || invoice.status === "void" || invoice.status === "paid"} onClick={() => updateInvoiceStatus(invoice, "void")}>Void</button></div></td></tr>)}</tbody></table></div>{!invoices.length && <EmptyState icon={<FileCheck2 />} title="No invoices generated yet" detail="Create an invoice export from uninvoiced task charges." />}</section>
    <section className="panel table-panel"><div className="responsive-table"><table><thead><tr><th>Task</th><th>Agency</th><th>Unit price</th><th>Settlement</th><th>Payout</th><th>Actions</th></tr></thead><tbody>{charges.map((charge) => <tr key={charge.id}><td><strong>{charge.taskId}</strong><small>{formatDate(charge.createdAt, true)}</small></td><td><strong>{charge.agencyName}</strong><small>{charge.handymanName || "No handyman"}</small></td><td><strong>£{charge.totalAmount.toFixed(2)}</strong><small>Handyman payout £{charge.handymanAmount.toFixed(2)} · TaskBridge margin £{chargeMarginTotal(charge).toFixed(2)}</small><small>VAT excluded; added on invoice where applicable.</small></td><td>{settlementEditing === charge.id ? <form className="settlement-inline-form" onSubmit={(event) => settlement(event, charge)}><select name="settlementStatus" defaultValue={charge.settlementStatus}>{SETTLEMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input name="settlementReference" defaultValue={charge.settlementReference || ""} placeholder="Invoice/reference" /><div className="row-actions"><button className="button button-primary button-small" disabled={busy === charge.id} type="submit">{busy === charge.id ? "Saving..." : "Save"}</button><button className="button button-secondary button-small" type="button" onClick={() => setSettlementEditing("")}>Cancel</button></div></form> : <><StatusBadge status={charge.settlementStatus}>{humanize(charge.settlementStatus)}</StatusBadge>{charge.settlementReference && <small>{charge.settlementReference}</small>}</>}</td><td><StatusBadge status={charge.payoutStatus || "pending"}>{humanize(charge.payoutStatus || "pending")}</StatusBadge>{charge.payableAfter && <small>Eligible {formatDate(charge.payableAfter, true)}</small>}</td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={busy === charge.id} onClick={() => setSettlementEditing(settlementEditing === charge.id ? "" : charge.id)}>Settlement</button><button className="button button-secondary button-small document-reject" disabled={busy === charge.id} onClick={() => dispute(charge)}>Dispute / hold</button></div></td></tr>)}</tbody></table></div>{!charges.length && <EmptyState icon={<FileCheck2 />} title="No charge records yet" detail="Charges are created when a TaskBridge admin dispatches a handyman." />}</section>
  </>;
}

function ComplianceHub({ traders, joinRequests, filter, onFilter, user, onChanged }: { traders: Trader[]; joinRequests: HandymanJoinRequest[]; filter: string; onFilter: (filter: string) => void; user: User; onChanged: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ invitationUrl: string; expiresAt: string; emailDeliveryStatus: string; smsDeliveryStatus?: string; smsProviderError?: string | null } | null>(null);
  const [reviewingTrader, setReviewingTrader] = useState<Trader | null>(null);
  const [identityPreviewTrader, setIdentityPreviewTrader] = useState<Trader | null>(null);
  const [identityPreviewDocument, setIdentityPreviewDocument] = useState<ComplianceDocument | null>(null);
  const [identityPreviewLoading, setIdentityPreviewLoading] = useState(false);
  const [businessEditingTrader, setBusinessEditingTrader] = useState<Trader | null>(null);
  const [rateEditingTrader, setRateEditingTrader] = useState<Trader | null>(null);
  const [priceReviewTrader, setPriceReviewTrader] = useState<Trader | null>(null);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [ddcPack, setDdcPack] = useState<DdcPack | null>(null);
  const [ddcMessage, setDdcMessage] = useState("");
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const openLeads = joinRequests.filter((item) => ["new", "reviewing"].includes(item.status));
  const invitedLeads = joinRequests.filter((item) => item.status === "invited");
  const pendingInviteTraders = traders.filter((trader) => trader.onboardingStatus === "pending");
  const submittedTraders = traders.filter((trader) => trader.onboardingStatus === "submitted");
  const onboardingTraders = traders.filter((trader) => ["pending", "submitted", "not_invited"].includes(trader.onboardingStatus));
  const actionNeededTraders = traders.filter((trader) => trader.dbsStatus !== "approved" || trader.insuranceStatus !== "verified");
  const recruitment = useMemo(() => {
    const readyLeads = joinRequests
      .filter((item) => ["new", "reviewing"].includes(item.status) && !item.traderId)
      .map((item) => ({ item, score: handymanLeadScore(item) }))
      .filter((item) => item.score >= 70)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    const sourceRows = Array.from(joinRequests.reduce((map, item) => {
      const current = map.get(item.source) || { source: item.source, total: 0, invited: 0, open: 0, declined: 0 };
      current.total += 1;
      if (item.status === "invited") current.invited += 1;
      if (["new", "reviewing"].includes(item.status)) current.open += 1;
      if (item.status === "declined") current.declined += 1;
      map.set(item.source, current);
      return map;
    }, new Map<string, { source: string; total: number; invited: number; open: number; declined: number }>()).values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);
    const serviceRows = Array.from(traders
      .filter((trader) => trader.status === "active" || (trader.dbsStatus === "approved" && trader.insuranceStatus === "verified"))
      .reduce((map, trader) => {
        for (const service of trader.services.length ? trader.services : ["Uncategorised"]) {
          const key = `${trader.postcodeArea || "Unknown"}|${service}`;
          const current = map.get(key) || { postcode: trader.postcodeArea || "Unknown", service, count: 0 };
          current.count += 1;
          map.set(key, current);
        }
        return map;
      }, new Map<string, { postcode: string; service: string; count: number }>()).values())
      .sort((left, right) => right.count - left.count || left.postcode.localeCompare(right.postcode))
      .slice(0, 8);
    const referralCode = "CARE-AGENCY-HANDYMAN";
    const referralUrl = `${window.location.origin}/join-handyman?ref=${encodeURIComponent(referralCode)}`;
    return { readyLeads, sourceRows, serviceRows, referralCode, referralUrl };
  }, [joinRequests, traders]);
  const filteredTraders = traders.filter((trader) => {
    if (filter === "approved") return trader.dbsStatus === "approved";
    if (filter === "action-needed") return trader.dbsStatus !== "approved" || trader.insuranceStatus !== "verified";
    if (filter === "onboarding") return ["pending", "submitted", "not_invited"].includes(trader.onboardingStatus);
    if (filter === "leads") return false;
    return true;
  });
  const showLeadQueue = filter === "all" || filter === "leads" || filter === "action-needed";
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
      const [result, packResult] = await Promise.all([
        api<{ documents: ComplianceDocument[] }>(`/api/admin/traders/${trader.id}/documents`),
        user.role === "taskbridge_super_admin"
          ? api<{ pack: DdcPack | null; message?: string }>(`/api/admin/traders/${trader.id}/ddc-pack`)
          : Promise.resolve({ pack: null, message: "" })
      ]);
      setDocuments(result.documents);
      setDdcPack(packResult.pack);
      setDdcMessage(packResult.message || "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load compliance documents"); setDocuments([]); }
    finally { setDocumentsLoading(false); }
  }
  async function openIdentityPreview(trader: Trader) {
    setIdentityPreviewTrader(trader); setIdentityPreviewDocument(null); setIdentityPreviewLoading(true); setError("");
    try {
      const result = await api<{ documents: ComplianceDocument[] }>(`/api/admin/traders/${trader.id}/documents`);
      setIdentityPreviewDocument(result.documents.find((document) => document.documentType === "identity") || null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load submitted ID"); }
    finally { setIdentityPreviewLoading(false); }
  }
  async function reviewIdentityDocument(document: ComplianceDocument, status: "approved" | "rejected") {
    if (!identityPreviewTrader) return;
    const reason = status === "approved" ? "Identity document approved by TaskBridge compliance review." : window.prompt("Record the reason for rejection");
    if (!reason || reason.trim().length < 5) {
      setError("Record a review reason before rejecting the ID document.");
      return;
    }
    setBusy(document.id); setError("");
    try {
      await api(`/api/admin/traders/${identityPreviewTrader.id}/documents/${document.id}/review`, {
        method: "POST", body: JSON.stringify({ status, reason })
      });
      setIdentityPreviewDocument({ ...document, reviewStatus: status, reviewNotes: reason, reviewedAt: new Date().toISOString() });
      setDocuments((current) => current.map((item) => item.id === document.id
        ? { ...item, reviewStatus: status, reviewNotes: reason, reviewedAt: new Date().toISOString() }
        : item));
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to record ID review"); }
    finally { setBusy(""); }
  }
  async function saveBusinessProfile(trader: Trader, payload: { displayName: string; businessName: string; mobile: string; postcodeArea: string }) {
    setBusy(`business-${trader.id}`); setError("");
    try {
      await api(`/api/admin/traders/${trader.id}/business-profile`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setBusinessEditingTrader(null);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update handyman details"); }
    finally { setBusy(""); }
  }
  async function reviewDocument(document: ComplianceDocument, status: "approved" | "rejected") {
    if (!reviewingTrader) return;
    const isDbsDocument = document.documentType === "enhanced_dbs";
    const reason = status === "approved"
      ? isDbsDocument
        ? "DBS certificate details checked against the official Home Office route and approved by TaskBridge compliance review."
        : "Approved by TaskBridge compliance review."
      : window.prompt("Record the reason for rejection");
    if (!reason || reason.trim().length < 5) {
      setError("Record a review reason before rejecting the document.");
      return;
    }
    const dbsExpiryDate = isDbsDocument && status === "approved" ? nextAnnualReviewDate() : null;
    if (isDbsDocument && status === "approved" && (!document.dbsCheck?.certificateNumber || !document.dbsCheck.currentSurname || !document.dbsCheck.dateOfBirth)) {
      setError("The DBS evidence is missing the certificate number, surname or date of birth needed for the official DBS check. Ask the handyman to resubmit it or record a manual DBS decision.");
      return;
    }
    setBusy(document.id); setError("");
    try {
      const result = await api<{
        status: string;
        trader: null | {
          status: string;
          dbsStatus: string;
          dbsExpiryDate: string | null;
          insuranceStatus: string;
          insuranceExpiryDate: string | null;
        };
      }>(`/api/admin/traders/${reviewingTrader.id}/documents/${document.id}/review`, {
        method: "POST", body: JSON.stringify({ status, reason, dbsExpiryDate: dbsExpiryDate || null })
      });
      const updatedTrader = result.trader ? {
        ...reviewingTrader,
        status: result.trader.status,
        dbsStatus: result.trader.dbsStatus,
        dbsExpiryDate: result.trader.dbsExpiryDate,
        insuranceStatus: result.trader.insuranceStatus,
        insuranceExpiryDate: result.trader.insuranceExpiryDate
      } : reviewingTrader;
      setReviewingTrader(updatedTrader);
      setDocuments((current) => current.map((item) => item.id === document.id
        ? { ...item, reviewStatus: status, reviewNotes: reason, reviewedAt: new Date().toISOString() }
        : item));
      await openDocuments(updatedTrader); await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to record document review"); }
    finally { setBusy(""); }
  }
  async function uploadComplianceDocument(trader: Trader, input: AdminDocumentUploadInput) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(input.file.type)) {
      setError("Compliance documents must be PDF, JPEG or PNG.");
      return;
    }
    setBusy(`upload-doc-${trader.id}`); setError("");
    const params = new URLSearchParams({
      documentType: input.documentType,
      originalFilename: input.file.name,
      reference: input.reference,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      dbsCurrentSurname: input.dbsCurrentSurname,
      dbsDateOfBirth: input.dbsDateOfBirth,
      dbsWorkforceType: input.dbsWorkforceType
    });
    try {
      const response = await fetch(`/api/admin/traders/${trader.id}/documents/server-upload?${params.toString()}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": input.file.type },
        body: input.file
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to upload document");
      await openDocuments(trader);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to upload document"); }
    finally { setBusy(""); }
  }
  async function updateDdcStatus(status: string, adminNotes: string) {
    if (!reviewingTrader) return;
    setBusy(`ddc-${reviewingTrader.id}`); setError("");
    try {
      await api(`/api/admin/traders/${reviewingTrader.id}/ddc-pack`, { method: "PATCH", body: JSON.stringify({ status, adminNotes }) });
      const result = await api<{ pack: DdcPack | null; message?: string }>(`/api/admin/traders/${reviewingTrader.id}/ddc-pack`);
      setDdcPack(result.pack);
      setDdcMessage(result.message || "");
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update DDC status"); }
    finally { setBusy(""); }
  }
  async function inviteHandyman(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("invite"); setError(""); setInviteResult(null);
    try {
      const result = await api<{ invitationUrl: string; expiresAt: string; emailDeliveryStatus: string; smsDeliveryStatus?: string; smsProviderError?: string | null }>("/api/admin/traders/invitations", {
        method: "POST",
        body: JSON.stringify({ fullName: values.get("fullName"), email: values.get("email"), mobile: values.get("mobile") })
      });
      setInviteResult(result);
      form?.reset?.();
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
  async function saveRateCard(trader: Trader, payload: RateCardPayload) {
    setBusy(`rate-${trader.id}`); setError("");
    try {
      await api(`/api/admin/traders/${trader.id}/rate-cards`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setRateEditingTrader(null);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save rate card"); }
    finally { setBusy(""); }
  }
  async function priceAllServices(trader: Trader, selectedServices?: string[]) {
    const services = trader.services.length ? trader.services : ["All services"];
    const categories = selectedServices?.length ? selectedServices : services;
    setBusy(`rate-all-${trader.id}`); setError("");
    try {
      for (const serviceCategory of categories) {
        const template = defaultRateCards[serviceCategory] || fallbackRateCard;
        await api(`/api/admin/traders/${trader.id}/rate-cards`, {
          method: "POST",
          body: JSON.stringify({
            serviceCategory,
            postcodeArea: trader.postcodeArea || "ALL",
            callOutFee: template.callOutFee,
            hourlyRate: template.hourlyRate,
            fixedPrice: template.fixedPrice,
            minimumHours: template.minimumHours,
            materialsRule: template.materialsRule,
            vatRegistered: false,
            status: "approved",
            adminNotes: `Approved standard TaskBridge price. Fixed price covers up to ${STANDARD_LABOUR_MINUTES} minutes; materials are separate unless included. TaskBridge margin is included. Larger jobs require approval before release.`
          })
        });
      }
      setPriceReviewTrader(null);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to price all services"); }
    finally { setBusy(""); }
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Handyman</span><h1>Leads, onboarding and compliance</h1><p>Move a handyman from website application to invite, document review, DBS, insurance and activation in one place.</p></div>{user.role === "taskbridge_super_admin" && <button className="button button-primary" onClick={() => { setInviteOpen(!inviteOpen); setInviteResult(null); }}><UserPlus size={18} /> Register handyman</button>}</div>
    {error && <div className="alert alert-danger">{error}</div>}
    {inviteOpen && <section className="panel invite-handyman-panel">
      <div className="panel-heading"><div><h2>Register and invite a handyman</h2><p>An expiring one-use registration link will be sent to their email address.</p></div></div>
      <form className="invite-handyman-form" onSubmit={inviteHandyman}><label>Full name<input required name="fullName" minLength={2} autoComplete="off" /></label><label>Email address<input required name="email" type="email" autoComplete="off" /></label><label>Mobile number<input name="mobile" type="tel" placeholder="+44..." autoComplete="off" /></label><button className="button button-primary" disabled={busy === "invite"} type="submit">{busy === "invite" ? <><LoaderCircle className="spin" size={17} /> Sending...</> : <><Send size={17} /> Send registration link</>}</button></form>
      {inviteResult && <div className={`invitation-result ${inviteResult.emailDeliveryStatus === "sent" ? "sent" : "attention"}`}><div><strong>{inviteResult.emailDeliveryStatus === "sent" ? "Invitation email sent" : "Invitation created; email delivery needs configuration"}</strong><span>SMS: {humanize(inviteResult.smsDeliveryStatus || "not_configured")} · Expires {formatDate(inviteResult.expiresAt, true)}</span>{inviteResult.smsProviderError && <small>SMS reason: {inviteResult.smsProviderError}</small>}</div><div className="invitation-link"><input readOnly value={inviteResult.invitationUrl} aria-label="Handyman invitation URL" /><button className="icon-button" onClick={copyInvitationLink} type="button" aria-label="Copy invitation link"><Copy size={18} /></button><a className="icon-button" href={inviteResult.invitationUrl} target="_blank" rel="noreferrer" aria-label="Open invitation"><ExternalLink size={18} /></a></div></div>}
    </section>}
    <nav className="task-filter-links" aria-label="Filter handyman pipeline">{[
      ["all", "All"],
      ["leads", "Leads"],
      ["onboarding", "Onboarding"],
      ["action-needed", "Action needed"],
      ["approved", "DBS approved"]
    ].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => onFilter(key)} aria-pressed={filter === key}>{label}<span>{key === "leads" ? openLeads.length : key === "onboarding" ? onboardingTraders.length : key === "approved" ? traders.filter((trader) => trader.dbsStatus === "approved").length : key === "action-needed" ? actionNeededTraders.length + openLeads.length : traders.length + openLeads.length}</span></button>)}</nav>
    <section className="panel compliance-stage-panel">
      <div className="compliance-document-grid">
        <article className="compliance-document-card"><div className="compliance-document-heading"><span><Wrench size={19} /></span><div><h3>Lead intake</h3><p>Website applications awaiting review</p></div><StatusBadge status={openLeads.length ? "pending" : "approved"}>{openLeads.length}</StatusBadge></div></article>
        <article className="compliance-document-card"><div className="compliance-document-heading"><span><Send size={19} /></span><div><h3>Invited</h3><p>Token sent, waiting for registration</p></div><StatusBadge status="invited">{pendingInviteTraders.length || invitedLeads.length}</StatusBadge></div></article>
        <article className="compliance-document-card"><div className="compliance-document-heading"><span><FileCheck2 size={19} /></span><div><h3>Submitted</h3><p>Documents ready for review</p></div><StatusBadge status={submittedTraders.length ? "pending" : "approved"}>{submittedTraders.length}</StatusBadge></div></article>
        <article className="compliance-document-card"><div className="compliance-document-heading"><span><ShieldCheck size={19} /></span><div><h3>Compliance action</h3><p>DBS, identity or insurance still needs review</p></div><StatusBadge status={actionNeededTraders.length ? "pending" : "approved"}>{actionNeededTraders.length}</StatusBadge></div></article>
      </div>
    </section>
    <section className="handyman-recruitment-grid">
      <article className="panel recruitment-card">
        <div className="panel-heading"><div><h2>Ready for onboarding shortlist</h2><p>Strong leads based on insurance, DBS route, services and care-sector fit.</p></div></div>
        <div className="recruitment-list">
          {recruitment.readyLeads.map(({ item, score }) => <div key={item.id}><strong>{item.fullName}</strong><span className={`lead-score lead-score-${scoreBand(score)}`}>{score}/100</span><p>{item.postcode} / {item.services.slice(0, 3).join(", ")}</p></div>)}
          {!recruitment.readyLeads.length && <p className="muted-copy">No strong open leads yet. Keep sourcing and review new submissions.</p>}
        </div>
      </article>
      <article className="panel recruitment-card">
        <div className="panel-heading"><div><h2>Invite campaign status</h2><p>Which sources are producing open and invited leads.</p></div></div>
        <div className="source-funnel-list">
          {recruitment.sourceRows.map((source) => <div key={source.source}><strong>{compactSource(source.source)}</strong><span>{source.total} leads</span><i><b style={{ width: `${Math.round((source.invited / Math.max(1, source.total)) * 100)}%` }} /></i><small>{source.open} open / {source.invited} invited / {source.declined} declined</small></div>)}
          {!recruitment.sourceRows.length && <p className="muted-copy">No campaign sources yet.</p>}
        </div>
      </article>
      <article className="panel recruitment-card">
        <div className="panel-heading"><div><h2>Approved capacity</h2><p>Coverage by postcode area and service category.</p></div></div>
        <div className="capacity-list">
          {recruitment.serviceRows.map((row) => <span key={`${row.postcode}-${row.service}`}><strong>{row.postcode}</strong>{row.service}<b>{row.count}</b></span>)}
          {!recruitment.serviceRows.length && <p className="muted-copy">Approved service coverage will appear after compliance activation.</p>}
        </div>
      </article>
      <article className="panel recruitment-card">
        <div className="panel-heading"><div><h2>Care agency referral code</h2><p>Share this with agencies so trusted handymen enter the right campaign.</p></div></div>
        <div className="referral-code-card"><strong>{recruitment.referralCode}</strong><div className="invitation-link"><input readOnly value={recruitment.referralUrl} aria-label="Handyman referral link" /><button className="icon-button" onClick={() => navigator.clipboard.writeText(recruitment.referralUrl)} aria-label="Copy referral link"><Copy size={17} /></button></div></div>
      </article>
      <article className="panel recruitment-card recruitment-template-card">
        <div className="panel-heading"><div><h2>Email and SMS invite templates</h2><p>Pre-approved wording for controlled outreach.</p></div></div>
        <div className="template-snippets">
          <p><strong>Email</strong> Join TaskBridge as a vetted local home-safety operative supporting care organisations with practical, approved tasks for older and vulnerable residents.</p>
          <p><strong>SMS</strong> TaskBridge: trusted local handyman panel now open. Clear care-approved tasks, safeguarded visits and evidence workflow. Apply: {window.location.origin}/join-handyman</p>
        </div>
      </article>
    </section>
    {showLeadQueue && <HandymanJoinRequestDesk requests={filter === "leads" ? joinRequests : openLeads} onChanged={onChanged} embedded />}
    {filter !== "leads" && <>
    <section className="panel table-panel">
      <div className="responsive-table"><table><thead><tr><th>Handyman</th><th>Lead source</th><th>Business</th><th>Onboarding</th><th>Services</th><th>Rate card</th><th>DBS route</th><th>Insurance</th><th>Quality</th><th>Action</th></tr></thead><tbody>{filteredTraders.map((trader) => <tr key={trader.id}>
        <td><strong>{trader.displayName}</strong><small>Email: {trader.email || "Not provided"}</small><small>Mobile: {trader.mobile || "Not provided"}</small></td>
        <td>{trader.leadId ? <><StatusBadge status={trader.leadStatus || "invited"}>{humanize(trader.leadStatus || "invited")}</StatusBadge><small>Website lead {trader.leadCreatedAt ? formatDate(trader.leadCreatedAt, true) : ""}</small></> : <small>Manual compliance record</small>}</td>
        <td><strong>{trader.businessName || "No business name"}</strong><small>{humanize(trader.tradingStatus || "sole_trader")}</small>{trader.companyRegistrationNumber && <small>Company reg: {trader.companyRegistrationNumber}</small>}{trader.vatNumber && <small>VAT: {trader.vatNumber}</small>}</td>
        <td><StatusBadge status={trader.onboardingStatus}>{humanize(trader.onboardingStatus)}</StatusBadge><small>{trader.emailDeliveryStatus ? `Email: ${humanize(trader.emailDeliveryStatus)}` : "Marketplace record"}</small></td>
        <td><span className="service-summary" title={trader.services.join(", ")}>{trader.services.length ? `${trader.services.slice(0, 2).join(", ")}${trader.services.length > 2 ? ` +${trader.services.length - 2}` : ""}` : "Awaiting registration"}</span></td>
        <td><RateCardSummary trader={trader} /></td>
        <td><StatusBadge status={trader.dbsStatus}>{humanize(trader.dbsStatus)}</StatusBadge><small>{trader.dbsExpiryDate ? `Expires ${formatDate(trader.dbsExpiryDate)}` : dbsRouteLabel(trader)}</small>{trader.dbsOutcome && <small className="table-note">{trader.dbsOutcome}</small>}</td>
        <td><StatusBadge status={trader.insuranceStatus}>{humanize(trader.insuranceStatus)}</StatusBadge><small>{trader.insuranceExpiryDate ? `Expires ${formatDate(trader.insuranceExpiryDate)}` : "No active expiry"}</small></td>
        <td><span className="rating"><Star size={15} /> {trader.qualityScore}</span></td>
        <td><div className="row-actions"><button className="button button-secondary button-small" disabled={identityPreviewLoading && identityPreviewTrader?.id === trader.id} onClick={() => openIdentityPreview(trader)}>ID</button><button className="button button-secondary button-small" disabled={busy === `rate-all-${trader.id}`} onClick={() => setPriceReviewTrader(trader)}><CreditCard size={15} /> Price all</button><button className="button button-secondary button-small" disabled={busy === `rate-${trader.id}`} onClick={() => setRateEditingTrader(trader)}><CreditCard size={15} /> Edit rate</button><button className="button button-secondary button-small" disabled={documentsLoading && reviewingTrader?.id === trader.id} onClick={() => openDocuments(trader)}><FileCheck2 size={15} /> Review documents</button><button className="button button-secondary button-small" disabled={busy === trader.id || trader.onboardingStatus === "pending"} onClick={() => startCheck(trader)}>Start DBS route</button><button className="button button-secondary button-small" disabled={busy === `business-${trader.id}`} onClick={() => setBusinessEditingTrader(trader)}>{busy === `business-${trader.id}` ? "Saving..." : "Edit business"}</button>{user.role === "taskbridge_super_admin" && trader.onboardingStatus === "pending" ? <button className="icon-button danger-icon" disabled={busy === trader.id} onClick={() => revokeInvitation(trader)} aria-label="Revoke invitation"><Trash2 size={18} /></button> : user.role === "taskbridge_super_admin" && <><button className="icon-button success-icon" onClick={() => review(trader, "approved")} aria-label="Approve DBS"><BadgeCheck size={18} /></button><button className="icon-button danger-icon" onClick={() => review(trader, "rejected")} aria-label="Reject DBS"><CircleAlert size={18} /></button></>}</div></td>
      </tr>)}</tbody></table></div>
      {!filteredTraders.length && <EmptyState icon={<BadgeCheck />} title="No handymen in this view" detail="Choose another compliance filter to review the registry." />}
    </section>
    </>}
    {identityPreviewTrader && <IdentityDocumentPreviewModal trader={identityPreviewTrader} document={identityPreviewDocument} loading={identityPreviewLoading} busy={busy} onClose={() => { setIdentityPreviewTrader(null); setIdentityPreviewDocument(null); }} onReview={reviewIdentityDocument} />}
    {businessEditingTrader && <BusinessProfileModal trader={businessEditingTrader} busy={busy === `business-${businessEditingTrader.id}`} onClose={() => setBusinessEditingTrader(null)} onSave={saveBusinessProfile} />}
    {rateEditingTrader && <RateCardModal trader={rateEditingTrader} busy={busy === `rate-${rateEditingTrader.id}`} onClose={() => setRateEditingTrader(null)} onSave={saveRateCard} />}
    {priceReviewTrader && <PriceAllServicesModal trader={priceReviewTrader} busy={busy === `rate-all-${priceReviewTrader.id}`} onClose={() => setPriceReviewTrader(null)} onConfirm={priceAllServices} />}
    {reviewingTrader && <div className="modal-backdrop"><ComplianceDocumentReview trader={reviewingTrader} documents={documents} ddcPack={ddcPack} ddcMessage={ddcMessage} loading={documentsLoading} busy={busy} onClose={() => { setReviewingTrader(null); setDocuments([]); setDdcPack(null); setDdcMessage(""); }} onReview={reviewDocument} onUpload={uploadComplianceDocument} onDdcStatus={updateDdcStatus} /></div>}
  </>;
}

function dbsRouteLabel(trader: Trader) {
  if (trader.dbsRoute === "self_submitted_certificate") return `Certificate submitted / ${humanize(trader.updateServiceStatus || "not_checked")}`;
  if (trader.dbsRoute === "umbrella_application_required") return "DBS application route required";
  if (trader.dbsRoute === "basic_dbs_provider_application") return "Basic DBS provider route";
  if (trader.dbsRoute === "basic_or_not_sure") return "Limited to non-vulnerable or supervised work";
  return "No active expiry";
}

function nextAnnualReviewDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function dbsCheckFields(document: ComplianceDocument) {
  const fields = [
    ["Certificate number", document.dbsCheck?.certificateNumber || document.reference || ""],
    ["Current surname", document.dbsCheck?.currentSurname || ""],
    ["Date of birth", document.dbsCheck?.dateOfBirth || ""],
    ["Certificate issue date", document.dbsCheck?.issueDate || document.issueDate || ""]
  ].filter(([, value]) => value);
  return fields;
}

function IdentityDocumentPreviewModal({ trader, document, loading, busy, onClose, onReview }: {
  trader: Trader;
  document: ComplianceDocument | null;
  loading: boolean;
  busy: string;
  onClose: () => void;
  onReview: (document: ComplianceDocument, status: "approved" | "rejected") => Promise<void>;
}) {
  const canPreviewImage = Boolean(document?.reviewUrl && document.contentType.startsWith("image/"));
  const canPreviewFrame = Boolean(document?.reviewUrl && !canPreviewImage);
  return <div className="modal-backdrop">
    <section className="modal admin-modal admin-modal-wide identity-preview-modal">
      <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <div className="panel-heading"><div><span className="eyebrow">Submitted ID</span><h2>{trader.displayName}</h2><p>Preview the identity evidence submitted during onboarding.</p></div>{document && <StatusBadge status={document.reviewStatus}>{humanize(document.reviewStatus)}</StatusBadge>}</div>
      {loading && <div className="app-loading"><LoaderCircle className="spin" /> Loading submitted ID...</div>}
      {!loading && !document && <EmptyState icon={<UserCheck />} title="No ID submitted" detail="This handyman has not uploaded an identity document yet." />}
      {!loading && document && <div className="identity-preview-layout">
        <div className="identity-preview-frame">
          {canPreviewImage && <img src={document.reviewUrl || ""} alt={`${trader.displayName} submitted ID`} />}
          {canPreviewFrame && <iframe src={document.reviewUrl || ""} title={`${trader.displayName} submitted ID`} />}
          {!document.reviewUrl && <div className="document-unavailable">Secure preview unavailable</div>}
        </div>
        <aside className="identity-preview-details">
          <h3>{document.originalFilename}</h3>
          <dl>
            <div><dt>Submitted</dt><dd>{formatDate(document.createdAt, true)}</dd></div>
            {document.reference && <div><dt>Reference</dt><dd>{document.reference}</dd></div>}
            {document.issueDate && <div><dt>Issue date</dt><dd>{formatDate(document.issueDate)}</dd></div>}
            {document.expiryDate && <div><dt>Expiry date</dt><dd>{formatDate(document.expiryDate)}</dd></div>}
            <div><dt>File size</dt><dd>{Math.max(1, Math.round(document.sizeBytes / 1024))} KB</dd></div>
          </dl>
          {document.reviewNotes && <p className="review-note"><strong>Review note:</strong> {document.reviewNotes}</p>}
          <div className="compliance-document-actions">
            {document.reviewUrl && <a className="button button-secondary button-small" href={document.reviewUrl} target="_blank" rel="noreferrer">Open full file <ExternalLink size={15} /></a>}
            {document.reviewStatus === "pending" && <>
              <button className="button button-success button-small" disabled={busy === document.id || !document.reviewUrl} onClick={() => onReview(document, "approved")}>Approve ID</button>
              <button className="button button-secondary button-small document-reject" disabled={busy === document.id} onClick={() => onReview(document, "rejected")}>Reject</button>
            </>}
          </div>
        </aside>
      </div>}
    </section>
  </div>;
}

function BusinessProfileModal({ trader, busy, onClose, onSave }: {
  trader: Trader;
  busy: boolean;
  onClose: () => void;
  onSave: (trader: Trader, payload: { displayName: string; businessName: string; mobile: string; postcodeArea: string }) => Promise<void>;
}) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await onSave(trader, {
      displayName: String(values.get("displayName") || ""),
      businessName: String(values.get("businessName") || ""),
      mobile: String(values.get("mobile") || ""),
      postcodeArea: String(values.get("postcodeArea") || "")
    });
  }
  return <div className="modal-backdrop">
    <form className="modal admin-modal" onSubmit={submit}>
      <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <span className="eyebrow">Handyman profile</span>
      <h2>Edit business details</h2>
      <p>Update the details TaskBridge admins use for compliance, follow-up and matching.</p>
      <div className="field-row"><label>Display name<input name="displayName" required minLength={2} defaultValue={trader.displayName} /></label><label>Business or company name<input name="businessName" defaultValue={trader.businessName || ""} placeholder="Optional" /></label></div>
      <div className="field-row"><label>Mobile number<input name="mobile" type="tel" defaultValue={trader.mobile || ""} placeholder="+447712345678" /></label><label>Postcode area<input name="postcodeArea" defaultValue={trader.postcodeArea || ""} placeholder="PE1 or ALL" /></label></div>
      <div className="modal-action-row"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving..." : "Save details"}</button></div>
    </form>
  </div>;
}

function RateCardModal({ trader, busy, onClose, onSave }: {
  trader: Trader;
  busy: boolean;
  onClose: () => void;
  onSave: (trader: Trader, payload: RateCardPayload) => Promise<void>;
}) {
  const existing = trader.rateCards.find((card) => card.status === "approved") || trader.rateCards[0];
  const defaultService = existing?.serviceCategory || trader.services[0] || "All services";
  const template = defaultRateCards[defaultService] || fallbackRateCard;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const fixedPriceText = String(values.get("fixedPrice") || "").trim();
    const hourlyRateText = String(values.get("hourlyRate") || "").trim();
    const fixedPrice = fixedPriceText ? Number(fixedPriceText) : null;
    const hourlyRate = hourlyRateText ? Number(hourlyRateText) : null;
    const callOutFee = Number(values.get("callOutFee") || 0);
    const minimumHours = Number(values.get("minimumHours") || 1);
    const materialsCapText = String(values.get("materialsCap") || "").trim();
    if ((fixedPrice === null && hourlyRate === null) || !Number.isFinite(callOutFee) || !Number.isFinite(minimumHours)) return;
    await onSave(trader, {
      serviceCategory: String(values.get("serviceCategory") || defaultService),
      postcodeArea: String(values.get("postcodeArea") || trader.postcodeArea || "ALL"),
      callOutFee,
      hourlyRate,
      fixedPrice,
      minimumHours,
      materialsRule: String(values.get("materialsRule") || "charged_with_receipt") as RateCardPayload["materialsRule"],
      materialsCap: materialsCapText ? Number(materialsCapText) : null,
      emergencyUpliftPercent: Number(values.get("emergencyUpliftPercent") || 0),
      vatRegistered: values.get("vatRegistered") === "on",
      status: "approved",
      adminNotes: String(values.get("adminNotes") || `Approved by TaskBridge operations. Fixed price covers up to ${STANDARD_LABOUR_MINUTES} minutes; materials are separate unless included. TaskBridge margin is included. Larger jobs require approval before release.`)
    });
  }
  return <div className="modal-backdrop">
    <form className="modal admin-modal admin-modal-wide" onSubmit={submit}>
      <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <span className="eyebrow">Rate card</span>
      <h2>Edit agreed rate</h2>
      <p>Set the unit price, payout basis and material rule in one place. VAT is not included here; it is added at invoice stage where applicable.</p>
      <div className="field-row"><label>Service category<select name="serviceCategory" defaultValue={defaultService}>{Array.from(new Set([defaultService, ...trader.services, "All services", ...Object.keys(defaultRateCards)])).map((service) => <option key={service} value={service}>{service}</option>)}</select></label><label>Postcode area<input name="postcodeArea" defaultValue={existing?.postcodeArea || trader.postcodeArea || "ALL"} /></label></div>
      <div className="field-row"><label>Fixed unit price GBP<input name="fixedPrice" type="number" min="0" step="0.01" defaultValue={existing?.fixedPrice ?? template.fixedPrice ?? ""} /></label><label>Hourly rate GBP<input name="hourlyRate" type="number" min="0" step="0.01" defaultValue={existing?.hourlyRate ?? template.hourlyRate ?? ""} /></label></div>
      <div className="field-row"><label>Call-out fee GBP<input name="callOutFee" type="number" min="0" step="0.01" defaultValue={existing?.callOutFee ?? template.callOutFee} /></label><label>Minimum billable hours<input name="minimumHours" type="number" min="0" max="24" step="0.25" defaultValue={existing?.minimumHours ?? template.minimumHours} /></label></div>
      <div className="field-row"><label>Materials rule<select name="materialsRule" defaultValue={existing?.materialsRule || template.materialsRule}><option value="included">Included where stated</option><option value="charged_with_receipt">Separate with receipt</option><option value="capped">Capped and agreed</option><option value="not_included">Not included</option></select></label><label>Materials cap GBP<input name="materialsCap" type="number" min="0" step="0.01" defaultValue={existing?.materialsCap ?? ""} placeholder="Optional" /></label></div>
      <div className="field-row"><label>Emergency uplift %<input name="emergencyUpliftPercent" type="number" min="0" max="300" step="1" defaultValue={existing?.emergencyUpliftPercent ?? 0} /></label><label className="toggle-row compact-toggle"><input name="vatRegistered" type="checkbox" defaultChecked={Boolean(existing?.vatRegistered)} /><span><strong>VAT registered handyman</strong><small>Shown for admin awareness; VAT is applied separately on invoice.</small></span></label></div>
      <label>Admin notes<textarea name="adminNotes" rows={3} defaultValue={existing?.adminNotes || `Approved by TaskBridge operations. Fixed price covers up to ${STANDARD_LABOUR_MINUTES} minutes; materials are separate unless included. TaskBridge margin is included. Larger jobs require approval before release.`} /></label>
      <RatePreview fixedPrice={existing?.fixedPrice ?? template.fixedPrice} hourlyRate={existing?.hourlyRate ?? template.hourlyRate} callOutFee={existing?.callOutFee ?? template.callOutFee} minimumHours={existing?.minimumHours ?? template.minimumHours} />
      <div className="modal-action-row"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving..." : "Approve rate"}</button></div>
    </form>
  </div>;
}

function PriceAllServicesModal({ trader, busy, onClose, onConfirm }: {
  trader: Trader;
  busy: boolean;
  onClose: () => void;
  onConfirm: (trader: Trader, selectedServices: string[]) => Promise<void>;
}) {
  const services = trader.services.length ? trader.services : ["All services"];
  const [selected, setSelected] = useState(services);
  const rows = services.map((service) => {
    const template = defaultRateCards[service] || fallbackRateCard;
    const unitPrice = template.fixedPrice ?? template.callOutFee + (template.hourlyRate || 0) * template.minimumHours;
    const split = splitIncludedMargin(unitPrice);
    return { service, template, unitPrice, split };
  });
  function toggle(service: string) {
    setSelected((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);
  }
  return <div className="modal-backdrop">
    <section className="modal admin-modal admin-modal-wide">
      <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <span className="eyebrow">Standard pricing</span>
      <h2>Review prices before applying</h2>
      <p>These are TaskBridge standard unit prices. Each fixed price covers up to {STANDARD_LABOUR_MINUTES} minutes, with materials handled separately unless stated.</p>
      <div className="price-review-table"><table><thead><tr><th>Apply</th><th>Service</th><th>Unit price</th><th>Handyman payout</th><th>TaskBridge margin</th><th>Materials</th></tr></thead><tbody>{rows.map((row) => <tr key={row.service}><td><input type="checkbox" checked={selected.includes(row.service)} onChange={() => toggle(row.service)} /></td><td>{row.service}</td><td>GBP {row.unitPrice.toFixed(2)}</td><td>GBP {row.split.handymanPayout.toFixed(2)}</td><td>GBP {row.split.taskbridgeMargin.toFixed(2)}</td><td>{materialRuleLabel(row.template.materialsRule)}</td></tr>)}</tbody></table></div>
      <div className="modal-action-row"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || !selected.length} onClick={() => onConfirm(trader, selected)}>{busy ? "Applying..." : `Apply ${selected.length} price${selected.length === 1 ? "" : "s"}`}</button></div>
    </section>
  </div>;
}

function RatePreview({ fixedPrice, hourlyRate, callOutFee, minimumHours }: {
  fixedPrice: string | number | null | undefined;
  hourlyRate: string | number | null | undefined;
  callOutFee: string | number | null | undefined;
  minimumHours: string | number | null | undefined;
}) {
  const unitPrice = fixedPrice !== null && fixedPrice !== undefined && fixedPrice !== ""
    ? Number(fixedPrice)
    : Number(callOutFee || 0) + Number(hourlyRate || 0) * Number(minimumHours || 1);
  const split = splitIncludedMargin(unitPrice);
  return <div className="rate-preview-card">
    <span><strong>Unit price</strong>GBP {unitPrice.toFixed(2)}</span>
    <span><strong>Handyman payout</strong>GBP {split.handymanPayout.toFixed(2)}</span>
    <span><strong>TaskBridge margin</strong>GBP {split.taskbridgeMargin.toFixed(2)}</span>
  </div>;
}

function RateCardSummary({ trader }: { trader: Trader }) {
  const approved = trader.rateCards.filter((card) => card.status === "approved");
  const primary = approved[0] || trader.rateCards[0];
  if (!primary) return <><StatusBadge status="pending">Missing</StatusBadge><small>No agreed price</small></>;
  const fixedPrice = primary.fixedPrice !== null && primary.fixedPrice !== undefined ? Number(primary.fixedPrice) : null;
  const hourlyRate = primary.hourlyRate !== null && primary.hourlyRate !== undefined ? Number(primary.hourlyRate) : null;
  const callOut = Number(primary.callOutFee || 0);
  const minimumHours = Number(primary.minimumHours || 1);
  const estimate = fixedPrice !== null ? fixedPrice : callOut + (hourlyRate || 0) * minimumHours;
  const split = splitIncludedMargin(estimate);
  return <>
    <StatusBadge status={primary.status}>{humanize(primary.status)}</StatusBadge>
    <small>{primary.serviceCategory} / {primary.postcodeArea || "ALL"}</small>
    <small>Unit price: GBP {estimate.toFixed(2)}{fixedPrice === null && hourlyRate !== null ? ` (${minimumHours}h min)` : ""}</small>
    <small>Payout: GBP {split.handymanPayout.toFixed(2)} / margin: GBP {split.taskbridgeMargin.toFixed(2)}</small>
    <small>Up to {STANDARD_LABOUR_MINUTES} mins labour. {materialRuleLabel(primary.materialsRule)}.</small>
    {approved.length > 1 && <small>{approved.length} approved cards</small>}
  </>;
}

function ComplianceDocumentReview({ trader, documents, ddcPack, ddcMessage, loading, busy, onClose, onReview, onUpload, onDdcStatus }: {
  trader: Trader;
  documents: ComplianceDocument[];
  ddcPack: DdcPack | null;
  ddcMessage: string;
  loading: boolean;
  busy: string;
  onClose: () => void;
  onReview: (document: ComplianceDocument, status: "approved" | "rejected") => Promise<void>;
  onUpload: (trader: Trader, input: AdminDocumentUploadInput) => Promise<void>;
  onDdcStatus: (status: string, adminNotes: string) => Promise<void>;
}) {
  const identity = documents.find((document) => document.documentType === "identity");
  const insurance = documents.find((document) => document.documentType === "public_liability_insurance");
  return <section className="modal admin-modal admin-modal-wide compliance-review-panel">
    <div className="panel-heading"><div><span className="eyebrow">Submitted evidence</span><h2>{trader.displayName}</h2><p>Services: {trader.services.length ? trader.services.join(", ") : "No services selected"}</p></div><button className="button button-secondary button-small" onClick={onClose}>Close</button></div>
    {!loading && <div className="compliance-document-grid">
      <article className="compliance-document-card"><div className="compliance-document-heading"><span><UserCheck size={19} /></span><div><h3>Identity</h3><p>Must be approved before dispatch</p></div><StatusBadge status={identity?.reviewStatus || "pending"}>{humanize(identity?.reviewStatus || "missing")}</StatusBadge></div></article>
      <article className="compliance-document-card"><div className="compliance-document-heading"><span><ShieldCheck size={19} /></span><div><h3>Insurance</h3><p>Public liability evidence must be current</p></div><StatusBadge status={insurance?.reviewStatus || "pending"}>{humanize(insurance?.reviewStatus || "missing")}</StatusBadge></div></article>
      <article className="compliance-document-card"><div className="compliance-document-heading"><span><BadgeCheck size={19} /></span><div><h3>DBS route</h3><p>Approve submitted evidence or record a manual DBS decision</p></div><StatusBadge status={trader.dbsStatus}>{humanize(trader.dbsStatus)}</StatusBadge></div></article>
      <article className="compliance-document-card"><div className="compliance-document-heading"><span><FileCheck2 size={19} /></span><div><h3>Activation</h3><p>Active only after identity, insurance and DBS are approved</p></div><StatusBadge status={trader.status}>{humanize(trader.status)}</StatusBadge></div></article>
    </div>}
    {!loading && <AdminDocumentUploadPanel trader={trader} busy={busy === `upload-doc-${trader.id}`} onUpload={onUpload} />}
    {!loading && <DdcRegistrationPack pack={ddcPack} message={ddcMessage} busy={busy} onStatus={onDdcStatus} />}
    {loading ? <div className="app-loading"><LoaderCircle className="spin" /> Loading secure documents...</div> : <div className="compliance-document-grid">{documents.map((document) => <article key={document.id} className="compliance-document-card">
      <div className="compliance-document-heading"><span><FileCheck2 size={19} /></span><div><h3>{humanize(document.documentType)}</h3><p>{document.originalFilename}</p></div><StatusBadge status={document.reviewStatus}>{humanize(document.reviewStatus)}</StatusBadge></div>
      <dl><div><dt>Submitted</dt><dd>{formatDate(document.createdAt, true)}</dd></div>{document.reference && <div><dt>Reference</dt><dd>{document.reference}</dd></div>}{document.issueDate && <div><dt>Issue date</dt><dd>{formatDate(document.issueDate)}</dd></div>}{document.expiryDate && <div><dt>Expiry date</dt><dd>{formatDate(document.expiryDate)}</dd></div>}<div><dt>File size</dt><dd>{Math.max(1, Math.round(document.sizeBytes / 1024))} KB</dd></div></dl>
      {document.documentType === "enhanced_dbs" && <DbsCertificateCheckHelper document={document} />}
      {document.reviewNotes && <p className="review-note"><strong>Review note:</strong> {document.reviewNotes}</p>}
      <div className="compliance-document-actions">{document.reviewUrl ? <a className="button button-secondary button-small" href={document.reviewUrl} target="_blank" rel="noreferrer">Open evidence <ExternalLink size={15} /></a> : <span className="document-unavailable">Secure preview unavailable</span>}{document.reviewStatus === "pending" && <><button className="button button-success button-small" disabled={busy === document.id || !document.reviewUrl || (document.documentType === "enhanced_dbs" && (!document.dbsCheck?.certificateNumber || !document.dbsCheck.currentSurname || !document.dbsCheck.dateOfBirth))} onClick={() => onReview(document, "approved")}>{document.documentType === "enhanced_dbs" ? "Approve after match" : "Approve"}</button><button className="button button-secondary button-small document-reject" disabled={busy === document.id} onClick={() => onReview(document, "rejected")}>Reject</button></>}</div>
    </article>)}</div>}
    {!loading && !documents.length && <EmptyState icon={<FileCheck2 />} title="No documents submitted" detail="The handyman has not completed document registration." />}
  </section>;
}

function AdminDocumentUploadPanel({ trader, busy, onUpload }: {
  trader: Trader;
  busy: boolean;
  onUpload: (trader: Trader, input: AdminDocumentUploadInput) => Promise<void>;
}) {
  const [documentType, setDocumentType] = useState<AdminDocumentUploadInput["documentType"]>("enhanced_dbs");
  const [file, setFile] = useState<File | null>(null);
  const isDbs = documentType === "enhanced_dbs";
  const isInsurance = documentType === "public_liability_insurance";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const values = new FormData(event.currentTarget);
    await onUpload(trader, {
      documentType,
      file,
      reference: String(values.get("reference") || ""),
      issueDate: String(values.get("issueDate") || ""),
      expiryDate: String(values.get("expiryDate") || ""),
      dbsCurrentSurname: String(values.get("dbsCurrentSurname") || ""),
      dbsDateOfBirth: String(values.get("dbsDateOfBirth") || ""),
      dbsWorkforceType: String(values.get("dbsWorkforceType") || "adult") as AdminDocumentUploadInput["dbsWorkforceType"]
    });
    event.currentTarget.reset();
    setFile(null);
  }
  return <form className="admin-document-upload-panel" onSubmit={submit}>
    <div className="ddc-pack-heading"><div><span className="eyebrow">Admin upload</span><h3>Upload evidence for this handyman</h3><p>Use this when a handyman sends evidence outside the onboarding form, for example by text, WhatsApp or email.</p></div></div>
    <div className="field-row"><label>Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value as AdminDocumentUploadInput["documentType"])}><option value="enhanced_dbs">DBS certificate</option><option value="identity">ID / form of ID</option><option value="public_liability_insurance">Public liability insurance</option><option value="qualification">Qualification</option></select></label><label>File<input required type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label></div>
    <div className="field-row"><label>{isInsurance ? "Policy reference" : isDbs ? "DBS certificate reference" : "Reference"}<input name="reference" placeholder={isDbs ? "Certificate number" : isInsurance ? "Policy number" : "Optional"} /></label><label>{isInsurance ? "Expiry date" : "Issue date"}<input name={isInsurance ? "expiryDate" : "issueDate"} type="date" required={isInsurance} /></label></div>
    {isDbs && <div className="field-row"><label>Surname on certificate<input name="dbsCurrentSurname" placeholder="Required before DBS approval" /></label><label>Date of birth on certificate<input name="dbsDateOfBirth" type="date" /></label></div>}
    {isDbs && <div className="field-row"><label>DBS workforce<select name="dbsWorkforceType" defaultValue="adult"><option value="adult">Adult workforce</option><option value="child">Child workforce</option><option value="adult_and_child">Adult and child workforce</option><option value="unknown">Unknown</option></select></label></div>}
    <div className="modal-action-row"><button className="button button-secondary button-small" disabled={!file || busy} type="submit">{busy ? "Uploading..." : "Upload to compliance file"}</button></div>
  </form>;
}

function DbsCertificateCheckHelper({ document }: { document: ComplianceDocument }) {
  const fields = dbsCheckFields(document);
  const ready = Boolean(document.dbsCheck?.certificateNumber && document.dbsCheck.currentSurname && document.dbsCheck.dateOfBirth);
  return <div className={`dbs-check-helper ${ready ? "ready" : "manual"}`}>
    <div>
      <strong>{ready ? "Ready for official DBS check" : "Manual DBS confirmation needed"}</strong>
      <p>{ready
        ? "Use the copied details with the Home Office certificate route. Approve only when the uploaded evidence and official result match."
        : "The uploaded DBS evidence does not include all required details. Ask the handyman to resubmit, or record a manual DBS decision from the action row."}</p>
    </div>
    {fields.length > 0 && <div className="dbs-check-fields">{fields.map(([label, value]) => <span key={label}><b>{label}</b><code>{value}</code><button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(value)} aria-label={`Copy ${label}`}><Copy size={15} /></button></span>)}</div>}
    <a className="button button-secondary button-small" href={document.dbsCheck?.homeOfficeCheckUrl || HOME_OFFICE_DBS_CHECK_URL} target="_blank" rel="noreferrer">Open Home Office DBS check <ExternalLink size={15} /></a>
  </div>;
}

function DdcRegistrationPack({ pack, message, busy, onStatus }: { pack: DdcPack | null; message: string; busy: string; onStatus: (status: string, adminNotes: string) => Promise<void> }) {
  const [status, setStatus] = useState(pack?.status || "ready_to_enter");
  const [adminNotes, setAdminNotes] = useState(pack?.adminNotes || "");
  useEffect(() => {
    setStatus(pack?.status || "ready_to_enter");
    setAdminNotes(pack?.adminNotes || "");
  }, [pack?.status, pack?.adminNotes]);
  if (!pack) return <section className="ddc-pack-panel ddc-pack-empty"><div><BadgeCheck size={20} /><strong>DDC registration pack</strong></div><p>{message || "No DDC DBS application pack is available for this handyman."}</p></section>;
  const fields = [
    ["Title", pack.title],
    ["Forename", pack.forename],
    ["Middle", pack.middleNames],
    ["Surname", pack.surname],
    ["Date of birth", pack.dateOfBirth],
    ["National Insurance Number", pack.nationalInsuranceNumber],
    ["Contact telephone number", pack.mobile],
    ["Daytime telephone number", pack.daytimeTelephone],
    ["Email", pack.email || ""],
    ["Confirm Applicant Contact Email", pack.confirmEmail || ""],
    ["Role", pack.role],
    ["Your reference: Applicant ID", pack.applicantReference],
    ["Your reference: Location ID", pack.locationReference],
    ["Any extra comments DDC should know", pack.ddcComment]
  ].filter(([, value]) => value);
  return <section className="ddc-pack-panel">
    <div className="ddc-pack-heading"><div><span className="eyebrow">DDC manual DBS helper</span><h3>Copy-ready registration pack</h3><p>Use these fields to complete the DDC applicant screen while API integration is unavailable.</p></div><StatusBadge status={pack.status}>{humanize(pack.status)}</StatusBadge></div>
    <div className="ddc-route-note"><strong>{pack.applicantEntryMode === "applicant_input_own_data" ? "Use: Applicant to input own data" : "Use: Applicant present, admin inputs data"}</strong><span>DDC role should remain {pack.role} unless eligibility guidance says otherwise.</span></div>
    <div className="ddc-field-grid">{fields.map(([label, value]) => <div className="ddc-copy-field" key={label}><span>{label}</span><code>{value}</code><button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(value)} aria-label={`Copy ${label}`}><Copy size={16} /></button></div>)}</div>
    <div className="ddc-status-row"><label>DDC status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="not_started">Not started</option><option value="ready_to_enter">Ready to enter</option><option value="ddc_invite_sent">DDC invite sent</option><option value="applicant_submitted">Applicant submitted</option><option value="awaiting_result">Awaiting result</option><option value="approved">Approved</option><option value="query">Query</option><option value="rejected">Rejected</option></select></label><label>Admin notes<input value={adminNotes} maxLength={1000} onChange={(event) => setAdminNotes(event.target.value)} placeholder="Optional DDC tracking note" /></label><button className="button button-secondary button-small" disabled={busy.startsWith("ddc-")} onClick={() => onStatus(status, adminNotes)}>{busy.startsWith("ddc-") ? "Saving..." : "Save DDC status"}</button></div>
  </section>;
}

function AgencyOnboarding({ agencies, onChanged }: { agencies: Agency[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [issuedKey, setIssuedKey] = useState("");
  const [staffInvitation, setStaffInvitation] = useState<{ url: string; delivery: string } | null>(null);
  const [activeIntegrationAgencyId, setActiveIntegrationAgencyId] = useState("");
  const [activeSettingsAgencyId, setActiveSettingsAgencyId] = useState("");
  async function createAgency(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess(""); setIssuedKey(""); setStaffInvitation(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const result = await api<{ apiKey: string; invitationUrl: string; emailDeliveryStatus: string; careIntegrationEmailDeliveryStatus?: string | null }>("/api/admin/agencies", { method: "POST", body: JSON.stringify({
        name: values.get("name"),
        primaryContactName: values.get("primaryContactName"),
        primaryContactEmail: values.get("primaryContactEmail"),
        workEmailDomain: values.get("workEmailDomain"),
        careManagementIntegrationRequested: values.get("careManagementIntegrationRequested") === "on"
      }) });
      const baseMessage = result.emailDeliveryStatus === "sent"
        ? "Care agency created and manager invitation sent."
        : "Care agency created. Manager email delivery requires configuration.";
      const integrationMessage = result.careIntegrationEmailDeliveryStatus
        ? ` Care-management integration email ${result.careIntegrationEmailDeliveryStatus === "sent" ? "sent." : "requires email configuration."}`
        : "";
      setSuccess(`${baseMessage}${integrationMessage}`);
      setIssuedKey(result.apiKey);
      setStaffInvitation({ url: result.invitationUrl, delivery: result.emailDeliveryStatus });
      form?.reset?.();
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to onboard care agency"); }
    finally { setBusy(false); }
  }
  async function updateSettings(event: React.FormEvent<HTMLFormElement>, agency: Agency) {
    event.preventDefault();
    const current = agency.settings;
    const values = new FormData(event.currentTarget);
    const monthlyCap = Number(values.get("monthlyCap") || current?.monthlyCap || 500);
    if (!Number.isFinite(monthlyCap)) return;
    const goLiveStatus = String(values.get("goLiveStatus") || current?.goLiveStatus || "pilot_live");
    const healthAnalyticsEnabled = values.get("healthAnalytics") === "unlocked";
    const rotaPlannerEnabled = values.get("rotaPlanner") === "unlocked";
    const careOsEnabled = values.get("careOs") === "unlocked";
    setSettingsBusy(agency.id); setError("");
    try {
      await api(`/api/admin/agencies/${agency.id}/settings`, { method: "PATCH", body: JSON.stringify({
        vulnerableAdultRequiresEnhancedDbs: current?.vulnerableAdultRequiresEnhancedDbs ?? true,
        completionRequiresCareConfirmation: current?.completionRequiresCareConfirmation ?? true,
        supervisedVisitExceptionAllowed: current?.supervisedVisitExceptionAllowed ?? false,
        taskbridgeAssignmentRequiresAdminReview: current?.taskbridgeAssignmentRequiresAdminReview ?? true,
        healthAnalyticsEnabled,
        rotaPlannerEnabled,
        careOsEnabled,
        defaultVisitRadiusMiles: current?.defaultVisitRadiusMiles ?? 15,
        goLiveStatus,
        monthlyCap
      }) });
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update agency settings"); }
    finally { setSettingsBusy(""); }
  }
  async function configureIntegration(event: React.FormEvent<HTMLFormElement>, agency: Agency) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const provider = String(values.get("provider") || "generic");
    setSettingsBusy(`${agency.id}-integration`); setError(""); setSuccess("");
    try {
      await api(`/api/admin/agencies/${agency.id}/integrations`, { method: "PATCH", body: JSON.stringify({
        provider,
        enabled: true,
        externalAccountId: values.get("externalAccountId"),
        providerApiBaseUrl: values.get("providerApiBaseUrl"),
        providerAccessToken: values.get("providerAccessToken"),
        callbackUrl: values.get("callbackUrl"),
        webhookSigningSecret: values.get("webhookSigningSecret"),
        callbackSigningSecret: values.get("callbackSigningSecret")
      }) });
      setSuccess(`${agency.name} integration settings updated.`);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update integration settings"); }
    finally { setSettingsBusy(""); }
  }
  async function healthCheckAgencyIntegration(agency: Agency, provider: string) {
    setSettingsBusy(`${agency.id}-health`); setError(""); setSuccess("");
    try {
      const result = await api<{ status: string | number; durationMs?: number; credentialScope?: string }>(`/api/admin/agencies/${agency.id}/integrations/${provider}/health`, { method: "POST" });
      setSuccess(`${provider.toUpperCase()} health check returned ${result.status}${result.durationMs !== undefined ? ` in ${result.durationMs}ms` : ""} using ${humanize(result.credentialScope || "configured")} credentials.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Agency integration health check failed"); }
    finally { setSettingsBusy(""); }
  }
  async function sandboxIntegration(agency: Agency, provider: string, eventType: string) {
    setSettingsBusy(`${agency.id}-sandbox`); setError(""); setSuccess("");
    try {
      const result = await api<{ normalized: { eventType: string; taskWouldBeCreated: boolean; visitCompletionWouldBeAccepted: boolean } }>(`/api/admin/agencies/${agency.id}/integrations/sandbox`, { method: "POST", body: JSON.stringify({
        provider,
        payload: {
          event_type: eventType,
          event_id: `sandbox-${Date.now()}`,
          service_user: { id: "sandbox-service-user-001", name: "Sandbox Service User", address: "1 Safe Street", postcode: "PE2 6XU", town: "Peterborough", county: "Cambridgeshire", vulnerable: true },
          note: "Carer observed a loose hallway rail and asked for a verified handyman visit.",
          hazard: "Loose hallway rail",
          task_id: "sandbox-task-001",
          completed_at: new Date().toISOString()
        }
      }) });
      setSuccess(`Sandbox accepted ${result.normalized.eventType}. Task creation: ${result.normalized.taskWouldBeCreated ? "yes" : "no"}. Visit completion: ${result.normalized.visitCompletionWouldBeAccepted ? "yes" : "no"}.`);
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Sandbox test failed"); }
    finally { setSettingsBusy(""); }
  }
  function renderSettingsPanel(agency: Agency) {
    const current = agency.settings;
    return <form className="agency-inline-panel" onSubmit={(event) => updateSettings(event, agency)}>
      <div className="agency-integration-heading"><div><strong>Agency controls</strong><small>Update go-live status and feature access without leaving this workspace.</small></div><button className="icon-button" type="button" onClick={() => setActiveSettingsAgencyId("")} aria-label="Close agency settings"><X size={16} /></button></div>
      <div className="agency-integration-grid">
        <label>Monthly cap in GBP<input name="monthlyCap" type="number" min={0} step={1} defaultValue={current?.monthlyCap || 500} /></label>
        <label>Go-live status<select name="goLiveStatus" defaultValue={current?.goLiveStatus || "pilot_live"}>{AGENCY_GO_LIVE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Free care analytics access<select name="healthAnalytics" defaultValue={current?.healthAnalyticsEnabled ? "unlocked" : "locked"}>{ACCESS_STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Premium AI rota planner access<select name="rotaPlanner" defaultValue={current?.rotaPlannerEnabled ? "unlocked" : "locked"}>{ACCESS_STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>CareOS Intelligence access<select name="careOs" defaultValue={current?.careOsEnabled ? "unlocked" : "locked"}>{ACCESS_STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <div className="agency-integration-actions"><button className="button button-primary button-small" disabled={settingsBusy === agency.id} type="submit">{settingsBusy === agency.id ? "Saving..." : "Save settings"}</button></div>
    </form>;
  }
  function renderIntegrationPanel(agency: Agency) {
    const enabledIntegration = agency.integrations?.find((item) => item.enabled);
    const defaultProvider = enabledIntegration?.provider || "generic";
    const existing = agency.integrations?.find((item) => item.provider === defaultProvider) || enabledIntegration;
    return <form className="agency-inline-panel" onSubmit={(event) => configureIntegration(event, agency)}>
      <div className="agency-integration-heading"><div><strong>Care-management integration</strong><small>Configure this agency's own provider credentials. Blank secret fields keep existing saved secrets.</small></div><button className="icon-button" type="button" onClick={() => setActiveIntegrationAgencyId("")} aria-label="Close integration setup"><X size={16} /></button></div>
      <div className="agency-integration-grid">
        <label>Provider<select name="provider" defaultValue={defaultProvider}>{CARE_INTEGRATION_PROVIDERS.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label>
        <label>Workspace / account ID<input name="externalAccountId" defaultValue={existing?.externalAccountId || agency.public_id} /></label>
        <label>API base URL<input name="providerApiBaseUrl" defaultValue={existing?.providerApiBaseUrl || ""} placeholder="https://api.provider.example" /></label>
        <label>Outbound callback URL<input name="callbackUrl" defaultValue={existing?.callbackUrl || ""} placeholder="https://provider.example/taskbridge/callback" /></label>
        <label>Provider API token<input name="providerAccessToken" type="password" placeholder={existing?.providerAccessTokenSet ? "Saved. Leave blank to keep." : "Paste token from provider"} /></label>
        <label>Inbound webhook secret<input name="webhookSigningSecret" type="password" placeholder={existing?.webhookSigningSecretSet ? "Saved. Leave blank to keep." : "Paste webhook secret"} /></label>
        <label>Outbound callback secret<input name="callbackSigningSecret" type="password" placeholder={existing?.callbackSigningSecretSet ? "Saved. Leave blank to keep." : "Paste callback signing secret"} /></label>
        <label>Sandbox event<select name="sandboxEvent" defaultValue="risk_hazard.logged">{CARE_INTEGRATION_SANDBOX_EVENTS.map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select></label>
      </div>
      <div className="agency-integration-actions">
        <button className="button button-primary button-small" disabled={settingsBusy === `${agency.id}-integration`} type="submit">{settingsBusy === `${agency.id}-integration` ? "Saving..." : "Save integration"}</button>
        <button className="button button-secondary button-small" disabled={settingsBusy === `${agency.id}-health`} type="button" onClick={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;
          healthCheckAgencyIntegration(agency, String(new FormData(form).get("provider") || defaultProvider));
        }}>{settingsBusy === `${agency.id}-health` ? "Checking..." : "Run health check"}</button>
        <button className="button button-secondary button-small" disabled={settingsBusy === `${agency.id}-sandbox`} type="button" onClick={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;
          const values = new FormData(form);
          sandboxIntegration(agency, String(values.get("provider") || defaultProvider), String(values.get("sandboxEvent") || "risk_hazard.logged"));
        }}>{settingsBusy === `${agency.id}-sandbox` ? "Testing..." : "Run sandbox test"}</button>
      </div>
    </form>;
  }
  return <>
    <div className="page-title-row"><div><span className="eyebrow">Super-admin control</span><h1>Care agency onboarding</h1><p>Only TaskBridge super administrators can create a care-organisation workspace.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Super admin only</span></div>
    <div className="agency-onboarding-layout">
      <section className="panel"><div className="panel-heading"><div><h2>Care agencies</h2><p>{agencies.length} organisation{agencies.length === 1 ? "" : "s"} registered.</p></div></div><div className="agency-list agency-key-list">{agencies.map((agency) => <article key={agency.id}><span><Building2 size={19} /></span><div><h3>{agency.name}</h3><p><Mail size={14} /> {agency.primary_contact_email}</p><small>{agency.public_id} / {agency.work_email_domain}</small><div className="agency-operational-meta"><span><ClipboardCheck size={14} /> {agency.activeWorkorders} active workorder{agency.activeWorkorders === 1 ? "" : "s"}</span><span><ShieldCheck size={14} /> {agencyGoLiveLabel(agency.settings?.goLiveStatus)} · £{(agency.settings?.monthlyCap || 500).toFixed(0)} cap</span><span><Activity size={14} /> {(agency.integrations || []).filter((item) => item.enabled).map((item) => `${item.provider.toUpperCase()}${item.providerAccessTokenSet ? " agency token" : " fallback"}`).join(", ") || "No care-platform integration"}</span>{agency.secretApiKey ? <span title={agency.secretApiKey.encryptionRepresentation}><KeyRound size={14} /> {agency.secretApiKey.masked} / {agency.secretApiKey.length} characters / {agency.secretApiKey.encryptionRepresentation}</span> : <span><KeyRound size={14} /> Integration key not issued</span>}</div></div><div className="row-actions"><StatusBadge status={agency.status}>{humanize(agency.status)}</StatusBadge><button className="button button-secondary button-small" onClick={() => { setActiveSettingsAgencyId(""); setActiveIntegrationAgencyId(activeIntegrationAgencyId === agency.id ? "" : agency.id); }}>{activeIntegrationAgencyId === agency.id ? "Close integration" : "Integration"}</button><button className="button button-secondary button-small" onClick={() => { setActiveIntegrationAgencyId(""); setActiveSettingsAgencyId(activeSettingsAgencyId === agency.id ? "" : agency.id); }}>{activeSettingsAgencyId === agency.id ? "Close settings" : "Settings"}</button></div>{activeIntegrationAgencyId === agency.id && renderIntegrationPanel(agency)}{activeSettingsAgencyId === agency.id && renderSettingsPanel(agency)}</article>)}</div></section>
      <aside className="agency-create-panel"><div className="resident-create-heading"><span><Plus size={20} /></span><div><h2>Onboard a care agency</h2><p>Create the tenant and invite its first care manager.</p></div></div><form className="stack" onSubmit={createAgency}><label>Agency name<input required name="name" minLength={2} /></label><label>Primary contact name<input required name="primaryContactName" minLength={2} /></label><label>Primary contact work email<input required name="primaryContactEmail" type="email" /></label><label>Approved work email domain<input required name="workEmailDomain" placeholder="careagency.co.uk" /></label><label className="integration-request-option"><input name="careManagementIntegrationRequested" type="checkbox" /><span><strong>Send care-management API requirements email</strong><small>Use this when the agency wants Birdie, PASS, Cera or another care-management system connected.</small></span></label>{error && <p className="form-error">{error}</p>}{success && <p className="form-success">{success}</p>}{staffInvitation && <div className="invitation-link"><input readOnly value={staffInvitation.url} aria-label="Care manager invitation URL" /><button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(staffInvitation.url)} aria-label="Copy manager invitation"><Copy size={18} /></button></div>}{issuedKey && <div className="issued-api-key"><strong>Copy the integration key now</strong><p>For security, the full secret is shown only once.</p><div><input readOnly value={issuedKey} aria-label="New agency API key" /><button className="icon-button" type="button" onClick={() => navigator.clipboard.writeText(issuedKey)} aria-label="Copy API key"><Copy size={18} /></button></div></div>}<button className="button button-primary button-full" disabled={busy} type="submit">{busy ? <><LoaderCircle className="spin" size={17} /> Creating...</> : <><Building2 size={17} /> Create agency workspace</>}</button></form></aside>
    </div>
  </>;
}

function AccessControl({ currentUser, users, invitations, agencies, onChanged, embedded = false }: {
  currentUser: User; users: AccessUser[]; invitations: AccessInvitation[]; agencies: Agency[]; onChanged: () => Promise<void>; embedded?: boolean;
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
      setInviteResult(result); form?.reset?.(); await onChanged();
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
    {embedded ? <div className="page-title-row compact"><div><span className="eyebrow">Access setup</span><h1>People and privileges</h1><p>Invite care-agency users and manage TaskBridge administrator access from the onboarding workspace.</p></div></div> : <div className="page-title-row"><div><span className="eyebrow">Super-admin control</span><h1>People and privileges</h1><p>Invite staff and manage TaskBridge administrator access with a complete audit trail.</p></div><span className="secure-indicator"><ShieldCheck size={17} /> Super admin only</span></div>}
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="access-control-layout">
      <section className="panel table-panel"><div className="panel-heading"><div><h2>TaskBridge administrators</h2><p>Promotion, demotion and account changes require a fresh sign-in.</p></div></div><div className="responsive-table"><table><thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Last sign in</th><th>Actions</th></tr></thead><tbody>{taskbridgeUsers.map((entry) => <tr key={entry.id}><td><strong>{entry.full_name}</strong><small>{entry.email}</small></td><td><StatusBadge status={entry.role}>{humanize(entry.role)}</StatusBadge></td><td><StatusBadge status={entry.status}>{humanize(entry.status)}</StatusBadge></td><td>{entry.last_login_at ? formatDate(entry.last_login_at, true) : "Not yet"}</td><td><div className="row-actions"><button className="button button-secondary button-small" disabled={entry.id === currentUser.id || busy === entry.id} onClick={() => changeRole(entry)}>{entry.role === "taskbridge_super_admin" ? "Demote" : "Promote"}</button><button className="button button-secondary button-small" disabled={entry.id === currentUser.id || busy === entry.id} onClick={() => changeStatus(entry)}>{entry.status === "active" ? "Suspend" : "Activate"}</button><button className="icon-button danger-icon" disabled={entry.id === currentUser.id || busy === entry.id} onClick={() => remove(entry)} aria-label={`Delete ${entry.full_name}`}><Trash2 size={17} /></button></div></td></tr>)}</tbody></table></div></section>
      <aside className="agency-create-panel access-invite-panel"><div className="resident-create-heading"><span><UserPlus size={20} /></span><div><h2>Invite a staff member</h2><p>Send an expiring one-use account setup link.</p></div></div><form className="stack" onSubmit={invite}><label>Full name<input name="fullName" required minLength={2} /></label><label>Work email<input name="email" required type="email" /></label><label>Access role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="taskbridge_admin">TaskBridge admin</option><option value="taskbridge_super_admin">TaskBridge super admin</option><option value="care_manager">Care manager</option><option value="care_coordinator">Care coordinator</option></select></label>{role.startsWith("care_") && <label>Care agency<select name="agencyId" required defaultValue=""><option value="" disabled>Select agency</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}</select></label>}<button className="button button-primary button-full" disabled={busy === "invite"} type="submit">{busy === "invite" ? <><LoaderCircle className="spin" size={17} /> Sending...</> : <><Send size={17} /> Send invitation</>}</button></form>{inviteResult && <div className="invitation-result"><strong>{inviteResult.emailDeliveryStatus === "sent" ? "Invitation sent" : "Invitation created"}</strong><div className="invitation-link"><input readOnly value={inviteResult.invitationUrl} aria-label="Staff invitation URL" /><button className="icon-button" onClick={() => navigator.clipboard.writeText(inviteResult.invitationUrl)} aria-label="Copy invitation"><Copy size={17} /></button></div></div>}</aside>
    </div>
    {invitations.length > 0 && <section className="panel pending-access-panel"><div className="panel-heading"><div><h2>Pending staff invitations</h2><p>Links expire automatically after seven days.</p></div></div><div className="agency-list">{invitations.map((entry) => <article key={entry.id}><span><Mail size={18} /></span><div><h3>{entry.full_name}</h3><p>{entry.email}</p><small>{entry.agency_name || "TaskBridge"} · {humanize(entry.role)} · expires {formatDate(entry.expires_at, true)}</small></div><StatusBadge status={entry.email_delivery_status}>{humanize(entry.email_delivery_status)}</StatusBadge></article>)}</div></section>}
  </>;
}
