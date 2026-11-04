import type { ScaleName } from './theory';

export const MOODS = ['menu', 'governance', 'tension', 'war', 'election'] as const;
export type Mood = (typeof MOODS)[number];

/** A mood and how hard it pushes, 0–1 (the election builds as the day nears). */
export interface MoodState {
  mood: Mood;
  intensity: number;
}

export type Lead = 'pluck' | 'flute';

/**
 * One drum cycle, one character per eighth note: `D` low drum, `t` high drum, `s` slap, `.` rest. Its length is
 * the bar's length, so a seven-character pattern gives a cycle of seven.
 */
export type DrumPattern = string;

export interface MoodSpec {
  scale: ScaleName;
  /** Quarter notes a minute. */
  tempo: number;
  /** Instruments that carry the melody, in turn by phrase. Empty for none. */
  leads: Lead[];
  /** Chance of a melody note on each eighth note. */
  density: number;
  /** Lowest and highest melody degree. */
  range: [number, number];
  /** Drum cycles, in turn by bar; the bar's length is the first pattern's. Empty for no drums. */
  drums: DrumPattern[];
  pad: boolean;
  /** The drone's octave: 0 is D3, -1 is D2. */
  droneOctave: number;
  /** Scale degrees of the pad chord's roots, in turn every two bars. */
  progression: number[];
}

export const MOOD_SPECS: Record<Mood, MoodSpec> = {
  menu: {
    scale: 'majorPentatonic',
    tempo: 60,
    leads: ['flute'],
    density: 0.28,
    range: [5, 12],
    drums: [],
    pad: true,
    droneOctave: -1,
    progression: [0, 3, 4, 2],
  },
  governance: {
    scale: 'major',
    tempo: 76,
    leads: ['pluck', 'pluck', 'flute'],
    density: 0.4,
    range: [7, 16],
    drums: ['D..t.Dt.', 'D..t.Dts'],
    pad: false,
    droneOctave: -1,
    progression: [0, 5, 3, 4],
  },
  tension: {
    scale: 'darkMinor',
    tempo: 70,
    leads: ['pluck'],
    density: 0.22,
    range: [5, 12],
    drums: ['D..t..t', 'D..t.st'],
    pad: true,
    droneOctave: -1,
    progression: [0, 1, 0, 5],
  },
  war: {
    scale: 'minor',
    tempo: 92,
    leads: [],
    density: 0,
    range: [0, 0],
    drums: ['D.D.D.tD', 'D.D.DttD'],
    pad: true,
    droneOctave: -1,
    progression: [0, 5, 3, 6],
  },
  election: {
    scale: 'mixolydian',
    tempo: 84,
    leads: ['flute', 'pluck'],
    density: 0.38,
    range: [7, 16],
    drums: ['D.tD.tt.', 'D.tDsttD'],
    pad: false,
    droneOctave: -1,
    progression: [0, 6, 3, 4],
  },
};

/** Eighth notes in one bar of a mood. */
export const stepsPerBar = (spec: MoodSpec): number => spec.drums[0]?.length ?? 8;

/** Seconds in one eighth note. */
export const stepSeconds = (spec: MoodSpec): number => 30 / spec.tempo;
