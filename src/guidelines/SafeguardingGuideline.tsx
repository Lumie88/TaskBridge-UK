import { Camera, EyeOff, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";

const safeguards = [
  {
    icon: ShieldCheck,
    title: "Enhanced DBS-vetted attendance",
    detail: "Vulnerable-adult visits are released only to suitable operatives with active safeguarding checks and verified service fit."
  },
  {
    icon: EyeOff,
    title: "Resident details shielded",
    detail: "Direct contact numbers, access notes and sensitive context stay inside the authorised workflow rather than being exposed in open messages."
  },
  {
    icon: Camera,
    title: "Evidence before closure",
    detail: "Arrival, before-and-after photographs, checkout and completion notes are recorded for care-team review."
  },
  {
    icon: RefreshCw,
    title: "Care record feedback loop",
    detail: "The care office gets a clear record of what changed, who attended and what evidence supports the completed task."
  }
];

export default function SafeguardingGuideline() {
  return (
    <section id="safeguarding" className="premium-guideline safeguarding-guideline">
      <div className="site-width safeguarding-premium-grid">
        <div className="safeguarding-copy">
          <span className="eyebrow">Safeguarding protocol</span>
          <h1>Designed for the moment a stranger enters a vulnerable person's home.</h1>
          <p>TaskBridge is built around a simple operational principle: practical help should never require care teams to lower their safeguarding standards.</p>
          <div className="safeguarding-framework">
            <span><LockKeyhole size={20} /></span>
            <div>
              <strong>The Safe Visit Framework</strong>
              <p>Suitability checks, identity shielding, geofenced attendance and evidence review sit between the care note and the completed visit.</p>
            </div>
          </div>
        </div>

        <div className="safeguarding-cards">
          {safeguards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <span><Icon size={21} /></span>
                <h2>{item.title}</h2>
                <p>{item.detail}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
