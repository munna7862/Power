import { researchNode, UNIT_CONTENT } from '../content/military';
import { DOMAIN_LABELS, DOMAINS, UNITS, type DomainId, type UnitId } from '../content/ids';
import { commandConfidence } from '../departments/quality';
import { allEfficiencies } from '../economy/model';
import { groupIndian } from '../engine/numberFormat';
import { appendLog } from '../state/log';
import type { GameState, MilitaryState } from '../state/types';
import { CANCEL_REFUND, DELIVERY, MAX_ORDER_SIZE, MAX_QUEUE } from './constants';
import { militaryStrength, monthlyUpkeep, unitCost, unitGeneration, unitUpkeep } from './strength';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const patchMilitary = (state: GameState, patch: Partial<MilitaryState>): GameState => ({
  ...state,
  military: { ...state.military, ...patch },
});

const crore = (v: number) => `₹${groupIndian(Math.round(v))} crore`;

/** Cost of an order of `quantity` units at the domain’s current tier. */
export const orderCost = (state: Pick<GameState, 'military'>, unit: UnitId, quantity: number): number =>
  unitCost(unit, state.military.tech[UNIT_CONTENT[unit].domain]) * quantity;

const pay = (state: GameState, amount: number): GameState => ({
  ...state,
  nation: { ...state.nation, treasury: state.nation.treasury - amount },
});

/** Days until an order of `quantity` units is delivered. */
export const deliveryDays = (unit: UnitId, quantity: number): number =>
  Math.ceil(DELIVERY.base + UNIT_CONTENT[unit].buildDays / DELIVERY.buildDaysPerDay + quantity / DELIVERY.unitsPerDay);

export function validateOrder(state: GameState, unit: UnitId, quantity: number): string | null {
  if (!UNITS.includes(unit)) return `Unknown unit ${unit}.`;
  if (!Number.isInteger(quantity) || quantity < 1) return 'Order at least one unit.';
  if (quantity > MAX_ORDER_SIZE) return `An order can be at most ${MAX_ORDER_SIZE} units.`;
  if (state.military.queue.length >= MAX_QUEUE) return `The delivery queue is full (${MAX_QUEUE} orders).`;
  const cost = orderCost(state, unit, quantity);
  if (cost > state.nation.treasury) {
    return `The treasury holds ${crore(state.nation.treasury)}; this order costs ${crore(cost)}.`;
  }
  return null;
}

/** Places an order and pays for it from the treasury. Equipment arrives after its delivery time. */
export function placeOrder(state: GameState, unit: UnitId, quantity: number): GameState {
  const order = {
    id: `ord-${state.nextId}`,
    unit,
    quantity,
    startedTick: state.clock.tick,
    endsTick: state.clock.tick + deliveryDays(unit, quantity),
  };
  return {
    ...pay(patchMilitary(state, { queue: [...state.military.queue, order] }), orderCost(state, unit, quantity)),
    nextId: state.nextId + 1,
  };
}

export interface ForcePreview {
  strength: number;
  upkeep: number;
}

/**
 * India's strength and monthly upkeep if `change` units of a type joined (or, negative, left) the forces today,
 * with today's readiness, morale and technology: the same `militaryStrength()` the simulation uses.
 */
export function previewForces(state: Pick<GameState, 'military'>, unit: UnitId, change: number): ForcePreview {
  const m = state.military;
  const forces = { ...m.forces, [unit]: Math.max(0, m.forces[unit] + change) };
  return {
    strength: militaryStrength({ ...m, forces }),
    upkeep: monthlyUpkeep({ forces, tech: m.tech }),
  };
}

export function validateDecommissionUnits(state: GameState, unit: UnitId, quantity: number): string | null {
  if (!UNITS.includes(unit)) return `Unknown unit ${unit}.`;
  if (!Number.isInteger(quantity) || quantity < 1) return 'Decommission at least one unit.';
  if (quantity > state.military.forces[unit]) {
    return `Only ${state.military.forces[unit]} ${UNIT_CONTENT[unit].name.toLowerCase()} units are in service.`;
  }
  if (state.military.wars.length > 0) return 'Units cannot be stood down during a war.';
  return null;
}

/** Retires units from service. Nothing is refunded; the saving is their upkeep. */
export function decommissionUnits(state: GameState, unit: UnitId, quantity: number): GameState {
  const forces = { ...state.military.forces, [unit]: state.military.forces[unit] - quantity };
  return appendLog(patchMilitary(state, { forces }), {
    severity: 'info',
    category: 'military',
    title: 'Units decommissioned',
    body: `${quantity} × ${UNIT_CONTENT[unit].name} have been stood down, saving ${crore(quantity * unitUpkeep(unit, state.military.tech[UNIT_CONTENT[unit].domain]))} a month in upkeep.`,
  });
}

export function validateCancel(state: GameState, orderId: string): string | null {
  return state.military.queue.some((o) => o.id === orderId) ? null : 'That order is no longer in the queue.';
}

export function cancelOrder(state: GameState, orderId: string): GameState {
  const order = state.military.queue.find((o) => o.id === orderId);
  if (!order) return state;
  const tier = state.military.tech[UNIT_CONTENT[order.unit].domain];
  const refund = Math.round(unitCost(order.unit, tier) * order.quantity * CANCEL_REFUND);
  return pay(patchMilitary(state, { queue: state.military.queue.filter((o) => o.id !== orderId) }), -refund);
}

export function validateResearch(state: GameState, domain: DomainId): string | null {
  if (!DOMAINS.includes(domain)) return `Unknown domain ${domain}.`;
  const { research, tech } = state.military;
  if (research) return 'A research project is already under way.';
  if (tech[domain] >= 3) return `${DOMAIN_LABELS[domain]} technology is already at its highest tier.`;
  const node = researchNode(domain, (tech[domain] + 1) as 2 | 3);
  if (node.cost > state.nation.treasury) {
    return `The treasury holds ${crore(state.nation.treasury)}; this research costs ${crore(node.cost)}.`;
  }
  return null;
}

export function startResearch(state: GameState, domain: DomainId): GameState {
  const tier = (state.military.tech[domain] + 1) as 2 | 3;
  const node = researchNode(domain, tier);
  return pay(
    patchMilitary(state, {
      research: { domain, tier, startedTick: state.clock.tick, endsTick: state.clock.tick + node.days },
    }),
    node.cost,
  );
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
  /** Defence money spent this month: pay and upkeep. */
  spend: number;
  upkeep: number;
  /** Money for upkeep over upkeep due; below 1 the forces are underfunded. */
  ratio: number;
}

/** How a month of Defence spending covers upkeep. Since Sprint 8.7 equipment is bought from the treasury. */
export function fundingFor(military: Pick<MilitaryState, 'forces' | 'tech'>, spend: number): Funding {
  const upkeep = monthlyUpkeep(military);
  return { spend, upkeep, ratio: upkeep === 0 ? 1.3 : spend / upkeep };
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

/** Monthly: pays upkeep and lets readiness and morale drift toward what funding supports. */
export function settleForces(state: GameState): GameState {
  const spend = state.economy.lastMonth?.expenditure.defence ?? 0;
  const funding = fundingFor(state.military, spend);
  const m = state.military;
  const eff = allEfficiencies(state).defence;
  const weariness = Math.max(0, ...m.wars.map((w) => w.weariness));
  const loyalty = commandConfidence(state);

  const readiness = clamp(m.readiness + (readinessTarget(funding.ratio, eff) - m.readiness) * 0.12, 0, 100);
  const morale = clamp(
    m.morale + (moraleTarget(funding.ratio, state.nation.approval, loyalty, weariness) - m.morale) * 0.1,
    0,
    100,
  );

  let next = patchMilitary(state, { readiness, morale, fundingRatio: funding.ratio });
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
