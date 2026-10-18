import { INDUSTRY_CONTENT } from '../content/goods';
import { INDUSTRIES, REGIONS, type IndustryId, type RegionId } from '../content/ids';
import { groupIndian } from '../engine/numberFormat';
import { placeName, splitCloseIndustry } from '../national/split';
import { appendLog } from '../state/log';
import type { GameState, PlantOwner } from '../state/types';
import {
  INDUSTRY_CANCEL_REFUND,
  LICENCE_DAYS,
  LICENCE_MIN_CLIMATE,
  MAX_INDUSTRY_ORDER,
  MAX_INDUSTRY_QUEUE,
  MAX_LICENCES,
} from './constants';
import { businessClimate, plantProfit } from './flows';

/** ₹ crore to build this many state plants. */
export const industryCost = (industry: IndustryId, quantity: number): number =>
  INDUSTRY_CONTENT[industry].cost * quantity;

const plantName = (industry: IndustryId) => INDUSTRY_CONTENT[industry].name.toLowerCase();

function validateTarget(industry: IndustryId, region: RegionId | null, quantity: number): string | null {
  if (!INDUSTRIES.includes(industry)) return `Unknown industry ${industry}.`;
  if (region !== null && !REGIONS.includes(region)) return `Unknown region ${region}.`;
  if (!Number.isInteger(quantity) || quantity < 1) return 'Choose a whole number of plants, at least one.';
  if (quantity > MAX_INDUSTRY_ORDER) return `At most ${MAX_INDUSTRY_ORDER} plants in one order.`;
  return null;
}

const queueFull = (state: GameState) =>
  state.industry.queue.length >= MAX_INDUSTRY_QUEUE
    ? `At most ${MAX_INDUSTRY_QUEUE} industrial projects can run at once.`
    : null;

function enqueue(
  state: GameState,
  industry: IndustryId,
  region: RegionId,
  owner: PlantOwner,
  quantity: number,
  cost: number,
  days: number,
): GameState {
  return {
    ...state,
    industry: {
      ...state.industry,
      queue: [
        ...state.industry.queue,
        {
          id: `ind-${state.nextId}`,
          industry,
          region,
          owner,
          quantity,
          cost,
          startedTick: state.clock.tick,
          endsTick: state.clock.tick + days,
        },
      ],
    },
    nextId: state.nextId + 1,
  };
}

/** Why state plants cannot be ordered now, or null. */
export function validateIndustry(
  state: GameState,
  industry: IndustryId,
  region: RegionId,
  quantity: number,
): string | null {
  return (
    validateTarget(industry, region, quantity) ??
    queueFull(state) ??
    (state.nation.treasury < industryCost(industry, quantity) ? 'The treasury cannot cover this project.' : null)
  );
}

/** Pays for state plants up front; they start producing when the order completes. */
export function startIndustry(state: GameState, industry: IndustryId, region: RegionId, quantity: number): GameState {
  const cost = industryCost(industry, quantity);
  const days = INDUSTRY_CONTENT[industry].buildDays;
  const paid = { ...state, nation: { ...state.nation, treasury: state.nation.treasury - cost } };
  return appendLog(enqueue(paid, industry, region, 'state', quantity, cost, days), {
    severity: 'info',
    title: `Industrial project begins in ${placeName(state, region)}`,
    body: `Work starts on ${quantity} × ${plantName(industry)} for ₹${groupIndian(cost)} crore. ${days <= 60 ? 'Production starts in a few weeks.' : `Production starts in about ${Math.round(days / 30)} months.`}`,
  });
}

/**
 * Why a private plant cannot be licensed now, or null. An investor must exist: the plant has to make a profit at
 * today's prices, the business climate has to be good enough, and only a couple of licensed plants are built at once.
 */
export function validateLicence(state: GameState, industry: IndustryId, region: RegionId): string | null {
  const problem = validateTarget(industry, region, 1) ?? queueFull(state);
  if (problem) return problem;
  if (state.industry.queue.filter((o) => o.owner === 'private').length >= MAX_LICENCES) {
    return `Investors are already building ${MAX_LICENCES} licensed plants; wait for one to open.`;
  }
  if (businessClimate(state).total < LICENCE_MIN_CLIMATE)
    return 'The business climate is too poor to attract an investor.';
  if (plantProfit(state, industry) <= 0) return 'No investor wants a plant that loses money at today’s prices.';
  return null;
}

/** Licenses an investor to build a private plant: the fee goes to the treasury, the plant opens after a short build. */
export function licencePlant(state: GameState, industry: IndustryId, region: RegionId): GameState {
  const fee = INDUSTRY_CONTENT[industry].licenceFee;
  const paid = { ...state, nation: { ...state.nation, treasury: state.nation.treasury + fee } };
  return appendLog(enqueue(paid, industry, region, 'private', 1, 0, LICENCE_DAYS), {
    severity: 'good',
    title: `Licence granted in ${placeName(state, region)}`,
    body: `An investor pays ₹${groupIndian(fee)} crore for a licence to build a ${plantName(industry)}. It should open in about ${Math.round(LICENCE_DAYS / 30)} months and pay corporate tax on its profits.`,
  });
}

export function validateCancelIndustry(state: GameState, orderId: string): string | null {
  const order = state.industry.queue.find((o) => o.id === orderId);
  if (!order) return 'That project has already finished.';
  return order.owner === 'private' ? 'A licensed plant is the investor’s to build; it cannot be cancelled.' : null;
}

/** Stops a state project and refunds part of its price. */
export function cancelIndustry(state: GameState, orderId: string): GameState {
  const order = state.industry.queue.find((o) => o.id === orderId);
  if (!order) return state;
  const refund = Math.round(order.cost * INDUSTRY_CANCEL_REFUND);
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury + refund },
      industry: { ...state.industry, queue: state.industry.queue.filter((o) => o.id !== orderId) },
    },
    {
      severity: 'warning',
      title: 'Industrial project cancelled',
      body: `Work on ${order.quantity} × ${plantName(order.industry)} in ${placeName(state, order.region)} stops. ₹${groupIndian(refund)} crore of the ₹${groupIndian(order.cost)} crore comes back.`,
    },
  );
}

/** Why state plants cannot be closed, or null. Private plants close only on their owners' decision. */
/** Which regions lose the plants: the chosen one, or for all of India where there are most (null if too few). */
const closeShares = (state: GameState, industry: IndustryId, region: RegionId | null, quantity: number) =>
  region === null
    ? splitCloseIndustry(state, industry, quantity)
    : state.industry.plants[region][industry].state < quantity
      ? null
      : [{ region, quantity }];

export function validateCloseIndustry(
  state: GameState,
  industry: IndustryId,
  region: RegionId | null,
  quantity: number,
): string | null {
  const problem = validateTarget(industry, region, quantity);
  if (problem) return problem;
  return closeShares(state, industry, region, quantity) ? null : 'There are not that many state plants to close.';
}

export function closeIndustry(
  state: GameState,
  industry: IndustryId,
  region: RegionId | null,
  quantity: number,
): GameState {
  const closed = (closeShares(state, industry, region, quantity) ?? []).reduce(
    (next, s) => changePlants(next, industry, s.region, 'state', -s.quantity),
    state,
  );
  return appendLog(closed, {
    severity: 'warning',
    title: `State plants closed in ${placeName(state, region)}`,
    body: `${quantity} × ${plantName(industry)} shut down. Their running costs stop, and so do their output and jobs.`,
  });
}

/** Adds (or removes) plants of one owner in a region. */
export function changePlants(
  state: GameState,
  industry: IndustryId,
  region: RegionId,
  owner: PlantOwner,
  delta: number,
): GameState {
  const plants = state.industry.plants;
  const here = plants[region][industry];
  return {
    ...state,
    industry: {
      ...state.industry,
      plants: { ...plants, [region]: { ...plants[region], [industry]: { ...here, [owner]: here[owner] + delta } } },
    },
  };
}

/** Daily: finished projects open, state and licensed private plants alike. */
export function completeIndustry(state: GameState): GameState {
  const done = state.industry.queue.filter((o) => o.endsTick <= state.clock.tick);
  if (done.length === 0) return state;
  let next: GameState = {
    ...state,
    industry: { ...state.industry, queue: state.industry.queue.filter((o) => o.endsTick > state.clock.tick) },
  };
  for (const o of done) {
    next = appendLog(changePlants(next, o.industry, o.region, o.owner, o.quantity), {
      severity: 'good',
      title: `${o.owner === 'state' ? 'State' : 'Private'} plant opens in ${placeName(next, o.region)}`,
      body: `${o.quantity} × ${plantName(o.industry)} start production.`,
    });
  }
  return next;
}
