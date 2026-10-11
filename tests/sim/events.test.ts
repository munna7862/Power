import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  advanceUntilAttention,
  dispatch,
  EVENT_CATEGORIES,
  EVENT_CONTENT,
  EVENT_LIST,
  MAX_PENDING,
  pendingView,
  statValue,
  STAT_IDS,
  tick,
  type GameState,
} from '../../src/sim';
import { fireEvent, conditionsHold, rollDailyEvent } from '../../src/sim/events/engine';
import { Rng } from '../../src/sim/engine/rng';
import { deepFreeze, newGame } from '../helpers';

const fire = (state: GameState, id: string, region: 'east' | null = null, ref: string | null = null) =>
  fireEvent(state, EVENT_CONTENT[id]!, region, ref, new Rng(state.rng));

describe('event content', () => {
  it('has at least 90 events across every category', () => {
    expect(EVENT_LIST.length).toBeGreaterThanOrEqual(90);
    for (const category of EVENT_CATEGORIES) {
      expect(EVENT_LIST.some((e) => e.category === category)).toBe(true);
    }
  });

  it('has unique ids, valid follow-ups and the events the systems rely on', () => {
    expect(new Set(EVENT_LIST.map((e) => e.id)).size).toBe(EVENT_LIST.length);
    expect(EVENT_CONTENT['terror-warning']).toBeDefined();
    expect(EVENT_CONTENT['terror-aftermath']).toBeDefined();
    expect(EVENT_CONTENT['disaster-reconstruction']?.weight).toBe(0);
  });

  it('never frames unrest or terror by religion or caste, or names real organisations', () => {
    const banned =
      /\b(hindu|muslim|islam|christian|sikh|buddhist|jain|caste|dalit|brahmin|bjp|congress|rss|isis|al-qaeda|lashkar|naxal|ndrf|cag)\b/i;
    for (const e of EVENT_LIST) {
      const text = JSON.stringify(e);
      expect(text, e.id).not.toMatch(banned);
    }
  });

  it('gives every decision exactly one default and cheap, readable choices', () => {
    for (const e of EVENT_LIST.filter((x) => x.choices.length > 0)) {
      expect(
        e.choices.filter((c) => c.default),
        e.id,
      ).toHaveLength(1);
      expect(e.choices.length, e.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('conditions', () => {
  it('evaluates stats in percent units and per-ministry efficiency', () => {
    const state = newGame();
    expect(statValue(state, 'unemployment', null)).toBeCloseTo(7.8);
    expect(statValue(state, 'efficiency.home', null)).toBeGreaterThan(0.5);
    expect(statValue(state, 'regionUnrest', 'east')).toBe(state.security.unrest.east);
    expect(statValue(state, 'regionUnrest', null)).toBe(0);
    for (const stat of STAT_IDS) expect(Number.isFinite(statValue(state, stat, 'east')), stat).toBe(true);
  });

  it('supports all/any nesting and comparators', () => {
    const state = newGame();
    const def = { ...EVENT_CONTENT['minister-scandal']! };
    const holds = (conditions: unknown[]) => conditionsHold(state, { ...def, conditions } as never, null);
    expect(holds([{ stat: 'month', op: '==', value: 1 }])).toBe(true);
    expect(holds([{ stat: 'month', op: '!=', value: 1 }])).toBe(false);
    expect(
      holds([
        {
          any: [
            { stat: 'month', op: '>', value: 5 },
            { stat: 'month', op: '<=', value: 1 },
          ],
        },
      ]),
    ).toBe(true);
    expect(
      holds([
        {
          all: [
            { stat: 'month', op: '>=', value: 1 },
            { stat: 'month', op: '<', value: 1 },
          ],
        },
      ]),
    ).toBe(false);
  });
});

describe('event engine', () => {
  it('raises a decision, logs it and pauses nothing until it expires', () => {
    const state = fire(newGame(), 'global-slowdown');
    expect(state.events.pending).toHaveLength(1);
    expect(state.log.at(-1)).toMatchObject({ category: 'economy', pendingId: state.events.pending[0]!.id });
    const view = pendingView(state, state.events.pending[0]!);
    expect(view?.choices.map((c) => c.choice.id)).toEqual(['stimulus', 'austerity', 'wait']);
    expect(view?.daysLeft).toBe(30);
  });

  it('applies informational events immediately as modifiers', () => {
    const state = fire(newGame(), 'bumper-harvest');
    expect(state.events.pending).toHaveLength(0);
    expect(state.modifiers.some((m) => m.label === 'Bumper harvest')).toBe(true);
  });

  it('resolves a choice: pays the cost, applies effects, schedules a follow-up and rejects bad input', () => {
    const base = fire(newGame(), 'flood-river', 'east');
    const pending = base.events.pending[0]!;
    const treasury = base.nation.treasury;
    expect(dispatch(base, { type: 'RESOLVE_EVENT', pendingId: 'nope', choiceId: 'agency' }).ok).toBe(false);
    expect(dispatch(base, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: 'nope' }).ok).toBe(false);
    let result = dispatch(base, { type: 'RESOLVE_EVENT', pendingId: pending.id, choiceId: 'relief' });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.events.pending).toHaveLength(0);
    expect(result.state.nation.treasury).toBeLessThan(treasury);
    expect(result.state.events.scheduled[0]?.eventId).toBe('disaster-reconstruction');
    const state = advanceDays(result.state, 21);
    expect(state.events.pending.some((p) => p.eventId === 'disaster-reconstruction')).toBe(true);
    result = dispatch(
      { ...result.state, status: { kind: 'over', cause: 'coup', date: base.clock.date, title: '', summary: '' } },
      {
        type: 'RESOLVE_EVENT',
        pendingId: pending.id,
        choiceId: 'relief',
      },
    );
    expect(result.ok).toBe(false);
  });

  it('a well-run disaster ministry softens the damage', () => {
    const weak = newGame();
    const strong = {
      ...weak,
      budget: {
        ...weak.budget,
        allocations: { ...weak.budget.allocations, disaster: weak.budget.allocations.disaster * 3 },
      },
    };
    const damage = (s: GameState) => {
      const f = fire(s, 'flood-river', 'east');
      const r = dispatch(f, { type: 'RESOLVE_EVENT', pendingId: f.events.pending[0]!.id, choiceId: 'nothing' });
      if (!r.ok) throw new Error(r.error);
      return r.state.security.unrest.east - s.security.unrest.east;
    };
    expect(damage(strong)).toBeLessThan(damage(weak));
  });

  it('applies the default choice and an indecision penalty when a crisis decision lapses', () => {
    const raised = fire(newGame(), 'flood-river', 'east');
    const later = advanceDays(raised, 12, []);
    expect(later.events.pending).toHaveLength(1); // no systems ran
    const lapsed = advanceDays(raised, 12);
    expect(lapsed.events.pending.some((p) => p.eventId === 'flood-river')).toBe(false);
    expect(lapsed.modifiers.some((m) => m.source === 'indecision')).toBe(true);
    expect(lapsed.log.some((e) => e.title.endsWith(': no decision'))).toBe(true);
  });

  it('drops decisions whose content no longer exists', () => {
    const state = newGame();
    const stale = {
      ...state,
      events: {
        ...state.events,
        pending: [{ id: 'evt-x', eventId: 'gone', region: null, ref: null, raisedTick: 0, expiresTick: 1 }],
      },
    };
    expect(tick(stale).events.pending).toHaveLength(0);
    expect(pendingView(stale, stale.events.pending[0]!)).toBeNull();
  });

  it('respects cooldowns, one event per day, and the cap on waiting decisions', () => {
    const state = newGame();
    const full = {
      ...state,
      events: {
        ...state.events,
        pending: Array.from({ length: MAX_PENDING }, (_, i) => ({
          id: `evt-${i}`,
          eventId: 'global-slowdown',
          region: null,
          ref: null,
          raisedTick: 0,
          expiresTick: 99,
        })),
      },
    };
    // With every event certain to roll, a full inbox still raises nothing new.
    const certain = rollDailyEvent(full, {
      next: () => 0,
      range: () => 0,
      int: () => 0,
      chance: () => true,
      state: full.rng,
    } as unknown as Rng);
    expect(certain.events.pending).toHaveLength(MAX_PENDING);
    const cooling = fire(state, 'global-slowdown');
    expect(cooling.events.cooldowns['global-slowdown']).toBe(540);
  });

  it('is deterministic and immutable', () => {
    const frozen = deepFreeze(newGame());
    const a = advanceDays(frozen, 400);
    const b = advanceDays(newGame(), 400);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('fires plenty of events over a term, and harder difficulties fire more', () => {
    const count = (difficulty: 'easy' | 'hard') =>
      [1, 2, 3].reduce(
        (n, seed) =>
          n + advanceDays(newGame({ seed, difficulty }), 300).log.filter((e) => e.category !== 'general').length,
        0,
      );
    expect(count('easy')).toBeGreaterThan(10);
    expect(count('hard')).toBeGreaterThan(count('easy'));
  });

  it('advanceUntilAttention stops on a new decision', () => {
    let state = newGame();
    let interrupted = false;
    for (let i = 0; i < 40 && !interrupted; i++) ({ state, interrupted } = advanceUntilAttention(state, 30));
    expect(interrupted).toBe(true);
    expect(
      advanceUntilAttention(
        { ...state, status: { kind: 'over', cause: 'coup', date: state.clock.date, title: '', summary: '' } },
        5,
      ).interrupted,
    ).toBe(false);
  });
});
