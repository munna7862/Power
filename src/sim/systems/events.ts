import { EVENT_CONTENT } from '../content/events';
import type { System } from '../engine/system';
import { defaultChoice, fireEvent, resolvePending, rollDailyEvent } from '../events/engine';

/**
 * Daily event pipeline: undecided decisions fall back to their default choice, scheduled follow-ups
 * arrive, and then each event rolls its chance of happening today.
 */
export const eventsSystem: System = {
  id: 'events',
  cadence: 'daily',
  run(state, { rng }) {
    if (state.status.kind === 'over') return state;
    const now = state.clock.tick;
    let next = state;

    for (const pending of state.events.pending.filter((p) => p.expiresTick <= now)) {
      const def = EVENT_CONTENT[pending.eventId];
      const choice = def ? defaultChoice(def) : null;
      next = choice
        ? resolvePending(next, pending, choice, rng, true)
        : { ...next, events: { ...next.events, pending: next.events.pending.filter((p) => p.id !== pending.id) } };
    }

    const due = next.events.scheduled.filter((s) => s.dueTick <= now);
    if (due.length > 0) {
      next = { ...next, events: { ...next.events, scheduled: next.events.scheduled.filter((s) => s.dueTick > now) } };
      for (const item of due) {
        const def = EVENT_CONTENT[item.eventId];
        if (def) next = fireEvent(next, def, item.region, null, rng);
      }
    }

    return rollDailyEvent(next, rng);
  },
};
