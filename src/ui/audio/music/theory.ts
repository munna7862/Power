/** Pitch and chance for the soundtrack. Pure, so the composer can be tested without a sound card. */

/** Every mood is in D, so the drone never jumps when moods crossfade. D3. */
export const ROOT_HZ = 146.83;

/** Scales as semitones above the root, one octave. */
export const SCALES = {
  majorPentatonic: [0, 2, 4, 7, 9],
  major: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  /** Minor with a flat second: uneasy without leaning on any one tradition's phrases. */
  darkMinor: [0, 1, 3, 5, 7, 8, 10],
} as const satisfies Record<string, readonly number[]>;

export type ScaleName = keyof typeof SCALES;

/** Semitones above the root of a scale degree; degrees past the scale's length climb (or fall) by octaves. */
export function degreeToSemitones(scale: readonly number[], degree: number): number {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  const step = degree - octave * n;
  return octave * 12 + (scale[step] ?? 0);
}

/** Frequency of a pitch given in semitones above the root (negative is below). */
export const semitonesToHz = (semitones: number): number => ROOT_HZ * 2 ** (semitones / 12);

/** A small seeded generator (mulberry32). The music keeps its own, so it never touches the game's `Rng`. */
export function musicRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
