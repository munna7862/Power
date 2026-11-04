import type { Instrument } from './composer';

/**
 * The soundtrack's instruments, each built from oscillators, noise and filters at the moment it plays. Every
 * function schedules its nodes to stop on their own, and returns the source nodes so the player can count voices.
 */

export interface Voice {
  ctx: AudioContext;
  dest: AudioNode;
  freq: number;
  start: number;
  /** Seconds the note is held. */
  duration: number;
  gain: number;
}

type Play = (v: Voice) => AudioScheduledSourceNode[];

/** Mix level of each instrument, so the composer's gains can stay 0–1. */
const LEVEL: Record<Instrument, number> = {
  drone: 0.09,
  pad: 0.07,
  pluck: 0.5,
  flute: 0.16,
  drumLow: 0.6,
  drumHigh: 0.3,
  slap: 0.22,
};

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** A second of white noise, made once per context. Chance is fine: music is cosmetic and outside the sim. */
function noise(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

const plucks = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

/**
 * A plucked string by Karplus–Strong: a burst of noise circulating in a delay line one period long, averaged a
 * little each pass so it mellows as it fades. Rendered into a buffer (a Web Audio feedback loop cannot be shorter
 * than 128 samples, too long for high notes) and cached per pitch.
 */
function pluckBuffer(ctx: BaseAudioContext, freq: number): AudioBuffer {
  let cache = plucks.get(ctx);
  if (!cache) plucks.set(ctx, (cache = new Map()));
  const key = Math.round(freq * 10);
  const cached = cache.get(key);
  if (cached) return cached;
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * 2.4), rate);
  const out = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(rate / freq));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
  let prev = 0;
  // The last fifth of a second fades to silence, so low strings that still ring never end on a click.
  const fadeFrom = out.length - Math.floor(rate * 0.2);
  for (let i = 0; i < out.length; i++) {
    const j = i % period;
    const current = line[j] ?? 0;
    const next = 0.996 * 0.5 * (current + prev);
    prev = current;
    line[j] = next;
    out[i] = i < fadeFrom ? current : current * ((out.length - i) / (out.length - fadeFrom));
  }
  cache.set(key, buffer);
  return buffer;
}

/** An attack, hold and release on a gain node. */
function envelope(
  ctx: BaseAudioContext,
  dest: AudioNode,
  start: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), start + Math.max(attack, hold));
  g.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack, hold) + release);
  g.connect(dest);
  return g;
}

const drone: Play = ({ ctx, dest, freq, start, duration, gain }) => {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  filter.connect(envelope(ctx, dest, start, gain, 2.5, duration - 2, 2.5));
  return [0.997, 1.003].map((detune) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * detune, start);
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + duration + 3);
    return osc;
  });
};

const pad: Play = ({ ctx, dest, freq, start, duration, gain }) => {
  const env = envelope(ctx, dest, start, gain, 1.8, duration - 1.5, 2);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, start);
  osc.connect(env);
  osc.start(start);
  osc.stop(start + duration + 2.5);
  return [osc];
};

const pluck: Play = ({ ctx, dest, freq, start, gain }) => {
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(ctx, freq);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(dest);
  src.start(start);
  return [src];
};

const flute: Play = ({ ctx, dest, freq, start, duration, gain }) => {
  const env = envelope(ctx, dest, start, gain, 0.09, duration * 0.85, 0.35);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  // A small scoop up into the note, then a gentle vibrato that arrives late, as a player would.
  osc.frequency.setValueAtTime(freq * 0.985, start);
  osc.frequency.exponentialRampToValueAtTime(freq, start + 0.08);
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.2;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, start);
  depth.gain.linearRampToValueAtTime(freq * 0.006, start + Math.min(0.6, duration));
  vibrato.connect(depth);
  depth.connect(osc.frequency);
  osc.connect(env);
  // Breath: noise through a narrow band around the note.
  const breath = ctx.createBufferSource();
  breath.buffer = noise(ctx);
  breath.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq * 2;
  band.Q.value = 6;
  const breathGain = ctx.createGain();
  breathGain.gain.value = 0.25;
  breath.connect(band);
  band.connect(breathGain);
  breathGain.connect(env);
  const end = start + duration + 0.5;
  for (const node of [osc, vibrato, breath]) {
    node.start(start);
    node.stop(end);
  }
  return [osc, vibrato, breath];
};

const drumLow: Play = ({ ctx, dest, freq, start, gain }) => {
  const env = envelope(ctx, dest, start, gain, 0.004, 0.02, 0.45);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.6, start);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.75, start + 0.18);
  osc.connect(env);
  osc.start(start);
  osc.stop(start + 0.55);
  return [osc];
};

const drumHigh: Play = ({ ctx, dest, freq, start, gain }) => {
  // A tuned, ringing tap whose pitch lifts slightly as it sounds.
  const env = envelope(ctx, dest, start, gain, 0.002, 0.01, 0.28);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.linearRampToValueAtTime(freq * 1.03, start + 0.12);
  osc.connect(env);
  osc.start(start);
  osc.stop(start + 0.35);
  return [osc];
};

const slap: Play = ({ ctx, dest, start, gain }) => {
  const env = envelope(ctx, dest, start, gain, 0.002, 0.005, 0.07);
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800;
  band.Q.value = 1.2;
  src.connect(band);
  band.connect(env);
  src.start(start, Math.random() * 0.5);
  src.stop(start + 0.1);
  return [src];
};

const PLAYERS: Record<Instrument, Play> = { drone, pad, pluck, flute, drumLow, drumHigh, slap };

/** Plays one note on an instrument at its mix level. */
export const playNote = (instrument: Instrument, voice: Voice): AudioScheduledSourceNode[] =>
  PLAYERS[instrument]({ ...voice, gain: voice.gain * LEVEL[instrument] });

/** A soft room: an impulse of decaying stereo noise, made once per context. */
export function makeReverb(ctx: BaseAudioContext, seconds = 2.6): ConvolverNode {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}
