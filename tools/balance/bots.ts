import {
  choiceUtility,
  COUNTRY_CONTENT,
  FOCUS_IDS,
  MAX_TRADE_TREATIES,
  pactAcceptance,
  relationOf,
  tradeAcceptance,
  tradeSizesFor,
  validateEmbassy,
  validatePact,
  validateTrade,
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
  type ServiceId,
  type TaxId,
  DEPARTMENT_SERVICES,
  serviceStars,
  validateUpgrade,
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

/** Services the balanced bot raises first: the ones that protect the presidency, then the economy's engines. */
const UPGRADE_PRIORITY: readonly [MinistryId, ServiceId][] = [
  ['defence', 'armyCommand'],
  ['home', 'presidentialProtection'],
  ...(
    ['finance', 'industry', 'education', 'health', 'agriculture', 'home', 'antiCorruption', 'intelligence'] as const
  ).flatMap((m) => DEPARTMENT_SERVICES[m].map((s): [MinistryId, ServiceId] => [m, s])),
];

/** Upgrades the weakest priority service, at most two a month, while debt stays manageable. */
function upgradeServices(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 2; i++) {
    if (debtToGdp(next.economy) > 0.7) break;
    const target = UPGRADE_PRIORITY.filter(([m, s]) => !validateUpgrade(next, m, s)).sort(
      ([am, as], [bm, bs]) => serviceStars(next, am, as) - serviceStars(next, bm, bs),
    )[0];
    if (!target || serviceStars(next, target[0], target[1]) >= 4) break;
    next = apply(next, { type: 'UPGRADE_SERVICE', department: target[0], service: target[1] });
  }
  return next;
}

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
      .sort((a, b) => (next.diplomacy.countries[a]?.relation ?? 0) - (next.diplomacy.countries[b]?.relation ?? 0))[0];
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

/**
 * Runs foreign policy the way a sensible President would: answer offers, open a few embassies, sign trade
 * contracts with the friendliest large economies and seek a pact with the neighbours it is not at war with.
 */
function manageDiplomacy(state: GameState): GameState {
  let next = state;
  const trades = () => next.diplomacy.treaties.filter((t) => t.type === 'trade').length;

  for (const offer of state.diplomacy.offers) {
    if (offer.type === 'trade' && trades() >= MAX_TRADE_TREATIES) continue;
    next = apply(next, { type: 'ACCEPT_OFFER', offerId: offer.id });
  }

  const rich = next.nation.treasury > 30_000;
  const embassies = next.diplomacy.treaties.filter((t) => t.type === 'embassy').length;
  if (rich && embassies < 4) {
    const target = [...FOCUS_IDS]
      .filter((id) => !validateEmbassy(next, id))
      .sort((a, b) => (COUNTRY_CONTENT[b]?.power ?? 0) - (COUNTRY_CONTENT[a]?.power ?? 0))[0];
    if (target) next = apply(next, { type: 'OPEN_EMBASSY', country: target });
  }

  if (trades() < 4) {
    const options = FOCUS_IDS.flatMap((id) => {
      const c = COUNTRY_CONTENT[id];
      const size = tradeSizesFor(next, id)[1]?.size ?? tradeSizesFor(next, id)[0]?.size;
      const sector = c?.strengths[0];
      if (!c || !size || !sector || validateTrade(next, id, sector, size, 3)) return [];
      const value = tradeSizesFor(next, id).find((s) => s.size === size)?.value ?? 0;
      return [{ id, sector, size, chance: tradeAcceptance(next, id, sector, value).chance }];
    }).sort((a, b) => b.chance - a.chance);
    const best = options[0];
    if (best && best.chance > 0.4) {
      next = apply(next, { type: 'PROPOSE_TRADE', country: best.id, sector: best.sector, size: best.size, years: 3 });
    }
  }

  const neighbour = [...RIVALS]
    .filter((id) => !next.military.rivals[id].annexed && !validatePact(next, id))
    .sort((a, b) => relationOf(next, b) - relationOf(next, a))[0];
  if (neighbour && pactAcceptance(next, neighbour).chance > 0.4) {
    next = apply(next, { type: 'PROPOSE_PACT', country: neighbour });
  }
  return next;
}

export const balancedBot: Bot = {
  id: 'balanced',
  description:
    'Upgrades the services that keep it safe and the economy growing, nudges taxes and spending toward a ~3% deficit, funds security when pressure builds, audits departments, runs the armed forces (equipment, drills, research, recon, ending wars), runs foreign policy (answers offers, embassies, trade contracts, pacts) and settles every decision on its merits.',
  act(state) {
    let next = upgradeServices(state);

    // Audit the biggest-spending department not already under audit when the country looks corrupt.
    if (next.economy.corruption > 42 && next.security.investigations.length < MAX_INVESTIGATIONS - 1) {
      const target = [...MINISTRIES]
        .filter((m) => !next.security.investigations.some((i) => i.department === m))
        .sort((a, b) => next.budget.allocations[b] - next.budget.allocations[a])[0];
      if (target && next.nation.treasury > INVESTIGATION_COST) {
        next = apply(next, { type: 'LAUNCH_INVESTIGATION', department: target });
      }
    }

    next = manageMilitary(next);
    next = manageDiplomacy(next);

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
