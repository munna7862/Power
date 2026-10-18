import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_CONTENT,
  DEPARTMENT_SERVICES,
  IDEOLOGIES,
  IDEOLOGY_CONTENT,
  MINISTRIES,
  MINISTRY_CONTENT,
  STRATEGIES,
  STRATEGY_CONTENT,
} from '../../src/sim';

/** Content guardrails: every content file is complete and consistent with the ids in src/sim/content/ids.ts. */
describe('content files', () => {
  it('define every ministry, ideology and strategy exactly once', () => {
    expect(Object.keys(MINISTRY_CONTENT)).toEqual([...MINISTRIES]);
    expect(Object.keys(IDEOLOGY_CONTENT)).toEqual([...IDEOLOGIES]);
    expect(Object.keys(STRATEGY_CONTENT)).toEqual([...STRATEGIES]);
  });

  it('allocate a plausible share of GDP to ministries', () => {
    const total = MINISTRIES.reduce((s, m) => s + MINISTRY_CONTENT[m].defaultAllocation, 0);
    expect(total).toBeGreaterThan(0.08);
    expect(total).toBeLessThan(0.1);
  });

  it('give every ideology and strategy at least one effect and a summary', () => {
    for (const p of [...Object.values(IDEOLOGY_CONTENT), ...Object.values(STRATEGY_CONTENT)]) {
      expect(p.modifiers.length).toBeGreaterThan(0);
      expect(p.summary.length).toBeGreaterThan(20);
    }
  });

  it('give every department its services, each with a name and a summary', () => {
    for (const m of MINISTRIES) {
      const services = DEPARTMENT_CONTENT[m].services;
      expect(services.map((x) => x.id)).toEqual([...DEPARTMENT_SERVICES[m]]);
      for (const x of services) expect(x.summary.length).toBeGreaterThan(10);
    }
  });
});
