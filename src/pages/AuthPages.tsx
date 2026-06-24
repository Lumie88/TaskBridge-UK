import { type FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Brand } from "../components";
import type { User } from "../types";

interface SignInProps {
  portal: "care" | "admin";
  onAuthenticated: (user: User) => void;
}

export function SignIn({ portal, onAuthenticated }: SignInProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User }>("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password, portal })
      });
      onAuthenticated(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = portal === "admin";
  return (
    <main className={`auth-page ${isAdmin ? "admin-auth" : ""}`}>
      <section className="auth-aside">
        <a className="auth-back" href={isAdmin ? "/" : "/"}><ArrowLeft size={17} /> Back</a>
        <div className="auth-message">
          <span className="auth-symbol">{isAdmin ? <LockKeyhole /> : <ShieldCheck />}</span>
          <span className="eyebrow eyebrow-light">{isAdmin ? "Restricted access" : "Care team workspace"}</span>
          <h1>{isAdmin ? "TaskBridge operations administration." : "Keep every home-safety task moving."}</h1>
          <p>{isAdmin ? "This isolated entry point is for authorised TaskBridge administrators only. Access events are monitored and audited." : "Review suggested tasks, follow assignments and confirm completed work without seeing sensitive marketplace decisioning."}</p>
          <ul className="auth-benefits">
            <li><Check /> Secure role-based access</li>
            <li><Check /> Encrypted resident information</li>
            <li><Check /> Complete task history</li>
          </ul>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <Brand />
          <div className="auth-title"><span className="eyebrow">{isAdmin ? "Authorised personnel" : "Welcome back"}</span><h2>{isAdmin ? "Admin sign in" : "Sign in to your workspace"}</h2><p>Use your organisation email and password.</p></div>
          <form className="stack" onSubmit={submit}>
            <label>Email address<div className="input-icon"><Mail size={18} /><input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" placeholder="you@organisation.co.uk" /></div></label>
            <label>Password<div className="input-icon"><LockKeyhole size={18} /><input value={password} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? "text" : "password"} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary button-full" disabled={busy} type="submit">{busy ? "Signing in..." : "Sign in"}<ArrowRight size={18} /></button>
          </form>
          {!isAdmin && <p className="auth-provisioning-note"><ShieldCheck size={16} /> Workspace access is issued by your care agency after TaskBridge onboarding.</p>}
        </div>
      </section>
    </main>
  );
}
