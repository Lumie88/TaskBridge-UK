import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { api, humanize } from "../api";
import { Brand } from "../components";

interface StaffInvitation {
  fullName: string;
  email: string;
  role: string;
  organisationName: string;
  expiresAt: string;
}

export function StaffOnboardingPage({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<StaffInvitation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [complete, setComplete] = useState(false);
  const [portal, setPortal] = useState("care");

  useEffect(() => {
    api<{ invitation: StaffInvitation }>(`/api/auth/staff-invitations/${encodeURIComponent(token)}`)
      .then((result) => setInvitation(result.invitation))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Invitation unavailable"))
      .finally(() => setBusy(false));
  }, [token]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") || "");
    if (password !== String(values.get("confirmPassword") || "")) return setError("Passwords do not match");
    setBusy(true); setError("");
    try {
      const result = await api<{ portal: string }>(`/api/auth/staff-invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST", body: JSON.stringify({ password })
      });
      setPortal(result.portal); setComplete(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to activate account"); }
    finally { setBusy(false); }
  }

  return <main className="staff-onboarding-page">
    <header><Brand /></header>
    <section className="staff-onboarding-panel">
      {busy && !invitation ? <div className="app-loading"><LoaderCircle className="spin" /> Validating invitation...</div>
        : complete ? <div className="staff-onboarding-success"><CheckCircle2 size={38} /><h1>Access is ready</h1><p>Your secure TaskBridge account has been activated.</p><a className="button button-primary" href={portal === "admin" ? "/internal/taskbridge" : "/sign-in"}>Continue to sign in</a></div>
          : invitation ? <>
            <div className="staff-onboarding-heading"><span><ShieldCheck size={24} /></span><div><small>Secure staff onboarding</small><h1>Join {invitation.organisationName}</h1><p>{invitation.fullName} · {humanize(invitation.role)}</p></div></div>
            <form className="stack" onSubmit={accept}>
              <label>Work email<input value={invitation.email} disabled /></label>
              <label>Create password<input name="password" type="password" minLength={12} required autoComplete="new-password" /></label>
              <label>Confirm password<input name="confirmPassword" type="password" minLength={12} required autoComplete="new-password" /></label>
              <p className="password-guidance"><KeyRound size={15} /> Use at least 12 characters with upper and lower case letters and a number.</p>
              {error && <p className="form-error">{error}</p>}
              <button className="button button-primary button-full" disabled={busy} type="submit">{busy ? <><LoaderCircle className="spin" size={17} /> Activating...</> : "Activate secure access"}</button>
            </form>
          </> : <div className="staff-onboarding-success"><h1>Invitation unavailable</h1><p>{error || "Ask your TaskBridge super administrator for a new link."}</p></div>}
    </section>
  </main>;
}
