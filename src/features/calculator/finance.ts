/**
 * The four calculations of MQSMaster's finance calculator
 * (`scripts/CFA/Financecalculator.py`), with the conventions of its formula
 * library (`scripts/CFA/src`) and the BUSI 3550 formula sheet it maps:
 *
 * - Future value:  FV = PV (1 + r)^t
 * - Present value: PV = FV / (1 + r)^t
 * - NPV:           NPV = sum of CF_t / (1 + r)^t for t = 1..n, minus C0
 * - Annuity PV:    PV = C (1 - (1 + r/m)^-(m t)) / (r/m)
 *
 * Rates are decimals here (0.05 is 5%); the page converts from percent.
 * Each function returns a result or the reason there is none, in words a
 * person can act on, rather than throwing.
 */

export type Calculation = { ok: true; value: number } | { ok: false; problem: string };

const fail = (problem: string): Calculation => ({ ok: false, problem });
const done = (value: number): Calculation =>
  Number.isFinite(value) ? { ok: true, value } : fail('The result is too large to show.');

function rateProblem(rate: number): string | null {
  if (!Number.isFinite(rate)) return 'Enter an interest rate.';
  // At -100% every future amount is worth nothing and the formulas divide by 0.
  if (rate <= -1) return 'The rate must be above -100%.';
  return null;
}

function yearsProblem(years: number): string | null {
  if (!Number.isFinite(years)) return 'Enter a number of years.';
  if (years <= 0) return 'The number of years must be more than 0.';
  return null;
}

/** What `presentValue` grows to after `years` at `rate` a year, compounded yearly. */
export function futureValue(presentValue: number, rate: number, years: number): Calculation {
  if (!Number.isFinite(presentValue)) return fail('Enter the amount invested today.');
  const problem = rateProblem(rate) ?? yearsProblem(years);
  if (problem) return fail(problem);
  return done(presentValue * (1 + rate) ** years);
}

/** What `futureValue`, received after `years`, is worth today at `rate` a year. */
export function presentValue(futureValue: number, rate: number, years: number): Calculation {
  if (!Number.isFinite(futureValue)) return fail('Enter the future amount.');
  const problem = rateProblem(rate) ?? yearsProblem(years);
  if (problem) return fail(problem);
  return done(futureValue / (1 + rate) ** years);
}

/**
 * Net present value: each cash flow discounted from the end of its year
 * (the first one year from now), minus the investment paid today.
 */
export function netPresentValue(
  initialInvestment: number,
  rate: number,
  cashFlows: readonly number[],
): Calculation {
  if (!Number.isFinite(initialInvestment)) return fail('Enter the initial investment.');
  if (initialInvestment < 0) return fail('Enter the initial investment as a positive amount.');
  const problem = rateProblem(rate);
  if (problem) return fail(problem);
  if (cashFlows.length === 0) return fail('Enter at least one cash flow.');
  if (cashFlows.some((cashFlow) => !Number.isFinite(cashFlow)))
    return fail('Every cash flow must be a number.');
  const presentValueOfInflows = cashFlows.reduce(
    (total, cashFlow, index) => total + cashFlow / (1 + rate) ** (index + 1),
    0,
  );
  return done(presentValueOfInflows - initialInvestment);
}

/**
 * Present value of an annuity: `payment` received `paymentsPerYear` times a
 * year for `years`, at `rate` a year compounded with each payment. At 0% it is
 * simply the sum of the payments.
 */
export function annuityPresentValue(
  payment: number,
  rate: number,
  years: number,
  paymentsPerYear: number,
): Calculation {
  if (!Number.isFinite(payment)) return fail('Enter the payment amount.');
  const problem = rateProblem(rate) ?? yearsProblem(years);
  if (problem) return fail(problem);
  if (!Number.isInteger(paymentsPerYear) || paymentsPerYear <= 0)
    return fail('Choose how often the payment is made.');
  const periodicRate = rate / paymentsPerYear;
  const payments = years * paymentsPerYear;
  if (periodicRate === 0) return done(payment * payments);
  return done((payment * (1 - (1 + periodicRate) ** -payments)) / periodicRate);
}

/**
 * Cash flows typed as a list, separated by commas, spaces, semicolons or new
 * lines, as the MQSMaster script reads them ("200, 300, 400"). Because a comma
 * separates flows, a thousands separator would split a number in two, so
 * amounts are written without one; a leading `$` is allowed. Something that is
 * not a number comes back as NaN, which `netPresentValue` reports.
 */
export function parseCashFlows(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .filter((part) => part.length > 0)
    .map((part) => Number(part.replace(/^\$/, '')));
}
