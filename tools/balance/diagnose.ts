/**
 * Prints what a bot's games look like year by year, to help tune the domestic-pressure formulas.
 *   npx tsx tools/balance/diagnose.ts passive 20
 */
import {
  REGIONS,
  advanceDays,
  createInitialState,
  presidentialSafety,
  allEfficiencies,
  coupRisk,
  type GameState,
} from '../../src/sim';
import { BOTS } from './bots';

const [botId = 'passive', seedsArg = '20'] = process.argv.slice(2);
const bot = BOTS.find((b) => b.id === botId);
if (!bot) throw new Error(`Unknown bot ${botId}`);

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const rows: Record<number, Record<string, number[]>> = {};
const counts: Record<string, number> = {};
const decisions: Record<string, number> = {};
const endedByYear: Record<number, number> = {};

for (let seed = 1; seed <= Number(seedsArg); seed++) {
  let state: GameState = createInitialState({ seed, difficulty: 'normal', presidentName: 'Diag', startYear: 2026 });
  const seenLog = new Set<string>();
  const seenYear = new Set<string>();
  for (let year = 1; year <= 5 && state.status.kind === 'playing'; year++) {
    for (let month = 0; month < 12 && state.status.kind === 'playing'; month++) {
      state = bot.act(state);
      const m = state.clock.date.month;
      do {
        state = advanceDays(state, 1);
        if (bot.react && state.status.kind === 'playing') state = bot.react(state);
      } while (state.status.kind === 'playing' && state.clock.date.month === m);
    }
    const eff = allEfficiencies(state);
    const yearLog = state.log.filter((e) => e.tick >= (year - 1) * 365 && e.tick < year * 365 && !seenYear.has(e.id));
    yearLog.forEach((e) => seenYear.add(e.id));
    for (const c of ['economy', 'personal', 'disaster', 'corruption', 'unrest', 'security', 'terror']) {
      (rows[year] ??= {})['n_' + c] ??= [];
      rows[year]!['n_' + c]!.push(yearLog.filter((e) => e.category === c && !e.title.includes('no decision')).length);
    }
    (rows[year] ??= {}).decisions ??= [];
    rows[year]!.decisions!.push(yearLog.filter((e) => e.pendingId).length);
    const r = (rows[year] ??= {});
    const push = (k: string, v: number) => (r[k] ??= []).push(v);
    push('alive', state.status.kind === 'playing' ? 1 : 0);
    push('approval', state.nation.approval);
    push('unrestAvg', avg(REGIONS.map((x) => state.security.unrest[x])));
    push('unrestMax', Math.max(...REGIONS.map((x) => state.security.unrest[x])));
    push('terror', state.security.terrorThreat);
    push('safety', presidentialSafety(state, eff));
    push('coupRisk', coupRisk(state));
    push('milLoy', state.security.militaryLoyalty);
    push('corruption', state.economy.corruption);
    push('mods', state.modifiers.length);
    push('attacks', state.security.attacksSuffered);
  }
  for (const e of state.log) {
    if (seenLog.has(e.id)) continue;
    seenLog.add(e.id);
    counts[e.title.replace(/ (in|of|for) the .*$/, '')] =
      (counts[e.title.replace(/ (in|of|for) the .*$/, '')] ?? 0) + 1;
  }
  if (state.status.kind === 'over') {
    const y = Math.floor(state.clock.tick / 365.25) + 1;
    endedByYear[y] = (endedByYear[y] ?? 0) + 1;
  }
  decisions[state.status.kind === 'over' ? state.status.cause : 'survived'] =
    (decisions[state.status.kind === 'over' ? state.status.cause : 'survived'] ?? 0) + 1;
}

console.log(`bot ${botId}, ${seedsArg} seeds`, decisions, 'ended in year:', endedByYear);
for (const [year, r] of Object.entries(rows)) {
  console.log(
    `year ${year}:`,
    Object.entries(r)
      .map(([k, v]) => `${k}=${k === 'alive' ? v.reduce((a, b) => a + b, 0) : avg(v).toFixed(1)}`)
      .join('  '),
  );
}
const top = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25);
console.log(top.map(([k, v]) => `${v} ${k}`).join('\n'));
