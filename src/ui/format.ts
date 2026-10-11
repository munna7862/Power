import { groupIndian } from '../sim';

const LAKH_CRORE = 100_000;

/** ₹ crore → "₹3.50 lakh cr" for large values, "₹45,000 cr" otherwise. */
export function formatCrore(value: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
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

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}
