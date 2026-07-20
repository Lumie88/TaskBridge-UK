import { useState, type FormEvent, type PropsWithChildren, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Calendar,
  ChevronRight,
  CheckCircle,
  Mail,
  LogOut,
  Menu,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import type { User } from "./types";
import { api } from "./api";

export function TaskBridgeMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 3.5 25 7v7.4c0 6.3-3.7 11.2-9 14.1-5.3-2.9-9-7.8-9-14.1V7l9-3.5Z" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinejoin="round" />
      <path d="M10 18.2c2.1-3.1 9.9-3.1 12 0" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" />
      <path d="M11 21h10" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" />
      <path d="m13 13.8 2 2 4.4-5" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="/" aria-label="TaskBridge by Growing Fig home">
      <span className="brand-mark"><TaskBridgeMark size={compact ? 19 : 23} /><i /></span>
      <span className="brand-copy"><strong>Task<span>Bridge</span></strong><small>by Growing Fig</small></span>
    </a>
  );
}

export function StatusBadge({ status, children }: PropsWithChildren<{ status?: string }>) {
  const tone = status?.includes("completed") || status === "approved" || status === "verified"
    ? "success"
    : status?.includes("pending") || status?.includes("awaiting") || status === "unclear"
      ? "warning"
      : status === "rejected" || status === "failed"
        ? "danger"
        : status?.includes("checked") || status?.includes("dispatch") || status === "active"
          ? "info"
          : "neutral";
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function PublicHeader({ onDemo }: { onDemo: () => void }) {
  return (
    <header className="public-header">
      <div className="site-width header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="/how-it-works">How it works</a>
          <a className="nav-signin" href="/sign-in">Sign in</a>
        </nav>
        <div className="header-actions">
          <button className="button button-primary button-small" onClick={onDemo}>Book a demo <ArrowRight size={16} /></button>
        </div>
      </div>
    </header>
  );
}

export function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [received, setReceived] = useState(false);
  if (!open) return null;
  function closeModal() {
    setError("");
    setReceived(false);
    onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      await api("/api/auth/demo-request", {
        method: "POST",
        body: JSON.stringify({
          fullName: values.get("fullName"),
          organisationName: values.get("organisationName"),
          workEmail: values.get("workEmail"),
          message: `Role: ${values.get("role")}\nNeeds: ${values.get("message") || "Not specified"}`
        })
      });
      setReceived(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send your request");
    } finally { setBusy(false); }
  }
  return (
    <div className="studio-demo-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
      <section className="studio-demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title">
        <button className="studio-demo-close" onClick={closeModal} aria-label="Close demo request"><X size={17} /></button>

        <aside className="studio-demo-insight">
          <div>
            <span>Secure coordination</span>
            <h3>TaskBridge by Growing Fig</h3>
            <p>Experience secure, coordinated home-safety dispatch with safeguarding controls built into every step.</p>
          </div>
          <div className="studio-demo-benefits">
            <div><Users size={17} /><p>Designed for home care managers and operations coordinators.</p></div>
            <div><ShieldAlert size={17} /><p>Enhanced DBS verification supports trusted vulnerable-adult visits.</p></div>
          </div>
          <blockquote>"Making home safer for our vulnerable"</blockquote>
        </aside>

        <div className="studio-demo-content">
          {!received ? <form onSubmit={submit}>
            <header><h2 id="demo-title">Schedule your demo</h2><p>Tell us about your organisation in under two minutes.</p></header>
            <label>Your full name<input name="fullName" required autoComplete="name" placeholder="E.g., Sarah Jenkins" /></label>
            <label>Work email<input name="workEmail" required type="email" autoComplete="email" placeholder="E.g., manager@homecare.co.uk" /></label>
            <label>Organisation name<input name="organisationName" required autoComplete="organization" placeholder="E.g., Primrose Care Services" /></label>
            <label>Your role<select name="role" defaultValue="Care Coordinator"><option>Care Coordinator</option><option>Care Manager</option><option>Safeguarding Lead</option><option>Operations Director</option><option>Local Authority Commissioner</option></select></label>
            <label>Safety or integration needs<textarea name="message" rows={2} placeholder="E.g., fall-risk prevention or care-platform integration" /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="studio-demo-submit" disabled={busy} type="submit"><span>{busy ? "Sending request..." : "Request demo allocation"}</span><Send size={16} /></button>
          </form> : <div className="studio-demo-success">
            <span className="studio-success-icon"><CheckCircle size={32} /></span>
            <div><h2 id="demo-title">Demo request received</h2><p>Your organisation has been added to the TaskBridge by Growing Fig demo queue.</p></div>
            <div className="studio-demo-receipt">
              <strong><Calendar size={17} /> What happens next</strong>
              <p>A clinical integration specialist will review your requirements and arrange a focused walkthrough.</p>
              <p><Mail size={16} /> Confirmation and scheduling details will be sent to your work email.</p>
            </div>
            <button className="studio-demo-submit" onClick={closeModal}>Done</button>
          </div>}
        </div>
      </section>
    </div>
  );
}

interface PortalShellProps extends PropsWithChildren {
  user: User;
  area: "care" | "admin";
  active: string;
  onActive: (value: string) => void;
  onSignOut: () => void;
  workspaceName?: string;
  actions?: ReactNode;
  notificationCount?: number;
  onNotifications?: () => void;
}

export function PortalShell({ user, area, active, onActive, onSignOut, workspaceName, children, actions, notificationCount = 0, onNotifications }: PortalShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const careItems = [
    ["overview", "Dashboard"],
    ["new-task", "Create task"],
    ["tasks", "Status board"],
    ["service-users", "Service users"],
    ["analytics", "Care analytics"],
    ["rota-planner", "Rota planner"],
    ["billing", "Invoices"],
    ["notifications", "Notifications"]
  ];
  const adminItems = [
    ["overview", "Control centre"],
    ["demo-requests", "Demo requests"],
    ["tasks", "Assignments"],
    ["traders", "Handyman compliance"],
    ["integrations", "Integrations"],
    ["billing", "Finance controls"]
  ];
  if (user.role === "taskbridge_super_admin") adminItems.push(["agencies", "Agency onboarding"]);
  if (user.role === "taskbridge_super_admin") adminItems.push(["access", "Access control"]);
  const items = area === "care" ? careItems : adminItems;
  return (
    <div className="portal-frame">
      <aside className="portal-sidebar">
        <Brand compact />
        <div className="portal-area"><ShieldCheck size={17} /><span><strong>{area === "care" ? workspaceName || "Care workspace" : "Secure administration"}</strong>{area === "care" && workspaceName && <small>Care workspace</small>}</span></div>
        <nav aria-label="Portal navigation">
          {items.map(([key, label]) => (
            <button key={key} className={active === key ? "active" : ""} onClick={() => onActive(key)}>{label}</button>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{user.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <div><strong>{user.fullName}</strong><small>{user.role.replaceAll("_", " ")}</small></div>
          <button className="icon-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="portal-main">
        <header className="portal-topbar">
          <button className="icon-button mobile-only" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}>{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <span className="topbar-context">{area === "care" ? workspaceName || "Care coordination" : "TaskBridge operations"}</span>
          <div className="topbar-actions">{actions}<button className="icon-button notification-button" aria-label="Notifications" onClick={onNotifications}>{notificationCount > 0 && <span>{Math.min(notificationCount, 99)}</span>}<Bell size={19} /></button></div>
        </header>
        {mobileNavOpen && <nav className="portal-mobile-nav mobile-only" aria-label="Mobile portal navigation">
          {items.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => { onActive(key); setMobileNavOpen(false); }}>{label}</button>)}
        </nav>}
        <div className="portal-content">{children}</div>
      </main>
    </div>
  );
}

export function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{detail}</p></div>;
}
