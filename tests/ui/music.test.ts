import { describe, expect, it } from 'vitest';
import { electionYear, IMPEACHMENT_THRESHOLD, REGIONS, RIOT_TRIGGER, startWar, type GameState } from '../../src/sim';
import { composeBar, PHRASE_BARS, STINGERS, stingerNotes, type Note } from '../../src/ui/audio/music/composer';
import { moodFor, monthsToElection, TENSE_APPROVAL_MARGIN } from '../../src/ui/audio/music/mood';
import { MOOD_SPECS, MOODS, stepsPerBar } from '../../src/ui/audio/music/moods';
import { degreeToSemitones, musicRng, SCALES } from '../../src/ui/audio/music/theory';
import { endless, newGame } from '../helpers';

const PITCHED = new Set<Note['instrument']>(['drone', 'pad', 'pluck', 'flute']);

/** Writes a run of bars of one mood, carrying the melody from bar to bar as the player does. */
function compose(mood: (typeof MOODS)[number], bars: number, seed: number, intensity = 0.5): Note[][] {
  const spec = MOOD_SPECS[mood];
  const rng = musicRng(seed);
  let last = spec.range[0];
  return Array.from({ length: bars }, (_, bar) => {
    const written = composeBar(spec, bar, rng, intensity, last);
    last = written.lastDegree;
    return written.notes;
  });
}

const withUnrest = (state: GameState, value: number): GameState => ({
  ...state,
  security: {
    ...state.security,
    unrest: Object.fromEntries(REGIONS.map((r) => [r, value])) as GameState['security']['unrest'],
  },
});

const onDate = (state: GameState, year: number, month: number): GameState => ({
  ...state,
  clock: { ...state.clock, date: { ...state.clock.date, year, month, day: 1 } },
});

describe('the composer', () => {
  it('writes the same music for the same seed, and different music for another', () => {
    expect(compose('governance', 16, 7)).toEqual(compose('governance', 16, 7));
    expect(compose('governance', 16, 7)).not.toEqual(compose('governance', 16, 8));
  });

  it.each(MOODS)('keeps every pitched note of the %s mood in its scale', (mood) => {
    const spec = MOOD_SPECS[mood];
    const scale = SCALES[spec.scale].map((s) => s % 12);
    for (const bar of compose(mood, 32, 3)) {
      for (const note of bar.filter((n) => PITCHED.has(n.instrument))) {
        expect(scale).toContain(((note.semitones % 12) + 12) % 12);
      }
    }
  });

  it.each(MOODS)('keeps the %s mood inside its bar, with sensible lengths and levels', (mood) => {
    const steps = stepsPerBar(MOOD_SPECS[mood]);
    for (const bar of compose(mood, 16, 11, 1)) {
      for (const note of bar) {
        expect(note.step).toBeGreaterThanOrEqual(0);
        expect(note.step).toBeLessThan(steps);
        expect(note.length).toBeGreaterThan(0);
        expect(note.gain).toBeGreaterThan(0);
        expect(note.gain).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the melody in range and ends each phrase on the root', () => {
    const spec = MOOD_SPECS.governance;
    const scale = SCALES[spec.scale];
    const low = degreeToSemitones(scale, spec.range[0]);
    const high = degreeToSemitones(scale, spec.range[1]);
    const bars = compose('governance', PHRASE_BARS * 6, 21);
    bars.forEach((bar, i) => {
      const melody = bar.filter((n) => n.instrument === 'pluck' || n.instrument === 'flute');
      for (const n of melody) {
        expect(n.semitones).toBeGreaterThanOrEqual(low);
        expect(n.semitones).toBeLessThanOrEqual(high);
      }
      if (i % PHRASE_BARS === PHRASE_BARS - 1) expect((melody.at(-1)?.semitones ?? -1) % 12).toBe(0);
    });
  });

  it('plays no melody in war and no drums on the menu', () => {
    const war = compose('war', 8, 5).flat();
    expect(war.some((n) => n.instrument === 'pluck' || n.instrument === 'flute')).toBe(false);
    expect(war.some((n) => n.instrument === 'drumLow')).toBe(true);
    expect(
      compose('menu', 8, 5)
        .flat()
        .some((n) => n.instrument.startsWith('drum')),
    ).toBe(false);
  });

  it('presses harder as intensity rises', () => {
    const count = (intensity: number) => compose('election', 32, 9, intensity).flat().length;
    expect(count(1)).toBeGreaterThan(count(0));
  });

  it.each(STINGERS)('writes a short %s stinger', (kind) => {
    const notes = stingerNotes(kind);
    expect(notes.length).toBeGreaterThan(0);
    expect(Math.max(...notes.map((n) => n.step + n.length))).toBeLessThanOrEqual(20);
  });
});

describe('the mood', () => {
  const game = newGame();

  it('is the menu away from a game, and after it ends', () => {
    expect(moodFor('menu', null, 'adaptive').mood).toBe('menu');
    expect(moodFor('new-game', game, 'adaptive').mood).toBe('menu');
    const over: GameState = {
      ...game,
      status: { kind: 'over', cause: 'impeachment', date: game.clock.date, title: '', summary: '' },
    };
    expect(moodFor('game', over, 'adaptive').mood).toBe('menu');
  });

  it('is calm at the start of a game', () => {
    expect(moodFor('game', game, 'adaptive')).toEqual({ mood: 'governance', intensity: 0 });
  });

  it('turns tense at the riot trigger or near impeachment', () => {
    expect(moodFor('game', withUnrest(game, RIOT_TRIGGER - 1), 'adaptive').mood).toBe('governance');
    expect(moodFor('game', withUnrest(game, RIOT_TRIGGER), 'adaptive').mood).toBe('tension');
    const unpopular = { ...game, nation: { ...game.nation, approval: IMPEACHMENT_THRESHOLD + TENSE_APPROVAL_MARGIN } };
    expect(moodFor('game', unpopular, 'adaptive').mood).toBe('tension');
    expect(moodFor('game', withUnrest(game, 100), 'adaptive').intensity).toBe(1);
  });

  it('builds over the last six months before election day, but not in endless mode', () => {
    const year = electionYear(game) - 1;
    expect(monthsToElection(onDate(game, year, 7))).toBe(6);
    expect(moodFor('game', onDate(game, year, 6), 'adaptive').mood).toBe('governance');
    expect(moodFor('game', onDate(game, year, 7), 'adaptive')).toEqual({ mood: 'election', intensity: 0 });
    expect(moodFor('game', onDate(game, year, 12), 'adaptive')).toEqual({ mood: 'election', intensity: 1 });
    expect(moodFor('game', onDate(endless(game), year, 12), 'adaptive').mood).toBe('governance');
  });

  it('puts war over tension, and tension over the election', () => {
    const tense = withUnrest(onDate(game, electionYear(game) - 1, 10), 90);
    expect(moodFor('game', tense, 'adaptive').mood).toBe('tension');
    expect(moodFor('game', startWar(tense, 'PAK', 'rival'), 'adaptive').mood).toBe('war');
  });

  it('stays calm with "Calm only"', () => {
    const atWar = startWar(withUnrest(game, 90), 'PAK', 'rival');
    expect(moodFor('game', atWar, 'calm').mood).toBe('governance');
    expect(moodFor('menu', atWar, 'calm').mood).toBe('menu');
  });
});
