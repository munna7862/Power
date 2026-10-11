import {
  choiceUtility,
  DOMAINS,
  DRILLS,
  INTEL_OPS,
  monthlyUpkeep,
  RIVALS,
  unitUpkeep,
  UNIT_CONTENT,
  warScore,
  type DomainId,
  type UnitId,
  debtToGdp,
  dispatch,
  EVENT_CONTENT,
  INVESTIGATION_COST,
  lastDeficitRatio,
  MAX_INVESTIGATIONS,
  MINISTRIES,
  MINISTRY_CONTENT,
  nextBudgetDate,
  OPERATIONS,
  TAX_LIMITS,
  TAXES,
  type BudgetProposal,
  type GameState,
  type MinistryId,
  type Minister,
  type TaxId,
} from '../../src/sim';

/**
 * A bot looks at the state and issues commands through dispatch(), exactly like a player.
 * `act` runs on the first day of every month; `react` runs every day, for decisions with short deadlines.
 */
export interface Bot {
  id: string;
  description: string;
  act(state: GameState): GameState;
  react?(state: GameState): GameState;
}

const apply = (state: GameState, command: Parameters<typeof dispatch>[1]) => dispatch(state, command).state;

function enact(state: GameState, change: (p: BudgetProposal) => BudgetProposal): GameState {
  if (nextBudgetDate(state)) return state;
  const proposal = change({ taxRates: { ...state.budget.taxRates }, allocations: { ...state.budget.allocations } });
  return apply(state, { type: 'ENACT_BUDGET', proposal });
}

const step = (state: GameState, tax: TaxId, delta: number) =>
  Math.min(TAX_LIMITS[tax].max, Math.max(TAX_LIMITS[tax].min, state.budget.taxRates[tax] + delta));

/** Ministries whose loyalty matters for the President's survival. */
const GUARDIANS: readonly MinistryId[] = ['home', 'defence', 'intelligence'];

const score = (m: Minister, ministry: MinistryId) =>
  m.competence - 0.6 * m.corruption + (GUARDIANS.includes(ministry) ? 0.4 * m.loyalty : 0);

export const passiveBot: Bot = {
  id: 'passive',
  description: 'Never changes anything and lets every decision lapse.',
  act: (state) => state,
};

export const greedyBot: Bot = {
  id: 'greedy',
  description: 'Raises every tax as far and as fast as the rules allow; ignores decisions.',
  act: (state) =>
    enact(state, (p) => ({
      ...p,
      taxRates: Object.fromEntries(TAXES.map((t) => [t, step(state, t, 0.05)])) as BudgetProposal['taxRates'],
    })),
};

/** Settles every waiting decision with the choice whose listed effects look best, skipping ones it cannot afford. */
function decide(state: GameState): GameState {
  let next = state;
  for (const pending of state.events.pending) {
    const def = EVENT_CONTENT[pending.eventId];
    if (!def) continue;
    const thrifty = debtToGdp(next.economy) > 0.9;
    const options = def.choices
      .filter((c) => !thrifty || c.cost <= 2500)
      .map((choice) => ({ choice, value: choiceUtility(next, choice) }))
      .sort((a, b) => b.value - a.value);
    const best = options[0];
    if (best) next = apply(next, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: best.choice.id });
  }
  return next;
}

/** Buy order for the balanced bot: a rounded force that stays within what the Defence budget can keep up. */
const SHOPPING: readonly UnitId[] = ['fighter', 'armour', 'frigate', 'airDefence', 'infantry', 'artillery', 'missile'];

/** Runs the armed forces the way a sensible President would: spend the fund, train, spy, end wars. */
function manageMilitary(state: GameState): GameState {
  let next = state;
  const m = () => next.military;

  // End wars: take what is offered, settle victories for reparations, ask for peace before a rout.
  for (const war of m().wars) {
    if (war.status === 'terms') next = apply(next, { type: 'SETTLE_WAR', warId: war.id, terms: 'reparations' });
    else if (war.ceasefireOffered) next = apply(next, { type: 'ACCEPT_CEASEFIRE', warId: war.id });
    else if (warScore(war) < -45) next = apply(next, { type: 'SUE_FOR_PEACE', warId: war.id });
  }

  // Train when readiness slips.
  if (m().readiness < 82 && m().drills.length < 2) {
    const kinds = ['joint', 'air', 'land', 'naval'] as const;
    for (const kind of kinds) {
      if (m().procurementFund > DRILLS[kind].cost + 12_000) {
        next = apply(next, { type: 'START_DRILL', kind });
        break;
      }
    }
  }

  // Research the weakest domain.
  if (!m().research) {
    const domain = [...DOMAINS].sort((a: DomainId, b: DomainId) => m().tech[a] - m().tech[b])[0];
    if (domain && m().tech[domain] < 3) next = apply(next, { type: 'START_RESEARCH', domain });
  }

  // Buy equipment while upkeep stays below 85% of the Defence budget.
  const spend = next.economy.lastMonth?.expenditure.defence ?? 0;
  for (const unit of SHOPPING) {
    if (m().queue.length >= 4) break;
    const added = 2 * unitUpkeep(unit, m().tech[UNIT_CONTENT[unit].domain]);
    const queued = m().queue.reduce(
      (s, o) => s + o.quantity * unitUpkeep(o.unit, m().tech[UNIT_CONTENT[o.unit].domain]),
      0,
    );
    if (monthlyUpkeep(m()) + queued + added > spend * 0.85) continue;
    next = apply(next, { type: 'ORDER_UNITS', unit, quantity: 2 });
  }

  // Keep an eye on the most hostile neighbour, and spies out.
  if (next.nation.treasury > 30_000) {
    const target = [...RIVALS]
      .filter((r) => !m().rivals[r].annexed)
      .sort((a, b) => m().rivals[a].relation - m().rivals[b].relation)[0];
    const stale = target
      ? !m().rivals[target].sighting || next.clock.tick - (m().rivals[target].sighting?.tick ?? 0) > 400
      : false;
    if (target && stale && next.nation.treasury > INTEL_OPS.recon.cost * 20) {
      next = apply(next, { type: 'LAUNCH_INTEL_OP', kind: 'recon', target });
    }
    if (!m().intelOps.some((o) => o.kind === 'counterIntel') && m().counterIntel < 50) {
      next = apply(next, { type: 'LAUNCH_INTEL_OP', kind: 'counterIntel', target: null });
    }
  }
  return next;
}

export const balancedBot: Bot = {
  id: 'balanced',
  description:
    'Hires the best candidates each January, nudges taxes and spending toward a ~3% deficit, funds security when pressure builds, investigates corruption, runs the armed forces (equipment, drills, research, recon, ending wars) and settles every decision on its merits.',
  act(state) {
    let next = state;
    if (state.clock.date.month === 1) {
      for (const m of MINISTRIES) {
        const best = [...next.cabinet.candidates[m]].sort((a, b) => score(b, m) - score(a, m))[0];
        const current = next.cabinet.ministers[m];
        if (best && (!current || score(best, m) > score(current, m) + 15)) {
          next = apply(next, { type: 'APPOINT_MINISTER', ministry: m, candidateId: best.id });
        }
      }
    }

    // Fill any vacancy left by a scandal.
    for (const m of MINISTRIES) {
      if (next.cabinet.ministers[m]) continue;
      const best = [...next.cabinet.candidates[m]].sort((a, b) => score(b, m) - score(a, m))[0];
      if (best) next = apply(next, { type: 'APPOINT_MINISTER', ministry: m, candidateId: best.id });
    }

    // Open inquiries into the most suspect minister when the country looks corrupt.
    if (next.economy.corruption > 42 && next.security.investigations.length < MAX_INVESTIGATIONS - 1) {
      const suspect = [...MINISTRIES]
        .filter((m) => next.cabinet.ministers[m] && (next.cabinet.ministers[m]?.corruption ?? 0) > 50)
        .sort((a, b) => (next.cabinet.ministers[b]?.corruption ?? 0) - (next.cabinet.ministers[a]?.corruption ?? 0))[0];
      if (suspect && next.nation.treasury > INVESTIGATION_COST) {
        next = apply(next, { type: 'LAUNCH_INVESTIGATION', ministry: suspect });
      }
    }

    next = manageMilitary(next);

    // Keep surveillance running while the threat is high.
    if (next.security.terrorThreat > 50 && next.nation.treasury > OPERATIONS.surveillance.cost) {
      next = apply(next, { type: 'LAUNCH_OPERATION', kind: 'surveillance' });
    }

    const deficit = lastDeficitRatio(next.economy);
    const { inflation, unemployment } = next.economy;
    const pressure = Math.max(...Object.values(next.security.unrest));
    return enact(next, (p) => {
      const taxRates = { ...p.taxRates };
      const allocations = { ...p.allocations };
      if (deficit > 0.035) {
        taxRates.gst = step(next, 'gst', 0.005);
        taxRates.corporate = step(next, 'corporate', 0.005);
      } else if (deficit < 0.015) {
        taxRates.income = step(next, 'income', -0.005);
      }
      const bump = (ministry: MinistryId, factor: number, ceiling = 3) => {
        const d = MINISTRY_CONTENT[ministry].defaultAllocation;
        allocations[ministry] = Math.min(d * ceiling, Math.max(d * 0.25, allocations[ministry] * factor));
      };
      if (unemployment > 0.075 && inflation < 0.06) bump('industry', 1.05);
      if (inflation > 0.06) bump('industry', 0.97);
      if (next.politics.satisfaction.services < 50 && deficit < 0.03) {
        bump('health', 1.05);
        bump('education', 1.05);
      }
      // Security: more police when unrest builds, more intelligence when the threat does, steady disaster funding.
      if (pressure > 45) bump('home', 1.06, 2.2);
      if (next.security.terrorThreat > 35) bump('intelligence', 1.06, 2.2);
      if (next.security.militaryLoyalty < 55) bump('defence', 1.04, 1.6);
      bump('disaster', 1.02, 1.8);
      return { taxRates, allocations };
    });
  },
  react: decide,
};

export const BOTS: readonly Bot[] = [passiveBot, greedyBot, balancedBot];
