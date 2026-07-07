import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserCheck
} from "lucide-react";
import heroImage from "../assets/home-safety-hero.jpg";
import { SOLUTION_STEPS } from "./data";

const stepIcons = [FileText, ClipboardCheck, UserCheck, CheckCircle2];

const controlNotes = [
  {
    title: "TaskBridge automated verification",
    detail: "The care note is converted into a practical home-safety task for care-team review.",
    icon: Sparkles
  },
  {
    title: "Strict resident safeguarding protection",
    detail: "Resident contact details, keysafe notes and private records remain shielded from the operative.",
    icon: LockKeyhole
  },
  {
    title: "Compliance and digital audit trail",
    detail: "Visit status, evidence photos and completion checks are recorded for authorised care teams.",
    icon: BadgeCheck
  }
];

const servicePills = ["Care note AI", "Coordinator approval", "DBS matching", "Visit evidence", "Care record sync"];

export default function HowItWorksGuideline() {
  const [activeStep, setActiveStep] = useState(1);
  const selectedStep = SOLUTION_STEPS.find((step) => step.number === activeStep) || SOLUTION_STEPS[0];
  const SelectedIcon = stepIcons[selectedStep.number - 1] || FileText;

  return (
    <section id="how-it-works" className="lifecycle-section">
      <div className="site-width">
        <section className="twilio-style-showcase">
          <div className="twilio-style-grid">
            <article className="twilio-style-copy">
              <span className="twilio-style-kicker">Secure care operations</span>
              <h2>Intelligent <span>home-safety coordination</span></h2>
              <p>TaskBridge turns everyday care observations into approved, traceable home-safety work. Coordinators stay in control while the platform handles service matching, safeguarding checks and visit evidence.</p>
              <div className="twilio-style-pills" aria-label="TaskBridge workflow capabilities">
                {servicePills.map((pill) => <button key={pill} type="button">{pill}</button>)}
              </div>
            </article>

            <aside className="twilio-style-visual" aria-label="TaskBridge visual workflow preview">
              <img src={heroImage} alt="Verified home-safety work completed in a resident home" />
              <div className="twilio-message-card twilio-message-top">
                <span><i /></span>
                <p>Care note: slippery garden path after rain. Resident is vulnerable. Carer available Tuesday morning.</p>
              </div>
              <div className="twilio-message-card twilio-message-bottom">
                <strong>TaskBridge agent</strong>
                <p>Task split, Enhanced DBS requirement applied, care-manager approval requested.</p>
              </div>
            </aside>
          </div>

          <div className="twilio-journey-rail" aria-label="TaskBridge horizontal journey">
            {SOLUTION_STEPS.map((step) => {
              const isActive = step.number === activeStep;
              return (
                <button key={step.number} type="button" className={isActive ? "active" : ""} onClick={() => setActiveStep(step.number)}>
                  <span>{step.number === 1 ? <FileText size={20} /> : step.number === 2 ? <ClipboardCheck size={20} /> : step.number === 3 ? <UserCheck size={20} /> : <CheckCircle2 size={20} />}</span>
                  <strong>{step.badge}</strong>
                </button>
              );
            })}
          </div>
        </section>

        <div className="lifecycle-intro">
          <span className="eyebrow">TaskBridge workflow</span>
          <h2>How the TaskBridge lifecycle works</h2>
          <p>Select any of the four key steps to see how the secure care middleware moves from a care note to verified on-site completion.</p>
        </div>

        <div className="lifecycle-slider" role="tablist" aria-label="TaskBridge lifecycle steps">
          {SOLUTION_STEPS.map((step) => {
            const isActive = step.number === activeStep;
            return (
              <button
                key={step.number}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={isActive ? "active" : ""}
                onClick={() => setActiveStep(step.number)}
              >
                <span>{String(step.number).padStart(2, "0")}</span>
                <div>
                  <small>{step.badge}</small>
                  <strong>{step.title}</strong>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lifecycle-stage">
          <article className="lifecycle-detail">
            <span className="lifecycle-step-pill"><SelectedIcon size={17} /> Step {String(selectedStep.number).padStart(2, "0")}: {selectedStep.badge}</span>
            <h3>{selectedStep.title}</h3>
            <p>{selectedStep.description}</p>

            <div className="lifecycle-log">
              <header><span>Care field interaction log</span><i /></header>
              <p>{selectedStep.caregiverAction}</p>
            </div>

            <div className="lifecycle-log lifecycle-log-secure">
              <header><span>Secure middleware automation</span><strong>Active log</strong></header>
              <p>{selectedStep.middlewareAction}</p>
            </div>
          </article>

          <aside className="lifecycle-control-card">
            <header>
              <div><i /><strong>Care dispatch control card</strong></div>
              <span>Secure middleware</span>
            </header>

            <div className="lifecycle-control-list">
              {controlNotes.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title}>
                    <span><Icon size={16} /></span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {(activeStep === 3 || activeStep === 4) && (
              <div className="lifecycle-operative">
                <span>TB</span>
                <div>
                  <strong>Vetted handyman dispatched</strong>
                  <p>Enhanced DBS status active and suitable for the task.</p>
                </div>
              </div>
            )}

            <footer>
              <span>Evidence record</span>
              <strong>{selectedStep.evidenceCapture}</strong>
            </footer>
          </aside>
        </div>

        <div className="lifecycle-assurance">
          <div><ShieldCheck size={20} /><span>Enhanced DBS-vetted attendance for vulnerable-adult visits</span></div>
          <div><MapPin size={20} /><span>Geofenced check-in and checkout evidence</span></div>
          <div><Camera size={20} /><span>Before-and-after task photos for care-team review</span></div>
        </div>

        <section className="lifecycle-gap">
          <div>
            <span><AlertCircle size={19} /></span>
            <h3>Why TaskBridge exists</h3>
            <p>Care teams notice practical hazards every day, but those observations often remain trapped inside notes. TaskBridge gives care providers a controlled route to approve, assign and verify the home-safety work without exposing service-user details.</p>
          </div>
          <a href="/services">View supported services <ArrowRight size={17} /></a>
        </section>
      </div>
    </section>
  );
}
