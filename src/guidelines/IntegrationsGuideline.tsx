import React from "react";
import { ArrowDown, ArrowRight, ShieldCheck, Database, Link, Sliders, Lock } from "lucide-react";

export default function IntegrationHub() {
  return (
    <section id="integrations" className="bg-white py-20 lg:py-28 font-sans border-b border-slate-100">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Flow Diagram - Left Column */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-100 rounded-3xl relative overflow-hidden">
            <div className="w-full text-center mb-6">
              <span className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest block">DATA TRANSFER PIPELINE</span>
              <h4 className="font-display font-semibold text-sm text-slate-800 mt-1">Zero-Disruption Integration</h4>
            </div>

            {/* FLOW DIAGRAM WRAPPER */}
            <div className="flex flex-col items-center w-full max-w-sm gap-4 text-center font-sans">
              
              {/* Box 1: Existing Systems */}
              <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm relative group hover:border-rose-100 transition-colors">
                <div className="absolute top-3 left-4 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-display font-bold text-xs text-slate-800">Your Care Planning Application</p>
                    <p className="text-[10px] text-slate-500">Everyday Care Logs, Audits, &amp; Notes</p>
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div className="flex flex-col items-center">
                <ArrowDown className="h-5 w-5 text-slate-300 animate-bounce" />
              </div>

              {/* Box 2: TaskBridge Middleware (Encrypted) */}
              <div className="w-full bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 shadow-lg relative">
                <div className="absolute top-3 left-4 h-2 w-2 rounded-full bg-rose-500" />
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <Link className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-display font-bold text-xs text-white">TaskBridge Secure Middleware</p>
                    <p className="font-mono text-[9px] text-rose-400 font-semibold uppercase tracking-wider">Masks personal data &amp; maps tasks</p>
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div className="flex flex-col items-center">
                <ArrowDown className="h-5 w-5 text-slate-300" />
              </div>

              {/* Box 3: Vetted Trader Network */}
              <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm relative group hover:border-emerald-100 transition-colors">
                <div className="absolute top-3 left-4 h-2 w-2 rounded-full bg-emerald-500" />
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-display font-bold text-xs text-slate-800">Enhanced DBS Checked Operative</p>
                    <p className="text-[10px] text-slate-500">Safe, Timely Visit &amp; Photo-Checkoff</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Description & Compatibility Pitch - Right Column */}
          <div className="lg:col-span-6 text-left flex flex-col justify-center">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
              seamless sync options
            </span>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl leading-tight">
              Compatible with most leading care management applications.
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed text-balance">
              TaskBridge slots directly alongside your existing record-keeping solutions. By monitoring selected digital ledger folders or accepting secure carer note exports, our middleware handles risk sorting without requiring your frontlines to adopt and configure new app logins.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 mt-1">
                  <Sliders className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-xs text-slate-800">No Extra Caregiver App Needed</h4>
                  <p className="font-sans text-xs text-slate-500 mt-0.5">Carers note down observations exactly as they do today. Our secure middleware extracts practical hazards seamlessly behind the scenes.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 mt-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-xs text-slate-800">Compliance &amp; GDPR Safeguarding Built-in</h4>
                  <p className="font-sans text-xs text-slate-500 mt-0.5">Any data processed meets stringent healthtech privacy parameters, shielding key location coordinates, codes, and vulnerabilities.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mt-1">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-xs text-slate-800">Automated Identity and DBS Verification</h4>
                  <p className="font-sans text-xs text-slate-500 mt-0.5">Secure provider integrations keep identity checks, Enhanced DBS outcomes and verification status current without exposing the underlying compliance workflow.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2.5 py-1 uppercase">
                Enhanced DBS Verification Ready
              </span>
              <span className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 rounded px-2 py-1">
                API COMPLIANT
              </span>
              <span className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 rounded px-2 py-1">
                WEBHOOK INTEGRATED
              </span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
