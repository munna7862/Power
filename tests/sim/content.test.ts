import { describe, expect, it } from 'vitest';
import names from '../../content/names.json';
import {
  IDEOLOGIES,
  IDEOLOGY_CONTENT,
  MINISTRIES,
  MINISTRY_CONTENT,
  STRATEGIES,
  STRATEGY_CONTENT,
} from '../../src/sim';

/**
 * Content guardrails (master plan §1.3): ministers are fictional. Name parts that
 * would make well-known real politicians likely are kept out of the name lists.
 */
const BLOCKED_FIRST_NAMES = [
  'Narendra',
  'Rahul',
  'Sonia',
  'Priyanka',
  'Amit',
  'Mamata',
  'Arvind',
  'Akhilesh',
  'Mayawati',
  'Nitish',
  'Lalu',
  'Rajnath',
  'Nirmala',
  'Smriti',
  'Yogi',
  'Uddhav',
  'Sharad',
  'Pinarayi',
  'Shashi',
  'Manmohan',
  'Atal',
];
const BLOCKED_SURNAMES = [
  'Gandhi',
  'Modi',
  'Nehru',
  'Shah',
  'Yadav',
  'Thackeray',
  'Banerjee',
  'Kejriwal',
  'Pawar',
  'Scindia',
  'Badal',
  'Abdullah',
  'Mufti',
  'Owaisi',
  'Naidu',
  'Gogoi',
  'Vajpayee',
  'Tharoor',
  'Sitharaman',
];

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

  it('keep well-known politicians’ names out of the minister name lists', () => {
    for (const region of Object.values(names)) {
      for (const first of [...region.female, ...region.male]) expect(BLOCKED_FIRST_NAMES).not.toContain(first);
      for (const surname of region.surnames) expect(BLOCKED_SURNAMES).not.toContain(surname);
    }
  });
});
