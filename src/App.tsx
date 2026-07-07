import { useEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";
import { SignIn } from "./pages/AuthPages";
import { AdultSafeguardingPolicy, ApiDocumentation, CookiePolicy, GDPRShieldPolicy, HowItWorks, JoinHandymanPage, MarketingHome, OurServices, SafeguardingProtocol, SafeguardingSLA, SystemIntegrations } from "./pages/Marketing";
import { CoordinatorPortal } from "./pages/CoordinatorPortal";
import { AdminPortal } from "./pages/AdminPortal";
import { VisitPage } from "./pages/VisitPage";
import { HandymanOnboardingPage } from "./pages/HandymanOnboardingPage";
import { StaffOnboardingPage } from "./pages/StaffOnboardingPage";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const path = window.location.pathname.replace(/\/$/, "") || "/";

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  function signedIn(nextUser: User) {
    setUser(nextUser);
    const isAdmin = nextUser.role.startsWith("taskbridge_");
    window.history.replaceState({}, "", isAdmin ? "/internal/taskbridge" : "/portal");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function signOut() {
    await api<void>("/api/auth/signout", { method: "POST" });
    setUser(null);
    window.location.assign("/");
  }

  if (path.startsWith("/visit/")) return <VisitPage token={path.slice("/visit/".length)} />;
  if (path.startsWith("/handyman-onboarding/")) return <HandymanOnboardingPage token={path.slice("/handyman-onboarding/".length)} />;
  if (path.startsWith("/staff-onboarding/")) return <StaffOnboardingPage token={path.slice("/staff-onboarding/".length)} />;
  if (path === "/") return <MarketingHome />;
  if (path === "/how-it-works") return <HowItWorks />;
  if (path === "/services") return <OurServices />;
  if (path === "/join-handyman") return <JoinHandymanPage />;
  if (path === "/safeguarding") return <SafeguardingProtocol />;
  if (path === "/integrations") return <SystemIntegrations />;
  if (path === "/api-documentation") return <ApiDocumentation />;
  if (path === "/adult-safeguarding-policy" || path === "/safeguarding-policy") return <AdultSafeguardingPolicy />;
  if (path === "/gdpr-shield-policy") return <GDPRShieldPolicy />;
  if (path === "/cookie-policy") return <CookiePolicy />;
  if (path === "/safeguarding-sla") return <SafeguardingSLA />;
  if (loading) return <div className="app-loading"><span className="loading-mark" />Loading TaskBridge...</div>;
  if (path === "/sign-in") return user ? <RedirectForUser user={user} /> : <SignIn portal="care" onAuthenticated={signedIn} />;
  if (path === "/internal/taskbridge") {
    if (!user) return <SignIn portal="admin" onAuthenticated={signedIn} />;
    if (!user.role.startsWith("taskbridge_")) return <AccessDenied />;
    return <AdminPortal user={user} onSignOut={signOut} />;
  }
  if (path === "/portal") {
    if (!user) return <SignIn portal="care" onAuthenticated={signedIn} />;
    if (user.role.startsWith("taskbridge_")) return <RedirectForUser user={user} />;
    return <CoordinatorPortal user={user} onSignOut={signOut} />;
  }
  return <NotFound />;
}

function RedirectForUser({ user }: { user: User }) {
  useEffect(() => {
    window.location.replace(user.role.startsWith("taskbridge_") ? "/internal/taskbridge" : "/portal");
  }, [user]);
  return <div className="app-loading">Opening your workspace...</div>;
}

function AccessDenied() {
  return <main className="error-page"><span>403</span><h1>Access is restricted.</h1><p>This workspace requires an authorised TaskBridge administrator account.</p><a className="button button-primary" href="/">Return home</a></main>;
}

function NotFound() {
  return <main className="error-page"><span>404</span><h1>We could not find that page.</h1><a className="button button-primary" href="/">Return home</a></main>;
}
