import {
  dispatch,
  lastDeficitRatio,
  MINISTRIES,
  MINISTRY_CONTENT,
  nextBudgetDate,
  TAX_LIMITS,
  TAXES,
  type BudgetProposal,
  type GameState,
  type Minister,
  type TaxId,
} from '../../src/sim';

/** A bot looks at the state once a month and issues commands through dispatch(), exactly like a player. */
export interface Bot {
  id: string;
  description: string;
  act(state: GameState): GameState;
}

const apply = (state: GameState, command: Parameters<typeof dispatch>[1]) => dispatch(state, command).state;

function enact(state: GameState, change: (p: BudgetProposal) => BudgetProposal): GameState {
  if (nextBudgetDate(state)) return state;
  const proposal = change({ taxRates: { ...state.budget.taxRates }, allocations: { ...state.budget.allocations } });
  return apply(state, { type: 'ENACT_BUDGET', proposal });
}

const step = (state: GameState, tax: TaxId, delta: number) =>
  Math.min(TAX_LIMITS[tax].max, Math.max(TAX_LIMITS[tax].min, state.budget.taxRates[tax] + delta));

const score = (m: Minister) => m.competence - 0.6 * m.corruption;

export const passiveBot: Bot = {
  id: 'passive',
  description: 'Never changes anything.',
  act: (state) => state,
};

export const greedyBot: Bot = {
  id: 'greedy',
  description: 'Raises every tax as far and as fast as the rules allow.',
  act: (state) =>
    enact(state, (p) => ({
      ...p,
      taxRates: Object.fromEntries(TAXES.map((t) => [t, step(state, t, 0.05)])) as BudgetProposal['taxRates'],
    })),
};

export const balancedBot: Bot = {
  id: 'balanced',
  description: 'Hires the best candidates each January and nudges taxes and spending toward a ~3% deficit.',
  act(state) {
    let next = state;
    if (state.clock.date.month === 1) {
      for (const m of MINISTRIES) {
        const best = [...next.cabinet.candidates[m]].sort((a, b) => score(b) - score(a))[0];
        const current = next.cabinet.ministers[m];
        if (best && (!current || score(best) > score(current) + 15)) {
          next = apply(next, { type: 'APPOINT_MINISTER', ministry: m, candidateId: best.id });
        }
      }
    }
    const deficit = lastDeficitRatio(next.economy);
    const { inflation, unemployment } = next.economy;
    return enact(next, (p) => {
      const taxRates = { ...p.taxRates };
      const allocations = { ...p.allocations };
      if (deficit > 0.035) {
        taxRates.gst = step(next, 'gst', 0.005);
        taxRates.corporate = step(next, 'corporate', 0.005);
      } else if (deficit < 0.015) {
        taxRates.income = step(next, 'income', -0.005);
      }
      const bump = (ministry: (typeof MINISTRIES)[number], factor: number) => {
        const d = MINISTRY_CONTENT[ministry].defaultAllocation;
        allocations[ministry] = Math.min(d * 3, Math.max(d * 0.25, allocations[ministry] * factor));
      };
      if (unemployment > 0.075 && inflation < 0.06) bump('industry', 1.05);
      if (inflation > 0.06) bump('industry', 0.97);
      if (next.politics.satisfaction.services < 50 && deficit < 0.03) {
        bump('health', 1.05);
        bump('education', 1.05);
      }
      return { taxRates, allocations };
    });
  },
};

export const BOTS: readonly Bot[] = [passiveBot, greedyBot, balancedBot];
