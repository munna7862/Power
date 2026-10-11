import { describe, expect, it } from 'vitest';
import { removeExpired, resolve, type Modifier } from '../../src/sim/engine/modifiers';

const mod = (overrides: Partial<Modifier>): Modifier => ({
  id: 'm',
  source: 'test',
  label: 'Test',
  target: 'economy.revenue',
  kind: 'add',
  value: 0,
  expiresAtTick: null,
  ...overrides,
});

describe('modifier stack', () => {
  it('returns the base unchanged when nothing applies', () => {
    expect(resolve([], 'economy.revenue', 100)).toEqual({ base: 100, total: 100, breakdown: [] });
  });

  it('applies (base + Σadd) × (1 + Σmult) and reports a breakdown', () => {
    const result = resolve(
      [
        mod({ id: 'a', label: 'Tax reform', kind: 'add', value: 20 }),
        mod({ id: 'b', label: 'Boom', kind: 'mult', value: 0.1 }),
        mod({ id: 'c', label: 'Strike', kind: 'mult', value: -0.05 }),
        mod({ id: 'd', label: 'Other target', target: 'politics.approvalTarget', value: 999 }),
      ],
      'economy.revenue',
      100,
    );
    expect(result.total).toBeCloseTo(120 * 1.05);
    expect(result.breakdown.map((b) => b.label)).toEqual(['Tax reform', 'Boom', 'Strike']);
  });

  it('removes modifiers once their expiry tick is reached and keeps permanent ones', () => {
    const mods = [mod({ id: 'perm' }), mod({ id: 'soon', expiresAtTick: 10 }), mod({ id: 'later', expiresAtTick: 20 })];
    expect(removeExpired(mods, 9).map((m) => m.id)).toEqual(['perm', 'soon', 'later']);
    expect(removeExpired(mods, 10).map((m) => m.id)).toEqual(['perm', 'later']);
  });
});
