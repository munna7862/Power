/**
 * Headless balance harness.
 *   npm run balance                       # 50 seeds × 5 years × 3 bots, Normal
 *   npm run balance -- --seeds 10 --years 3 --difficulty hard
 * Writes reports/balance/balance.csv and summary.md; exits 1 if a KPI band fails.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DIFFICULTIES, type Difficulty } from '../../src/sim';
import { BOTS } from './bots';
import { evaluate, simulate, type RunResult } from './simulate';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '50' },
    years: { type: 'string', default: '5' },
    difficulty: { type: 'string', default: 'normal' },
    out: { type: 'string', default: 'reports/balance' },
  },
});

const seeds = Number(values.seeds);
const years = Number(values.years);
const difficulty = values.difficulty as Difficulty;
if (!DIFFICULTIES.includes(difficulty)) throw new Error(`Unknown difficulty ${difficulty}`);

const started = performance.now();
const results: RunResult[] = [];
for (const bot of BOTS) {
  for (let seed = 1; seed <= seeds; seed++) results.push(simulate(bot, seed, years, difficulty));
}
const seconds = ((performance.now() - started) / 1000).toFixed(1);

const pct = (v: number) => (v * 100).toFixed(2);
const csv = [
  'seed,bot,year,status,approval,realGrowthPct,inflationPct,unemploymentPct,debtToGdpPct,corruption',
  ...results.flatMap((r) =>
    r.years.map((y) =>
      [
        y.seed,
        y.bot,
        y.year,
        y.status,
        y.approval.toFixed(1),
        pct(y.realGrowth),
        pct(y.inflation),
        pct(y.unemployment),
        pct(y.debtToGdp),
        y.corruption.toFixed(1),
      ].join(','),
    ),
  ),
].join('\n');

const kpis = evaluate(results, years);
const finalRows = BOTS.map((bot) => {
  const runs = results.filter((r) => r.bot === bot.id);
  const finals = runs.map((r) => r.years.at(-1)!);
  const avg = (f: (y: (typeof finals)[number]) => number) => finals.reduce((s, y) => s + f(y), 0) / finals.length;
  const ended = runs.filter((r) => r.endedInYear !== null).length;
  const causes = Object.entries(
    runs.reduce<Record<string, number>>(
      (acc, r) => (r.cause ? { ...acc, [r.cause]: (acc[r.cause] ?? 0) + 1 } : acc),
      {},
    ),
  )
    .map(([cause, n]) => `${cause} ${n}`)
    .join(', ');
  return `| ${bot.id} | ${bot.description} | ${ended}/${runs.length}${causes ? ` (${causes})` : ''} | ${avg((y) => y.approval).toFixed(1)}% | ${pct(avg((y) => y.realGrowth))}% | ${pct(avg((y) => y.inflation))}% | ${pct(avg((y) => y.unemployment))}% | ${pct(avg((y) => y.debtToGdp))}% |`;
});

const summary = [
  `# Balance report`,
  '',
  `${seeds} seeds × ${years} years × ${BOTS.length} bots on **${difficulty}** · ${results.length} games in ${seconds}s`,
  '',
  '## KPI bands',
  '',
  '| Result | KPI | Measured |',
  '|---|---|---|',
  ...kpis.map((k) => `| ${k.pass ? '✅' : '❌'} | ${k.description} | ${k.detail} |`),
  '',
  `## Final year averages`,
  '',
  '| Bot | Behaviour | Game over | Approval | Growth | Inflation | Unemployment | Debt/GDP |',
  '|---|---|---|---|---|---|---|---|',
  ...finalRows,
  '',
].join('\n');

mkdirSync(values.out, { recursive: true });
writeFileSync(`${values.out}/balance.csv`, `${csv}\n`);
writeFileSync(`${values.out}/summary.md`, summary);
console.log(summary);

if (difficulty === 'normal' && kpis.some((k) => !k.pass)) {
  console.error('Balance KPI band failed.');
  process.exit(1);
}
