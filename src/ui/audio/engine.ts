/**
 * Procedural audio. Every sound is synthesised at runtime with the Web Audio API: there are no audio files,
 * so nothing is licensed from anyone (see CREDITS.md). Browsers only allow sound after a user gesture, so
 * the context is created on the first click or key press. The soundtrack lives in `music/`.
 */

import type { Stinger } from './music/composer';
import type { MoodState } from './music/moods';
import { MusicPlayer } from './music/player';

export type Sfx = 'click' | 'decision' | 'alert' | 'success' | 'save' | 'failure';

type AudioContextCtor = typeof AudioContext;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private music: MusicPlayer | null = null;
  private wantMusic = false;
  private mood: MoodState = { mood: 'menu', intensity: 0 };
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
    this.music = new MusicPlayer(this.ctx, this.musicBus);
    this.music.setMood(this.mood);
    this.applyVolumes();
    if (this.wantMusic) this.music.start();
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
    this.musicBus.gain.setTargetAtTime(0.8 * this.volumes.music ** 2, now, 0.2);
    this.sfxBus.gain.setTargetAtTime(0.5 * this.volumes.sfx ** 2, now, 0.02);
  }

  setMusic(on: boolean): void {
    this.wantMusic = on;
    if (!this.music) return;
    if (on) this.music.start();
    else this.music.stop();
  }

  /** Steers the soundtrack; it follows on a bar line once the mood has held for a few seconds. */
  setMood(mood: MoodState): void {
    this.mood = mood;
    this.music?.setMood(mood);
  }

  /** A short musical cue over the soundtrack, on the music volume. */
  stinger(kind: Stinger): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.music) return;
    this.music.stinger(kind);
  }

  /** Stops all sound while the page is hidden, and picks up again when it returns. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
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
