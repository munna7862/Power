import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../eslint-rules/no-ui-literals.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
});

describe('apex/no-ui-literals', () => {
  tester.run('no-ui-literals', rule, {
    valid: [
      { code: `const a = <p>{t('menu.title')}</p>;` },
      { code: `const a = <Button aria-label={t('common.close')}>✕</Button>;` },
      { code: `const a = <span>{s}×</span>;` },
      { code: `const a = <div className="panel wide" data-testid="game-date" role="status" />;` },
      { code: `const rows = [{ id: 'growth', value: 3 }];` },
      { code: `const a = <p>{value.toFixed(1)}%</p>;` },
    ],
    invalid: [
      { code: `const a = <p>Hello there</p>;`, errors: [{ messageId: 'literal' }] },
      { code: `const a = <p>{'Hello'}</p>;`, errors: [{ messageId: 'literal' }] },
      { code: 'const a = <p>{`Year ${n}`}</p>;', errors: [{ messageId: 'literal' }] },
      { code: `const a = <button aria-label="Close" />;`, errors: [{ messageId: 'literal' }] },
      { code: 'const a = <Stat label={`Speed ${s}`} />;', errors: [{ messageId: 'literal' }] },
      { code: `const a = <p>{ok ? 'Saved' : 'Failed'}</p>;`, errors: [{ messageId: 'literal' }] },
      { code: `const rows = [{ label: 'Real growth' }];`, errors: [{ messageId: 'literal' }] },
    ],
  });
});
