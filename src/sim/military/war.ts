import { RIVAL_CONTENT } from '../content/military';
import { RIVALS, SECTORS, UNITS, type RivalId, type TerrainId } from '../content/ids';
import { addIncident } from '../diplomacy/relations';
import { adjustReputation, breakTreatiesForWar } from '../diplomacy/treaties';
import { nominalGdp } from '../economy/model';
import { formatDate } from '../engine/calendar';
import { groupIndian } from '../engine/numberFormat';
import type { Rng } from '../engine/rng';
import { addTimedModifier, replaceTimedModifier } from '../politics/policy';
import { clamp } from '../security/unrest';
import { endGame } from '../state/gameOver';
import { appendLog } from '../state/log';
import type { GameState, War, WarRecord } from '../state/types';
import { WAR } from './constants';
import { patchMilitary } from './forces';
import { adjustRelation, atWarWith, patchRival } from './rivals';
import { enemyFrontPower, frontPower, militaryStrength, personnel } from './strength';

export const MAX_WARS = 2;

export interface FrontRoundResult {
  /** Change to the front’s progress (positive = India advances). */
  progress: number;
  /** Share of India’s / the enemy’s strength on this front lost today. */
  indiaLoss: number;
  enemyLoss: number;
}

/**
 * One day of fighting on one front: strength × readiness × morale × terrain × luck.
 * `mine` and `enemy` are already the day’s effective powers (luck included). The weaker side digs in and
 * gets the terrain bonus. Edge cases: no army on one side means the other advances at full speed;
 * no army on either side means nothing happens.
 */
export function frontRound(mine: number, enemy: number, terrain: TerrainId): FrontRoundResult {
  const m0 = Math.max(0, mine);
  const e0 = Math.max(0, enemy);
  if (m0 === 0 && e0 === 0) return { progress: 0, indiaLoss: 0, enemyLoss: 0 };
  if (m0 === 0) return { progress: -WAR.maxProgress, indiaLoss: 2 * WAR.lossRate, enemyLoss: 0 };
  if (e0 === 0) return { progress: WAR.maxProgress, indiaLoss: 0, enemyLoss: 2 * WAR.lossRate };

  const bonus = WAR.terrain[terrain];
  const m = m0 < e0 ? m0 * bonus : m0;
  const e = e0 < m0 ? e0 * bonus : e0;
  return {
    progress: clamp(Math.log(m / e) * WAR.progressGain, -WAR.maxProgress, WAR.maxProgress),
    indiaLoss: (2 * WAR.lossRate * e) / (m + e),
    enemyLoss: (2 * WAR.lossRate * m) / (m + e),
  };
}

/** Mean progress across the fronts: +100 means the enemy is routed everywhere, −100 India is. */
export const warScore = (war: Pick<War, 'fronts'>): number =>
  war.fronts.length === 0 ? 0 : war.fronts.reduce((s, f) => s + f.progress, 0) / war.fronts.length;

export const activeWar = (state: Pick<GameState, 'military'>, warId: string): War | undefined =>
  state.military.wars.find((w) => w.id === warId);

export interface FrontOdds {
  name: string;
  terrain: TerrainId;
  progress: number;
  mine: number;
  enemy: number;
}

/** India’s and the enemy’s power on each front right now, before the day’s luck. For the War screen. */
export function frontOdds(state: GameState, war: War): FrontOdds[] {
  const rival = state.military.rivals[war.rival];
  const content = RIVAL_CONTENT[war.rival];
  return war.fronts.map((f) => {
    const front = content.fronts[f.index];
    if (!front) throw new Error(`Rival ${war.rival} has no front ${f.index}`);
    return {
      name: front.name,
      terrain: front.terrain,
      progress: f.progress,
      mine: frontPower(state.military, front),
      enemy: enemyFrontPower(rival, front),
    };
  });
}

export function validateDeclareWar(state: GameState, rival: RivalId): string | null {
  if (!RIVALS.includes(rival)) return `Unknown country ${rival}.`;
  if (state.military.rivals[rival].annexed) return 'That country no longer exists as a separate state.';
  if (atWarWith(state, rival)) return 'You are already at war with that country.';
  if (state.military.wars.length >= MAX_WARS) return `India cannot fight more than ${MAX_WARS} wars at once.`;
  if (state.nation.treasury < WAR.mobilisation) return 'The treasury cannot pay for mobilisation.';
  return null;
}

function newWar(state: GameState, rival: RivalId, declaredBy: War['declaredBy']): War {
  const content = RIVAL_CONTENT[rival];
  // An attack catches an unprepared army off guard on every front.
  const surprise = declaredBy === 'rival' ? -clamp((70 - state.military.readiness) * 0.3, 0, 12) : 0;
  return {
    id: `war-${state.nextId}`,
    rival,
    declaredBy,
    startedTick: state.clock.tick,
    status: 'active',
    fronts: content.fronts.map((_, index) => ({ index, progress: surprise })),
    enemyStartStrength: state.military.rivals[rival].strength,
    weariness: 0,
    casualties: { india: 0, enemy: 0 },
    equipmentLost: 0,
    ceasefireOffered: false,
    termsDeadlineTick: null,
    report: null,
  };
}

/** Opens a war. India declaring it costs mobilisation money, approval and goodwill; being attacked rallies the public. */
export function startWar(state: GameState, rival: RivalId, declaredBy: War['declaredBy']): GameState {
  const war = newWar(state, rival, declaredBy);
  const name = RIVAL_CONTENT[rival].name;
  let next: GameState = { ...state, nextId: state.nextId + 1 };
  next = patchMilitary(next, { wars: [...next.military.wars, war] });
  if (declaredBy === 'india') {
    next = { ...next, nation: { ...next.nation, treasury: next.nation.treasury - WAR.mobilisation } };
    next = addTimedModifier(
      next,
      {
        source: 'war',
        label: `Declared war on ${name}`,
        target: 'politics.approvalTarget',
        kind: 'add',
        value: -5,
      },
      120,
    );
    next = patchMilitary(next, { readiness: clamp(next.military.readiness - 4, 0, 100) });
    for (const other of RIVALS) {
      if (other !== rival && !next.military.rivals[other].annexed) next = adjustRelation(next, other, -8);
    }
    // Tearing up pacts and contracts to attack a partner costs standing with everyone.
    next = breakTreatiesForWar(next, rival);
    next = adjustReputation(next, -8);
    next = adjustRelation(next, rival, -30);
    next = addIncident(next, rival, 30);
    return appendLog(next, {
      severity: 'critical',
      category: 'military',
      title: `War declared on ${name}`,
      body: `Mobilisation costs ₹${groupIndian(WAR.mobilisation)} crore and the world watches. Voters are uneasy about a war of choice. Fronts: ${RIVAL_CONTENT[
        rival
      ].fronts
        .map((f) => f.name)
        .join(', ')}.`,
    });
  }
  next = addTimedModifier(
    next,
    {
      source: 'war',
      label: `Rally against ${name}`,
      target: 'politics.approvalTarget',
      kind: 'add',
      value: 3,
    },
    90,
  );
  next = adjustRelation(next, rival, -25);
  return appendLog(next, {
    severity: 'critical',
    category: 'military',
    title: `${name} invades`,
    body: `${name} declared war and crossed the frontier. The country rallies behind you, but readiness is ${next.military.readiness.toFixed(
      0,
    )}% and the army is already in contact on ${war.fronts.length} front${war.fronts.length === 1 ? '' : 's'}.`,
  });
}

function record(state: GameState, war: War, outcome: WarRecord['outcome'], settlement: string): GameState {
  const entry: WarRecord = {
    rival: war.rival,
    startedTick: war.startedTick,
    endedTick: state.clock.tick,
    outcome,
    settlement,
  };
  return patchMilitary(state, {
    wars: state.military.wars.filter((w) => w.id !== war.id),
    warHistory: [entry, ...state.military.warHistory].slice(0, 8),
  });
}

/** Ends a war and remembers how. The enemy needs two years to rebuild before it can attack again. */
export function endWar(state: GameState, war: War, outcome: WarRecord['outcome'], settlement: string): GameState {
  let next = record(state, war, outcome, settlement);
  next = patchRival(next, war.rival, { recoverUntilTick: state.clock.tick + 730 });
  return next;
}

/** Whether `war` can still be settled through the peace commands. */
export function validateWarAction(
  state: GameState,
  warId: string,
  action: 'suePeace' | 'ceasefire' | 'settle',
): string | null {
  const war = activeWar(state, warId);
  if (!war) return 'That war is over.';
  if (action === 'settle') return war.status === 'terms' ? null : 'The enemy has not yet capitulated.';
  if (war.status === 'terms') return 'The enemy has capitulated: settle the terms of peace.';
  if (action === 'ceasefire' && !war.ceasefireOffered) return 'The enemy has not offered a ceasefire.';
  return null;
}

const victoryBoost = (state: GameState, name: string, value = 6) =>
  addTimedModifier(
    state,
    { source: 'war', label: `Victory over ${name}`, target: 'politics.approvalTarget', kind: 'add', value },
    180,
  );

/** The President asks for peace. Accepted outright unless the war is going badly, when the enemy names a price. */
export function suePeace(state: GameState, warId: string): GameState {
  const war = activeWar(state, warId);
  if (!war) return state;
  const name = RIVAL_CONTENT[war.rival].name;
  const score = warScore(war);
  if (score >= -40) {
    let next = endWar(state, war, 'peace', 'White peace: borders unchanged.');
    next = adjustRelation(next, war.rival, 6);
    return appendLog(next, {
      severity: 'info',
      category: 'military',
      title: `Peace with ${name}`,
      body: 'Both sides agree to stop fighting and return to the old frontier. The public is relieved.',
    });
  }
  const price = Math.round(0.00075 * nominalGdp(state.economy));
  let next = endWar(
    { ...state, nation: { ...state.nation, treasury: state.nation.treasury - price } },
    war,
    'peace',
    `Peace on the enemy’s terms: ₹${groupIndian(price)} crore paid.`,
  );
  next = addTimedModifier(
    next,
    { source: 'war', label: `Humbling peace with ${name}`, target: 'politics.approvalTarget', kind: 'add', value: -5 },
    180,
  );
  return appendLog(next, {
    severity: 'warning',
    category: 'military',
    title: `Peace with ${name} on hard terms`,
    body: `With the front collapsing, ${name} named its price: ₹${groupIndian(price)} crore in compensation. The opposition calls it a humiliation.`,
  });
}

/** Accepts the ceasefire the enemy offered. */
export function acceptCeasefire(state: GameState, warId: string): GameState {
  const war = activeWar(state, warId);
  if (!war) return state;
  const name = RIVAL_CONTENT[war.rival].name;
  let next = endWar(state, war, 'ceasefire', 'Ceasefire along the current lines.');
  next = adjustRelation(next, war.rival, 8);
  next = addTimedModifier(
    next,
    { source: 'war', label: `Ceasefire with ${name}`, target: 'politics.approvalTarget', kind: 'add', value: 2 },
    90,
  );
  return appendLog(next, {
    severity: 'good',
    category: 'military',
    title: `Ceasefire with ${name}`,
    body: 'The guns fall silent along the current lines. Casualty lists are published and the nation begins to count the cost.',
  });
}

export type PeaceTerms = 'annex' | 'reparations' | 'whitePeace';

/** Reparations a defeated rival pays: a share of its economy. */
export const reparationsFor = (state: Pick<GameState, 'economy'>, rival: RivalId): number =>
  Math.round(0.015 * RIVAL_CONTENT[rival].gdpShare * nominalGdp(state.economy));

/** Settles a won war. Annexation takes the land and the people, and pays for it in unrest and sanctions. */
export function settleWar(state: GameState, warId: string, terms: PeaceTerms): GameState {
  const war = activeWar(state, warId);
  if (!war) return state;
  const content = RIVAL_CONTENT[war.rival];
  const name = content.name;
  let next = state;

  if (terms === 'annex') {
    const sectors = Object.fromEntries(
      SECTORS.map((s) => [
        s,
        { ...next.economy.sectors[s], output: next.economy.sectors[s].output * (1 + content.gdpShare) },
      ]),
    ) as typeof next.economy.sectors;
    next = {
      ...next,
      economy: { ...next.economy, sectors },
      nation: { ...next.nation, population: next.nation.population * (1 + content.populationShare) },
      security: {
        ...next.security,
        unrest: {
          ...next.security.unrest,
          [content.region]: clamp(next.security.unrest[content.region] + 18, 0, 100),
        },
      },
    };
    next = patchRival(next, war.rival, { annexed: true, strength: 0, readiness: 0 });
    next = addTimedModifier(
      next,
      {
        source: 'war',
        label: `Sanctions after annexing ${name}`,
        target: 'economy.growth',
        kind: 'add',
        value: -0.004,
      },
      1095,
    );
    next = addTimedModifier(
      next,
      {
        source: 'war',
        label: `Sanctions after annexing ${name}`,
        target: 'economy.revenue',
        kind: 'mult',
        value: -0.03,
      },
      1095,
    );
    for (const other of RIVALS) {
      if (other !== war.rival && !next.military.rivals[other].annexed) next = adjustRelation(next, other, -20);
    }
    next = adjustReputation(next, -15);
    next = endWar(
      next,
      war,
      'victory',
      `Annexed ${name}: +${(content.gdpShare * 100).toFixed(1)}% GDP, +${(content.populationShare * 100).toFixed(1)}% population.`,
    );
    next = victoryBoost(next, name, 8);
    return appendLog(next, {
      severity: 'good',
      category: 'military',
      title: `${name} annexed`,
      body: `India absorbs ${name}: the economy grows by ${(content.gdpShare * 100).toFixed(1)}% and the population by ${(content.populationShare * 100).toFixed(1)}%. Unrest rises in the ${content.region === 'northEast' ? 'North-East' : content.region} and the world imposes sanctions for three years.`,
    });
  }

  if (terms === 'reparations') {
    const amount = reparationsFor(next, war.rival);
    next = { ...next, nation: { ...next.nation, treasury: next.nation.treasury + amount } };
    next = adjustRelation(next, war.rival, -10);
    next = endWar(next, war, 'victory', `Reparations: ₹${groupIndian(amount)} crore received.`);
    next = victoryBoost(next, name);
    return appendLog(next, {
      severity: 'good',
      category: 'military',
      title: `Victory over ${name}`,
      body: `${name} signs a peace treaty and pays ₹${groupIndian(amount)} crore in reparations. The public celebrates a clear victory.`,
    });
  }

  next = adjustRelation(next, war.rival, 10);
  next = endWar(next, war, 'victory', 'Magnanimous peace: no claims.');
  next = victoryBoost(next, name, 7);
  return appendLog(next, {
    severity: 'good',
    category: 'military',
    title: `Magnanimous peace with ${name}`,
    body: `You accept the surrender without claims. ${name} owes you a favour and the world admires your restraint.`,
  });
}

function dailyText(
  name: string,
  score: number,
  indiaLoss: number,
  enemyLoss: number,
  indiaCasualties: number,
  enemyCasualties: number,
): string {
  const momentum = score > 15 ? 'India is advancing' : score < -15 ? 'India is falling back' : 'the lines hold';
  return `${name}: ${momentum}. Losses today: India ${(indiaLoss * 100).toFixed(2)}% (${groupIndian(indiaCasualties)} personnel), enemy ${(enemyLoss * 100).toFixed(2)}% (${groupIndian(enemyCasualties)}).`;
}

/** Removes `fraction` of every unit type, rounding up or down by chance so small losses still add up. */
function loseEquipment(state: GameState, fraction: number, rng: Rng): { state: GameState; lost: number } {
  const forces = { ...state.military.forces };
  let lost = 0;
  for (const unit of UNITS) {
    const expected = forces[unit] * fraction;
    const whole = Math.floor(expected);
    const extra = rng.chance(expected - whole) ? 1 : 0;
    const taken = Math.min(forces[unit], whole + extra);
    forces[unit] -= taken;
    lost += taken;
  }
  return { state: patchMilitary(state, { forces }), lost };
}

/** One day of one active war. */
function fightDay(state: GameState, war: War, rng: Rng): GameState {
  const content = RIVAL_CONTENT[war.rival];
  const rival = state.military.rivals[war.rival];
  const crew = personnel(state.military.forces);

  let indiaLoss = 0;
  let enemyLoss = 0;
  const fronts = war.fronts.map((f) => {
    const front = content.fronts[f.index];
    if (!front) throw new Error(`Rival ${war.rival} has no front ${f.index}`);
    const mine = frontPower(state.military, front) * rng.range(1 - WAR.noise, 1 + WAR.noise);
    const enemy = enemyFrontPower(rival, front) * rng.range(1 - WAR.noise, 1 + WAR.noise);
    const round = frontRound(mine, enemy, front.terrain);
    indiaLoss += round.indiaLoss * front.share;
    enemyLoss += round.enemyLoss * front.share;
    return { ...f, progress: clamp(f.progress + round.progress, -100, 100) };
  });

  const indiaCasualties = Math.round(crew * indiaLoss * 0.35);
  const enemyCasualties = Math.round(
    crew * (rival.strength / Math.max(militaryStrength(state.military), 1)) * enemyLoss * 0.35,
  );
  const fought = loseEquipment(state, indiaLoss, rng);
  let next = fought.state;
  next = patchRival(next, war.rival, {
    strength: Math.max(0.1, rival.strength * (1 - enemyLoss)),
    readiness: clamp(rival.readiness - 0.1, 5, 100),
  });
  const m = next.military;
  next = patchMilitary(next, {
    readiness: clamp(m.readiness - 0.08, 0, 100),
    morale: clamp(m.morale + (warScore({ fronts }) > 0 ? 0.04 : -0.08), 0, 100),
  });
  next = {
    ...next,
    nation: {
      ...next.nation,
      treasury: next.nation.treasury - Math.round(WAR.costPerStrength * militaryStrength(state.military)),
    },
  };
  const updated: War = {
    ...war,
    fronts,
    weariness: clamp(
      war.weariness + WAR.weariness.perDay + (indiaLoss * 100 * WAR.weariness.perLossPoint) / 10,
      0,
      100,
    ),
    casualties: {
      india: war.casualties.india + indiaCasualties,
      enemy: war.casualties.enemy + enemyCasualties,
    },
    equipmentLost: war.equipmentLost + fought.lost,
    report: {
      tick: state.clock.tick,
      date: state.clock.date,
      indiaLoss: indiaLoss * 100,
      enemyLoss: enemyLoss * 100,
      indiaCasualties,
      enemyCasualties,
      text: dailyText(content.name, warScore({ fronts }), indiaLoss, enemyLoss, indiaCasualties, enemyCasualties),
    },
  };
  return patchMilitary(next, { wars: next.military.wars.map((w) => (w.id === war.id ? updated : w)) });
}

/**
 * Daily: every active war plays one round on each front. A war ends when the enemy capitulates
 * (the President then settles the terms), when India is forced to capitulate (game over), or when the
 * deadline to settle passes and reparations apply.
 */
export function stepWars(state: GameState, rng: Rng): GameState {
  let next = state;
  for (const war0 of state.military.wars) {
    const war = next.military.wars.find((w) => w.id === war0.id);
    if (!war || next.status.kind === 'over') continue;
    const name = RIVAL_CONTENT[war.rival].name;

    if (war.status === 'terms') {
      if (war.termsDeadlineTick !== null && war.termsDeadlineTick <= next.clock.tick) {
        next = settleWar(next, war.id, 'reparations');
      }
      continue;
    }

    next = fightDay(next, war, rng);
    const after = next.military.wars.find((w) => w.id === war.id);
    if (!after) continue;
    const score = warScore(after);
    const rival = next.military.rivals[war.rival];

    if (score >= WAR.victoryScore || rival.strength <= after.enemyStartStrength * WAR.victoryStrengthShare) {
      next = patchMilitary(next, {
        wars: next.military.wars.map((w) =>
          w.id === war.id
            ? { ...w, status: 'terms', termsDeadlineTick: next.clock.tick + WAR.termsDays, ceasefireOffered: false }
            : w,
        ),
      });
      next = appendLog(next, {
        severity: 'good',
        category: 'military',
        title: `${name} capitulates`,
        body: `${name}’s army has collapsed. You have ${WAR.termsDays} days to choose the peace terms (annexation, reparations or a magnanimous peace); if you do not, reparations apply.`,
      });
    } else if (score <= WAR.defeatScore) {
      const summary = `The army was broken on every front and ${name} dictated terms. ${next.meta.presidentName} resigned on ${formatDate(next.clock.date)}.`;
      next = record(next, after, 'defeat', 'Forced to capitulate.');
      next = endGame(next, 'defeat', 'Defeated in war', summary);
    }
  }
  return next;
}

/**
 * Monthly: the cost of war shows in approval and growth, the enemy may offer a ceasefire, and a nuclear-armed
 * enemy that is losing may rattle its sabres.
 */
export function settleWars(state: GameState, rng: Rng): GameState {
  let next = state;
  for (const war0 of state.military.wars) {
    const war = next.military.wars.find((w) => w.id === war0.id);
    if (!war) continue;
    const name = RIVAL_CONTENT[war.rival].name;
    next = replaceTimedModifier(
      next,
      {
        source: 'war-weariness',
        label: `War weariness (${name})`,
        target: 'politics.approvalTarget',
        kind: 'add',
        value: -(war.weariness / 100) * WAR.wearinessApproval,
      },
      40,
    );
    next = replaceTimedModifier(
      next,
      { source: 'war-weariness', label: `War economy (${name})`, target: 'economy.growth', kind: 'add', value: -0.003 },
      40,
    );
    if (war.status !== 'active' || war.ceasefireOffered) continue;

    const days = next.clock.tick - war.startedTick;
    const score = warScore(war);
    const rivalLosing = score > 25;
    const rival = next.military.rivals[war.rival];
    if (days >= 60 && rng.chance(clamp(0.1 + days / 1500 + (rivalLosing ? 0.2 : 0), 0, 0.5))) {
      next = patchMilitary(next, {
        wars: next.military.wars.map((w) => (w.id === war.id ? { ...w, ceasefireOffered: true } : w)),
      });
      const nuclear = RIVAL_CONTENT[war.rival].nuclear && rivalLosing && !rival.annexed;
      next = appendLog(next, {
        severity: 'warning',
        category: 'military',
        title: `${name} offers a ceasefire`,
        body: nuclear
          ? `${name}, which holds nuclear weapons, hints that continued losses could push it to “extraordinary measures” and proposes a ceasefire through intermediaries. Accept it from the War screen, or press on.`
          : `${name} proposes a ceasefire along the current lines. You can accept it from the War screen, or press on.`,
      });
    }
  }
  return next;
}
