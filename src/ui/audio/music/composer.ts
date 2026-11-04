import { stepsPerBar, type Lead, type MoodSpec } from './moods';
import { degreeToSemitones, SCALES } from './theory';

export type Instrument = 'drone' | 'pad' | Lead | 'drumLow' | 'drumHigh' | 'slap';

/** One note of a bar. Times and lengths are in eighth notes from the start of the bar. */
export interface Note {
  instrument: Instrument;
  step: number;
  length: number;
  /** Semitones above D3. */
  semitones: number;
  /** 0–1, before the instrument's own level. */
  gain: number;
}

/** Bars in a melodic phrase; the last one comes home to the root. */
export const PHRASE_BARS = 4;

/** Melody moves mostly by step, sometimes holds or leaps a third. */
const MOVES = [-2, -1, -1, -1, 0, 1, 1, 1, 2];

export interface Bar {
  notes: Note[];
  /** The melody's last degree, to carry the line into the next bar. */
  lastDegree: number;
}

const pick = <T>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)] as T;

/** Keeps a degree inside the range by bouncing off its ends. */
function bounce(degree: number, [low, high]: [number, number]): number {
  if (degree < low) return Math.min(high, low + (low - degree));
  if (degree > high) return Math.max(low, high - (degree - high));
  return degree;
}

/** The root of the scale nearest to a degree, inside the range. */
function nearestRoot(degree: number, size: number, [low, high]: [number, number]): number {
  const below = Math.floor(degree / size) * size;
  const candidates = [below, below + size].filter((d) => d >= low && d <= high);
  if (candidates.length === 0) return Math.ceil(low / size) * size;
  return candidates.reduce((best, d) => (Math.abs(d - degree) < Math.abs(best - degree) ? d : best));
}

/**
 * Writes one bar of a mood. Pure: the same spec, bar number, generator state, intensity and last degree give the
 * same notes, and every pitched note of the drone, pad and melody is in the mood's scale.
 */
export function composeBar(spec: MoodSpec, bar: number, rng: () => number, intensity: number, lastDegree: number): Bar {
  const scale = SCALES[spec.scale];
  const size = scale.length;
  const steps = stepsPerBar(spec);
  const notes: Note[] = [];
  const level = Math.max(0, Math.min(1, intensity));

  if (bar % 2 === 0) {
    const drone = spec.droneOctave * 12;
    // Two bars and a little more, so each drone overlaps the next and the ground never drops out.
    notes.push({ instrument: 'drone', step: 0, length: steps * 2 + 2, semitones: drone, gain: 0.55 });
    notes.push({ instrument: 'drone', step: 0, length: steps * 2 + 2, semitones: drone + 7, gain: 0.35 });
    if (spec.pad) {
      const root = spec.progression[(bar / 2) % spec.progression.length] ?? 0;
      for (const d of [root, root + 2, root + 4]) {
        notes.push({
          instrument: 'pad',
          step: 0,
          length: steps * 2 + 2,
          semitones: degreeToSemitones(scale, d),
          gain: 0.3,
        });
      }
    }
  }

  if (spec.drums.length > 0) {
    const pattern = spec.drums[bar % spec.drums.length] ?? '';
    const tuned = degreeToSemitones(scale, 4) + 12;
    [...pattern].forEach((hit, step) => {
      if (hit === 'D') notes.push({ instrument: 'drumLow', step, length: 1, semitones: -12, gain: 0.85 });
      else if (hit === 't') notes.push({ instrument: 'drumHigh', step, length: 1, semitones: tuned, gain: 0.55 });
      else if (hit === 's') notes.push({ instrument: 'slap', step, length: 1, semitones: 0, gain: 0.45 });
      // Ghost taps fill the gaps as the mood presses harder.
      else if (rng() < 0.12 + 0.35 * level)
        notes.push({ instrument: 'drumHigh', step, length: 1, semitones: tuned, gain: 0.2 });
    });
  }

  let degree = bounce(lastDegree, spec.range);
  if (spec.leads.length > 0) {
    const lead = spec.leads[Math.floor(bar / PHRASE_BARS) % spec.leads.length] ?? 'pluck';
    const closing = bar % PHRASE_BARS === PHRASE_BARS - 1;
    const density = Math.min(0.9, spec.density * (1 + 0.6 * level));
    // The closing bar plays its first half, then rests on the root.
    const end = closing ? Math.floor(steps / 2) : steps;
    const onsets: { step: number; degree: number }[] = [];
    for (let step = 0; step < end; step++) {
      if (rng() >= density) continue;
      degree = bounce(degree + pick(MOVES, rng), spec.range);
      onsets.push({ step, degree });
    }
    if (closing) {
      degree = nearestRoot(degree, size, spec.range);
      onsets.push({ step: end, degree });
    }
    onsets.forEach((o, i) => {
      const next = onsets[i + 1]?.step ?? steps;
      notes.push({
        instrument: lead,
        step: o.step,
        length: Math.max(1, next - o.step),
        semitones: degreeToSemitones(scale, o.degree),
        gain: closing && i === onsets.length - 1 ? 0.7 : 0.5 + 0.2 * rng(),
      });
    });
  }

  return { notes, lastDegree: degree };
}

export const STINGERS = ['victory', 'defeat', 'war', 'peace'] as const;
export type Stinger = (typeof STINGERS)[number];

/** Tempo of every stinger, in quarter notes a minute. */
export const STINGER_TEMPO = 72;

/** A short cue for a big moment, written out in full. Times are in eighth notes at `STINGER_TEMPO`. */
export function stingerNotes(kind: Stinger): Note[] {
  const at = (scale: readonly number[], d: number) => degreeToSemitones(scale, d);
  switch (kind) {
    case 'victory': {
      const s = SCALES.majorPentatonic;
      return [
        ...[0, 2, 4].map((d) => ({ instrument: 'pad' as const, step: 0, length: 14, semitones: at(s, d), gain: 0.35 })),
        { instrument: 'drone', step: 0, length: 16, semitones: -12, gain: 0.5 },
        ...[5, 6, 7, 8].map((d, i) => ({
          instrument: 'flute' as const,
          step: i * 2,
          length: 2,
          semitones: at(s, d),
          gain: 0.6,
        })),
        { instrument: 'flute', step: 8, length: 7, semitones: at(s, 10), gain: 0.7 },
        ...[0, 3, 6, 8].map((step) => ({ instrument: 'drumLow' as const, step, length: 1, semitones: -12, gain: 0.7 })),
      ];
    }
    case 'defeat': {
      const s = SCALES.darkMinor;
      return [
        ...[0, 2, 4].map((d) => ({ instrument: 'pad' as const, step: 0, length: 16, semitones: at(s, d), gain: 0.3 })),
        { instrument: 'drone', step: 0, length: 16, semitones: -12, gain: 0.55 },
        ...[11, 10, 9, 8].map((d, i) => ({
          instrument: 'flute' as const,
          step: i * 3,
          length: 3,
          semitones: at(s, d),
          gain: 0.55,
        })),
        { instrument: 'flute', step: 12, length: 6, semitones: at(s, 7), gain: 0.5 },
        { instrument: 'drumLow', step: 0, length: 1, semitones: -12, gain: 0.8 },
      ];
    }
    case 'war': {
      const s = SCALES.darkMinor;
      return [
        ...[0, 2, 4].map((d) => ({
          instrument: 'pad' as const,
          step: 0,
          length: 10,
          semitones: at(s, d) - 12,
          gain: 0.4,
        })),
        ...[0, 1, 2, 4].map((step) => ({
          instrument: 'drumLow' as const,
          step,
          length: 1,
          semitones: -12,
          gain: 0.95,
        })),
        { instrument: 'slap', step: 4, length: 1, semitones: 0, gain: 0.6 },
      ];
    }
    case 'peace': {
      const s = SCALES.majorPentatonic;
      return [
        { instrument: 'drone', step: 0, length: 12, semitones: -12, gain: 0.5 },
        ...[5, 6, 7, 8, 10].map((d, i) => ({
          instrument: 'pluck' as const,
          step: i,
          length: 2,
          semitones: at(s, d),
          gain: 0.55,
        })),
      ];
    }
  }
}
