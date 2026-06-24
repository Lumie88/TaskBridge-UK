import { type FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Camera, CheckCircle2, LoaderCircle, LocateFixed, MapPin, ShieldAlert, ShieldCheck } from "lucide-react";
import { api, humanize } from "../api";
import { Brand, StatusBadge } from "../components";

interface Visit {
  status: string;
  category: string;
  summary: string;
  address: string;
  handyman: string;
  mandatedInstruction: string;
}

export function VisitPage({ token }: { token: string }) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [complete, setComplete] = useState(false);

  async function load() {
    try {
      const result = await api<{ visit: Visit }>(`/api/visit/${token}`);
      setVisit(result.visit);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to open visit"); }
  }
  useEffect(() => { void load(); }, [token]);

  async function checkIn() {
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await api(`/api/visit/${token}/check-in`, { method: "POST", body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }) });
        await load();
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Check-in failed"); }
      finally { setBusy(false); }
    }, () => { setError("Location permission is required for a secure check-in."); setBusy(false); }, { enableHighAccuracy: true, timeout: 15000 });
  }

  async function submitEvidence(event: FormEvent) {
    event.preventDefault();
    if (!beforeFile || !afterFile) return setError("Take both before-work and after-work photos before completing the visit.");
    setBusy(true); setError("");
    try {
      const beforePhotoUrl = await uploadPhoto(beforeFile, "before_photo");
      await api(`/api/visit/${token}/evidence`, {
        method: "POST",
        body: JSON.stringify({ evidenceType: "before_photo", fileUrl: beforePhotoUrl })
      });
      const afterPhotoUrl = await uploadPhoto(afterFile, "after_photo");
      await api(`/api/visit/${token}/complete`, { method: "POST", body: JSON.stringify({ completionNotes: notes, afterPhotoUrl }) });
      setComplete(true); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to submit completion evidence"); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(photo: File, evidenceType: "before_photo" | "after_photo") {
    const signed = await api<{ uploadUrl: string; fileUrl: string; headers?: Record<string, string> }>(`/api/visit/${token}/evidence-upload-url`, {
      method: "POST",
      body: JSON.stringify({ fileName: photo.name, evidenceType, contentType: photo.type, sizeBytes: photo.size })
    });
    const upload = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers || { "content-type": photo.type }, body: photo });
    if (!upload.ok) throw new Error("A photo upload did not complete. Please try again.");
    return signed.fileUrl;
  }

  if (error && !visit) return <main className="visit-page"><div className="visit-card"><Brand /><div className="visit-error"><ShieldAlert /><h1>Visit link unavailable</h1><p>{error}</p></div></div></main>;
  if (!visit) return <main className="visit-page"><div className="visit-card"><div className="app-loading"><LoaderCircle className="spin" /> Opening secure visit...</div></div></main>;
  const checkedIn = visit.status === "checked_in";
  const finished = complete || ["evidence_submitted", "confirmed"].includes(visit.status);
  return <main className="visit-page">
    <section className="visit-card">
      <div className="visit-header"><Brand compact /><StatusBadge status={visit.status}>{humanize(visit.status)}</StatusBadge></div>
      <div className="visit-title"><span className="eyebrow">Secure TaskBridge visit</span><h1>{visit.category}</h1><p>{visit.summary}</p></div>
      <div className="visit-location"><MapPin size={20} /><div><small>Visit address</small><strong>{visit.address}</strong></div></div>
      <div className="identity-alert"><ShieldCheck size={24} /><div><strong>MANDATED WELFARE SECURITY</strong><p>{visit.mandatedInstruction}</p></div></div>
      {finished ? <div className="visit-complete"><CheckCircle2 /><h2>Evidence submitted</h2><p>The care team will review and confirm the completed work. You may now close this page.</p></div>
        : !checkedIn ? <div className="visit-action"><h2>Ready to begin?</h2><p>Check in when you are at the visit address. Your device location will be used only to verify arrival.</p>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-full button-large" disabled={busy} onClick={checkIn}>{busy ? <><LoaderCircle className="spin" size={19} /> Verifying location...</> : <><LocateFixed size={19} /> Check in securely</>}</button></div>
          : <form className="visit-evidence stack" onSubmit={submitEvidence}><div className="checked-in-banner"><BadgeCheck /> Checked in securely</div><h2>Complete the visit</h2><div className="visit-photo-grid"><label className="camera-field"><Camera size={25} /><strong>Before-work photo</strong><span>{beforeFile ? beforeFile.name : "Capture the area before work starts"}</span><input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setBeforeFile(event.target.files?.[0] || null)} /></label><label className="camera-field"><Camera size={25} /><strong>After-work photo</strong><span>{afterFile ? afterFile.name : "Capture the completed work clearly"}</span><input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setAfterFile(event.target.files?.[0] || null)} /></label></div><label>Completion notes<textarea required minLength={5} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe the work completed and any follow-up needed." /></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-full" disabled={busy} type="submit">{busy ? "Submitting evidence..." : "Check out and submit"}</button></form>}
      <p className="visit-footer">Visit assigned to <strong>{visit.handyman}</strong>. This token is personal and must not be shared.</p>
    </section>
  </main>;
}
