import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Hammer, Key, Leaf, Lock, Search, ShieldAlert, ShieldCheck, Sparkles, Droplet } from "lucide-react";
import { SUPPORTED_SERVICES, type ServiceItem } from "./data";

const categories = ["All", "Fall Prevention", "Outdoor Access", "Home Security", "Safety & Cleanliness"];

function serviceIcon(id: string) {
  switch (id) {
    case "lawn-mow":
    case "garden-clear":
      return Leaf;
    case "window-clean":
    case "path-clear":
      return Sparkles;
    case "lock-repair":
      return Key;
    case "deep-clean":
      return Droplet;
    case "appliance-check":
      return Lock;
    case "trip-hazard":
      return ShieldAlert;
    default:
      return Hammer;
  }
}

function categoryTone(category: ServiceItem["category"]) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function ServicesGuideline() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedService, setSelectedService] = useState<ServiceItem>(SUPPORTED_SERVICES[0]);

  const filteredServices = useMemo(() => SUPPORTED_SERVICES.filter((service) => {
    const matchesCategory = selectedCategory === "All" || service.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || service.name.toLowerCase().includes(query) || service.description.toLowerCase().includes(query) || service.impact.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  }), [searchQuery, selectedCategory]);

  return (
    <section id="services" className="premium-guideline services-guideline">
      <div className="site-width">
        <div className="guideline-hero-panel">
          <div>
            <span className="eyebrow">Real-world home safety support</span>
            <h1>Services framed around risks care teams actually see.</h1>
            <p>TaskBridge turns everyday hazards into approved, trackable work: clear access, reduce falls, protect hygiene and keep vulnerable people safer at home.</p>
          </div>
          <aside className="guideline-proof-card">
            <ShieldCheck size={24} />
            <strong>Safeguarding-first service release</strong>
            <span>Tasks are matched only when the operative, service type, visit window and evidence workflow fit the resident's safeguarding context.</span>
          </aside>
        </div>

        <div className="service-explorer">
          <div className="service-filter-row">
            <div className="service-tabs" aria-label="Service categories">
              {categories.map((category) => (
                <button key={category} type="button" className={selectedCategory === category ? "active" : ""} onClick={() => setSelectedCategory(category)}>
                  {category}
                </button>
              ))}
            </div>
            <label className="service-search">
              <Search size={17} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search a hazard or service" />
            </label>
          </div>

          <div className="service-story-layout">
            <div className="service-story-grid">
              {filteredServices.map((service) => {
                const Icon = serviceIcon(service.id);
                const isSelected = selectedService.id === service.id;
                return (
                  <button key={service.id} type="button" className={`service-story-card ${isSelected ? "active" : ""}`} onClick={() => setSelectedService(service)}>
                    <span className={`service-story-icon ${categoryTone(service.category)}`}><Icon size={20} /></span>
                    <small>{service.category}</small>
                    <strong>{service.name}</strong>
                    <p>{service.description}</p>
                  </button>
                );
              })}
              {filteredServices.length === 0 && <div className="service-empty"><strong>No matching service found</strong><span>Try selecting "All" or searching a broader hazard.</span></div>}
            </div>

            <aside className="service-impact-panel">
              <span className="service-impact-kicker">Resident outcome lens</span>
              <h2>{selectedService.name}</h2>
              <p>{selectedService.impact}</p>
              <div className="service-impact-steps">
                <div><CheckCircle2 size={18} /><span>Care team describes the hazard in plain language.</span></div>
                <div><ShieldCheck size={18} /><span>TaskBridge checks suitability, evidence and safeguarding controls.</span></div>
                <div><ArrowRight size={18} /><span>The completed visit returns proof for review before closure.</span></div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
