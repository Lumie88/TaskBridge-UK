import React, { useState } from "react";
import { Search, Hammer, ShieldCheck, HelpCircle, Leaf, Sparkles, Key, Droplet, Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { SUPPORTED_SERVICES, type ServiceItem } from "./data";

export default function ServicesPanel() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const categories = ["All", "Fall Prevention", "Outdoor Access", "Home Security", "Safety & Cleanliness"];

  // Filter logic
  const filteredServices = SUPPORTED_SERVICES.filter((service) => {
    const matchesCategory = selectedCategory === "All" || service.category === selectedCategory;
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          service.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Icon mapper
  const getServiceIcon = (id: string) => {
    switch (id) {
      case "lawn-mow":
        return <Leaf className="h-6 w-6 text-green-600" />;
      case "garden-clear":
        return <Leaf className="h-6 w-6 text-emerald-600" />;
      case "window-clean":
        return <Sparkles className="h-6 w-6 text-sky-500" />;
      case "path-clear":
        return <Sparkles className="h-6 w-6 text-blue-600" />;
      case "loose-rail":
        return <Hammer className="h-6 w-6 text-amber-600" />;
      case "lock-repair":
        return <Key className="h-6 w-6 text-indigo-600" />;
      case "deep-clean":
        return <Droplet className="h-6 w-6 text-purple-600" />;
      case "appliance-check":
        return <Lock className="h-6 w-6 text-rose-500" />;
      case "trip-hazard":
        return <ShieldAlert className="h-6 w-6 text-orange-600" />;
      default:
        return <Hammer className="h-6 w-6 text-slate-600" />;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Fall Prevention":
        return "bg-amber-50 text-amber-800 border-amber-100";
      case "Outdoor Access":
        return "bg-green-50 text-green-800 border-green-100";
      case "Home Security":
        return "bg-indigo-50 text-indigo-800 border-indigo-100";
      case "Safety & Cleanliness":
        return "bg-purple-50 text-purple-800 border-purple-100";
      default:
        return "bg-slate-50 text-slate-800 border-slate-100";
    }
  };

  return (
    <section id="services" className="bg-white py-20 lg:py-28 font-sans">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
          <div className="max-w-2xl text-left">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
              verified capability ledger
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Supported Safety & Home Maintenance Services
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Every job booked through TaskBridge passes straight to our checked, invite-only trader network. Care teams select exactly which hazards require safe mitigation.
            </p>
          </div>

          {/* Quick Stats side block */}
          <div className="mt-6 md:mt-0 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-6 font-display shrink-0">
            <div>
              <p className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-amber-600 bg-clip-text text-transparent">100%</p>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mt-1">DBS Checked</p>
            </div>
            <div className="border-l border-slate-200 pl-6">
              <p className="text-2xl font-bold text-slate-800">45 Min</p>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mt-1">Average SLA</p>
            </div>
          </div>
        </div>

        {/* INTERACTIVE CONTROLS: Category Tabs and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-100">
          
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  // clear search if switching categories to make query intuitive
                }}
                className={`rounded-xl px-4 py-2 text-xs font-semibold border transition-all ${
                  selectedCategory === cat
                    ? "bg-slate-900 border-slate-950 text-white shadow-md shadow-slate-905/10"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search specific hazard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 font-sans text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all shadow-inner"
            />
          </div>

        </div>

        {/* SERVICES GRID */}
        {filteredServices.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
            <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-slate-800 text-base">No matching services found</h3>
            <p className="font-sans text-xs text-slate-500 mt-1">Try broadening your search query or selecting "All" categories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => setSelectedService(service)}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-rose-500/5 hover:-translate-y-0.5 cursor-pointer hover:border-slate-300/80"
              >
                <div>
                  {/* Category Pill and Icon Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-inner group-hover:scale-105 transition-all">
                      {getServiceIcon(service.id)}
                    </div>
                    <span className={`inline-block font-sans text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 border ${getCategoryColor(service.category)}`}>
                      {service.category}
                    </span>
                  </div>

                  {/* Title and Description */}
                  <h3 className="mt-6 font-display text-base font-bold text-slate-800 group-hover:text-rose-600 transition-colors">
                    {service.name}
                  </h3>
                  <p className="mt-2 font-sans text-xs leading-relaxed text-slate-600">
                    {service.description}
                  </p>
                </div>

                {/* Impact Highlight strip */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 bg-slate-50/50 p-2.5 rounded-lg">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[8px]">✔</div>
                  <p className="font-sans text-[10px] text-slate-600 italic">
                    <strong>Mitigation Impact:</strong> {service.impact}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WORK INSPECTION STANDARDS NOTE */}
        <div className="mt-12 rounded-2xl bg-slate-900 p-6 md:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-rose-500/10 to-transparent blur" />
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-rose-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm">Full Audit Logs Provided for Care Commissioners</h4>
              <p className="font-sans text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl text-balance">
                Every dispatch is logged in structural database logs, noting timestamps, vetting status matches, and before-and-after photo verification tokens—easily exportable for local authorities and safeguarding leads.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById("demo-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-xl bg-white px-5 py-3 text-center font-sans text-xs font-bold text-slate-900 hover:bg-slate-50 transition-colors shrink-0"
          >
            Request Audit Sample
          </button>
        </div>

        {/* SERVICE DETAIL INTERACTIVE MODAL */}
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 relative">
              
              {/* Category */}
              <span className={`inline-block font-sans text-[9px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 border mb-3 ${getCategoryColor(selectedService.category)}`}>
                {selectedService.category}
              </span>

              {/* Title */}
              <h3 className="font-display font-extrabold text-xl text-slate-900">{selectedService.name}</h3>

              <p className="font-sans text-sm text-slate-600 mt-3 leading-relaxed">
                {selectedService.description}
              </p>

              {/* Service details specification */}
              <div className="mt-5 space-y-3.5 border-t border-slate-100 pt-4 font-sans text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dispatch Response:</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">Standard: &lt; 24 hours</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Safeguarding Check:</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">DBS Verified Operative Only</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Verification Steps:</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">Checked-In Photo Proofs</span>
                </div>
                <div className="bg-emerald-50 text-emerald-900 font-medium p-3 rounded-xl border border-emerald-100 flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-bold">Mitigation Outcome:</span>
                    <p className="font-sans text-[11px] text-emerald-800 mt-0.5">{selectedService.impact}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedService(null)}
                  className="w-full rounded-xl bg-slate-900 py-3 font-sans text-xs font-semibold text-white text-center hover:bg-slate-800 transition-colors"
                >
                  Close Specification
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </section>
  );
}
