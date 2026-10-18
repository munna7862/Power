import { PLANT_CONTENT } from '../content/power';
import { PLANTS, REGION_LABELS, REGIONS, type PlantId, type RegionId } from '../content/ids';
import { groupIndian } from '../engine/numberFormat';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';
import { MAX_PLANT_ORDER, MAX_PLANT_QUEUE, PLANT_CANCEL_REFUND } from './constants';
import { plantOutput } from './grid';

/** ₹ crore to build this many plants. */
export const plantCost = (plant: PlantId, quantity: number): number => PLANT_CONTENT[plant].cost * quantity;

const describe = (plant: PlantId, quantity: number): string =>
  `${quantity} × ${PLANT_CONTENT[plant].name.toLowerCase()}`;

function validateTarget(plant: PlantId, region: RegionId, quantity: number): string | null {
  if (!PLANTS.includes(plant)) return `Unknown power plant ${plant}.`;
  if (!REGIONS.includes(region)) return `Unknown region ${region}.`;
  if (!Number.isInteger(quantity) || quantity < 1) return 'Choose a whole number of plants, at least one.';
  if (quantity > MAX_PLANT_ORDER) return `At most ${MAX_PLANT_ORDER} plants in one order.`;
  return null;
}

/** Why this order cannot be placed now, or null. */
export function validatePlant(state: GameState, plant: PlantId, region: RegionId, quantity: number): string | null {
  const problem = validateTarget(plant, region, quantity);
  if (problem) return problem;
  if (state.energy.queue.length >= MAX_PLANT_QUEUE) return `At most ${MAX_PLANT_QUEUE} power projects can run at once.`;
  if (state.nation.treasury < plantCost(plant, quantity)) return 'The treasury cannot cover this project.';
  return null;
}

/** Pays for the plants up front; they start generating when the order completes. */
export function startPlant(state: GameState, plant: PlantId, region: RegionId, quantity: number): GameState {
  const cost = plantCost(plant, quantity);
  const days = PLANT_CONTENT[plant].buildDays;
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury - cost },
      energy: {
        ...state.energy,
        queue: [
          ...state.energy.queue,
          {
            id: `plant-${state.nextId}`,
            plant,
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
      title: `Power project begins in the ${REGION_LABELS[region]}`,
      body: `Work starts on ${describe(plant, quantity)} for ₹${groupIndian(cost)} crore, adding ${(quantity * plantOutput(plant)).toFixed(1)} GW on average. ${days <= 30 ? 'It connects to the grid in a few weeks.' : `It connects in about ${Math.round(days / 30)} months.`}`,
    },
  );
}

export function validateCancelPlant(state: GameState, orderId: string): string | null {
  return state.energy.queue.some((o) => o.id === orderId) ? null : 'That project has already finished.';
}

/** Stops a power project and refunds part of its price. */
export function cancelPlant(state: GameState, orderId: string): GameState {
  const order = state.energy.queue.find((o) => o.id === orderId);
  if (!order) return state;
  const refund = Math.round(order.cost * PLANT_CANCEL_REFUND);
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury + refund },
      energy: { ...state.energy, queue: state.energy.queue.filter((o) => o.id !== orderId) },
    },
    {
      severity: 'warning',
      title: 'Power project cancelled',
      body: `Work on ${describe(order.plant, order.quantity)} in the ${REGION_LABELS[order.region]} stops. ₹${groupIndian(refund)} crore of the ₹${groupIndian(order.cost)} crore comes back.`,
    },
  );
}

export function validateDecommission(
  state: GameState,
  plant: PlantId,
  region: RegionId,
  quantity: number,
): string | null {
  const problem = validateTarget(plant, region, quantity);
  if (problem) return problem;
  if (state.energy.plants[region][plant] < quantity) return 'There are not that many plants to close.';
  return null;
}

/** Closes plants to save their running and fuel costs (and, for coal and gas, their emissions). */
export function decommission(state: GameState, plant: PlantId, region: RegionId, quantity: number): GameState {
  const plants = state.energy.plants;
  return appendLog(
    {
      ...state,
      energy: {
        ...state.energy,
        plants: { ...plants, [region]: { ...plants[region], [plant]: plants[region][plant] - quantity } },
      },
    },
    {
      severity: 'warning',
      title: `Power plants closed in the ${REGION_LABELS[region]}`,
      body: `${describe(plant, quantity)} shut down. Their running costs stop, and so does ${(quantity * plantOutput(plant)).toFixed(1)} GW of supply.`,
    },
  );
}

/** Daily: finished power projects connect to the grid. */
export function completePlants(state: GameState): GameState {
  const done = state.energy.queue.filter((o) => o.endsTick <= state.clock.tick);
  if (done.length === 0) return state;
  let plants = state.energy.plants;
  for (const o of done) {
    plants = { ...plants, [o.region]: { ...plants[o.region], [o.plant]: plants[o.region][o.plant] + o.quantity } };
  }
  let next: GameState = {
    ...state,
    energy: { plants, queue: state.energy.queue.filter((o) => o.endsTick > state.clock.tick) },
  };
  for (const o of done) {
    next = appendLog(next, {
      severity: 'good',
      title: `Connected to the grid in the ${REGION_LABELS[o.region]}`,
      body: `${describe(o.plant, o.quantity)} now generate ${(o.quantity * plantOutput(o.plant)).toFixed(1)} GW on average.`,
    });
  }
  return next;
}
