import { groupIndian } from '../sim';

const LAKH_CRORE = 100_000;

/** ₹ crore → "₹3.50 lakh cr" for large values, "₹45,000 cr" otherwise. */
export function formatCrore(value: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 100 * LAKH_CRORE) return `${sign}₹${(abs / LAKH_CRORE).toFixed(0)} lakh cr`;
  if (abs >= LAKH_CRORE) return `${sign}₹${(abs / LAKH_CRORE).toFixed(2)} lakh cr`;
  return `${sign}₹${groupIndian(abs)} cr`;
}

/** Signed change, e.g. "+₹4,812 cr" or "−₹1.20 lakh cr". */
export function formatCroreDelta(value: number): string {
  return value >= 0 ? `+${formatCrore(value)}` : formatCrore(value);
}

export function formatPercent(fraction: number): string {
  const pct = Math.round(fraction * 1000) / 10;
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/** A rate as a plain percentage: 0.0684 → "6.8%". */
export function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** A change in a rate as signed percentage points: 0.003 → "+0.3 pts". */
export function pts(fraction: number, digits = 1): string {
  const value = (fraction * 100).toFixed(digits);
  return `${fraction >= 0 ? '+' : '−'}${value.replace('-', '')} pts`;
}

/** Signed whole number, for approval points: 2 → "+2", −1.5 → "−1.5". */
export function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded)}`;
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}
