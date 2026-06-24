import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  Clock3,
  FileCheck2,
  Heart,
  HeartPulse,
  Link2,
  LogIn,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Play,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Star,
  Store,
  UsersRound
} from "lucide-react";
import heroImage from "../assets/home-safety-hero.jpg";
import { DemoModal, PublicHeader } from "../components";
import HowItWorksGuideline from "../guidelines/HowItWorksGuideline";
import IntegrationsGuideline from "../guidelines/IntegrationsGuideline";
import SafeguardingGuideline from "../guidelines/SafeguardingGuideline";
import ServicesGuideline from "../guidelines/ServicesGuideline";

const services = [
  "Minor home repairs",
  "Grab rails and safety fittings",
  "Garden paths and lawn care",
  "Window cleaning",
  "Appliance safety tasks",
  "Locks, doors and access"
];

const faqs = [
  {
    question: "What happens after we book a demo?",
    answer: "We confirm the request by work email, review your organisation's care workflow and arrange a focused demonstration. After the demo, we agree the onboarding, safeguarding and integration plan. You do not need to share resident data for the demonstration."
  },
  {
    question: "How does TaskBridge check electrical work?",
    answer: "Electrical tasks are identified during task review and can only be matched to a professional with an approved, in-date electrical qualification and verified insurance. General handymen are blocked from regulated electrical work."
  },
  {
    question: "How are vulnerable service users safeguarded?",
    answer: "Care-team approval is required before assignment. Vulnerable-adult visits require an active Enhanced DBS check, verified insurance, service suitability and a secure visit record. Resident contact and access details remain protected."
  },
  {
    question: "How does the handyman receive and complete a task?",
    answer: "Once approved, the handyman receives a tokenised SMS link. The link supports geofenced check-in, visit instructions, photographic evidence and check-out without exposing the service user's direct contact details."
  },
  {
    question: "How are care agency staff given access?",
    answer: "A TaskBridge super admin creates the agency workspace and sends the nominated manager a one-use email invitation. Additional coordinators and managers are invited into that agency only, so they cannot see another organisation's records."
  },
  {
    question: "Who controls TaskBridge administrator access?",
    answer: "Only a TaskBridge super admin can invite administrators, promote an admin to super admin, demote or suspend access, or delete an account. Every change is audited, sessions are revoked after permission changes, and the final active super admin cannot be removed."
  }
];

export function MarketingHome() {
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <div className="marketing-page">
      <PublicHeader onDemo={() => setDemoOpen(true)} />
      <main>
        <section className="studio-hero">
          <div className="site-width studio-hero-grid">
            <div className="studio-hero-copy">
              <span className="studio-trust-pill"><ShieldCheck size={16} /> Compliant care operations middleware</span>
              <h1>Connecting care teams with trusted, <span>vetted home safety</span> support.</h1>
              <blockquote>“Making home safer for our vulnerable”</blockquote>
              <p>TaskBridge bridges the gap between care management and home safety. Convert carer observations into approved, trackable home inspections, garden safety and repairs while keeping resident identity and contact details secure.</p>
              <div className="studio-assurance" aria-label="Service assurances">
                <span><BadgeCheck size={19} /> Enhanced DBS-checked operatives</span>
                <span><BadgeCheck size={19} /> GDPR compliant</span>
              </div>
              <div className="studio-hero-actions">
                <button className="button studio-dark-button" onClick={() => setDemoOpen(true)}>Book a demo <ArrowRight size={17} /></button>
                <a className="button studio-light-button" href="/how-it-works"><Play size={15} /> See how it works</a>
                <a className="button studio-portal-button" href="/sign-in"><LogIn size={16} /> Sign in to portal</a>
              </div>
            </div>
            <div className="studio-hero-visual">
              <div className="studio-image-frame"><img src={heroImage} alt="A verified handyman installing a safety rail in a bright bathroom" /></div>
              <div className="studio-float-card verification-card"><span><BadgeCheck size={20} /></span><div><small>Verification match</small><strong>Enhanced DBS verified</strong><p>Operative status active &amp; validated</p></div></div>
              <div className="studio-float-card privacy-card"><span><ShieldAlert size={20} /></span><div><small>Encrypted privacy</small><strong>Contact details secured</strong><p>Resident contact numbers fully shielded</p></div></div>
            </div>
          </div>
        </section>

        <section className="studio-trust" id="integrations">
          <div className="site-width">
            <div className="studio-section-title"><span>Engineered for complete peace of mind</span><h2>Four pillars of safe, trusted care support</h2></div>
            <div className="studio-trust-grid">
              <StudioPillar icon={<Link2 />} tone="rose" title="Extremely compatible" detail="Compatible with most leading care management applications to sync notes smoothly." label="Integration ready" />
              <StudioPillar icon={<ShieldCheck />} tone="amber" title="Enhanced DBS vetted" detail="Every handyman is checked against active safeguarding and insurance requirements." label="Safeguarding compliant" />
              <StudioPillar icon={<Store />} tone="indigo" title="Private vetted networks" detail="Work is routed through controlled provider pools rather than public task feeds." label="Trusted trade panel" />
              <StudioPillar icon={<LockKeyhole />} tone="green" title="Resident details protected" detail="Home access details and direct resident contacts remain shielded from operatives." label="GDPR & cyber secure" />
            </div>
          </div>
        </section>

        <section className="section site-width intro-grid">
          <div className="section-heading">
            <span className="eyebrow">A clearer route from concern to completion</span>
            <h2>Practical help, without adding another coordination burden.</h2>
          </div>
          <div className="intro-copy">
            <p>TaskBridge helps care teams act on everyday hazards before they become serious incidents. One note can contain several needs; each is identified, checked and followed through as its own task.</p>
            <a className="inline-link" href="/how-it-works">Explore the full process <ArrowRight size={17} /></a>
          </div>
        </section>

        <section className="process-band" id="safeguarding">
          <div className="site-width">
            <div className="section-heading section-heading-centered">
              <span className="eyebrow">Safeguarding built into the journey</span>
              <h2>Every visit passes through the right controls.</h2>
              <p>Care-team approval comes first. TaskBridge then handles suitability, verified cover, Enhanced DBS status and secure visit evidence.</p>
            </div>
            <div className="process-grid">
              <ProcessStep number="01" icon={<MessageSquareText />} title="Describe the concern" detail="A coordinator records the resident's practical home-safety need in plain language." />
              <ProcessStep number="02" icon={<Sparkles />} title="Review clear tasks" detail="The note is organised into one or more suggested tasks for care-team approval." />
              <ProcessStep number="03" icon={<UsersRound />} title="Safely match" detail="TaskBridge checks service fit, distance, availability, insurance and safeguarding status." />
              <ProcessStep number="04" icon={<Camera />} title="Confirm the outcome" detail="Geofenced arrival and completion evidence return the result to the care team." />
            </div>
          </div>
        </section>

        <section className="section site-width services-section" id="services">
          <div className="services-copy">
            <span className="eyebrow">Everyday support that matters</span>
            <h2>One trusted route to a safer home.</h2>
            <p>From a loose handle to an overgrown path, TaskBridge helps teams coordinate the small jobs that can make a meaningful difference to independence and wellbeing.</p>
            <ul className="service-list">
              {services.map((service) => <li key={service}><Check size={17} /> {service}</li>)}
            </ul>
          </div>
          <div className="outcome-panel">
            <span className="outcome-icon"><HeartPulse size={27} /></span>
            <p className="outcome-label">Built around prevention</p>
            <h3>Spot the hazard. Coordinate the fix. Keep the care record connected.</h3>
            <div className="outcome-stats">
              <div><Clock3 /><strong>Less chasing</strong><span>Clear ownership and task status</span></div>
              <div><FileCheck2 /><strong>Better evidence</strong><span>Visit activity recorded end to end</span></div>
              <div><ShieldCheck /><strong>Stronger safeguards</strong><span>Controls applied before dispatch</span></div>
            </div>
          </div>
        </section>

        <section className="section site-width faq-section" id="faq">
          <div className="section-heading section-heading-centered">
            <span className="eyebrow">Questions, answered clearly</span>
            <h2>What care teams need to know.</h2>
            <p>Practical detail about onboarding, safeguarding, compliance and secure visits.</p>
          </div>
          <div className="faq-list">
            {faqs.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}
          </div>
        </section>

        <StudioCallout onDemo={() => setDemoOpen(true)} />
      </main>
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

function ProcessStep({ number, icon, title, detail }: { number: string; icon: React.ReactNode; title: string; detail: string }) {
  return <article className="process-step"><span className="process-number">{number}</span><span className="process-icon">{icon}</span><h3>{title}</h3><p>{detail}</p></article>;
}

function StudioPillar({ icon, tone, title, detail, label }: { icon: React.ReactNode; tone: string; title: string; detail: string; label: string }) {
  return <article className="studio-pillar"><span className={`studio-pillar-icon ${tone}`}>{icon}</span><h3>{title}</h3><p>{detail}</p><footer><span>{label}</span><i /></footer></article>;
}

export function HowItWorks() {
  return <GuidelinePage><HowItWorksGuideline /></GuidelinePage>;
}

export function OurServices() {
  return <GuidelinePage><ServicesGuideline /></GuidelinePage>;
}

export function SafeguardingProtocol() {
  return <GuidelinePage><SafeguardingGuideline /></GuidelinePage>;
}

export function SystemIntegrations() {
  return <GuidelinePage><IntegrationsGuideline /></GuidelinePage>;
}

function GuidelinePage({ children }: { children: ReactNode }) {
  const [demoOpen, setDemoOpen] = useState(false);
  return (
    <div className="marketing-page">
      <PublicHeader onDemo={() => setDemoOpen(true)} />
      <main className="guideline-main">
        {children}
        <StudioCallout onDemo={() => setDemoOpen(true)} />
      </main>
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

function StudioCallout({ onDemo }: { onDemo: () => void }) {
  return <section className="studio-callout-section">
    <div className="site-width studio-callout">
      <span className="studio-callout-badge"><ShieldCheck size={14} /> Secure operational care middleware</span>
      <h2>Ready to transform safe resident care?</h2>
      <p>See how the TaskBridge secure gateway connects with your existing care management systems to coordinate approved, vetted home-safety support.</p>
      <div className="studio-callout-actions">
        <button onClick={onDemo}>Book personal demonstration <ArrowRight size={18} /></button>
        <a href="/sign-in"><LogIn size={18} /> Care coordinator sign in</a>
      </div>
      <div className="studio-callout-trust">
        <span><Star size={19} /> Designed around UK care-quality expectations</span>
        <span><Heart size={19} /> Enhanced DBS controls enforced</span>
        <span><LockKeyhole size={19} /> Resident identity data shielded</span>
      </div>
    </div>
  </section>;
}

function Footer() {
  return <footer className="footer">
    <div className="site-width footer-main">
      <section className="footer-about" aria-label="About TaskBridge">
        <a className="footer-brand" href="/" aria-label="TaskBridge home">
          <span className="footer-brand-mark"><ShieldCheck size={24} /></span>
          <span><strong>Task<span>Bridge</span></strong><small>Safeguarded care middleware</small></span>
        </a>
        <p>Connecting home care managers and safeguarding coordinators with verified, Enhanced DBS-vetted home support professionals.</p>
        <blockquote>“Making home safer for our vulnerable”</blockquote>
      </section>

      <nav className="footer-links" aria-label="System guidelines">
        <h2>System guidelines</h2>
        <a href="/how-it-works">How it works</a>
        <a href="/services">Our services</a>
        <a href="/safeguarding">Safeguarding protocol</a>
        <a href="/integrations">System integrations</a>
      </nav>

      <section className="footer-contact" aria-label="Inquiries and support">
        <h2>Inquiries &amp; support</h2>
        <a className="footer-contact-row" href="tel:+442080501234">
          <Phone size={19} />
          <span><strong>+44 (0) 20 8050 1234</strong><small>Mon - Fri: 8:00 AM - 6:00 PM GMT</small></span>
        </a>
        <a className="footer-contact-row" href="mailto:integrations@taskbridge.tech">
          <Mail size={19} /><span><strong>integrations@taskbridge.tech</strong></span>
        </a>
        <div className="footer-contact-row">
          <MapPin size={19} />
          <address>TaskBridge Systems Ltd,<br />85 Great Portland Street, First Floor,<br />London, W1W 7LT</address>
        </div>
      </section>
    </div>

    <div className="site-width footer-bottom">
      <div><p>© 2026 TaskBridge Systems Ltd. All rights reserved.</p><small>TaskBridge is a HealthTech and care operations middleware platform. Enhanced DBS validation supports vulnerable-adult safeguarding controls.</small></div>
      <nav aria-label="Security and legal">
        <a href="/how-it-works#security">Security standards</a>
        <a href="mailto:privacy@taskbridge.tech?subject=TaskBridge%20privacy%20policy">GDPR shield policy</a>
        <a href="mailto:integrations@taskbridge.tech?subject=TaskBridge%20safeguarding%20SLA">Safeguarding SLA</a>
      </nav>
    </div>
  </footer>;
}
