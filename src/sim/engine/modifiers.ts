/**
 * Modifier stack: the single mechanism through which difficulty, ministers,
 * ideology, events and policies change the simulation. Every resolved value
 * carries a breakdown, which powers the "Why?" tooltips in the UI.
 */
export const MODIFIER_TARGETS = [
  /** Annual real growth added to every sector (0.005 = +0.5 percentage points). */
  'economy.growth',
  'economy.growth.agriculture',
  'economy.growth.industry',
  'economy.growth.services',
  'economy.growth.energy',
  'economy.growth.tech',
  /** Added to the inflation target (fraction per year). */
  'economy.inflation',
  /** Added to the unemployment target (fraction of the workforce). */
  'economy.unemployment',
  /** Multiplies all tax and non-tax revenue. */
  'economy.revenue',
  /** Multiplies ministry spending. */
  'economy.expenditure',
  /** Added to the approval target (points). */
  'politics.approvalTarget',
  /** Added to the national corruption target (points). */
  'politics.corruption',
  /** Added to the Human Development Index target. */
  'society.hdi',
] as const;

export type ModifierTarget = (typeof MODIFIER_TARGETS)[number];

export type ModifierKind = 'add' | 'mult';

export interface Modifier {
  id: string;
  /** Machine-readable origin, e.g. "difficulty", "ideology", "scandal". */
  source: string;
  /** Human-readable label shown in breakdowns. */
  label: string;
  target: ModifierTarget;
  /** "add" adds `value` to the base; "mult" adds `value` as a fraction (0.05 = +5%). */
  kind: ModifierKind;
  value: number;
  /** Tick at which the modifier is removed, or null for permanent. */
  expiresAtTick: number | null;
}

export interface BreakdownLine {
  label: string;
  source: string;
  kind: ModifierKind;
  value: number;
}

export interface Resolution {
  base: number;
  total: number;
  breakdown: BreakdownLine[];
}

/** total = (base + Σadd) × (1 + Σmult) */
export function resolve(modifiers: readonly Modifier[], target: ModifierTarget, base: number): Resolution {
  let added = 0;
  let multiplier = 0;
  const breakdown: BreakdownLine[] = [];
  for (const m of modifiers) {
    if (m.target !== target) continue;
    if (m.kind === 'add') added += m.value;
    else multiplier += m.value;
    breakdown.push({ label: m.label, source: m.source, kind: m.kind, value: m.value });
  }
  return { base, total: (base + added) * (1 + multiplier), breakdown };
}

/** Net effect of all modifiers on a target that is a pure offset (base 0). */
export function sumAdd(modifiers: readonly Modifier[], target: ModifierTarget): number {
  return resolve(modifiers, target, 0).total;
}

/** Net multiplier (1 + Σmult) for a target. */
export function multiplierFor(modifiers: readonly Modifier[], target: ModifierTarget): number {
  return resolve(modifiers, target, 1).total;
}

export function removeExpired(modifiers: readonly Modifier[], tick: number): Modifier[] {
  return modifiers.filter((m) => m.expiresAtTick === null || m.expiresAtTick > tick);
}
