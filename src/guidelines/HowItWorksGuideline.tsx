import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollSceneRef = useRef<HTMLDivElement | null>(null);
  const selectedStep = SOLUTION_STEPS.find((step) => step.number === activeStep) || SOLUTION_STEPS[0];
  const SelectedIcon = stepIcons[selectedStep.number - 1] || FileText;
  const sliderStyle = { "--lifecycle-progress": scrollProgress } as CSSProperties;

  useEffect(() => {
    const updateFromScroll = () => {
      const scene = scrollSceneRef.current;
      if (!scene) return;

      const viewportHeight = window.innerHeight || 1;
      const rect = scene.getBoundingClientRect();
      const scrollableDistance = Math.max(scene.offsetHeight - viewportHeight, 1);
      const nextProgress = Math.min(1, Math.max(0, -rect.top / scrollableDistance));
      const nextStep = Math.min(
        SOLUTION_STEPS.length,
        Math.max(1, Math.round(nextProgress * (SOLUTION_STEPS.length - 1)) + 1)
      );

      setScrollProgress(nextProgress);
      setActiveStep(nextStep);
    };

    updateFromScroll();
    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);

    return () => {
      window.removeEventListener("scroll", updateFromScroll);
      window.removeEventListener("resize", updateFromScroll);
    };
  }, []);

  return (
    <section id="how-it-works" className="lifecycle-section">
      <div className="site-width">
        <div className="lifecycle-intro">
          <span className="eyebrow">TaskBridge workflow</span>
          <h2>How the TaskBridge lifecycle works</h2>
          <p>Select any of the four key steps to see how the secure care middleware moves from a care note to verified on-site completion.</p>
        </div>

        <div className="lifecycle-pills" aria-label="TaskBridge workflow capabilities">
          {servicePills.map((pill) => <button key={pill} type="button">{pill}</button>)}
        </div>

        <div className="lifecycle-scroll-scene" ref={scrollSceneRef}>
          <div className="lifecycle-scroll-sticky">
            <div className="lifecycle-scroll-window">
              <div className="lifecycle-slider lifecycle-slider-scroll" role="tablist" aria-label="TaskBridge lifecycle steps" style={sliderStyle}>
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
          </div>
        </div>

        <div className="lifecycle-journey-rail" aria-label="TaskBridge horizontal journey">
          {SOLUTION_STEPS.map((step) => {
            const isActive = step.number === activeStep;
            const RailIcon = stepIcons[step.number - 1] || FileText;
            return (
              <button key={step.number} type="button" className={isActive ? "active" : ""} onClick={() => setActiveStep(step.number)}>
                <span><RailIcon size={20} /></span>
                <strong>{step.badge}</strong>
              </button>
            );
          })}
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
