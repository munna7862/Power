import { composeBar, STINGER_TEMPO, stingerNotes, type Note, type Stinger } from './composer';
import { makeReverb, playNote } from './instruments';
import { MOOD_SPECS, stepSeconds, stepsPerBar, type MoodState } from './moods';
import { musicRng, semitonesToHz } from './theory';

/** Bars are written this far ahead of the audio clock, so timer jitter never makes the music stumble. */
const LOOKAHEAD_SECONDS = 0.6;
const TIMER_MS = 100;
/** A new mood must hold this long before the music follows it, so a figure hovering on a threshold cannot flap. */
const HOLD_SECONDS = 4;
/** Seconds for the incoming mood to rise and the outgoing one to fade. */
const CROSSFADE_SECONDS = 3;
/** Notes that may sound at once; past it, new notes (other than the drone) are skipped. */
export const MAX_VOICES = 64;

/**
 * Plays the soundtrack: writes bars from the composer just ahead of the audio clock, follows the mood it is given
 * with a crossfade on a bar line, and ducks under stingers.
 */
export class MusicPlayer {
  private readonly duck: GainNode;
  private readonly stingerBus: GainNode;
  private layer: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private current: MoodState = { mood: 'menu', intensity: 0 };
  private wanted: MoodState = { mood: 'menu', intensity: 0 };
  private wantedSince = 0;
  private bar = 0;
  private nextBar = 0;
  private lastDegree = 0;
  private voices = 0;
  // Chance is fine here: music is cosmetic and never touches the simulation.
  private readonly rng = musicRng(Math.floor(Math.random() * 2 ** 32));

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
  ) {
    const reverb = makeReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet);
    wet.connect(out);
    this.duck = ctx.createGain();
    this.duck.connect(out);
    this.duck.connect(reverb);
    this.stingerBus = ctx.createGain();
    this.stingerBus.connect(out);
    this.stingerBus.connect(reverb);
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  get mood(): MoodState {
    return this.current;
  }

  start(): void {
    if (this.timer) return;
    this.current = { ...this.wanted };
    this.nextBar = this.ctx.currentTime + 0.1;
    this.beginLayer(this.nextBar);
    this.timer = setInterval(() => this.fill(), TIMER_MS);
    this.fill();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.endLayer(this.ctx.currentTime);
  }

  setMood(next: MoodState): void {
    if (next.mood !== this.wanted.mood) this.wantedSince = this.ctx.currentTime;
    this.wanted = next;
  }

  /** Plays a short cue over the music, which dips while it sounds. */
  stinger(kind: Stinger): void {
    if (this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.05;
    const step = 30 / STINGER_TEMPO;
    const notes = stingerNotes(kind);
    const length = Math.max(...notes.map((n) => n.step + n.length)) * step;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(0.2, t, 0.15);
    this.duck.gain.setTargetAtTime(1, t + length, 1.2);
    for (const n of notes) this.play(n, t, step, this.stingerBus, true);
  }

  private fill(): void {
    const now = this.ctx.currentTime;
    // After the page slept, pick up from now instead of rushing through the bars that were missed.
    if (this.nextBar < now) this.nextBar = now + 0.05;
    while (this.nextBar < now + LOOKAHEAD_SECONDS) this.writeBar();
  }

  private writeBar(): void {
    const start = this.nextBar;
    if (this.wanted.mood !== this.current.mood) {
      if (start - this.wantedSince >= HOLD_SECONDS) {
        this.endLayer(start);
        this.current = { ...this.wanted };
        this.bar = 0;
        this.beginLayer(start);
      }
    } else {
      this.current = { ...this.wanted };
    }
    const spec = MOOD_SPECS[this.current.mood];
    const written = composeBar(spec, this.bar, this.rng, this.current.intensity, this.lastDegree);
    this.lastDegree = written.lastDegree;
    const step = stepSeconds(spec);
    if (this.layer) for (const n of written.notes) this.play(n, start, step, this.layer, false);
    this.nextBar = start + stepsPerBar(spec) * step;
    this.bar++;
  }

  private play(note: Note, barStart: number, step: number, dest: AudioNode, always: boolean): void {
    if (!always && this.voices >= MAX_VOICES && note.instrument !== 'drone') return;
    const sources = playNote(note.instrument, {
      ctx: this.ctx,
      dest,
      freq: semitonesToHz(note.semitones),
      start: barStart + note.step * step,
      duration: note.length * step,
      gain: note.gain,
    });
    const last = sources.at(-1);
    if (!last) return;
    this.voices++;
    last.onended = () => {
      this.voices--;
    };
  }

  private beginLayer(at: number): void {
    const spec = MOOD_SPECS[this.current.mood];
    this.lastDegree = Math.round((spec.range[0] + spec.range[1]) / 2);
    const layer = this.ctx.createGain();
    layer.gain.setValueAtTime(0.0001, at);
    layer.gain.exponentialRampToValueAtTime(1, at + CROSSFADE_SECONDS);
    layer.connect(this.duck);
    this.layer = layer;
  }

  private endLayer(at: number): void {
    const layer = this.layer;
    if (!layer) return;
    this.layer = null;
    layer.gain.cancelScheduledValues(at);
    layer.gain.setTargetAtTime(0, at, CROSSFADE_SECONDS / 3);
    // Drones scheduled into the old layer ring on for a few seconds; let them go quietly, then drop the node.
    const ms = (at - this.ctx.currentTime + CROSSFADE_SECONDS * 3) * 1000;
    setTimeout(() => layer.disconnect(), Math.max(0, ms));
  }
}
