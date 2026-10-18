import { COUNTRY_CONTENT, FOCUS_IDS } from '../content/world';
import type { CountryId } from '../content/ids';
import { adjustRelation, atWarWithCountry, countryState, sanctionsIndia } from '../diplomacy/relations';
import { adjustReputation } from '../diplomacy/treaties';
import { interestRateFor, lastDeficitRatio, nominalGdp } from '../economy/model';
import { groupIndian } from '../engine/numberFormat';
import { appendLog } from '../state/log';
import type { GameState, Loan, LoanLender } from '../state/types';

/**
 * Loans (Sprint 8.8): money now from a friendly country or the international lender, interest every month through
 * the Interest line and the principal back on the due date. One formula, `loanRate()`, prices a loan for the
 * command, the Finance screen and the bots.
 */

export const INTL_LENDER = 'intl';
export const MAX_LOANS = 6;
export const MIN_LOAN = 1_000;
export const MAX_LOAN_YEARS = 10;
/** Largest single loan from the international lender, ₹ crore. */
export const INTL_LOAN_CAP = 250_000;
/** A country lends at most this many ₹ crore per billion dollars of its GDP, up to COUNTRY_LOAN_CAP. */
export const COUNTRY_LOAN_PER_GDP = 30;
export const COUNTRY_LOAN_CAP = 150_000;
/** All loans together may not exceed this share of India's annual GDP. */
export const LOAN_CEILING_SHARE = 0.02;
/** Countries need an embassy and at least this relation to lend. */
export const LENDER_RELATION = 20;
/** Countries smaller than this (GDP, $ billion) do not lend. */
export const LENDER_MIN_GDP = 300;
/** The international lender turns India away below this reputation. */
export const INTL_MIN_REPUTATION = 25;
/** A missed repayment: reputation lost and the lender's goodwill. */
export const MISSED_REPUTATION = 6;
export const MISSED_RELATION = 15;
const DAYS_PER_YEAR = 365;

/** Countries that can lend to India: the larger focus nations. */
export const LENDERS: readonly CountryId[] = FOCUS_IDS.filter(
  (id) => (COUNTRY_CONTENT[id]?.gdp ?? 0) >= LENDER_MIN_GDP,
);

export const lenderName = (lender: LoanLender): string =>
  lender === INTL_LENDER ? 'the international lender' : (COUNTRY_CONTENT[lender]?.name ?? lender);

const crore = (value: number) => `₹${groupIndian(Math.round(value))} crore`;

/** What the bond market charges India today: the rate automatic borrowing reprices toward. */
export const marketRate = (state: Pick<GameState, 'economy'>): number =>
  interestRateFor(
    state.economy.debt / nominalGdp(state.economy),
    state.economy.inflation,
    lastDeficitRatio(state.economy),
  );

export interface RateLine {
  label: string;
  value: number;
}

/** The yearly rate a lender asks, and why. Loans undercut the market; friends and a good name undercut it more. */
export function loanRate(
  state: Pick<GameState, 'economy' | 'diplomacy'>,
  lender: LoanLender,
  years: number,
): { total: number; lines: RateLine[] } {
  const market = marketRate(state);
  const lines: RateLine[] = [{ label: 'Market rate', value: market }];
  if (lender === INTL_LENDER) {
    lines.push({ label: 'International lender', value: -0.12 * market });
  } else {
    const relation = countryState(state, lender).relation;
    lines.push({ label: 'Relation', value: -(0.08 + 0.0025 * Math.max(0, relation - LENDER_RELATION)) * market });
  }
  lines.push({ label: 'Reputation', value: 0.0004 * (55 - state.diplomacy.reputation) });
  lines.push({ label: 'Term', value: 0.002 * (years - 1) });
  const total = Math.max(
    0.01,
    lines.reduce((s, l) => s + l.value, 0),
  );
  return { total, lines };
}

/** Largest loan a lender will make. */
export const lenderCap = (lender: LoanLender): number =>
  lender === INTL_LENDER
    ? INTL_LOAN_CAP
    : Math.min(COUNTRY_LOAN_CAP, Math.round((COUNTRY_CONTENT[lender]?.gdp ?? 0) * COUNTRY_LOAN_PER_GDP));

export const loanCeiling = (state: Pick<GameState, 'economy'>): number =>
  Math.round(nominalGdp(state.economy) * LOAN_CEILING_SHARE);

export const outstanding = (state: Pick<GameState, 'economy'>): number =>
  state.economy.loans.reduce((s, l) => s + l.principal, 0);

/** Why a lender will not lend at all, or null. */
export function lenderProblem(state: GameState, lender: LoanLender): string | null {
  if (state.economy.loans.some((l) => l.lender === lender)) return `India already owes ${lenderName(lender)}.`;
  if (lender === INTL_LENDER) {
    return state.diplomacy.reputation < INTL_MIN_REPUTATION
      ? 'The international lender will not lend while India’s reputation is this low.'
      : null;
  }
  const name = lenderName(lender);
  if (!LENDERS.includes(lender)) return `${name} does not lend to India.`;
  if (atWarWithCountry(state, lender)) return `India is at war with ${name}.`;
  const cs = countryState(state, lender);
  if (cs.sanctioned || sanctionsIndia(state, lender)) return `Sanctions stand between India and ${name}.`;
  if (!cs.embassy) return `Open an embassy in ${name} to borrow from it.`;
  if (cs.relation < LENDER_RELATION) return `Relations with ${name} are too cool for a loan.`;
  return null;
}

export function validateLoan(state: GameState, lender: LoanLender, amount: number, years: number): string | null {
  if (lender !== INTL_LENDER && !COUNTRY_CONTENT[lender]) return `Unknown lender ${lender}.`;
  if (!Number.isInteger(amount) || amount < MIN_LOAN) return `Borrow at least ${crore(MIN_LOAN)}.`;
  if (!Number.isInteger(years) || years < 1 || years > MAX_LOAN_YEARS) {
    return `A loan runs from 1 to ${MAX_LOAN_YEARS} years.`;
  }
  if (state.economy.loans.length >= MAX_LOANS) return `India can carry at most ${MAX_LOANS} loans.`;
  const problem = lenderProblem(state, lender);
  if (problem) return problem;
  if (amount > lenderCap(lender)) return `${lenderName(lender)} lends at most ${crore(lenderCap(lender))}.`;
  const room = loanCeiling(state) - outstanding(state);
  if (amount > room) return `Loans are capped at 2% of GDP; there is room for ${crore(Math.max(0, room))}.`;
  return null;
}

export function takeLoan(state: GameState, lender: LoanLender, amount: number, years: number): GameState {
  const loan: Loan = {
    id: `loan-${state.nextId}`,
    lender,
    principal: amount,
    rate: loanRate(state, lender, years).total,
    startTick: state.clock.tick,
    dueTick: state.clock.tick + years * DAYS_PER_YEAR,
  };
  return {
    ...state,
    nation: { ...state.nation, treasury: state.nation.treasury + amount },
    economy: { ...state.economy, loans: [...state.economy.loans, loan] },
    nextId: state.nextId + 1,
  };
}

export function validateRepay(state: GameState, loanId: string): string | null {
  const loan = state.economy.loans.find((l) => l.id === loanId);
  if (!loan) return 'That loan is no longer outstanding.';
  if (loan.principal > state.nation.treasury) return `The treasury cannot repay ${crore(loan.principal)} today.`;
  return null;
}

const without = (state: GameState, loanId: string): GameState => ({
  ...state,
  economy: { ...state.economy, loans: state.economy.loans.filter((l) => l.id !== loanId) },
});

/** Repays a loan early, in full, with no penalty. */
export function repayLoan(state: GameState, loanId: string): GameState {
  const loan = state.economy.loans.find((l) => l.id === loanId);
  if (!loan) return state;
  const next = without(state, loanId);
  return { ...next, nation: { ...next.nation, treasury: next.nation.treasury - loan.principal } };
}

/**
 * Monthly, before the fiscal settlement: loans that have fallen due are repaid from the treasury. When the
 * treasury cannot cover one, the principal is rolled into public debt at the market's rate, and the default costs
 * India its reputation and the lender's goodwill.
 */
export function settleLoans(state: GameState): GameState {
  let next = state;
  for (const loan of state.economy.loans.filter((l) => l.dueTick <= state.clock.tick)) {
    next = without(next, loan.id);
    if (next.nation.treasury >= loan.principal) {
      next = appendLog(
        { ...next, nation: { ...next.nation, treasury: next.nation.treasury - loan.principal } },
        {
          severity: 'info',
          title: 'Loan repaid',
          body: `India repaid ${crore(loan.principal)} to ${lenderName(loan.lender)} on time.`,
        },
      );
      continue;
    }
    next = adjustReputation(
      { ...next, economy: { ...next.economy, debt: next.economy.debt + loan.principal } },
      -MISSED_REPUTATION,
    );
    if (loan.lender !== INTL_LENDER) next = adjustRelation(next, loan.lender, -MISSED_RELATION);
    next = appendLog(next, {
      severity: 'warning',
      title: 'Loan repayment missed',
      body: `The treasury could not repay ${crore(loan.principal)} to ${lenderName(loan.lender)}. The sum was rolled into public debt at the market rate, and India's reputation suffers.`,
    });
  }
  return next;
}
