import { groupIndian } from '../../../sim';

/** Quantities of goods with sensible precision: 0.018, 1.92, 400, 1,04,956. */
export const qty = (v: number): string => (v >= 100 ? groupIndian(v) : String(Math.round(v * 100) / 100));
