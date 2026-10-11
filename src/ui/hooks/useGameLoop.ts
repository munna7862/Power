import { useEffect } from 'react';
import { gameStore, useGame } from '../../store';

/** Longest real-time gap simulated at once, so returning to a background tab doesn't fast-forward months. */
const MAX_FRAME_MS = 1000;

/** Drives the simulation from requestAnimationFrame: `speed` in-game days per real second. */
export function useGameLoop(): void {
  const speed = useGame((s) => s.speed);

  useEffect(() => {
    if (speed === 0) return;
    const msPerDay = 1000 / speed;
    let frame = 0;
    let last = performance.now();
    let carry = 0;

    const loop = (now: number) => {
      carry += Math.min(now - last, MAX_FRAME_MS);
      last = now;
      const days = Math.floor(carry / msPerDay);
      if (days > 0) {
        carry -= days * msPerDay;
        gameStore.getState().advanceDays(days);
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [speed]);
}
