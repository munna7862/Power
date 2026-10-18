import { FACILITY_CONTENT } from '../content/infrastructure';
import { FACILITIES, REGIONS, type FacilityId, type RegionId } from '../content/ids';
import { groupIndian } from '../engine/numberFormat';
import { placeName, splitDemolish, splitFacilities, type Share } from '../national/split';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';
import { CANCEL_REFUND, MAX_BUILD_QUANTITY, MAX_BUILD_QUEUE } from './constants';
import { receive } from '../finance/receipts';

/** ₹ crore to build this many facilities. */
export const buildCost = (facility: FacilityId, quantity: number): number => FACILITY_CONTENT[facility].cost * quantity;

const describe = (facility: FacilityId, quantity: number): string =>
  `${groupIndian(quantity)} × ${FACILITY_CONTENT[facility].name.toLowerCase()}`;

function validateTarget(facility: FacilityId, region: RegionId | null, quantity: number): string | null {
  if (!FACILITIES.includes(facility)) return `Unknown facility ${facility}.`;
  if (region !== null && !REGIONS.includes(region)) return `Unknown region ${region}.`;
  if (!Number.isInteger(quantity) || quantity < 1) return 'Choose a whole number of facilities, at least one.';
  if (quantity > MAX_BUILD_QUANTITY) return `At most ${groupIndian(MAX_BUILD_QUANTITY)} in one order.`;
  return null;
}

/** Why this order cannot be placed now, or null. A null region is an order for all of India. */
export function validateBuild(
  state: GameState,
  facility: FacilityId,
  region: RegionId | null,
  quantity: number,
): string | null {
  const problem = validateTarget(facility, region, quantity);
  if (problem) return problem;
  if (state.infrastructure.queue.length >= MAX_BUILD_QUEUE) {
    return `At most ${MAX_BUILD_QUEUE} building projects can run at once.`;
  }
  if (state.nation.treasury < buildCost(facility, quantity)) return 'The treasury cannot cover this project.';
  return null;
}

/**
 * Pays for the facilities up front; they open when the order completes. An order for all of India (null region) opens
 * where coverage is thinnest on the day it completes.
 */
export function startBuild(
  state: GameState,
  facility: FacilityId,
  region: RegionId | null,
  quantity: number,
): GameState {
  const cost = buildCost(facility, quantity);
  const days = FACILITY_CONTENT[facility].buildDays;
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury - cost },
      infrastructure: {
        ...state.infrastructure,
        queue: [
          ...state.infrastructure.queue,
          {
            id: `build-${state.nextId}`,
            facility,
            region,
            quantity,
            cost,
            startedTick: state.clock.tick,
            endsTick: state.clock.tick + days,
          },
        ],
      },
      nextId: state.nextId + 1,
    },
    {
      severity: 'info',
      title: `Construction begins in ${placeName(state, region)}`,
      body: `Work starts on ${describe(facility, quantity)} for ₹${groupIndian(cost)} crore. ${days <= 28 ? 'They open in a few weeks.' : `They open in about ${Math.round(days / 30)} months.`}`,
    },
  );
}

export function validateCancelBuild(state: GameState, orderId: string): string | null {
  return state.infrastructure.queue.some((o) => o.id === orderId) ? null : 'That project has already finished.';
}

/** Stops a project and refunds part of its price. */
export function cancelBuild(state: GameState, orderId: string): GameState {
  const order = state.infrastructure.queue.find((o) => o.id === orderId);
  if (!order) return state;
  const refund = Math.round(order.cost * CANCEL_REFUND);
  return appendLog(
    {
      ...receive(state, 'refunds', refund),
      infrastructure: {
        ...state.infrastructure,
        queue: state.infrastructure.queue.filter((o) => o.id !== orderId),
      },
    },
    {
      severity: 'warning',
      title: 'Construction cancelled',
      body: `Work on ${describe(order.facility, order.quantity)} in ${placeName(state, order.region)} stops. ₹${groupIndian(refund)} crore of the ₹${groupIndian(order.cost)} crore comes back; the rest is already spent.`,
    },
  );
}

/** Which regions lose the facilities: the chosen one, or for all of India where coverage is best (null if too few). */
const demolishShares = (state: GameState, facility: FacilityId, region: RegionId | null, quantity: number) =>
  region === null
    ? splitDemolish(state, facility, quantity)
    : state.infrastructure.counts[region][facility] < quantity
      ? null
      : [{ region, quantity }];

/** Why these facilities cannot be demolished, or null. */
export function validateDemolish(
  state: GameState,
  facility: FacilityId,
  region: RegionId | null,
  quantity: number,
): string | null {
  const problem = validateTarget(facility, region, quantity);
  if (problem) return problem;
  if (!demolishShares(state, facility, region, quantity)) return 'There are not that many to demolish.';
  return null;
}

const addFacilities = (
  counts: GameState['infrastructure']['counts'],
  facility: FacilityId,
  shares: readonly Share[],
  sign: 1 | -1,
) =>
  shares.reduce(
    (c, s) => ({ ...c, [s.region]: { ...c[s.region], [facility]: c[s.region][facility] + sign * s.quantity } }),
    counts,
  );

/** Closes facilities to save their upkeep. Nothing is refunded. */
export function demolish(state: GameState, facility: FacilityId, region: RegionId | null, quantity: number): GameState {
  const shares = demolishShares(state, facility, region, quantity) ?? [];
  return appendLog(
    {
      ...state,
      infrastructure: {
        ...state.infrastructure,
        counts: addFacilities(state.infrastructure.counts, facility, shares, -1),
      },
    },
    {
      severity: 'warning',
      title: `Facilities closed in ${placeName(state, region)}`,
      body: `${describe(facility, quantity)} close their doors. Their running costs stop, and so does the service they gave.`,
    },
  );
}

/** Daily: finished projects open. */
export function completeBuilds(state: GameState): GameState {
  const done = state.infrastructure.queue.filter((o) => o.endsTick <= state.clock.tick);
  if (done.length === 0) return state;
  // Orders open one after another, so a national order sees what the orders before it added.
  let next: GameState = state;
  for (const o of done) {
    const shares =
      o.region === null ? splitFacilities(next, o.facility, o.quantity) : [{ region: o.region, quantity: o.quantity }];
    next = {
      ...next,
      infrastructure: {
        ...next.infrastructure,
        counts: addFacilities(next.infrastructure.counts, o.facility, shares, 1),
      },
    };
  }
  next = {
    ...next,
    infrastructure: {
      ...next.infrastructure,
      queue: state.infrastructure.queue.filter((o) => o.endsTick > state.clock.tick),
    },
  };
  for (const o of done) {
    next = appendLog(next, {
      severity: 'good',
      title: `Opened in ${placeName(state, o.region)}`,
      body: `${describe(o.facility, o.quantity)} open to the public.`,
    });
  }
  return next;
}
