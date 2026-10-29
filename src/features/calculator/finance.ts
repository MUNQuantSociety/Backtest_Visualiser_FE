/**
 * MQSMaster's finance calculator (`scripts/CFA/Financecalculator.py`), with
 * the conventions of its formula library (`scripts/CFA/src`):
 *
 * - Future value:  FV = PV (1 + r)^t
 * - Present value: PV = FV / (1 + r)^t
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
