// MIRROR of packages/db/src/mortgage.ts — keep in sync (same pattern as theme.ts vs web).
// Pure maths, no dependencies. Tested in packages/db/tests/unit/mortgage.test.ts.
export interface MortgageCalculationResult {
  propertyPriceNgn: number;
  downPaymentPct: number;
  downPaymentNgn: number;
  loanPrincipalNgn: number;
  tenureYears: number;
  annualInterestRatePct: number;
  numberOfPayments: number;
  monthlyRepaymentNgn: number;
  totalRepaymentNgn: number;
  totalInterestNgn: number;
}

/** Starting value for the calculator's rate field only — a placeholder the user is told to replace with their lender's quote. */
export const ILLUSTRATIVE_RATE_PCT = 18.5;

export const MORTGAGE_LIMITS = { downPaymentPct: [5, 80], tenureYears: [1, 30], ratePct: [1, 60] } as const;

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

/** Standard amortisation: M = P·r(1+r)^n / ((1+r)^n − 1), monthly compounding. Inputs are clamped, never thrown on. */
export function calculateMonthlyMortgage(
  propertyPriceNgn: number,
  downPaymentPct = 20,
  tenureYears = 20,
  annualInterestRatePct = ILLUSTRATIVE_RATE_PCT
): MortgageCalculationResult {
  const price = Math.max(0, Number.isFinite(propertyPriceNgn) ? propertyPriceNgn : 0);
  const dpPct = clamp(downPaymentPct, MORTGAGE_LIMITS.downPaymentPct);
  const years = Math.round(clamp(tenureYears, MORTGAGE_LIMITS.tenureYears));
  const ratePct = clamp(annualInterestRatePct, MORTGAGE_LIMITS.ratePct);

  const downPaymentNgn = Math.round((price * dpPct) / 100);
  const loanPrincipalNgn = price - downPaymentNgn;
  const numberOfPayments = years * 12;
  const r = ratePct / 100 / 12;

  let monthlyRepaymentNgn = 0;
  if (loanPrincipalNgn > 0) {
    const factor = Math.pow(1 + r, numberOfPayments);
    monthlyRepaymentNgn = Math.round((loanPrincipalNgn * r * factor) / (factor - 1));
  }
  const totalRepaymentNgn = monthlyRepaymentNgn * numberOfPayments;
  return {
    propertyPriceNgn: price,
    downPaymentPct: dpPct,
    downPaymentNgn,
    loanPrincipalNgn,
    tenureYears: years,
    annualInterestRatePct: ratePct,
    numberOfPayments,
    monthlyRepaymentNgn,
    totalRepaymentNgn,
    totalInterestNgn: Math.max(0, totalRepaymentNgn - loanPrincipalNgn),
  };
}
