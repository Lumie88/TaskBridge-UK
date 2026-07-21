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
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    api<{ payment: FamilyPayment }>(`/api/family/payments/${token}`)
      .then((result) => {
        setPayment(result.payment);
        setPayerName(result.payment.payerName || "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Payment link unavailable"));
  }, [token]);

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api(`/api/family/payments/${token}/confirm`, {
        method: "POST",
        body: JSON.stringify({ payerName, confirmationReference: reference })
      });
      setComplete(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to confirm payment"); }
    finally { setBusy(false); }
  }

  const loadedPayment = payment;
  return <main className="family-page">
    <section className="family-card">
      <Brand />
      {!payment && !error ? <div className="app-loading"><LoaderCircle className="spin" /> Opening secure payment...</div>
        : error ? <div className="alert alert-danger">{error}</div>
          : complete || loadedPayment?.status === "paid" ? <div className="family-success"><CheckCircle2 size={42} /><h1>Payment recorded</h1><p>TaskBridge has marked this safety work as paid and the care team can continue the dispatch process.</p></div>
            : loadedPayment && <><span className="eyebrow">Family payment portal</span><h1>Secure payment for approved home-safety work</h1><div className="family-summary"><span><CreditCard size={22} /></span><div><strong>{loadedPayment.category}</strong><p>{loadedPayment.summary}</p><small>{loadedPayment.agencyName} · Service user {loadedPayment.serviceUserInitials} · {loadedPayment.taskId}</small></div></div><div className="payment-amount"><small>Amount due</small><strong>{loadedPayment.currency} {loadedPayment.amount.toFixed(2)}</strong></div><form className="stack" onSubmit={confirm}><label>Your name<input required value={payerName} onChange={(event) => setPayerName(event.target.value)} /></label><label>Payment reference<input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Card/Stripe/bank confirmation reference" /></label><button className="button button-primary button-full" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Confirming...</> : <><ShieldCheck size={17} /> Confirm payment</>}</button></form><p className="family-note">This pilot screen records payment confirmation for TaskBridge. Stripe Checkout can be enabled with live Stripe credentials.</p></>}
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
          : loadedUpdate && <><span className="eyebrow">Family update</span><h1>Home-safety work update</h1><div className="family-summary"><span><ShieldCheck size={22} /></span><div><strong>{loadedUpdate.category}</strong><p>{loadedUpdate.summary}</p><small>{loadedUpdate.agencyName} · Service user {loadedUpdate.serviceUserInitials} · {loadedUpdate.taskId}</small></div></div><div className="family-status-strip"><span>{humanize(loadedUpdate.status)}</span>{loadedUpdate.confirmedAt && <small>Care team confirmed {formatDate(loadedUpdate.confirmedAt, true)}</small>}</div>{loadedUpdate.completionNotes && <p className="family-completion-note">{loadedUpdate.completionNotes}</p>}<div className="family-evidence-grid"><EvidenceImage label="Before" url={loadedUpdate.beforePhotoUrl} /><EvidenceImage label="After" url={loadedUpdate.afterPhotoUrl} /></div></>}
    </section>
  </main>;
}

function EvidenceImage({ label, url }: { label: string; url: string | null }) {
  return <article className="family-evidence"><strong>{label}</strong>{url ? <img src={url} alt={`${label} task evidence`} /> : <p>Evidence not available on this link.</p>}</article>;
}
