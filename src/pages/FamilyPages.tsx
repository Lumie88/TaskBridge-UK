import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { api, formatDate, humanize } from "../api";
import { Brand } from "../components";

interface FamilyPayment {
  id: string;
  taskId: string;
  agencyName: string;
  serviceUserInitials: string;
  category: string;
  summary: string;
  amount: number;
  currency: string;
  status: string;
  stripeEnabled: boolean;
  payerEmail: string;
  payerName: string | null;
}

interface FamilyUpdate {
  taskId: string;
  agencyName: string;
  serviceUserInitials: string;
  category: string;
  summary: string;
  status: string;
  completionNotes: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  confirmedAt: string | null;
}

export function FamilyPaymentPage({ token }: { token: string }) {
  const [payment, setPayment] = useState<FamilyPayment | null>(null);
  const [payerName, setPayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ payment: FamilyPayment }>(`/api/family/payments/${token}`)
      .then((result) => {
        setPayment(result.payment);
        setPayerName(result.payment.payerName || "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Payment link unavailable"));
  }, [token]);

  async function startCheckout() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ checkoutUrl: string }>(`/api/family/payments/${token}/checkout`, { method: "POST" });
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start secure payment");
    } finally {
      setBusy(false);
    }
  }

  const loadedPayment = payment;
  return <main className="family-page">
    <section className="family-card">
      <Brand />
      {!payment && !error ? <div className="app-loading"><LoaderCircle className="spin" /> Opening secure payment...</div>
        : error ? <div className="alert alert-danger">{error}</div>
          : loadedPayment?.status === "paid" ? <div className="family-success"><CheckCircle2 size={42} /><h1>Payment recorded</h1><p>TaskBridge has marked this safety work as paid and the care team can continue the dispatch process.</p></div>
            : loadedPayment && <>
              <span className="eyebrow">Family payment portal</span>
              <h1>Secure payment for approved home-safety work</h1>
              <div className="family-summary">
                <span><CreditCard size={22} /></span>
                <div>
                  <strong>{loadedPayment.category}</strong>
                  <p>{loadedPayment.summary}</p>
                  <small>{loadedPayment.agencyName} - Service user {loadedPayment.serviceUserInitials} - {loadedPayment.taskId}</small>
                </div>
              </div>
              <div className="payment-amount"><small>Amount due</small><strong>{loadedPayment.currency} {loadedPayment.amount.toFixed(2)}</strong></div>
              <div className="stack">
                <label>Your name<input value={payerName} onChange={(event) => setPayerName(event.target.value)} /></label>
                <button type="button" className="button button-primary button-full" disabled={busy || !loadedPayment.stripeEnabled} onClick={startCheckout}>{busy ? <><LoaderCircle className="spin" size={17} /> Opening Stripe...</> : <><ShieldCheck size={17} /> Pay securely by card</>}</button>
              </div>
              <p className="family-note">{loadedPayment.stripeEnabled ? "Card payments are handled by Stripe Checkout. TaskBridge only marks the task paid after Stripe confirms the payment." : "Stripe Checkout is not configured yet. Please contact the care team for payment support."}</p>
            </>}
    </section>
  </main>;
}

export function FamilyUpdatePage({ token }: { token: string }) {
  const [update, setUpdate] = useState<FamilyUpdate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ update: FamilyUpdate }>(`/api/family/updates/${token}`)
      .then((result) => setUpdate(result.update))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Update link unavailable"));
  }, [token]);

  const loadedUpdate = update;
  return <main className="family-page">
    <section className="family-card family-update-card">
      <Brand />
      {!update && !error ? <div className="app-loading"><LoaderCircle className="spin" /> Opening secure update...</div>
        : error ? <div className="alert alert-danger">{error}</div>
          : loadedUpdate && <><span className="eyebrow">Family update</span><h1>Home-safety work update</h1><div className="family-summary"><span><ShieldCheck size={22} /></span><div><strong>{loadedUpdate.category}</strong><p>{loadedUpdate.summary}</p><small>{loadedUpdate.agencyName} - Service user {loadedUpdate.serviceUserInitials} - {loadedUpdate.taskId}</small></div></div><div className="family-status-strip"><span>{humanize(loadedUpdate.status)}</span>{loadedUpdate.confirmedAt && <small>Care team confirmed {formatDate(loadedUpdate.confirmedAt, true)}</small>}</div>{loadedUpdate.completionNotes && <p className="family-completion-note">{loadedUpdate.completionNotes}</p>}<div className="family-evidence-grid"><EvidenceImage label="Before" url={loadedUpdate.beforePhotoUrl} /><EvidenceImage label="After" url={loadedUpdate.afterPhotoUrl} /></div></>}
    </section>
  </main>;
}

function EvidenceImage({ label, url }: { label: string; url: string | null }) {
  return <article className="family-evidence"><strong>{label}</strong>{url ? <img src={url} alt={`${label} task evidence`} /> : <p>Evidence not available on this link.</p>}</article>;
}
