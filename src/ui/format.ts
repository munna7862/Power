import { groupIndian } from '../sim';
import { t } from './i18n';

const LAKH_CRORE = 100_000;

/** ₹ crore → "₹3.50 lakh cr" for large values, "₹45,000 cr" otherwise. */
export function formatCrore(value: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 100 * LAKH_CRORE) return t('units.lakhCrore', { sign, value: (abs / LAKH_CRORE).toFixed(0) });
  if (abs >= LAKH_CRORE) return t('units.lakhCrore', { sign, value: (abs / LAKH_CRORE).toFixed(2) });
  return t('units.crore', { sign, value: groupIndian(abs) });
}

/** Like formatCrore, with up to two decimals for small sums (₹0.03 cr), for unit prices and upkeep. */
export function formatCroreFine(value: number): string {
  if (Math.abs(value) >= 100) return formatCrore(value);
  const sign = value < 0 ? '−' : '';
  return t('units.crore', { sign, value: String(Math.round(Math.abs(value) * 100) / 100) });
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
  return t('units.points', { sign: fraction >= 0 ? '+' : '−', value: value.replace('-', '') });
}

/** Signed whole number, for approval points: 2 → "+2", −1.5 → "−1.5". */
export function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded)}`;
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? t('common.unknownTime') : date.toLocaleString();
}
