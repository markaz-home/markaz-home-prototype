/**
 * Investment Case calculations (design spec §16.4). PURE and decimal-safe. The
 * API recomputes and persists these from validated inputs — never trusting a
 * client-supplied result. All money is whole AED (dirhams). `asOf` is passed in
 * (no ambient clock) so the functions stay deterministic and testable.
 */

export const ANNUALISED_MIN_DAYS = 30;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

export interface InvestmentInputs {
  /** Advertised asking price, whole AED. */
  askingPriceAed: number;
  /** Original purchase price, whole AED. */
  originalPurchasePriceAed: number;
  /** Renovation / improvement spend, whole AED (default 0). */
  renovationCostsAed?: number;
  /** ISO date string (YYYY-MM-DD) or null. */
  purchaseDate?: string | null;
  /** Property size in square feet, or null. */
  sizeSqft?: number | null;
  /** ISO date string for "now". */
  asOf: string;
}

export interface InvestmentResult {
  totalInvestedAed: number;
  estimatedGainAed: number;
  /** Percentage, 1 decimal, or null when total invested is not positive. */
  estimatedRoiPct: number | null;
  /** Percentage, 1 decimal, or null when holding period < 30 days / invalid. */
  estimatedAnnualisedReturnPct: number | null;
  /** Whole AED per sq ft, or null when size unavailable. */
  pricePerSqftAed: number | null;
  /** Fractional years held, or null when purchase date missing/invalid/future. */
  yearsHeld: number | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / MS_PER_DAY;
}

export function calculateInvestmentCase(inputs: InvestmentInputs): InvestmentResult {
  const renovation = inputs.renovationCostsAed ?? 0;
  const totalInvested = inputs.originalPurchasePriceAed + renovation;
  const gain = inputs.askingPriceAed - totalInvested;

  const roi = totalInvested > 0 ? round1((gain / totalInvested) * 100) : null;

  // Holding period: null when missing, unparseable, or in the future.
  let yearsHeld: number | null = null;
  if (inputs.purchaseDate) {
    const days = daysBetween(inputs.purchaseDate, inputs.asOf);
    if (days !== null && days >= 0) yearsHeld = days / DAYS_PER_YEAR;
  }

  let annualised: number | null = null;
  if (
    yearsHeld !== null &&
    yearsHeld * DAYS_PER_YEAR >= ANNUALISED_MIN_DAYS &&
    totalInvested > 0 &&
    inputs.askingPriceAed > 0
  ) {
    const factor = inputs.askingPriceAed / totalInvested;
    annualised = round1((Math.pow(factor, 1 / yearsHeld) - 1) * 100);
  }

  const pricePerSqft =
    inputs.sizeSqft && inputs.sizeSqft > 0
      ? Math.round(inputs.askingPriceAed / inputs.sizeSqft)
      : null;

  return {
    totalInvestedAed: totalInvested,
    estimatedGainAed: gain,
    estimatedRoiPct: roi,
    estimatedAnnualisedReturnPct: annualised,
    pricePerSqftAed: pricePerSqft,
    yearsHeld: yearsHeld === null ? null : round1(yearsHeld),
  };
}
