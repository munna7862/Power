/** Days left for something that ends at `endsTick`. */
export const daysLeft = (endsTick: number, now: number): number => Math.max(0, endsTick - now);

/** Percentage of the way from `startedTick` to `endsTick`. */
export const shareDone = (startedTick: number, endsTick: number, now: number): number =>
  endsTick <= startedTick ? 100 : Math.max(0, Math.min(100, ((now - startedTick) / (endsTick - startedTick)) * 100));
