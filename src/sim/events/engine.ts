import { EVENT_CONTENT, EVENT_LIST, type Condition, type EventChoice, type EventContent } from '../content/events';
import { REGION_LABELS, REGIONS, type RegionId } from '../content/ids';
import { Rng } from '../engine/rng';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { GameState, PendingEvent } from '../state/types';
import { applyEffects, EVENT_DIFFICULTY } from './effects';
import { statValue } from './stats';

/** Approval cost and duration of letting a crisis decision lapse, by event severity. Voters notice a President who does not act. */
export const INDECISION_PENALTY: Record<string, { value: number; days: number } | undefined> = {
  warning: { value: -2.5, days: 180 },
  critical: { value: -7, days: 180 },
};

/** Most decisions that can wait at once. Further random events are held back until some are settled. */
export const MAX_PENDING = 6;

function compare(op: string, a: number, b: number): boolean {
  switch (op) {
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '==':
      return a === b;
    default:
      return a !== b;
  }
}

export function conditionHolds(state: GameState, condition: Condition, region: RegionId | null): boolean {
  if ('stat' in condition) return compare(condition.op, statValue(state, condition.stat, region), condition.value);
  if ('all' in condition) return condition.all.every((c) => conditionHolds(state, c, region));
  return condition.any.some((c) => conditionHolds(state, c, region));
}

export const conditionsHold = (state: GameState, def: EventContent, region: RegionId | null) =>
  def.conditions.every((c) => conditionHolds(state, c, region));

export interface EventText {
  title: string;
  body: string;
}

/** Fills {region}, {president} and {group} into an event's text. */
export function renderEventText(
  state: GameState,
  def: Pick<EventContent, 'title' | 'body'>,
  region: RegionId | null,
  ref: string | null,
): EventText {
  const group = state.security.plots.find((p) => p.id === ref)?.group ?? 'a militant group';
  const fill = (text: string) =>
    text
      .replaceAll('{region}', region ? REGION_LABELS[region] : 'the country')
      .replaceAll('{president}', state.meta.presidentName)
      .replaceAll('{group}', group);
  return { title: fill(def.title), body: fill(def.body) };
}

/** Raises an event: informational events apply their effects at once; decisions wait in the inbox. */
export function fireEvent(
  state: GameState,
  def: EventContent,
  region: RegionId | null,
  ref: string | null,
  rng: Rng,
): GameState {
  const { title, body } = renderEventText(state, def, region, ref);
  let next: GameState = {
    ...state,
    events: {
      ...state.events,
      cooldowns: { ...state.events.cooldowns, [def.id]: state.clock.tick + def.cooldownDays },
    },
  };

  if (def.choices.length === 0) {
    next = applyEffects(next, def.effects, { rng, region, ref, label: title });
    return appendLog(next, { severity: def.severity, category: def.category, title, body });
  }

  const pending: PendingEvent = {
    id: `evt-${next.nextId}`,
    eventId: def.id,
    region,
    ref,
    raisedTick: next.clock.tick,
    expiresTick: next.clock.tick + def.deadlineDays,
  };
  next = { ...next, events: { ...next.events, pending: [...next.events.pending, pending] }, nextId: next.nextId + 1 };
  return appendLog(next, {
    severity: def.severity,
    category: def.category,
    title,
    body,
    pendingId: pending.id,
  });
}

export function defaultChoice(def: EventContent): EventChoice | null {
  return def.choices.find((c) => c.default) ?? null;
}

/** Applies a choice to a pending decision: pays the cost, applies effects, schedules any follow-up. */
export function resolvePending(
  state: GameState,
  pending: PendingEvent,
  choice: EventChoice,
  rng: Rng,
  automatic: boolean,
): GameState {
  const def = EVENT_CONTENT[pending.eventId] as EventContent;
  const { title } = renderEventText(state, def, pending.region, pending.ref);
  let next: GameState = {
    ...state,
    nation: { ...state.nation, treasury: state.nation.treasury - choice.cost },
    events: { ...state.events, pending: state.events.pending.filter((p) => p.id !== pending.id) },
  };
  next = applyEffects(next, choice.effects, { rng, region: pending.region, ref: pending.ref, label: title });
  const followUp = choice.followUp;
  if (followUp && (followUp.chance >= 1 || rng.chance(followUp.chance))) {
    next = {
      ...next,
      events: {
        ...next.events,
        scheduled: [
          ...next.events.scheduled,
          { eventId: followUp.eventId, dueTick: next.clock.tick + followUp.delayDays, region: pending.region },
        ],
      },
    };
  }
  const penalty = automatic ? INDECISION_PENALTY[def.severity] : undefined;
  if (penalty) {
    next = addTimedModifier(
      next,
      {
        source: 'indecision',
        label: 'Seen as indecisive in a crisis',
        target: 'politics.approvalTarget',
        kind: 'add',
        value: penalty.value,
      },
      penalty.days,
    );
  }
  return appendLog(next, {
    severity: 'info',
    category: def.category,
    title: automatic ? `${title}: no decision` : title,
    body: automatic ? `No decision was made in time. ${choice.outcome}` : choice.outcome,
  });
}

/** Regions an event could happen in right now, with their relative likelihood. */
function regionCandidates(state: GameState, def: EventContent): { region: RegionId; weight: number }[] {
  return REGIONS.flatMap((region) => {
    const weight = def.regionWeights?.[region] ?? 1;
    const busy = state.events.pending.some((p) => p.eventId === def.id && p.region === region);
    return weight > 0 && !busy && conditionsHold(state, def, region) ? [{ region, weight }] : [];
  });
}

/**
 * Rolls today's random event. Every event gets one roll per day (so the random stream never depends on
 * game state); the first success that is eligible fires, at most one per day.
 */
export function rollDailyEvent(state: GameState, rng: Rng): GameState {
  const frequency = EVENT_DIFFICULTY[state.meta.difficulty].frequency;
  const open = state.events.pending.length < MAX_PENDING;
  let fired = false;
  let next = state;
  for (const def of EVENT_LIST) {
    const roll = rng.next();
    if (fired || !open || roll >= (def.weight / 365) * frequency) continue;
    if ((next.events.cooldowns[def.id] ?? 0) > next.clock.tick) continue;

    if (def.scope === 'region') {
      const candidates = regionCandidates(next, def);
      if (candidates.length === 0) continue;
      let pick = rng.next() * candidates.reduce((s, c) => s + c.weight, 0);
      const chosen =
        candidates.find((c) => (pick -= c.weight) < 0) ?? (candidates[candidates.length - 1] as { region: RegionId });
      next = fireEvent(next, def, chosen.region, null, rng);
    } else {
      if (next.events.pending.some((p) => p.eventId === def.id) || !conditionsHold(next, def, null)) continue;
      next = fireEvent(next, def, null, null, rng);
    }
    fired = true;
  }
  return next;
}

/** Raises a specific event now, bypassing conditions and cooldowns. For tests, tools and debug hooks. */
export function raiseEvent(state: GameState, eventId: string, region: RegionId | null = null): GameState {
  const def = EVENT_CONTENT[eventId];
  if (!def) throw new Error(`Unknown event ${eventId}`);
  const rng = new Rng(state.rng);
  const next = fireEvent(state, def, region, null, rng);
  return { ...next, rng: rng.state };
}
