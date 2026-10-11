import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HANDBOOK } from '../../src/ui/handbook/contents';
import { en } from '../../src/ui/i18n/en';
import { TUTORIAL_STEPS } from '../../src/ui/tutorial/steps';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`),
  );
}

describe('the English catalogue', () => {
  const all = leaves(en as unknown as Tree);

  it('has no empty strings and balanced {{placeholders}}', () => {
    for (const [key, value] of all) {
      expect(value.trim(), key).not.toBe('');
      expect((value.match(/\{\{/g) ?? []).length, key).toBe((value.match(/\}\}/g) ?? []).length);
    }
  });

  it('never defines the same top-level section in two files (merging would silently drop one)', () => {
    const dir = fileURLToPath(new URL('../../src/ui/i18n/en/', import.meta.url));
    const seen = new Map<string, string>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      for (const section of Object.keys(JSON.parse(readFileSync(dir + file, 'utf8')))) {
        expect(seen.get(section), `${section} in ${file}`).toBeUndefined();
        seen.set(section, file);
      }
    }
    expect([...seen.keys()].sort()).toEqual(Object.keys(en).sort());
  });

  it('has a title and body for every handbook entry and every tutorial step', () => {
    const entries = en.handbook.entries as Record<string, { title: string; body: string }>;
    for (const section of HANDBOOK) {
      expect(en.handbook.sections[section.id], section.id).toBeTruthy();
      for (const id of section.entries) {
        expect(entries[id]?.title, id).toBeTruthy();
        expect(entries[id]?.body, id).toBeTruthy();
      }
    }
    const steps = en.tutorial.steps as Record<string, { title: string; body: string; hint?: string }>;
    for (const step of TUTORIAL_STEPS) {
      expect(steps[step.id]?.title, step.id).toBeTruthy();
      expect(steps[step.id]?.body, step.id).toBeTruthy();
      // Steps that wait for the player tell them exactly what to do.
      if (step.advance.kind !== 'next') expect(steps[step.id]?.hint, step.id).toBeTruthy();
    }
  });
});
