import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  advise,
  dailyFinance,
  dispatch,
  INTL_LENDER,
  lenderCap,
  loanCeiling,
  loanInterest,
  loanRate,
  marketRate,
  MISSED_RELATION,
  MISSED_REPUTATION,
  projectMonth,
  relationOf,
  parseSave,
  type Command,
  type GameState,
} from '../../src/sim';
import { patchCountry } from '../../src/sim/diplomacy/relations';
import { daysInMonth } from '../../src/sim/engine/calendar';
import { calm, deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

/** Japan with an embassy and warm relations: a willing lender. */
const friendlyJapan = (state = newGame()): GameState => patchCountry(state, 'JPN', { embassy: true, relation: 60 });

describe('daily money', () => {
  it('is the month’s projection spread over the days of the month', () => {
    const state = newGame();
    const daily = dailyFinance(state);
    const month = projectMonth(state, state.budget);
    const days = daysInMonth(state.clock.date.year, state.clock.date.month);
    expect(daily.days).toBe(days);
    expect(daily.balance * days).toBeCloseTo(month.balance, 6);
    expect(daily.expenditure.defence * days).toBeCloseTo(month.expenditure.defence, 6);
    expect(daily.totalRevenue * days).toBeCloseTo(month.totalRevenue, 6);
  });
});

describe('loans', () => {
  it('pay into the treasury now and add their interest to the Interest line', () => {
    const state = newGame();
    const taken = run(state, { type: 'TAKE_LOAN', lender: INTL_LENDER, amount: 50_000, years: 3 });
    expect(taken.nation.treasury).toBe(state.nation.treasury + 50_000);
    const loan = taken.economy.loans[0]!;
    expect(loan.rate).toBeCloseTo(loanRate(state, INTL_LENDER, 3).total, 12);
    expect(loan.dueTick).toBe(state.clock.tick + 3 * 365);
    expect(loanInterest(taken.economy)).toBeCloseTo((50_000 * loan.rate) / 12, 9);
    expect(projectMonth(taken, taken.budget).expenditure.interest).toBeCloseTo(
      projectMonth(state, state.budget).expenditure.interest + loanInterest(taken.economy),
      6,
    );
  });

  it('undercut the market, more for friends and a good name, and charge more for longer terms', () => {
    const state = friendlyJapan();
    expect(loanRate(state, INTL_LENDER, 1).total).toBeLessThan(marketRate(state));
    const warmer = patchCountry(state, 'JPN', { relation: 95 });
    expect(loanRate(warmer, 'JPN', 2).total).toBeLessThan(loanRate(state, 'JPN', 2).total);
    const disgraced = { ...state, diplomacy: { ...state.diplomacy, reputation: 30 } };
    expect(loanRate(disgraced, INTL_LENDER, 2).total).toBeGreaterThan(loanRate(state, INTL_LENDER, 2).total);
    expect(loanRate(state, INTL_LENDER, 8).total).toBeGreaterThan(loanRate(state, INTL_LENDER, 1).total);
    const labels = loanRate(state, 'JPN', 2).lines.map((l) => l.label);
    expect(labels).toEqual(['Market rate', 'Relation', 'Reputation', 'Term']);
  });

  it('need an embassy and warm relations with a country lender, within its cap and the ceiling', () => {
    const state = newGame();
    expect(dispatch(state, { type: 'TAKE_LOAN', lender: 'JPN', amount: 10_000, years: 2 }).ok).toBe(false);
    const friend = friendlyJapan(state);
    const taken = run(friend, { type: 'TAKE_LOAN', lender: 'JPN', amount: 10_000, years: 2 });
    // One loan per lender at a time.
    expect(dispatch(taken, { type: 'TAKE_LOAN', lender: 'JPN', amount: 10_000, years: 2 }).ok).toBe(false);
    const cool = patchCountry(friend, 'JPN', { relation: 5 });
    expect(dispatch(cool, { type: 'TAKE_LOAN', lender: 'JPN', amount: 10_000, years: 2 }).ok).toBe(false);
    // Small economies do not lend.
    expect(
      dispatch(patchCountry(state, 'NPL', { embassy: true, relation: 80 }), {
        type: 'TAKE_LOAN',
        lender: 'NPL',
        amount: 5_000,
        years: 1,
      }).ok,
    ).toBe(false);
    for (const [amount, years] of [
      [500, 2],
      [1_500.5, 2],
      [10_000, 0],
      [10_000, 11],
      [lenderCap('JPN') + 1, 2],
    ] as const) {
      expect(dispatch(friend, { type: 'TAKE_LOAN', lender: 'JPN', amount, years }).ok).toBe(false);
    }
    expect(dispatch(state, { type: 'TAKE_LOAN', lender: 'XXX', amount: 5_000, years: 1 }).ok).toBe(false);
    expect(loanCeiling(state)).toBeGreaterThan(lenderCap(INTL_LENDER));
  });

  it('can be repaid early in full, if the treasury can cover them', () => {
    const taken = run(newGame(), { type: 'TAKE_LOAN', lender: INTL_LENDER, amount: 40_000, years: 5 });
    const id = taken.economy.loans[0]!.id;
    const repaid = run(taken, { type: 'REPAY_LOAN', loanId: id });
    expect(repaid.economy.loans).toHaveLength(0);
    expect(repaid.nation.treasury).toBe(taken.nation.treasury - 40_000);
    expect(dispatch(repaid, { type: 'REPAY_LOAN', loanId: id }).ok).toBe(false);
    const broke = { ...taken, nation: { ...taken.nation, treasury: 100 } };
    expect(dispatch(broke, { type: 'REPAY_LOAN', loanId: id }).ok).toBe(false);
  });

  it('are repaid on the due date, or roll into debt and cost reputation and goodwill when missed', () => {
    const taken = run(friendlyJapan(), { type: 'TAKE_LOAN', lender: 'JPN', amount: 20_000, years: 1 });
    const paid = calm(taken, 400);
    expect(paid.economy.loans).toHaveLength(0);
    expect(paid.log.some((e) => e.title === 'Loan repaid')).toBe(true);

    // A treasury emptied just before the due date cannot pay.
    const due = calm(taken, 364);
    const broke = { ...due, nation: { ...due.nation, treasury: 0 } };
    const missed = calm(broke, 40);
    expect(missed.economy.loans).toHaveLength(0);
    expect(missed.log.some((e) => e.title === 'Loan repayment missed')).toBe(true);
    expect(relationOf(missed, 'JPN')).toBeLessThan(relationOf(due, 'JPN') - MISSED_RELATION / 2);
    expect(missed.diplomacy.reputation).toBeLessThan(due.diplomacy.reputation - MISSED_REPUTATION / 2);
  });

  it('never mutate the state they are given', () => {
    const state = deepFreeze(friendlyJapan());
    const taken = run(state, { type: 'TAKE_LOAN', lender: 'JPN', amount: 10_000, years: 1 });
    expect(() => run(deepFreeze(taken), { type: 'REPAY_LOAN', loanId: taken.economy.loans[0]!.id })).not.toThrow();
    expect(() => calm(deepFreeze(taken), 400)).not.toThrow();
  });
});

describe('the advisor', () => {
  it('is quiet at the start of a game', () => {
    expect(advise(newGame())).toEqual([]);
  });

  it('flags underfunded departments, power cuts, thin policing and unfunded forces, worst first', () => {
    const state = newGame();
    const starved = {
      ...state,
      budget: { ...state.budget, allocations: { ...state.budget.allocations, health: 0 } },
    };
    expect(advise(starved).map((a) => a.topic)).toContain('department');
    expect(advise(starved).find((a) => a.topic === 'department')!.department).toBe('health');

    const noCoal = Object.fromEntries(
      Object.entries(state.energy.plants).map(([r, p]) => [r, { ...p, coal: 0 }]),
    ) as GameState['energy']['plants'];
    const advice = advise({ ...state, energy: { ...state.energy, plants: noCoal } });
    expect(advice[0]!.topic).toBe('power');

    const thin = {
      ...state,
      police: { ...state.police, officers: { ...state.police.officers, east: state.police.officers.east * 0.5 } },
    };
    expect(advise(thin).find((a) => a.topic === 'police')?.region).toBe('east');

    const unfunded = { ...state, military: { ...state.military, fundingRatio: 0.6 } };
    expect(advise(unfunded).map((a) => a.topic)).toEqual(['forces']);

    const all = advise({ ...starved, energy: { ...state.energy, plants: noCoal }, military: unfunded.military });
    for (let i = 1; i < all.length; i++) expect(all[i - 1]!.score).toBeGreaterThanOrEqual(all[i]!.score);
  });

  it('warns about a loan falling due that the treasury cannot cover', () => {
    const taken = run(newGame(), { type: 'TAKE_LOAN', lender: INTL_LENDER, amount: 200_000, years: 1 });
    const near = {
      ...taken,
      clock: { ...taken.clock, tick: taken.clock.tick + 300 },
      nation: { ...taken.nation, treasury: 1_000 },
    };
    expect(advise(near)[0]).toMatchObject({ topic: 'loan', lender: INTL_LENDER });
  });
});

describe('saves from before the armoury and loans', () => {
  it('pay the old procurement fund into the treasury and start with no loans', () => {
    const text = readFileSync(new URL('../fixtures/saves/v11.json', import.meta.url), 'utf8');
    const raw = JSON.parse(text) as { state: { nation: { treasury: number }; military: { procurementFund: number } } };
    const result = parseSave(text);
    if (!result.ok) throw new Error(result.error);
    const { state } = result.save;
    expect(state.nation.treasury).toBe(Math.round(raw.state.nation.treasury + raw.state.military.procurementFund));
    expect(state.economy.loans).toEqual([]);
    expect('procurementFund' in state.military).toBe(false);
  });
});
