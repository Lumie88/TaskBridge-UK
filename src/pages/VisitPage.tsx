import { type FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Camera, CheckCircle2, CircleX, Clock3, LoaderCircle, LocateFixed, MapPin, ShieldAlert, ShieldCheck } from "lucide-react";
import { api, humanize } from "../api";
import { Brand, StatusBadge } from "../components";

interface Visit {
  status: string;
  category: string;
  summary: string;
  address: string;
  handyman: string;
  preferredWindow: { start: string | null; end: string | null };
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
  const [declined, setDeclined] = useState(false);

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

  async function acceptTask() {
    setBusy(true); setError("");
    try {
      await api(`/api/visit/${token}/accept`, { method: "POST" });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to accept task"); }
    finally { setBusy(false); }
  }

  async function declineTask() {
    const reason = window.prompt("Please give a short reason for declining this task");
    if (!reason || reason.trim().length < 5) return;
    setBusy(true); setError("");
    try {
      await api(`/api/visit/${token}/decline`, { method: "POST", body: JSON.stringify({ reason }) });
      setDeclined(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to decline task"); }
    finally { setBusy(false); }
  }

  async function submitEvidence(event: FormEvent) {
    event.preventDefault();
    if (!beforeFile || !afterFile) return setError("Take both before-work and after-work photos before completing the visit.");
    setBusy(true); setError("");
    try {
      const beforePhoto = await uploadPhoto(beforeFile, "before_photo");
      await api(`/api/visit/${token}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          evidenceType: "before_photo",
          storageKey: beforePhoto.storageKey,
          contentType: beforeFile.type,
          sizeBytes: beforeFile.size
        })
      });
      const afterPhoto = await uploadPhoto(afterFile, "after_photo");
      await api(`/api/visit/${token}/complete`, {
        method: "POST",
        body: JSON.stringify({
          completionNotes: notes,
          afterPhotoStorageKey: afterPhoto.storageKey,
          afterPhotoContentType: afterFile.type,
          afterPhotoSizeBytes: afterFile.size
        })
      });
      setComplete(true); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to submit completion evidence"); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(photo: File, evidenceType: "before_photo" | "after_photo") {
    const signed = await api<{ uploadUrl: string; storageKey: string; headers?: Record<string, string> }>(`/api/visit/${token}/evidence-upload-url`, {
      method: "POST",
      body: JSON.stringify({ fileName: photo.name, evidenceType, contentType: photo.type, sizeBytes: photo.size })
    });
    const upload = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers || { "content-type": photo.type }, body: photo });
    if (!upload.ok) throw new Error("A photo upload did not complete. Please try again.");
    return { storageKey: signed.storageKey };
  }

  if (error && !visit) return <main className="visit-page"><div className="visit-card"><Brand /><div className="visit-error"><ShieldAlert /><h1>Visit link unavailable</h1><p>{error}</p></div></div></main>;
  if (!visit) return <main className="visit-page"><div className="visit-card"><div className="app-loading"><LoaderCircle className="spin" /> Opening secure visit...</div></div></main>;
  const checkedIn = visit.status === "checked_in";
  const finished = complete || ["evidence_submitted", "confirmed"].includes(visit.status);
  const awaitingDecision = ["link_sent", "pending"].includes(visit.status);
  const accepted = visit.status === "accepted";
  return <main className="visit-page">
    <section className="visit-card">
      <div className="visit-header"><Brand compact /><StatusBadge status={visit.status}>{humanize(visit.status)}</StatusBadge></div>
      <div className="visit-title"><span className="eyebrow">Secure TaskBridge visit</span><h1>{visit.category}</h1><p>{visit.summary}</p></div>
      <div className="visit-location"><MapPin size={20} /><div><small>Visit address</small><strong>{visit.address}</strong></div></div>
      <div className="visit-meta-row"><Clock3 size={18} /><span>{formatWindow(visit.preferredWindow)}</span></div>
      {declined ? <div className="visit-complete visit-declined"><CircleX /><h2>Task declined</h2><p>TaskBridge operations will reassign this task. You may now close this page.</p></div>
        : awaitingDecision ? <div className="visit-decision"><h2>Do you accept this assigned task?</h2><p>Only accept if you can attend during the requested window, complete the task safely and follow the TaskBridge visit evidence requirements.</p><div className="visit-decision-actions"><button className="button button-primary button-large" disabled={busy} onClick={acceptTask}>{busy ? <><LoaderCircle className="spin" size={19} /> Updating...</> : <><BadgeCheck size={19} /> Accept task</>}</button><button className="button button-secondary button-large" disabled={busy} onClick={declineTask}><CircleX size={19} /> Decline</button></div>{error && <p className="form-error">{error}</p>}</div>
        : <>
      <div className="identity-alert"><ShieldCheck size={24} /><div><strong>MANDATED WELFARE SECURITY</strong><p>{visit.mandatedInstruction}</p></div></div>
      {finished ? <div className="visit-complete"><CheckCircle2 /><h2>Evidence submitted</h2><p>The care coordinator and TaskBridge admin can now review the before-and-after evidence. Payment remains on hold until the care coordinator confirms completion.</p></div>
        : accepted ? <div className="visit-action"><h2>Ready to begin on the day?</h2><p>When you arrive, present physical ID to the resident or attending caregiver, then check in securely. Your device location will be used only to verify arrival.</p>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-full button-large" disabled={busy} onClick={checkIn}>{busy ? <><LoaderCircle className="spin" size={19} /> Verifying location...</> : <><LocateFixed size={19} /> Check in securely</>}</button></div>
          : !checkedIn ? <div className="visit-action"><h2>Visit not ready</h2><p>This task is not currently available for check-in. Contact TaskBridge operations if you believe this is incorrect.</p>{error && <p className="form-error">{error}</p>}</div>
          : <form className="visit-evidence stack" onSubmit={submitEvidence}><div className="checked-in-banner"><BadgeCheck /> Checked in securely</div><h2>Complete the visit</h2><div className="visit-photo-grid"><label className="camera-field"><Camera size={25} /><strong>Before-work photo</strong><span>{beforeFile ? beforeFile.name : "Capture the area before work starts"}</span><input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setBeforeFile(event.target.files?.[0] || null)} /></label><label className="camera-field"><Camera size={25} /><strong>After-work photo</strong><span>{afterFile ? afterFile.name : "Capture the completed work clearly"}</span><input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setAfterFile(event.target.files?.[0] || null)} /></label></div><label>Completion notes<textarea required minLength={5} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe the work completed and any follow-up needed." /></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-full" disabled={busy} type="submit">{busy ? "Submitting evidence..." : "Check out and submit"}</button></form>}
      </>}
      <p className="visit-footer">Visit assigned to <strong>{visit.handyman}</strong>. This token is personal and must not be shared.</p>
    </section>
  </main>;
}

function formatWindow(window: Visit["preferredWindow"]) {
  if (!window.start && !window.end) return "Visit window to be confirmed";
  const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  const start = window.start ? new Intl.DateTimeFormat("en-GB", options).format(new Date(window.start)) : "Start to be confirmed";
  const end = window.end ? new Intl.DateTimeFormat("en-GB", options).format(new Date(window.end)) : "end to be confirmed";
  return `${start} - ${end}`;
}
