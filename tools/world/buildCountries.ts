/**
 * Generates content/countries.json from Natural Earth's India point-of-view admin-0 file (the same input as
 * buildMap.ts): name, region, rounded GDP (US$ billion) and population (millions). Power, outlook, aggression
 * and opening relation are derived by simple rules; about twenty focus nations are tuned by hand below.
 * Outlook is a coarse game abstraction used for the "ideology match" term, not a political judgement.
 *
 *   npx tsx tools/world/buildCountries.ts ne_10m_admin_0_countries_ind.geojson
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { countryId, isCountry, type Feature } from './common';

type Sector = 'agriculture' | 'industry' | 'services' | 'energy' | 'tech';
type Outlook = 'liberalism' | 'socialism' | 'conservatism' | 'nationalism' | 'technocracy';

interface Tuned {
  power: number;
  aggression: number;
  relation: number;
  outlook: Outlook;
  strengths: Sector[];
}

/** Hand-tuned focus nations. Power is on a 0–100 scale where India is about 75. */
const FOCUS: Record<string, Tuned> = {
  USA: { power: 100, aggression: 40, relation: 10, outlook: 'liberalism', strengths: ['tech', 'services'] },
  CHN: { power: 95, aggression: 55, relation: -25, outlook: 'socialism', strengths: ['industry', 'tech'] },
  RUS: { power: 85, aggression: 50, relation: 15, outlook: 'nationalism', strengths: ['energy', 'industry'] },
  JPN: { power: 72, aggression: 12, relation: 25, outlook: 'technocracy', strengths: ['tech', 'industry'] },
  DEU: { power: 72, aggression: 10, relation: 20, outlook: 'liberalism', strengths: ['industry', 'tech'] },
  GBR: { power: 70, aggression: 18, relation: 18, outlook: 'liberalism', strengths: ['services', 'tech'] },
  FRA: { power: 72, aggression: 20, relation: 22, outlook: 'liberalism', strengths: ['industry', 'services'] },
  KOR: { power: 62, aggression: 18, relation: 16, outlook: 'technocracy', strengths: ['tech', 'industry'] },
  AUS: { power: 56, aggression: 10, relation: 22, outlook: 'liberalism', strengths: ['agriculture', 'energy'] },
  BRA: { power: 58, aggression: 14, relation: 20, outlook: 'socialism', strengths: ['agriculture', 'energy'] },
  ZAF: { power: 40, aggression: 14, relation: 20, outlook: 'liberalism', strengths: ['industry', 'agriculture'] },
  IDN: { power: 55, aggression: 22, relation: 15, outlook: 'nationalism', strengths: ['energy', 'agriculture'] },
  SAU: { power: 56, aggression: 28, relation: 18, outlook: 'conservatism', strengths: ['energy'] },
  ARE: { power: 42, aggression: 14, relation: 28, outlook: 'technocracy', strengths: ['energy', 'services'] },
  IRN: { power: 50, aggression: 50, relation: -4, outlook: 'nationalism', strengths: ['energy'] },
  PAK: { power: 62, aggression: 45, relation: -10, outlook: 'nationalism', strengths: ['agriculture', 'industry'] },
  BGD: { power: 36, aggression: 25, relation: 8, outlook: 'socialism', strengths: ['industry', 'agriculture'] },
  MMR: { power: 38, aggression: 35, relation: -5, outlook: 'nationalism', strengths: ['agriculture', 'energy'] },
  LKA: { power: 26, aggression: 15, relation: 12, outlook: 'socialism', strengths: ['agriculture', 'services'] },
  NPL: { power: 18, aggression: 8, relation: 26, outlook: 'socialism', strengths: ['agriculture', 'energy'] },
};

/** Countries that share a land or close maritime border with India. */
const NEIGHBOURS = new Set(['PAK', 'CHN', 'NPL', 'BTN', 'BGD', 'MMR', 'AFG', 'LKA', 'MDV']);
const ENERGY = new Set([
  'SAU',
  'ARE',
  'QAT',
  'KWT',
  'OMN',
  'IRQ',
  'IRN',
  'RUS',
  'NGA',
  'AGO',
  'DZA',
  'LBY',
  'NOR',
  'KAZ',
  'VEN',
  'TKM',
  'AZE',
  'BRN',
  'GAB',
  'COG',
  'GNQ',
  'TTO',
  'CAN',
  'MEX',
  'COL',
  'ECU',
  'SDN',
  'SSD',
  'BHR',
]);
const TECH = new Set([
  'USA',
  'JPN',
  'KOR',
  'DEU',
  'GBR',
  'FRA',
  'CHE',
  'SWE',
  'FIN',
  'NLD',
  'ISR',
  'SGP',
  'TWN',
  'IRL',
  'DNK',
  'CAN',
  'AUT',
  'BEL',
]);
const INDUSTRY = new Set([
  'CHN',
  'DEU',
  'JPN',
  'KOR',
  'ITA',
  'POL',
  'CZE',
  'TUR',
  'VNM',
  'THA',
  'MYS',
  'MEX',
  'HUN',
  'SVK',
  'SVN',
  'ROU',
  'BGD',
]);
const SERVICES = new Set(['GBR', 'SGP', 'CHE', 'LUX', 'MLT', 'CYP', 'ISL', 'BHS', 'BRB', 'MUS', 'SYC']);

/** Names that the Natural Earth short form abbreviates or that read better in plain English. */
const NAME_FIX: Record<string, string> = {
  ATG: 'Antigua and Barbuda',
  BIH: 'Bosnia and Herzegovina',
  CAF: 'Central African Republic',
  DOM: 'Dominican Republic',
  GNQ: 'Equatorial Guinea',
  MHL: 'Marshall Islands',
  PRK: 'North Korea',
  KOR: 'South Korea',
  SLB: 'Solomon Islands',
  SSD: 'South Sudan',
  VCT: 'Saint Vincent and the Grenadines',
};

const hash = (s: string): number => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number, step: number) => Math.round(v / step) * step;

function derive(id: string, gdp: number, pop: number, income: string, continent: string): Tuned {
  const logGdp = Math.log10(Math.max(gdp, 0.05) + 1) / Math.log10(23000);
  const logPop = Math.log10(Math.max(pop, 0.01) + 1) / Math.log10(1450);
  const power = round(clamp(100 * (0.7 * logGdp + 0.3 * logPop) ** 1.6, 2, 70), 1);
  const rich = income.startsWith('1') || income.startsWith('2');
  const poor = income.startsWith('5') || income.startsWith('4');
  const pool: Outlook[] = rich
    ? ['liberalism', 'technocracy', 'conservatism', 'liberalism']
    : poor
      ? ['socialism', 'nationalism', 'conservatism', 'socialism']
      : ['nationalism', 'liberalism', 'socialism', 'conservatism', 'technocracy'];
  const outlook = pool[Math.floor(hash(`${id}:outlook`) * pool.length)] as Outlook;
  const strengths: Sector[] = [];
  if (ENERGY.has(id)) strengths.push('energy');
  if (TECH.has(id)) strengths.push('tech');
  if (INDUSTRY.has(id)) strengths.push('industry');
  if (SERVICES.has(id)) strengths.push('services');
  if (strengths.length === 0) {
    strengths.push(rich ? 'services' : continent === 'Africa' || poor || pop > 8 ? 'agriculture' : 'services');
  }
  const aggression = round(clamp(12 + 28 * hash(`${id}:aggr`) + (power > 45 ? 6 : 0), 5, 60), 1);
  const relation = round(clamp(8 + 24 * (hash(`${id}:rel`) - 0.5) + (NEIGHBOURS.has(id) ? -6 : 0), -20, 28), 1);
  return { power, aggression, relation, outlook, strengths };
}

function build(file: string): void {
  const geo = JSON.parse(readFileSync(file, 'utf8')) as { features: Feature[] };
  const rows = geo.features
    .filter((f) => isCountry(f.properties) && countryId(f.properties) !== 'IND')
    .map((f) => {
      const p = f.properties;
      const id = countryId(p);
      const gdp = Math.max(0, Number(p['GDP_MD'])) / 1000;
      const pop = Math.max(0, Number(p['POP_EST'])) / 1e6;
      const long = String(p['NAME_LONG']);
      const name = NAME_FIX[id] ?? (String(p['NAME']).includes('.') ? long : String(p['NAME']));
      const tuned = FOCUS[id] ?? derive(id, gdp, pop, String(p['INCOME_GRP']), String(p['CONTINENT']));
      return {
        id,
        name,
        continent: String(p['CONTINENT']),
        subregion: String(p['SUBREGION']),
        gdp: gdp >= 100 ? Math.round(gdp) : Math.round(gdp * 10) / 10,
        population: pop >= 10 ? Math.round(pop) : Math.round(pop * 100) / 100,
        power: tuned.power,
        outlook: tuned.outlook,
        aggression: tuned.aggression,
        relation: tuned.relation,
        strengths: tuned.strengths,
        focus: id in FOCUS,
        neighbour: NEIGHBOURS.has(id),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(new URL('../../content/countries.json', import.meta.url), `${JSON.stringify(rows, null, 1)}\n`);
  console.log(`${rows.length} countries; focus ${rows.filter((r) => r.focus).length}`);
}

const input = process.argv[2];
if (!input) throw new Error('Usage: npx tsx tools/world/buildCountries.ts <ne_10m_admin_0_countries_ind.geojson>');
build(input);
