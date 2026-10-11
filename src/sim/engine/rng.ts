/**
 * Seeded pseudo-random number generator (sfc32).
 *
 * The generator state lives inside GameState so that a saved game resumes the
 * exact same random sequence. Never use Math.random() in src/sim.
 */
export type RngState = [number, number, number, number];

function sfc32(state: RngState): { value: number; state: RngState } {
  let [a, b, c, d] = state;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = (b ^ (b >>> 9)) >>> 0;
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  return { value: t, state: [a, b, c, d] };
}

/** Expands a 32-bit seed into a well-mixed generator state (splitmix32), then warms it up. */
export function seedRng(seed: number): RngState {
  let s = seed >>> 0;
  const splitmix = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let state: RngState = [splitmix(), splitmix(), splitmix(), splitmix()];
  for (let i = 0; i < 12; i++) state = sfc32(state).state;
  return state;
}

/** Mutable cursor over an RngState, used for the duration of a single tick or command. */
export class Rng {
  private current: RngState;

  constructor(state: RngState) {
    this.current = [...state];
  }

  get state(): RngState {
    return [...this.current];
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const { value, state } = sfc32(this.current);
    this.current = state;
    return value / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with the given probability (0–1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
