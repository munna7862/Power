/**
 * Headless balance harness.
 *   npm run balance                       # 50 seeds × 5 years × 3 bots on every difficulty, bands on Normal
 *   npm run balance -- --seeds 10 --years 3 --difficulty hard
 * Writes reports/balance/balance.csv and summary.md; exits 1 if a KPI band fails (a blocking CI check).
 * The KPI bands are documented in planning/Phases/phase_6_polish_release.md and phase_8_hands_on_governance.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createInitialState, DIFFICULTIES, type Difficulty } from '../../src/sim';
import { BOTS } from './bots';
import { evaluateDiplomacy } from './diplomacy';
import { evaluateGovernance, governanceStats, meanStats } from './governance';
import { difficultyRows, evaluateRelease, probeOptions, worstRepeat } from './release';
import { evaluate, simulate, type RunResult } from './simulate';
import { evaluateWars, probeWars } from './wars';

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
const play = (d: Difficulty) =>
  BOTS.flatMap((bot) => Array.from({ length: seeds }, (_, i) => simulate(bot, i + 1, years, d)));
const results: RunResult[] = play(difficulty);
// The full band check (difficulty === 'normal') also plays the other difficulties, to compare them.
const full = difficulty === 'normal';
const byDifficulty = Object.fromEntries(
  DIFFICULTIES.map((d) => [d, d === difficulty ? results : full ? play(d) : []]),
) as Record<Difficulty, RunResult[]>;
const optionProbe = full ? probeOptions(Math.min(seeds, 20), years) : null;
const seconds = ((performance.now() - started) / 1000).toFixed(1);
const games = Object.values(byDifficulty).flat().length + (optionProbe?.runs ?? 0);

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

const opening = governanceStats(createInitialState({ seed: 1, difficulty, presidentName: 'Opening', startYear: 2026 }));
const governanceRows = BOTS.map((bot) => {
  const g = meanStats(results.filter((r) => r.bot === bot.id));
  return `| ${bot.id} | ${pct(g.coverage)}% | ${pct(g.powerMargin)}% | ${pct(g.importShare)}% | ${Math.round(g.stateProfit)} | ${pct(g.police)}% | ${pct(g.loanBurden)}% |`;
});

const warProbes = probeWars(Math.min(seeds, 30), 240, difficulty);
const kpis = [
  ...evaluate(results, years),
  ...evaluateWars(warProbes),
  ...evaluateDiplomacy(results),
  ...evaluateGovernance(results, opening),
  ...(optionProbe ? evaluateRelease(byDifficulty, optionProbe) : []),
];
const worst = worstRepeat(results);
const finalRows = BOTS.map((bot) => {
  const runs = results.filter((r) => r.bot === bot.id);
  const finals = runs.map((r) => r.years.at(-1)!);
  const avg = (f: (y: (typeof finals)[number]) => number) => finals.reduce((s, y) => s + f(y), 0) / finals.length;
  const ended = runs.filter((r) => r.endedInYear !== null).length;
  const won = runs.filter((r) => r.reelected).length;
  const causes = Object.entries(
    runs.reduce<Record<string, number>>(
      (acc, r) => (r.cause ? { ...acc, [r.cause]: (acc[r.cause] ?? 0) + 1 } : acc),
      {},
    ),
  )
    .map(([cause, n]) => `${cause} ${n}`)
    .join(', ');
  return `| ${bot.id} | ${bot.description} | ${ended}/${runs.length} | ${won}/${runs.length} | ${causes || '-'} | ${avg((y) => y.approval).toFixed(1)}% | ${pct(avg((y) => y.realGrowth))}% | ${pct(avg((y) => y.inflation))}% | ${pct(avg((y) => y.unemployment))}% | ${pct(avg((y) => y.debtToGdp))}% |`;
});

const summary = [
  `# Balance report`,
  '',
  `${seeds} seeds × ${years} years × ${BOTS.length} bots on **${difficulty}**${full ? ' (plus Easy, Hard and the option probes)' : ''} · ${games} games in ${seconds}s`,
  '',
  '## KPI bands',
  '',
  '| Result | KPI | Measured |',
  '|---|---|---|',
  ...kpis.map((k) => `| ${k.pass ? '✅' : '❌'} | ${k.description} | ${k.detail} |`),
  '',
  '## Hands-on governance',
  '',
  'Means over all runs at the end of the game (runs that ended early count where they ended).',
  '',
  '| Bot | Coverage | Reserve margin | Imports / GDP | State plant profit (₹ cr/month) | Thinnest police | Loans / GDP |',
  '|---|---|---|---|---|---|---|',
  `| opening | ${pct(opening.coverage)}% | ${pct(opening.powerMargin)}% | ${pct(opening.importShare)}% | ${Math.round(opening.stateProfit)} | ${pct(opening.police)}% | ${pct(opening.loanBurden)}% |`,
  ...governanceRows,
  '',
  `## War probe`,
  '',
  'Declares war on each neighbour from the opening forces and lets it run for 240 days with no player action.',
  '',
  '| Country | Won | Game over | Undecided | Mean score | Mean days | India casualties |',
  '|---|---|---|---|---|---|---|',
  ...warProbes.map(
    (p) =>
      `| ${p.rival} | ${p.won}/${p.seeds} | ${p.lost}/${p.seeds} | ${p.undecided}/${p.seeds} | ${p.meanScore.toFixed(0)} | ${p.meanDays.toFixed(0)} | ${Math.round(p.meanCasualties)} |`,
  ),
  '',
  ...(full
    ? [
        '## Difficulty comparison',
        '',
        'Share of runs that served the whole term and that won re-election, and the mean approval at the end.',
        '',
        '| Difficulty | Bot | Served the term | Re-elected | Final approval |',
        '|---|---|---|---|---|',
        ...difficultyRows(byDifficulty).map(
          (r) =>
            `| ${r.difficulty} | ${r.bot} | ${(r.served * 100).toFixed(0)}% | ${(r.reelected * 100).toFixed(0)}% | ${r.meanApproval.toFixed(1)}% |`,
        ),
        '',
      ]
    : []),
  `## Events`,
  '',
  `Most repeated random event on ${difficulty}: ${worst.event} (${worst.fires} times in one run). Mean distinct events per run: ${(
    results.reduce((s, r) => s + Object.keys(r.fires).length, 0) / Math.max(1, results.length)
  ).toFixed(1)}.`,
  '',
  `## Final year averages`,
  '',
  '| Bot | Behaviour | Out early | Re-elected | How games ended | Approval | Growth | Inflation | Unemployment | Debt/GDP |',
  '|---|---|---|---|---|---|---|---|---|---|',
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
