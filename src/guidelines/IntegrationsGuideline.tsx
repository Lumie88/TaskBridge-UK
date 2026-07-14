import { ArrowRight, Database, FileText, LockKeyhole, ShieldCheck, Sliders, UserCheck } from "lucide-react";

const integrationPoints = [
  {
    icon: FileText,
    title: "Selected care notes",
    detail: "Care teams can send selected notes or approved requests from their existing care management workflow."
  },
  {
    icon: Sliders,
    title: "TaskBridge coordination layer",
    detail: "The request is structured, privacy-reviewed and prepared for safeguarding-led assignment."
  },
  {
    icon: UserCheck,
    title: "Vetted operative workflow",
    detail: "The operative receives only the approved task context, visit window and secure check-in route."
  },
  {
    icon: ShieldCheck,
    title: "Evidence returned",
    detail: "Status updates, photos and completion outcomes are returned to authorised care teams."
  }
];

export default function IntegrationsGuideline() {
  return (
    <section id="integrations" className="premium-guideline integrations-guideline">
      <div className="site-width integrations-premium-grid">
        <div className="integration-flow-card">
          <span className="integration-flow-label">Care operations flow</span>
          <div className="integration-flow">
            {integrationPoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="integration-flow-step">
                  <span><Icon size={20} /></span>
                  <strong>{point.title}</strong>
                  <p>{point.detail}</p>
                  {index < integrationPoints.length - 1 && <ArrowRight className="integration-arrow" size={18} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="integrations-copy">
          <span className="eyebrow">System integrations</span>
          <h1>Compatible with most leading care management applications.</h1>
          <p>TaskBridge works alongside existing care records instead of asking frontline staff to learn another daily system. The focus is controlled information flow, safe task release and clear completion evidence.</p>
          <div className="integration-proof-list">
            <div><Database size={19} /><span>Webhook, portal and managed onboarding routes available.</span></div>
            <div><LockKeyhole size={19} /><span>Resident identity, access and vulnerability details stay protected.</span></div>
            <div><ShieldCheck size={19} /><span>Safeguarding controls are applied before external attendance.</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
