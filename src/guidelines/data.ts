export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  category: "Outdoor Access" | "Fall Prevention" | "Home Security" | "Safety & Cleanliness";
  impact: string;
}

export interface SolutionStep {
  number: number;
  title: string;
  badge: string;
  description: string;
  caregiverAction: string;
  middlewareAction: string;
  evidenceCapture: string;
}

export interface TrustCredential {
  title: string;
  description: string;
  badgeText: string;
}

export const TRUST_CREDENTIALS: TrustCredential[] = [
  {
    title: "Compatible App Ingress",
    description: "Connects seamlessly with most leading care management platforms via encrypted secure webhook relays.",
    badgeText: "Unified Ingress"
  },
  {
    title: "Enhanced DBS Vetted Handymen",
    description: "All attending operatives hold clean, up-to-date Enhanced DBS disclosures, checked dynamically.",
    badgeText: "safeguarding first"
  },
  {
    title: "Private Vetted Trader Networks",
    description: "Strictly invite-only trade panel certified under safety, reliability, and vulnerable-adult service protocols.",
    badgeText: "trusted traders"
  },
  {
    title: "Resident Contact Details Protected",
    description: "Zero phone numbers or specific home access codes are shared with providers until geo-fenced arrival.",
    badgeText: "data security"
  }
];

export const SOLUTION_STEPS: SolutionStep[] = [
  {
    number: 1,
    title: "Care note captured in your native care app",
    badge: "Risk Identification",
    description: "A frontline care worker notes down a practical home concern over their standard mobile terminal.",
    caregiverAction: "Observation spotted: 'Mrs. Higgins' rear slatted wooden path is covered in thick moss and extremely slick after rain.'",
    middlewareAction: "TaskBridge ingests and parses care notes for structural home-safety hazard triggers.",
    evidenceCapture: "Initial Care Note Log #8372"
  },
  {
    number: 2,
    title: "Safety review & approval by care managers",
    badge: "Operations Ledger",
    description: "The care coordinator logs into TaskBridge to review the parsed home risk and approve safety-dispatch budgets.",
    caregiverAction: "Action approved: Care manager reviews loose tile hazard, marks as high-priority fall prevention task.",
    middlewareAction: "Task details are sanitized—all sensitive medical diagnostic notes are stripped to protect privacy.",
    evidenceCapture: "Coordinator Auth Signed"
  },
  {
    number: 3,
    title: "Automated routing to verified traders",
    badge: "Secure Dispatch",
    description: "TaskBridge broadcasts the sanitized safety task to local Enhanced DBS vetted handymen under strict service SLA.",
    caregiverAction: "Trader assigned: Skilled carpenter/handyman accepted path clearance and minor grab-rail installation.",
    middlewareAction: "Trader receives geo-location only; resident's full private number remains secure.",
    evidenceCapture: "operative ID matched"
  },
  {
    number: 4,
    title: "In-situ work verification and checkoff",
    badge: "Safety Verified",
    description: "The trader checks in via secure web-link upon arrival, takes before/after pictures, and gathers completion voucher.",
    caregiverAction: "Risk mitigated: Slip hazard fully pressure-washed, treated with anti-mould sealer. Photo upload complete.",
    middlewareAction: "Evidence pack returned instantly into care office ledger for complete safeguarding audit.",
    evidenceCapture: "timestamped photos saved"
  }
];

export const SUPPORTED_SERVICES: ServiceItem[] = [
  {
    id: "lawn-mow",
    name: "Lawn Mowing",
    description: "Keeping pathways clear of grass overgrowth and maintaining visibility around the borders.",
    category: "Outdoor Access",
    impact: "Prevents tripping, eliminates damp build-up near doorways."
  },
  {
    id: "garden-clear",
    name: "Garden Clearance",
    description: "Removing aggressive weeds, thorny briers, and fallen branches blocking vital escape routes or paths.",
    category: "Outdoor Access",
    impact: "Restores clear access for walking frames and emergency responders."
  },
  {
    id: "window-clean",
    name: "Window Cleaning",
    description: "Thorough cleaning of interior and exterior glass to maximize natural light and ensure outdoor visibility.",
    category: "Safety & Cleanliness",
    impact: "Improves mood and visibility for spotting outdoor visitors or hazards."
  },
  {
    id: "path-clear",
    name: "Path Clearing",
    description: "Pressure washing of moss, clearing leaves, and spreading salt over slippery ramps or paved driveways.",
    category: "Fall Prevention",
    impact: "Directly combats the single highest cause of winter fractures among vulnerable residents."
  },
  {
    id: "loose-rail",
    name: "Loose Rail Repair",
    description: "Tightening or re-anchoring critical visual grab rails, banisters, and internal supporting fixtures.",
    category: "Fall Prevention",
    impact: "Restores balance confidence during moving and handling routines."
  },
  {
    id: "lock-repair",
    name: "Lock & Handle Repairs",
    description: "Fixing loose locks, sticking keys, out-of-line frames, and testing internal safety thumbturns.",
    category: "Home Security",
    impact: "Guarantees emergency egress while locking out unauthorized entries."
  },
  {
    id: "deep-clean",
    name: "Targeted Deep Cleaning",
    description: "Specialist sanitization around high-traffic points, cooker areas, and sanitizing bathrooms to avert contamination.",
    category: "Safety & Cleanliness",
    impact: "Reduces infection vectors and keeps hygiene standards compliant."
  },
  {
    id: "appliance-check",
    name: "Appliance Safety Checks",
    description: "Visual inspection of stove connections, testing carbon monoxide alarms, checking for frayed electrical cables.",
    category: "Home Security",
    impact: "Defends against house fire triggers and preventable gas emergencies."
  },
  {
    id: "trip-hazard",
    name: "Trip Hazard Removal",
    description: "Identifying and taping down curling carpets, securing loose floorboards, and rerouting loose cables.",
    category: "Fall Prevention",
    impact: "Provides friction-secured walkways across all highly-utilized rooms."
  }
];
