import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Automated half of the Sprint 6.1 sensitivity and legal review (master plan §1.3). Every word the player
 * can read comes from /content or the UI catalogue in src/ui/i18n; this scans all of it. A failure here
 * blocks the merge; passing it does not replace the human checklist in planning/Phases/phase_6_polish_release.md.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsonFiles(path);
    return name.endsWith('.json') && name !== 'map.json' ? [path] : [];
  });
}

/** Strings only (keys and ids are not player-visible prose), joined per file. */
function textOf(path: string): string {
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(JSON.parse(readFileSync(path, 'utf8')));
  return strings.join('\n');
}

const files = [...jsonFiles(join(root, 'content')), ...jsonFiles(join(root, 'src/ui/i18n'))];
const rel = (path: string) => path.slice(root.length).replaceAll('\\', '/');

/** Unrest and conflict are about regions and causes, never communities. */
const COMMUNAL =
  /\b(hindus?|muslims?|islam\w*|christians?|sikhs?|buddhists?|jains?|caste\w*|dalits?|brahmins?|communal)\b/i;

const DISCLAIMER = 'never by religion or caste';

/** Real parties, movements and armed groups. People and groups in the game are fictional. */
const ORGANISATIONS = /\b(shiv sena|trinamool|samajwadi|daesh|al-qaeda|lashkar|jaish|hizbul|naxal\w*|maoists?)\b/i;
/** Their acronyms, matched in capitals only so ordinary words (raw, inc.) do not trip it. */
const ACRONYMS = /\b(BJP|INC|AAP|RSS|CPI|BSP|ISIS|LTTE|ULFA|NSCN|NDRF|CAG|CBI|RAW|ISI|PLA)\b/;

/** Real heads of government and politicians, past and present. */
const POLITICIANS =
  /\b(modi|nehru|indira|rajiv gandhi|rahul gandhi|sonia|vajpayee|manmohan|kejriwal|amit shah|adityanath|mamata|xi jinping|putin|biden|trump|obama|imran khan|nawaz|shehbaz|hasina|yunus|rajapaksa|min aung hlaing)\b/i;

/** Trademarked or named weapon products: the game uses generic class names only. */
const PRODUCTS =
  /\b(rafale|brahmos|tejas|pinaka|sukhoi|su-30|mig-\d+|mirage|apache|chinook|f-16|f-35|t-90|t-72|bofors|abrams|s-400|patriot|predator|reaper|insas|ak-47|kalashnikov|scorpene|vikrant|vikramaditya|arihant)\b/i;

/** The reference game's identity must never appear. */
const REFERENCE = /\b(india simulator|oxiwyle)\b/i;

describe('content sensitivity and legal review (automated)', () => {
  it('scans every content file and the whole UI catalogue', () => {
    const names = files.map(rel);
    expect(names).toContain('content/countries.json');
    expect(names).toContain('content/weapons.json');
    expect(names.some((n) => n.startsWith('content/events/'))).toBe(true);
    expect(names).toContain('src/ui/i18n/en/handbook.json');
  });

  it.each(files.map((f) => [rel(f), f]))('%s: no communal framing', (_, path) => {
    // The Security screen states the rule to the player; that one disclaimer is the only allowed mention.
    expect(textOf(path).replaceAll(DISCLAIMER, '')).not.toMatch(COMMUNAL);
  });

  it.each(files.map((f) => [rel(f), f]))('%s: no real parties, organisations or politicians', (_, path) => {
    const text = textOf(path);
    expect(text).not.toMatch(ORGANISATIONS);
    expect(text).not.toMatch(ACRONYMS);
    expect(text).not.toMatch(POLITICIANS);
  });

  it.each(files.map((f) => [rel(f), f]))(
    '%s: no trademarked weapon names and no reference-game identity',
    (_, path) => {
      const text = textOf(path);
      expect(text).not.toMatch(PRODUCTS);
      expect(text).not.toMatch(REFERENCE);
    },
  );
});
