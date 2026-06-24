import React, { useState } from "react";
import { AlertCircle, ArrowRight, ClipboardCheck, Sparkles, UserCheck, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import { SOLUTION_STEPS } from "./data";

export default function ProblemSolution() {
  const [activeStep, setActiveStep] = useState<number>(1);

  // Helper icons for solution steps
  const getStepIcon = (num: number) => {
    switch (num) {
      case 1:
        return <FileText className="h-5 w-5" />;
      case 2:
        return <ClipboardCheck className="h-5 w-5" />;
      case 3:
        return <UserCheck className="h-5 w-5" />;
      case 4:
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const selectedStepData = SOLUTION_STEPS.find((s) => s.number === activeStep) || SOLUTION_STEPS[0];

  return (
    <section id="how-it-works" className="bg-slate-50 py-20 lg:py-28 relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* SECTION HEADER */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
            BRIDGING THE PRACTICAL SAFETY INACTION GAP
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl text-balance">
            The Danger of Unacted Care Observations
          </h2>
          <p className="mt-4 font-sans text-base text-slate-600">
            Carers spot home physical hazards daily, but care organizations lack a reliable integration pathway to act upon them under safeguarding controls. TaskBridge turns notes into safe resolution.
          </p>
        </div>

        {/* 1. THE PROBLEM SECTION - GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-20">
          
          {/* Problem Block - High Stress Path */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-rose-100 bg-rose-50/20 p-8 sm:p-10 shadow-sm relative overflow-hidden">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 font-sans text-xs font-semibold text-rose-800">
                <AlertCircle className="h-3.5 w-3.5 text-rose-700 font-bold" />
                <span>The Unsolved Hazard Gap</span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-slate-800">
                Traditional Hazard Reporting Gaps
              </h3>
              <p className="mt-4 font-sans text-sm text-slate-600 leading-relaxed">
                Care assistants regularly document home physical hazards (like rotting garden steps, moldy paths, or missing window locks) in care planning logs. Sadly, because care providers are not general contractors or handymen, these warnings are often stranded inside software archives.
              </p>

              <ul className="mt-6 space-y-4">
                <li className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">✕</div>
                  <p className="font-sans text-xs text-slate-700"><strong>Administrative Strain:</strong> Coordinators wasted hours phoning local, unverified traders with zero safeguarding history in vulnerable homes.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">✕</div>
                  <p className="font-sans text-xs text-slate-700"><strong>GDPR Safeguarding Exposures:</strong> Handing over sensitive phone numbers and home entry codes of vulnerable-adults to unknown online marketplace workers.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">✕</div>
                  <p className="font-sans text-xs text-slate-700"><strong>Zero Audit Trails:</strong> No evidence files, checkoffs, or real-time progress notes to satisfy care regulators and families.</p>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-rose-200/40">
              <p className="font-display font-medium text-xs text-rose-700 italic">
                “Observations without action leaves vulnerable residents at imminent fall or security risk.”
              </p>
            </div>
          </div>

          {/* Solution Intro Block - Connected Secure Path */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-slate-900 bg-slate-950 p-8 sm:p-10 text-white relative overflow-hidden shadow-xl">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 font-sans text-xs font-semibold text-rose-400">
                <Sparkles className="h-4 w-4 text-rose-400" />
                <span>The TaskBridge Middleware Solution</span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-white leading-snug">
                Turning observations into certified home resolution.
              </h3>
              <p className="mt-4 font-sans text-sm text-slate-300 leading-relaxed">
                TaskBridge functions as a secure safeguarding firewall. We connect care administration software with local, checked trade networks. Your staff operates exactly as they do now—TaskBridge manages the secure routing, vetted matching, and compliance validation.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                  <h4 className="font-display font-bold text-xs text-rose-300">Fluid API Automation</h4>
                  <p className="font-sans text-[11px] text-slate-400 mt-1">Accepts and structures carer field reports with zero extra training required.</p>
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                  <h4 className="font-display font-bold text-xs text-amber-300">Safeguarding Fortress</h4>
                  <p className="font-sans text-[11px] text-slate-400 mt-1">Conceals personal details, restricting info and codes exclusively during actual checked visits.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
              <span className="font-sans text-xs text-slate-400">See our interactive flow below</span>
              <ArrowRight className="h-5 w-5 text-rose-400 animate-bounce-right" />
            </div>
          </div>

        </div>

        {/* 2. INTERACTIVE SOLUTIONS WORKFLOW PATHWAY */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 lg:p-12">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="font-display text-2xl font-bold text-slate-900">How the TaskBridge Lifecycle Works</h3>
            <p className="font-sans text-xs text-slate-500 mt-2">
              Select any of the 4 key steps below to inspect how the secure data middleware and on-site evidence protects residents.
            </p>
          </div>

          {/* Interactive Navigation Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {SOLUTION_STEPS.map((step) => {
              const isSelected = step.number === activeStep;
              return (
                <button
                  key={step.number}
                  onClick={() => setActiveStep(step.number)}
                  className={`flex items-start gap-3.5 p-4 text-left rounded-2xl border transition-all ${
                    isSelected
                      ? "border-rose-500/60 bg-rose-50/40 text-slate-900 shadow-md ring-1 ring-rose-500/20"
                      : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100/60"
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all ${
                    isSelected ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    0{step.number}
                  </div>
                  <div>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-rose-500/90 block mb-0.5">
                      {step.badge}
                    </span>
                    <h4 className="font-display font-bold text-xs text-slate-800 leading-tight">
                      {step.title.split(" in ")[0]}
                    </h4>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Inspection Workspace (Two Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-50 rounded-2xl border border-slate-100 p-6 md:p-8">
            
            {/* Interactive Data Details - Left */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold px-3 py-1 uppercase tracking-wider mb-3">
                  {getStepIcon(selectedStepData.number)}
                  <span>STEP 0{selectedStepData.number}: {selectedStepData.badge}</span>
                </span>
                <h3 className="font-display text-xl font-bold text-slate-900 leading-snug">
                  {selectedStepData.title}
                </h3>
                <p className="font-sans text-sm text-slate-600 mt-2 leading-relaxed">
                  {selectedStepData.description}
                </p>
              </div>

              {/* Dynamic Interactive States Simulation */}
              <div className="space-y-4">
                
                {/* Visual Field Log block */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <span className="font-mono text-[10px] font-bold text-slate-400 uppercase">Carer Field Interaction Log</span>
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  </div>
                  <p className="font-sans text-xs italic text-slate-700 leading-relaxed font-medium">
                    {selectedStepData.caregiverAction}
                  </p>
                </div>

                {/* Secure Middleware Response block */}
                <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-rose-100/60 pb-2 mb-2">
                    <span className="font-mono text-[10px] font-bold text-rose-500 uppercase">Secure Middleware Automation</span>
                    <span className="font-mono text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">ACTIVE LOG</span>
                  </div>
                  <p className="font-sans text-xs text-slate-700 leading-relaxed font-semibold">
                    {selectedStepData.middlewareAction}
                  </p>
                </div>

              </div>
            </div>

            {/* Interactive Safe Dispatch Progress Panel - Designed for Care Managers (Non-Technical) */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xl relative overflow-hidden text-left">
                {/* Header of mock software terminal */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800">Care Dispatch Control Card</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">SECURE MIDDLEWARE</span>
                </div>

                {/* Friendly checklists and info cards */}
                <div className="space-y-4">
                  {/* Item 1 */}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-full bg-rose-50 p-1 text-rose-500">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">TaskBridge Automated Verification</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Hazard matched and dispatched instantly to local care team.</p>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-full bg-emerald-50 p-1 text-emerald-500">
                      <UserCheck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Strict Resident Safeguarding Protection</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">DBS verification successful. Telephone number and keysafe access shielded securely.</p>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-full bg-amber-50 p-1 text-slate-500">
                      <ClipboardCheck className="h-3.5 w-3.5 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Compliance & Digital Audit Trail</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Before-and-after photo records are logged for authorised care teams and inspection evidence.</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Evidence Record:</span>
                    <span className="font-sans font-semibold text-xs text-rose-600 underline">
                      {selectedStepData.evidenceCapture}
                    </span>
                  </div>
                </div>

                {/* Handyman matched card indicator inside panel when step is 3 or 4 */}
                {(activeStep === 3 || activeStep === 4) && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 flex items-center justify-center font-bold text-white text-xs shadow-sm shadow-rose-500/10">TB</div>
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">Vetted Handyman Dispatched</p>
                      <p className="text-[10px] text-slate-500 leading-none mt-0.5">Registered ID: TBP-9082 (Active Enhanced DBS Pass)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Workflow Bottom Notice */}
          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-1 font-sans text-xs text-slate-500">
              With TaskBridge, care managers stay fully aligned while contractors never gain access to resident history or direct files.
            </span>
          </div>

        </div>

      </div>
    </section>
  );
}
