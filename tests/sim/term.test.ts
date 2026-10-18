import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  declarationChance,
  DIFFICULTIES,
  DIFFICULTY_RULES,
  dispatch,
  EVENT_CONTENT,
  EVENT_LIST,
  impeachmentThreshold,
  isRiotEvent,
  MAX_REPEATS,
  NO_RIOTS_UNREST_CAP,
  recentFires,
  REPEAT_WINDOW_DAYS,
  RIOT_TRIGGER,
  RIOT_UNREST,
  rulesFor,
  TUTORIAL_EVENT,
  TUTORIAL_EVENT_DAY,
  TUTORIAL_QUIET_DAYS,
  unrestTrigger,
  type GameState,
} from '../../src/sim';
import { Rng } from '../../src/sim/engine/rng';
import { rollDailyEvent } from '../../src/sim/events/engine';
import { applyEffect } from '../../src/sim/events/effects';
import { SYSTEMS } from '../../src/sim/systems';
import { termSystem, voterFatigue, ELECTION_SWING } from '../../src/sim/systems/term';
import { deepFreeze, newGame } from '../helpers';

/** The state on the morning of election day (1 January after five years), with a chosen approval. */
function electionEve(approval: number, overrides: Parameters<typeof newGame>[0] = {}): GameState {
  const state = newGame(overrides);
  return {
    ...state,
    clock: { tick: 1826, date: { year: 2031, month: 1, day: 1 } },
    nation: { ...state.nation, approval },
  };
}

const runTerm = (state: GameState) => termSystem.run(state, { rng: new Rng(state.rng) });

describe('election day (F20 term victory)', () => {
  it('re-elects a President whose approval clears the bar even after the worst campaign', () => {
    const state = runTerm(electionEve(55 + ELECTION_SWING));
    expect(state.status).toMatchObject({ kind: 'over', cause: 'reelected', title: 'Re-elected' });
  });

  it('votes out a President who falls short even after the best campaign', () => {
    const state = runTerm(electionEve(55 - ELECTION_SWING - 0.1));
    expect(state.status).toMatchObject({ kind: 'over', cause: 'votedOut' });
    if (state.status.kind === 'over') expect(state.status.summary).toMatch(/55% needed/);
  });

  it('holds the election on 1 January after five years of real play, and never before', () => {
    const before = electionEve(70);
    expect(runTerm({ ...before, clock: { tick: 1461, date: { year: 2030, month: 1, day: 1 } } }).status.kind).toBe(
      'playing',
    );
    expect(runTerm(before).status.kind).toBe('over');
  });

  it('lets a re-elected President stay on in endless mode, with no further elections', () => {
    const won = runTerm(electionEve(80));
    expect(dispatch(electionEve(80), { type: 'CONTINUE_IN_OFFICE' }).ok).toBe(false);
    const result = dispatch(won, { type: 'CONTINUE_IN_OFFICE' });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.status.kind).toBe('playing');
    expect(result.state.meta.endless).toBe(true);
    expect(runTerm(result.state).status.kind).toBe('playing');
    const lost = runTerm(electionEve(20));
    expect(dispatch(lost, { type: 'CONTINUE_IN_OFFICE' }).ok).toBe(false);
  });

  it('is deterministic and does not mutate its input', () => {
    const eve = deepFreeze(electionEve(55));
    expect(runTerm(eve)).toEqual(runTerm(electionEve(55)));
  });
});

describe('voter fatigue', () => {
  it('grows each year after the first, up to four years, and is a modifier the "Why?" tooltip shows', () => {
    let state = newGame();
    const fatigue = () => state.modifiers.filter((m) => m.source === 'fatigue');
    state = advanceDays(state, 366); // 2 Jan 2027: one year in office, no fatigue yet
    expect(fatigue()).toHaveLength(0);
    state = { ...state, meta: { ...state.meta, endless: true } };
    for (let year = 2028; year <= 2033; year++) {
      state = runTerm({ ...state, clock: { ...state.clock, date: { year, month: 1, day: 1 } } });
      expect(fatigue()).toHaveLength(1);
      expect(fatigue()[0]?.value).toBe(-DIFFICULTY_RULES.normal.voterFatigue * Math.min(4, year - 2027));
    }
    expect(state.log.filter((e) => e.title === 'The honeymoon is over')).toHaveLength(1);
  });

  it('is gentler on Easy than on Normal', () => {
    const at = (difficulty: 'easy' | 'normal') =>
      voterFatigue({ ...newGame({ difficulty }), clock: { tick: 1461, date: { year: 2030, month: 1, day: 1 } } });
    expect(at('easy')).toBeGreaterThan(at('normal'));
  });
});

describe('difficulty', () => {
  it('keeps every difficulty rule in one table, ordered from Easy to Hard', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((d) => DIFFICULTY_RULES[d]);
    expect(easy!.treasury).toBeGreaterThan(normal!.treasury);
    expect(normal!.treasury).toBeGreaterThan(hard!.treasury);
    expect(easy!.eventFrequency).toBeLessThan(hard!.eventFrequency);
    expect(easy!.warChance).toBeLessThan(hard!.warChance);
    expect(easy!.voterFatigue).toBeLessThan(normal!.voterFatigue);
    expect(easy!.impeachmentThreshold).toBeLessThan(hard!.impeachmentThreshold);
    expect(impeachmentThreshold(newGame({ difficulty: 'hard' }))).toBe(hard!.impeachmentThreshold);
    expect(rulesFor(newGame({ difficulty: 'easy' }))).toBe(easy);
  });

  it('makes rivals more likely to attack on Hard', () => {
    // Without the approval and leadership systems, so a hands-off game cannot end before the rivals' grace period.
    const survives = SYSTEMS.filter((s) => s.id !== 'approval' && s.id !== 'leadership');
    const hostile = (difficulty: 'easy' | 'hard') => {
      const s = advanceDays(newGame({ difficulty, options: { noRiots: true } }), 400, survives);
      const countries = { ...s.diplomacy.countries, PAK: { ...s.diplomacy.countries.PAK!, relation: -90 } };
      return declarationChance({ ...s, diplomacy: { ...s.diplomacy, countries } }, 'PAK');
    };
    expect(hostile('hard')).toBeGreaterThan(hostile('easy'));
  });
});

describe('New Game options', () => {
  it('"no wars": no rival can declare war and India cannot either', () => {
    // Without the approval and leadership systems, so a hands-off game is still running after 400 days.
    const survives = SYSTEMS.filter((x) => x.id !== 'approval' && x.id !== 'leadership');
    const s = advanceDays(newGame({ options: { noWars: true } }), 400, survives);
    const countries = { ...s.diplomacy.countries, PAK: { ...s.diplomacy.countries.PAK!, relation: -100 } };
    const hostile = { ...s, diplomacy: { ...s.diplomacy, countries }, military: { ...s.military, deterrence: 0 } };
    expect(declarationChance(hostile, 'PAK')).toBe(0);
    const declared = dispatch(hostile, { type: 'DECLARE_WAR', rival: 'LKA' });
    expect(declared.ok).toBe(false);
    if (!declared.ok) expect(declared.error).toMatch(/switched off/);
  });

  it('"no riots": unrest is held below every riot trigger, by the monthly drift and by event effects', () => {
    const s = newGame({ options: { noRiots: true } });
    const unrest = Object.fromEntries(Object.entries(s.security.unrest).map(([r]) => [r, 95]));
    const boiling = { ...s, security: { ...s.security, unrest: unrest as GameState['security']['unrest'] } };
    const next = advanceDays(boiling, 1);
    expect(Math.max(...Object.values(next.security.unrest))).toBeLessThanOrEqual(NO_RIOTS_UNREST_CAP);
    const pushed = applyEffect(
      next,
      { type: 'unrest', delta: 40, where: 'all' },
      { rng: new Rng(next.rng), region: null, ref: null, label: 'test' },
    );
    expect(Math.max(...Object.values(pushed.security.unrest))).toBeLessThanOrEqual(NO_RIOTS_UNREST_CAP);
    // Without the option the same push goes past the riot level.
    const normal = applyEffect(
      { ...boiling, meta: { ...boiling.meta, options: { ...boiling.meta.options, noRiots: false } } },
      { type: 'unrest', delta: 5, where: 'all' },
      { rng: new Rng(s.rng), region: null, ref: null, label: 'test' },
    );
    expect(Math.max(...Object.values(normal.security.unrest))).toBeGreaterThan(RIOT_UNREST);
  });

  it('every riot event needs more unrest than the "no riots" cap allows', () => {
    expect(NO_RIOTS_UNREST_CAP).toBeLessThan(RIOT_TRIGGER);
    expect(RIOT_TRIGGER).toBeLessThanOrEqual(RIOT_UNREST);
    const riots = EVENT_LIST.filter(isRiotEvent).map((e) => e.id);
    expect(riots).toEqual(expect.arrayContaining(['riot-economic', 'riot-law-order', 'unrest-spreading']));
    expect(
      unrestTrigger({
        any: [
          { stat: 'inflation', op: '>', value: 7 },
          { stat: 'regionUnrest', op: '>', value: 70 },
        ],
      }),
    ).toBeNull();
    expect(
      unrestTrigger({
        all: [
          { stat: 'month', op: '>', value: 3 },
          { stat: 'maxUnrest', op: '>=', value: 61 },
        ],
      }),
    ).toBe(61);
  });

  it('"tutorial": schedules the practice decision for the first week, and only then', () => {
    const tutorial = newGame({ options: { tutorial: true } });
    expect(tutorial.events.scheduled).toEqual([{ eventId: TUTORIAL_EVENT, dueTick: TUTORIAL_EVENT_DAY, region: null }]);
    expect(newGame().events.scheduled).toEqual([]);
    expect(EVENT_CONTENT[TUTORIAL_EVENT]?.weight).toBe(0);
    const arrived = advanceDays(tutorial, TUTORIAL_EVENT_DAY);
    expect(arrived.events.pending.some((p) => p.eventId === TUTORIAL_EVENT)).toBe(true);
    expect(arrived.meta.options).toEqual({ noWars: false, noRiots: false, tutorial: true });
  });

  it('"tutorial": keeps the first week free of random events, whatever the dice say', () => {
    const certain = (s: GameState) =>
      ({ next: () => 0, range: () => 0, int: () => 0, chance: () => true, state: s.rng }) as unknown as Rng;
    const tutorial = newGame({ options: { tutorial: true } });
    expect(rollDailyEvent(tutorial, certain(tutorial)).events.pending).toHaveLength(0);
    const later = { ...tutorial, clock: { ...tutorial.clock, tick: TUTORIAL_QUIET_DAYS } };
    expect(rollDailyEvent(later, certain(later)).log.length).toBeGreaterThan(later.log.length);
    const plain = newGame();
    expect(rollDailyEvent(plain, certain(plain)).log.length).toBeGreaterThan(plain.log.length);
  });
});

describe('event repetition', () => {
  /** An RNG whose every roll succeeds, so the first eligible event in the list always fires. */
  const certain = (state: GameState) =>
    ({ next: () => 0, range: () => 0, int: () => 0, chance: () => true, state: state.rng }) as unknown as Rng;

  it(`holds back a random event once it has fired ${MAX_REPEATS} times in five years, even on a certain roll`, () => {
    const base = advanceDays(newGame(), 30);
    const random = EVENT_LIST.filter((e) => e.weight > 0);
    const exhausted = Object.fromEntries(random.map((e) => [e.id, [10, 20]]));
    const blocked = { ...base, events: { ...base.events, fired: exhausted } };
    expect(rollDailyEvent(blocked, certain(blocked)).events).toEqual(blocked.events);

    // Free one event: it is the only one that can fire, and its fire is recorded.
    const free = random.find((e) => e.scope === 'national' && e.conditions.length === 0 && !e.countryPick)!;
    const one = { ...blocked, events: { ...blocked.events, fired: { ...exhausted, [free.id]: [10] } } };
    const fired = rollDailyEvent(one, certain(one));
    expect(fired.log.length + fired.events.pending.length).toBeGreaterThan(one.log.length + one.events.pending.length);
    expect(recentFires(fired, free.id)).toEqual([10, base.clock.tick]);
  });

  it('forgets fires older than five years', () => {
    const state = newGame();
    const old = { ...state, events: { ...state.events, fired: { 'global-slowdown': [5, 400] } } };
    expect(recentFires(old, 'global-slowdown')).toEqual([5, 400]);
    const later = { ...old, clock: { ...old.clock, tick: REPEAT_WINDOW_DAYS + 5 } };
    expect(recentFires(later, 'global-slowdown')).toEqual([400]);
  });
});
