export const TASKBRIDGE_MARGIN_RATE = 0.15;
export const STANDARD_LABOUR_MINUTES = 60;

const largerScopeCategories = new Set([
  "garden clearance",
  "gutter cleaning",
  "pressure washing",
  "painting and decorating",
  "deep cleaning"
]);

const largerScopePattern = /\b(half[-\s]?day|full[-\s]?day|several hours|multiple rooms|whole house|large garden|heavy clearance|major repair|supply and fit)\b/i;

export function splitIncludedMargin(customerPrice: number) {
  const safePrice = Number.isFinite(customerPrice) && customerPrice > 0 ? customerPrice : 0;
  const handymanAmount = Number((safePrice / (1 + TASKBRIDGE_MARGIN_RATE)).toFixed(2));
  const platformFee = Number((safePrice - handymanAmount).toFixed(2));
  return {
    handymanAmount,
    platformFee,
    totalAmount: Number(safePrice.toFixed(2))
  };
}

export function requiresLargerJobApproval(category: string, summary = "") {
  return largerScopeCategories.has(category.trim().toLowerCase()) || largerScopePattern.test(summary);
}
