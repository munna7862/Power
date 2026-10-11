/**
 * Procedural audio. Every sound is synthesised at runtime with the Web Audio API: there are no audio files,
 * so nothing is licensed from anyone (see CREDITS.md). Browsers only allow sound after a user gesture, so
 * the context is created on the first click or key press.
 */

export type Sfx = 'click' | 'decision' | 'alert' | 'success' | 'save' | 'failure';

/** D major pentatonic over two octaves: calm, consonant and free of any one tradition's signature phrases. */
const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88];
/** Pad chords as scale indices: I, vi, IV-ish, V-ish, each held for one phrase. */
const PROGRESSION = [
  [0, 2, 4],
  [3, 5, 7],
  [1, 3, 5],
  [4, 6, 8],
];
const PHRASE_SECONDS = 9;

type AudioContextCtor = typeof AudioContext;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private phrase = 0;
  private wantMusic = false;
  private volumes = { music: 0.4, sfx: 0.7, muted: false };

  /** Creates the audio graph. Call from a user gesture; safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = (globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext) as AudioContextCtor | undefined;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    if (this.wantMusic) this.scheduleMusic();
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  setVolumes(music: number, sfx: number, muted: boolean): void {
    this.volumes = { music, sfx, muted };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : 1, now, 0.05);
    // Music sits well under the effects; squared for a natural-feeling slider.
    this.musicBus.gain.setTargetAtTime(0.22 * this.volumes.music ** 2, now, 0.2);
    this.sfxBus.gain.setTargetAtTime(0.5 * this.volumes.sfx ** 2, now, 0.02);
  }

  setMusic(on: boolean): void {
    this.wantMusic = on;
    if (!on && this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    if (on && this.ctx && !this.musicTimer) this.scheduleMusic();
  }

  /** A soft tone with an attack-decay envelope. */
  private tone(
    bus: AudioNode,
    freq: number,
    start: number,
    duration: number,
    peak: number,
    type: OscillatorType = 'sine',
    attack = 0.01,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** One phrase of ambient music: a slow pad chord, a low drone and a few sparse plucks. */
  private playPhrase(): void {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime + 0.05;
    const chord = PROGRESSION[this.phrase % PROGRESSION.length] ?? [0, 2, 4];
    this.phrase++;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(this.musicBus);
    for (const index of chord) {
      const freq = SCALE[index] ?? 220;
      this.tone(filter, freq, now, PHRASE_SECONDS + 1.5, 0.12, 'triangle', 2.5);
      this.tone(filter, freq * 1.003, now, PHRASE_SECONDS + 1.5, 0.06, 'sine', 3);
    }
    this.tone(filter, (SCALE[chord[0] ?? 0] ?? 146.83) / 2, now, PHRASE_SECONDS + 2, 0.1, 'sine', 3);
    // Sparse plucks: chance is fine here, music is cosmetic and never touches the simulation.
    const plucks = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < plucks; i++) {
      const note = SCALE[5 + Math.floor(Math.random() * 5)] ?? 440;
      this.tone(this.musicBus, note, now + 1 + Math.random() * (PHRASE_SECONDS - 2), 2.2, 0.05, 'sine', 0.01);
    }
  }

  private scheduleMusic(): void {
    this.playPhrase();
    this.musicTimer = setTimeout(() => this.scheduleMusic(), PHRASE_SECONDS * 1000);
  }

  play(sfx: Sfx): void {
    if (!this.ctx || !this.sfxBus || this.ctx.state !== 'running') return;
    const bus = this.sfxBus;
    const t = this.ctx.currentTime + 0.01;
    switch (sfx) {
      case 'click':
        this.tone(bus, 1200, t, 0.05, 0.08, 'triangle', 0.002);
        break;
      case 'save':
        this.tone(bus, 660, t, 0.12, 0.15, 'sine');
        this.tone(bus, 990, t + 0.08, 0.18, 0.12, 'sine');
        break;
      case 'decision':
        this.tone(bus, 587.33, t, 0.35, 0.18, 'sine');
        this.tone(bus, 880, t + 0.12, 0.45, 0.14, 'sine');
        break;
      case 'alert':
        this.tone(bus, 440, t, 0.25, 0.2, 'square', 0.005);
        this.tone(bus, 349.23, t + 0.22, 0.35, 0.18, 'square', 0.005);
        break;
      case 'success':
        [587.33, 739.99, 880, 1174.66].forEach((f, i) => this.tone(bus, f, t + i * 0.12, 0.6, 0.16, 'triangle'));
        break;
      case 'failure':
        [440, 392, 329.63].forEach((f, i) => this.tone(bus, f, t + i * 0.18, 0.7, 0.16, 'triangle'));
        break;
    }
  }
}

export const audio = new AudioEngine();
