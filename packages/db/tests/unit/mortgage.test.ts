import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateMonthlyMortgage } from "../../src/mortgage";

describe("calculateMonthlyMortgage", () => {
  test("₦200M at 20% down, 20 years, 18% → known amortisation figures", () => {
    const r = calculateMonthlyMortgage(200_000_000, 20, 20, 18);
    assert.equal(r.downPaymentNgn, 40_000_000);
    assert.equal(r.loanPrincipalNgn, 160_000_000);
    assert.equal(r.numberOfPayments, 240);
    assert.ok(r.monthlyRepaymentNgn > 2_400_000 && r.monthlyRepaymentNgn < 2_600_000);
    assert.ok(r.totalRepaymentNgn > r.loanPrincipalNgn);
  });

  test("zero price yields zero repayment, no NaN", () => {
    const r = calculateMonthlyMortgage(0, 20, 15, 18);
    assert.equal(r.monthlyRepaymentNgn, 0);
    assert.equal(r.loanPrincipalNgn, 0);
  });

  test("out-of-range inputs are clamped, not thrown on", () => {
    const r = calculateMonthlyMortgage(100_000_000, 95, 40, -5);
    assert.equal(r.downPaymentPct, 80);
    assert.equal(r.tenureYears, 30);
    assert.equal(r.annualInterestRatePct, 1);
  });

  test("NaN / non-finite inputs fall back safely", () => {
    const r = calculateMonthlyMortgage(NaN, NaN, NaN, NaN);
    assert.equal(r.monthlyRepaymentNgn, 0);
    assert.ok(Number.isFinite(r.totalInterestNgn));
  });
});
