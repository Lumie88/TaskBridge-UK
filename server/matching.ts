export interface MatchableTask {
  category: string;
  vulnerableAdult: boolean;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  requiresElectricalQualification?: boolean;
}

export interface MatchableTrader {
  id: string;
  status: string;
  services: string[];
  dbsStatus: string;
  dbsExpiryDate: string | null;
  insuranceStatus: string;
  insuranceExpiryDate: string | null;
  latitude: number;
  longitude: number;
  hourlyRate: number;
  qualityScore: number;
  available: boolean;
  electricalQualificationActive?: boolean;
}

export interface MatchEvaluation {
  traderId: string;
  eligible: boolean;
  reasons: string[];
  distanceMiles: number;
  score: number;
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function dateIsActive(date: string | null, now: Date) {
  if (!date) return false;
  return new Date(`${date}T23:59:59.999Z`) >= now;
}

export function evaluateTrader(task: MatchableTask, trader: MatchableTrader, now = new Date()): MatchEvaluation {
  const reasons: string[] = [];
  const distanceMiles = haversineMiles(task.latitude, task.longitude, trader.latitude, trader.longitude);
  if (trader.status !== "active") reasons.push("Trader is not active");
  if (!trader.services.includes(task.category)) reasons.push("Service category is not verified");
  if (distanceMiles > task.radiusMiles) reasons.push("Outside the permitted visit radius");
  if (!trader.available) reasons.push("Not available in the requested window");
  if (trader.insuranceStatus !== "verified" || !dateIsActive(trader.insuranceExpiryDate, now)) {
    reasons.push("Verified insurance is missing or expired");
  }
  if (task.vulnerableAdult && (trader.dbsStatus !== "approved" || !dateIsActive(trader.dbsExpiryDate, now))) {
    reasons.push("Active Enhanced DBS approval is required");
  }
  if (task.requiresElectricalQualification && !trader.electricalQualificationActive) {
    reasons.push("Approved in-date electrical qualification is required");
  }
  const score = Math.max(0, trader.qualityScore - distanceMiles * 2 - trader.hourlyRate * 0.15);
  return {
    traderId: trader.id,
    eligible: reasons.length === 0,
    reasons,
    distanceMiles: Number(distanceMiles.toFixed(2)),
    score: Number(score.toFixed(2))
  };
}

export function requiresElectricalQualification(category: string, summary = "") {
  return /\b(electric(?:al|ian|ity)?|wiring|rewire|socket|fuse|consumer unit|circuit|light fitting|eicr|pat test)\b/i
    .test(`${category} ${summary}`);
}
