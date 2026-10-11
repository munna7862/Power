import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Proves the architecture guard in eslint.config.js actually fires:
 * src/sim must stay free of UI, DOM, wall-clock time and Math.random.
 */
const eslint = new ESLint();

const ruleIdsFor = async (code: string, filePath = 'src/sim/engine/__probe__.ts') => {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map((m) => m.ruleId) ?? [];
};

describe('sim purity guard', { timeout: 60_000 }, () => {
  it.each([
    ['React import', `import { useState } from 'react';\nexport const x = useState;`, 'no-restricted-imports'],
    ['UI import', `import { x } from '../../ui/App';\nexport const y = x;`, 'no-restricted-imports'],
    ['Math.random', 'export const r = Math.random();', 'no-restricted-properties'],
    ['Date', 'export const d = new Date();', 'no-restricted-globals'],
    ['window', 'export const w = window.innerWidth;', 'no-restricted-globals'],
  ])('rejects %s in src/sim', async (_label, code, rule) => {
    expect(await ruleIdsFor(code)).toContain(rule);
  });

  it('allows the same code outside src/sim', async () => {
    expect(await ruleIdsFor('export const r = Math.random();', 'src/ui/__probe__.ts')).not.toContain(
      'no-restricted-properties',
    );
  });
});
