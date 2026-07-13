import React from "react";
import { ShieldCheck, EyeOff, Camera, RefreshCw } from "lucide-react";

export default function SafeguardingShield() {
  const points = [
    {
      icon: <ShieldCheck className="h-6 w-6 text-rose-500" />,
      title: "Enhanced DBS controls for vulnerable-adult visits",
      description: "Any operative attending a home visit holds active, validated Enhanced Disclosure and Barring Service clearance, ensuring peace of mind around vulnerable residents."
    },
    {
      icon: <EyeOff className="h-6 w-6 text-amber-500" />,
      title: "Resident Details Safely Escrowed",
      description: "Direct mobile numbers and specific key safe access credentials are held securely. Operatives communicate through the authorised workflow rather than requesting callbacks from residents."
    },
    {
      icon: <Camera className="h-6 w-6 text-indigo-500" />,
      title: "Secure Web-Links & Arrival Verification",
      description: "Visiting traders use single-use, timed secure web pages to coordinate progress and capture job evidence—no local data is ever saved on personal trader laptops or devices."
    },
    {
      icon: <RefreshCw className="h-6 w-6 text-purple-500" />,
      title: "Real-Time Care Team Feedback Loops",
      description: "As soon as a hazard is marked safe and clear, the care office receives time-logged evidence. Your native clinical systems can instantly log and verify completion times."
    }
  ];

  return (
    <section id="safeguarding" className="bg-slate-900 text-white py-20 lg:py-28 relative overflow-hidden font-sans">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        
        {/* Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: GRAPHIC CARD & BADGE */}
          <div className="lg:col-span-5 text-left flex flex-col justify-center">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-rose-400">
              SAFEGUARDING ASSURED
            </span>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-[1.15]">
              Built ground-up around vulnerable resident protection
            </h2>
            <p className="mt-4 text-base text-slate-300 leading-relaxed text-balance">
              At TaskBridge, home safety is not just about tightening a banister—it is about safeguarding the psychological and physical environment of everyone we serve. 
            </p>

            {/* Shield graphic board */}
            <div className="mt-8 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700/60 p-6 flex items-start gap-4 shadow-xl">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-sm text-white">The Safe Hands Framework</h4>
                <p className="font-sans text-xs text-slate-400 mt-1 leading-relaxed">
                  We verify trade insurance, validate geofenced arrival, and require photographic evidence before care-team completion approval. Every visit remains auditable.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CORE VALUES LIST */}
          <div className="lg:col-span-7 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {points.map((pt, idx) => (
                <div 
                  key={idx}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-6 transition-all hover:border-slate-700 hover:bg-slate-900/60 flex flex-col justify-between"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 mb-4 shadow-inner">
                    {pt.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-slate-100 mb-2 leading-snug">
                      {pt.title}
                    </h3>
                    <p className="font-sans text-[11px] leading-relaxed text-slate-400">
                      {pt.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
