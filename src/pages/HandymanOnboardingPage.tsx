import { type FormEvent, useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Wrench
} from "lucide-react";
import { api, formatDate } from "../api";
import { Brand } from "../components";

type RequiredDocumentType = "identity" | "public_liability_insurance" | "enhanced_dbs";

interface InvitationData {
  handyman: { fullName: string; email: string };
  expiresAt: string;
  serviceOptions: string[];
  requiredDocuments: RequiredDocumentType[];
}

interface UploadedDocument {
  documentType: RequiredDocumentType | "qualification";
  storageKey: string;
  originalFilename: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  sizeBytes: number;
  reference?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  qualificationTitle?: string;
}

export function HandymanOnboardingPage({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [fullName, setFullName] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<RequiredDocumentType, File | null>>({
    identity: null,
    public_liability_insurance: null,
    enhanced_dbs: null
  });
  const [qualificationFile, setQualificationFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api<InvitationData>(`/api/handyman-onboarding/${token}`)
      .then((result) => { setInvitation(result); setFullName(result.handyman.fullName); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to open this invitation"))
      .finally(() => setLoading(false));
  }, [token]);

  function toggleService(service: string) {
    setServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);
  }

  async function uploadDocument(documentType: UploadedDocument["documentType"], file: File) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new Error("Documents must be PDF, JPEG or PNG");
    const signed = await api<{ uploadUrl: string; storageKey: string; headers: Record<string, string> }>(
      `/api/handyman-onboarding/${token}/upload-url`,
      { method: "POST", body: JSON.stringify({ documentType, contentType: file.type, sizeBytes: file.size }) }
    );
    const uploaded = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: file });
    if (!uploaded.ok) throw new Error(`The ${documentLabel(documentType)} document did not upload`);
    return {
      documentType,
      storageKey: signed.storageKey,
      originalFilename: file.name,
      contentType: file.type as UploadedDocument["contentType"],
      sizeBytes: file.size
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!files.identity || !files.public_liability_insurance || !files.enhanced_dbs) {
      setError("Identity, insurance and Enhanced DBS documents are required");
      return;
    }
    if (!services.length) {
      setError("Select at least one service");
      return;
    }
    setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      setProgress("Uploading identity evidence...");
      const identity = await uploadDocument("identity", files.identity);
      setProgress("Uploading insurance evidence...");
      const insurance = await uploadDocument("public_liability_insurance", files.public_liability_insurance);
      setProgress("Uploading Enhanced DBS evidence...");
      const dbs = await uploadDocument("enhanced_dbs", files.enhanced_dbs);
      const documents: UploadedDocument[] = [
        identity,
        { ...insurance, reference: String(values.get("insuranceReference")), expiryDate: String(values.get("insuranceExpiry")) },
        { ...dbs, reference: String(values.get("dbsReference")), issueDate: String(values.get("dbsIssueDate")) }
      ];
      if (qualificationFile) {
        setProgress("Uploading qualification evidence...");
        const qualification = await uploadDocument("qualification", qualificationFile);
        documents.push({
          ...qualification,
          qualificationTitle: String(values.get("qualificationTitle") || "Trade qualification"),
          expiryDate: String(values.get("qualificationExpiry") || "") || null
        });
      }
      setProgress("Submitting for compliance review...");
      await api(`/api/handyman-onboarding/${token}/complete`, {
        method: "POST",
        body: JSON.stringify({
          fullName,
          mobile: values.get("mobile"),
          postcode: values.get("postcode"),
          hourlyRate: Number(values.get("hourlyRate")),
          services,
          insurance: {
            providerName: values.get("insuranceProvider"),
            policyReference: values.get("insuranceReference"),
            expiryDate: values.get("insuranceExpiry")
          },
          dbs: {
            certificateReference: values.get("dbsReference"),
            issueDate: values.get("dbsIssueDate")
          },
          documents,
          safeguardingDeclaration: values.get("safeguardingDeclaration") === "on",
          dataAccuracyConfirmation: values.get("dataAccuracyConfirmation") === "on",
          privacyNoticeAccepted: values.get("privacyNoticeAccepted") === "on"
        })
      });
      setSubmitted(true);
      setProgress("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration could not be submitted");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return <main className="handyman-onboarding-page">
    <header className="handyman-onboarding-header"><Brand /><span><LockKeyhole size={16} /> Secure registration</span></header>
    <div className="handyman-onboarding-shell">
      {loading ? <div className="app-loading"><LoaderCircle className="spin" /> Checking your invitation...</div>
        : submitted ? <section className="onboarding-complete"><span><CheckCircle2 size={38} /></span><h1>Registration submitted.</h1><p>Your information is now awaiting TaskBridge compliance review. You cannot receive work until the required checks have been approved.</p></section>
          : !invitation ? <section className="onboarding-complete onboarding-error"><span><LockKeyhole size={38} /></span><h1>Invitation unavailable.</h1><p>{error}</p></section>
            : <>
              <section className="onboarding-intro">
                <span className="eyebrow"><ShieldCheck size={15} /> TaskBridge vetted network</span>
                <h1>Complete your handyman registration.</h1>
                <p>Hello {invitation.handyman.fullName}. Provide the information TaskBridge needs to review your suitability for safeguarded home-support work.</p>
                <div><span><BadgeCheck size={17} /> Invited email: {invitation.handyman.email}</span><span>Link expires {formatDate(invitation.expiresAt, true)}</span></div>
              </section>
              <form className="onboarding-form" onSubmit={submit}>
                <section className="onboarding-form-section">
                  <div className="onboarding-section-title"><span><Wrench size={20} /></span><div><h2>Contact and work profile</h2><p>Information used to coordinate suitable local work.</p></div></div>
                  <div className="field-row"><label>Full legal name<input required minLength={2} maxLength={160} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label><label>Mobile number<input required name="mobile" pattern="\+[1-9][0-9]{7,14}" placeholder="+447700900000" autoComplete="tel" /></label></div>
                  <div className="field-row"><label>Primary work postcode<input required name="postcode" minLength={5} maxLength={12} autoComplete="postal-code" /></label><label>Hourly rate (£)<input required name="hourlyRate" type="number" min="1" max="500" step="0.01" /></label></div>
                  <fieldset><legend>Services you can provide</legend><div className="service-choice-grid">{invitation.serviceOptions.map((service) => <label className="service-choice" key={service}><input type="checkbox" checked={services.includes(service)} onChange={() => toggleService(service)} /><span>{service}</span></label>)}</div></fieldset>
                </section>

                <section className="onboarding-form-section">
                  <div className="onboarding-section-title"><span><FileCheck2 size={20} /></span><div><h2>Compliance evidence</h2><p>PDF, JPEG or PNG. Maximum 15 MB per document.</p></div></div>
                  <DocumentField label="Proof of identity" detail="Passport or driving licence" required onFile={(file) => setFiles((current) => ({ ...current, identity: file }))} />
                  <div className="document-block"><DocumentField label="Public liability insurance certificate" detail="Current insurance evidence" required onFile={(file) => setFiles((current) => ({ ...current, public_liability_insurance: file }))} /><div className="field-row"><label>Insurance provider<input required name="insuranceProvider" /></label><label>Policy reference<input required name="insuranceReference" /></label></div><label>Insurance expiry date<input required name="insuranceExpiry" type="date" /></label></div>
                  <div className="document-block"><DocumentField label="Enhanced DBS certificate" detail="Certificate evidence for safeguarded work" required onFile={(file) => setFiles((current) => ({ ...current, enhanced_dbs: file }))} /><div className="field-row"><label>Certificate reference<input required name="dbsReference" /></label><label>Certificate issue date<input required name="dbsIssueDate" type="date" /></label></div></div>
                  <div className="document-block optional-document"><DocumentField label="Trade qualification" detail="Optional role-specific certificate" onFile={setQualificationFile} /><div className="field-row"><label>Qualification title<input name="qualificationTitle" disabled={!qualificationFile} /></label><label>Expiry date<input name="qualificationExpiry" type="date" disabled={!qualificationFile} /></label></div></div>
                </section>

                <section className="onboarding-form-section declaration-section">
                  <div className="onboarding-section-title"><span><ShieldCheck size={20} /></span><div><h2>Declarations</h2><p>Submission starts review; it does not confirm approval.</p></div></div>
                  <label className="toggle-row"><input required name="safeguardingDeclaration" type="checkbox" /><span><strong>Safeguarding declaration</strong><small>I understand that work involving vulnerable adults is subject to active Enhanced DBS, insurance and TaskBridge approval.</small></span></label>
                  <label className="toggle-row"><input required name="dataAccuracyConfirmation" type="checkbox" /><span><strong>Information is accurate</strong><small>I confirm the information and documents supplied are current and genuine.</small></span></label>
                  <label className="toggle-row"><input required name="privacyNoticeAccepted" type="checkbox" /><span><strong>Privacy notice accepted</strong><small>I consent to TaskBridge processing this information for identity, safeguarding and work-suitability checks.</small></span></label>
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <button className="button button-primary button-large button-full" disabled={busy} type="submit">{busy ? <><LoaderCircle className="spin" size={18} /> {progress || "Submitting..."}</> : <><ShieldCheck size={18} /> Submit for compliance review</>}</button>
                </section>
              </form>
            </>}
    </div>
  </main>;
}

function DocumentField({ label, detail, required = false, onFile }: { label: string; detail: string; required?: boolean; onFile: (file: File | null) => void }) {
  return <label className="document-upload"><span><FileUp size={20} /></span><div><strong>{label}{required ? " *" : ""}</strong><small>{detail}</small><input required={required} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => onFile(event.target.files?.[0] || null)} /></div></label>;
}

function documentLabel(type: UploadedDocument["documentType"]) {
  return type.replaceAll("_", " ");
}
