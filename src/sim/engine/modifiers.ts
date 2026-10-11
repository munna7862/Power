/**
 * Modifier stack: the single mechanism through which difficulty, ministers,
 * ideology, events and policies change the simulation. Every resolved value
 * carries a breakdown, which powers the "Why?" tooltips in the UI.
 */
export type ModifierTarget = 'economy.monthlyRevenue' | 'economy.monthlyExpenditure' | 'politics.approvalTarget';

export type ModifierKind = 'add' | 'mult';

export interface Modifier {
  id: string;
  /** Machine-readable origin, e.g. "difficulty", "event:flood-2027". */
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

export function removeExpired(modifiers: readonly Modifier[], tick: number): Modifier[] {
  return modifiers.filter((m) => m.expiresAtTick === null || m.expiresAtTick > tick);
}
