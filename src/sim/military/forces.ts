import { researchNode, UNIT_CONTENT } from '../content/military';
import { DOMAIN_LABELS, DOMAINS, UNITS, type DomainId, type UnitId } from '../content/ids';
import { commandConfidence } from '../departments/quality';
import { allEfficiencies } from '../economy/model';
import { groupIndian } from '../engine/numberFormat';
import { appendLog } from '../state/log';
import type { GameState, MilitaryState } from '../state/types';
import { CANCEL_REFUND, FUND_CAP_MONTHS, MAX_ORDER_SIZE, MAX_QUEUE } from './constants';
import { monthlyUpkeep, unitCost, unitGeneration } from './strength';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const patchMilitary = (state: GameState, patch: Partial<MilitaryState>): GameState => ({
  ...state,
  military: { ...state.military, ...patch },
});

const crore = (v: number) => `₹${groupIndian(Math.round(v))} crore`;

/** Cost of an order of `quantity` units at the domain’s current tier. */
export const orderCost = (state: Pick<GameState, 'military'>, unit: UnitId, quantity: number): number =>
  unitCost(unit, state.military.tech[UNIT_CONTENT[unit].domain]) * quantity;

export function validateOrder(state: GameState, unit: UnitId, quantity: number): string | null {
  if (!UNITS.includes(unit)) return `Unknown unit ${unit}.`;
  if (!Number.isInteger(quantity) || quantity < 1) return 'Order at least one unit.';
  if (quantity > MAX_ORDER_SIZE) return `An order can be at most ${MAX_ORDER_SIZE} units.`;
  if (state.military.queue.length >= MAX_QUEUE) return `The production queue is full (${MAX_QUEUE} orders).`;
  const cost = orderCost(state, unit, quantity);
  if (cost > state.military.procurementFund) {
    return `The procurement fund holds ${crore(state.military.procurementFund)}; this order costs ${crore(cost)}. Raise the Defence budget to build it up.`;
  }
  return null;
}

/** Places an order and pays for it from the procurement fund. Equipment arrives after the unit’s build time. */
export function placeOrder(state: GameState, unit: UnitId, quantity: number): GameState {
  const cost = orderCost(state, unit, quantity);
  const days = UNIT_CONTENT[unit].buildDays + Math.ceil(quantity / 4) * 10;
  const order = {
    id: `ord-${state.nextId}`,
    unit,
    quantity,
    startedTick: state.clock.tick,
    endsTick: state.clock.tick + days,
  };
  return {
    ...patchMilitary(state, {
      procurementFund: state.military.procurementFund - cost,
      queue: [...state.military.queue, order],
    }),
    nextId: state.nextId + 1,
  };
}

export function validateCancel(state: GameState, orderId: string): string | null {
  return state.military.queue.some((o) => o.id === orderId) ? null : 'That order is no longer in the queue.';
}

export function cancelOrder(state: GameState, orderId: string): GameState {
  const order = state.military.queue.find((o) => o.id === orderId);
  if (!order) return state;
  const tier = state.military.tech[UNIT_CONTENT[order.unit].domain];
  const refund = Math.round(unitCost(order.unit, tier) * order.quantity * CANCEL_REFUND);
  return patchMilitary(state, {
    procurementFund: state.military.procurementFund + refund,
    queue: state.military.queue.filter((o) => o.id !== orderId),
  });
}

export function validateResearch(state: GameState, domain: DomainId): string | null {
  if (!DOMAINS.includes(domain)) return `Unknown domain ${domain}.`;
  const { research, tech, procurementFund } = state.military;
  if (research) return 'A research project is already under way.';
  if (tech[domain] >= 3) return `${DOMAIN_LABELS[domain]} technology is already at its highest tier.`;
  const node = researchNode(domain, (tech[domain] + 1) as 2 | 3);
  if (node.cost > procurementFund) {
    return `The procurement fund holds ${crore(procurementFund)}; this research costs ${crore(node.cost)}.`;
  }
  return null;
}

export function startResearch(state: GameState, domain: DomainId): GameState {
  const tier = (state.military.tech[domain] + 1) as 2 | 3;
  const node = researchNode(domain, tier);
  return patchMilitary(state, {
    procurementFund: state.military.procurementFund - node.cost,
    research: { domain, tier, startedTick: state.clock.tick, endsTick: state.clock.tick + node.days },
  });
}

/** Daily: delivers finished orders and completes research. */
export function completeProduction(state: GameState): GameState {
  const now = state.clock.tick;
  let next = state;
  const done = state.military.queue.filter((o) => o.endsTick <= now);
  if (done.length > 0) {
    const forces = { ...state.military.forces };
    for (const order of done) forces[order.unit] += order.quantity;
    next = patchMilitary(next, { forces, queue: state.military.queue.filter((o) => o.endsTick > now) });
    for (const order of done) {
      const tier = next.military.tech[UNIT_CONTENT[order.unit].domain];
      next = appendLog(next, {
        severity: 'good',
        category: 'military',
        title: 'Equipment delivered',
        body: `${order.quantity} × ${unitGeneration(order.unit, tier)} (${UNIT_CONTENT[order.unit].name}) have joined the forces.`,
      });
    }
  }
  const research = next.military.research;
  if (research && research.endsTick <= now) {
    const node = researchNode(research.domain, research.tier);
    next = patchMilitary(next, { tech: { ...next.military.tech, [research.domain]: research.tier }, research: null });
    next = appendLog(next, {
      severity: 'good',
      category: 'military',
      title: `${DOMAIN_LABELS[research.domain]} technology: tier ${research.tier}`,
      body: `Research complete: ${node.name}. Forces in this domain fight harder, and new orders use better equipment (they also cost more to keep).`,
    });
  }
  return next;
}

export interface Funding {
  /** Defence money available this month. */
  spend: number;
  upkeep: number;
  /** Money for upkeep over upkeep due; below 1 the forces are underfunded. */
  ratio: number;
  /** Left over for the procurement fund (never negative). */
  surplus: number;
  /** Drawn from the fund to cover a shortfall. */
  drawn: number;
}

/** How a month of Defence spending covers upkeep. Shortfalls are covered from the fund while it lasts. */
export function fundingFor(
  military: Pick<MilitaryState, 'forces' | 'tech' | 'procurementFund'>,
  spend: number,
): Funding {
  const upkeep = monthlyUpkeep(military);
  const shortfall = Math.max(0, upkeep - spend);
  const drawn = Math.min(shortfall, military.procurementFund);
  return {
    spend,
    upkeep,
    ratio: upkeep === 0 ? 1.3 : (spend + drawn) / upkeep,
    surplus: Math.max(0, spend - upkeep),
    drawn,
  };
}

/** Where readiness is heading: funding, the Defence ministry’s quality and whether the army has been fighting. */
export function readinessTarget(fundingRatio: number, defenceEfficiency: number): number {
  return clamp(35 + 35 * Math.min(fundingRatio, 1.3) + 8 * (Math.min(defenceEfficiency, 1.8) - 1), 15, 95);
}

export function moraleTarget(
  fundingRatio: number,
  approval: number,
  commandConfidence: number,
  weariness: number,
): number {
  return clamp(
    40 + 25 * Math.min(fundingRatio, 1.2) + 0.15 * (approval - 50) + 0.1 * (commandConfidence - 60) - 0.25 * weariness,
    10,
    95,
  );
}

/** Monthly: pays upkeep, banks the surplus and lets readiness and morale drift toward what funding supports. */
export function settleForces(state: GameState): GameState {
  const spend = state.economy.lastMonth?.expenditure.defence ?? 0;
  const funding = fundingFor(state.military, spend);
  const m = state.military;
  const eff = allEfficiencies(state).defence;
  const weariness = Math.max(0, ...m.wars.map((w) => w.weariness));
  const loyalty = commandConfidence(state);

  const fund = clamp(m.procurementFund - funding.drawn + funding.surplus, 0, Math.max(spend, 1) * FUND_CAP_MONTHS);
  const readiness = clamp(m.readiness + (readinessTarget(funding.ratio, eff) - m.readiness) * 0.12, 0, 100);
  const morale = clamp(
    m.morale + (moraleTarget(funding.ratio, state.nation.approval, loyalty, weariness) - m.morale) * 0.1,
    0,
    100,
  );

  let next = patchMilitary(state, { procurementFund: fund, readiness, morale, fundingRatio: funding.ratio });
  if (funding.ratio < 0.85 && m.fundingRatio >= 0.85) {
    next = appendLog(next, {
      severity: 'warning',
      category: 'military',
      title: 'The armed forces are underfunded',
      body: `This month’s Defence budget (${crore(funding.spend)}) does not cover upkeep (${crore(funding.upkeep)}). Readiness and morale will decay until funding is restored.`,
    });
  }
  return next;
}
