import {
  EVENT_CONTENT,
  isRiotEvent,
  MAX_RANDOM_EVENTS_PER_MONTH,
  MAX_REPEATS,
  NO_RIOTS_UNREST_CAP,
  type Difficulty,
} from '../../src/sim';
import { balancedBot, passiveBot } from './bots';
import { governanceStats, type GovernanceStats } from './governance';
import { simulate, type Kpi, type RunResult } from './simulate';

const share = (runs: RunResult[], test: (r: RunResult) => boolean) =>
  runs.filter(test).length / Math.max(1, runs.length);
const percent = (v: number) => `${(v * 100).toFixed(0)}%`;

/** Random events only: weight-0 events are briefings the simulation raises itself (follow-ups, warnings). */
const isRandom = (eventId: string) => (EVENT_CONTENT[eventId]?.weight ?? 0) > 0;

/** The most times any random event fired in one run, and which. */
export function worstRepeat(results: RunResult[]): { event: string; fires: number } {
  let worst = { event: '-', fires: 0 };
  for (const r of results) {
    for (const [event, fires] of Object.entries(r.fires)) {
      if (isRandom(event) && fires > worst.fires) worst = { event, fires };
    }
  }
  return worst;
}

/** Distinct events a President sees in one run. */
export const distinctEvents = (r: RunResult) => Object.keys(r.fires).length;

export interface DifficultyRow {
  difficulty: Difficulty;
  bot: string;
  served: number;
  reelected: number;
  meanApproval: number;
}

export function difficultyRows(byDifficulty: Record<Difficulty, RunResult[]>): DifficultyRow[] {
  return (Object.keys(byDifficulty) as Difficulty[]).flatMap((difficulty) => {
    const runs = byDifficulty[difficulty];
    return [...new Set(runs.map((r) => r.bot))].map((bot) => {
      const mine = runs.filter((r) => r.bot === bot);
      return {
        difficulty,
        bot,
        served: share(mine, (r) => r.endedInYear === null),
        reelected: share(mine, (r) => r.reelected),
        meanApproval: mine.reduce((s, r) => s + r.final.nation.approval, 0) / Math.max(1, mine.length),
      };
    });
  });
}

export interface OptionProbe {
  /** Runs with "no wars": how many saw a war start. */
  warsWithNoWars: number;
  /** Runs with "no riots": highest unrest seen on any day, and riot events fired. */
  peakUnrestWithNoRiots: number;
  riotEventsWithNoRiots: number;
  /** Balanced games on Normal with Regional play off (Sprint 8.10). */
  national: RunResult[];
  /** Runs with "calm months": the most random events in any calendar month, and how many served the term. */
  busiestCalmMonth: number;
  calm: RunResult[];
  runs: number;
}

/**
 * Plays hands-off and balanced games with each option switched on (hands-off games invite trouble), and balanced
 * games on Normal in national play, over `nationalSeeds` seeds so they compare with the regional runs.
 */
export function probeOptions(seeds: number, years: number, nationalSeeds = seeds): OptionProbe {
  const noWars = [passiveBot, balancedBot].flatMap((bot) =>
    Array.from({ length: seeds }, (_, i) => simulate(bot, i + 1, years, 'hard', { noWars: true })),
  );
  const noRiots = [passiveBot, balancedBot].flatMap((bot) =>
    Array.from({ length: seeds }, (_, i) => simulate(bot, i + 1, years, 'hard', { noRiots: true })),
  );
  const calm = [passiveBot, balancedBot].flatMap((bot) =>
    Array.from({ length: seeds }, (_, i) => simulate(bot, i + 1, years, 'normal', { calmMonths: true })),
  );
  const national = Array.from({ length: nationalSeeds }, (_, i) =>
    simulate(balancedBot, i + 1, years, 'normal', { regions: false }),
  );
  const riotEvents = (r: RunResult) =>
    Object.entries(r.fires)
      .filter(([id]) => EVENT_CONTENT[id] && isRiotEvent(EVENT_CONTENT[id]))
      .reduce((s, [, n]) => s + n, 0);
  return {
    warsWithNoWars: noWars.filter((r) => r.final.military.wars.length > 0 || r.final.military.warHistory.length > 0)
      .length,
    peakUnrestWithNoRiots: Math.max(...noRiots.map((r) => r.peakUnrest)),
    riotEventsWithNoRiots: noRiots.reduce((s, r) => s + riotEvents(r), 0),
    national,
    busiestCalmMonth: Math.max(0, ...calm.map((r) => r.busiestMonth)),
    calm,
    runs: noWars.length + noRiots.length + calm.length + national.length,
  };
}

/**
 * Phase 6 KPI bands: a term is winnable but tense on Normal, the difficulties are clearly apart, random
 * events rarely repeat, and the "no wars" and "no riots" options do what they say.
 */
export function evaluateRelease(
  byDifficulty: Record<Difficulty, RunResult[]>,
  options: OptionProbe,
  opening: GovernanceStats,
): Kpi[] {
  const balanced = (d: Difficulty) => byDifficulty[d].filter((r) => r.bot === 'balanced');
  const win = (d: Difficulty) => share(balanced(d), (r) => r.reelected);
  const all = Object.values(byDifficulty).flat();
  const worst = worstRepeat(all);
  const served = balanced('normal').filter((r) => r.endedInYear === null);
  const variety = served.reduce((s, r) => s + distinctEvents(r), 0) / Math.max(1, served.length);
  const nationalWin = share(options.national, (r) => r.reelected);
  const nationalTerms = options.national.filter((r) => r.endedInYear === null).map((r) => governanceStats(r.final));
  const nationalPolice = nationalTerms.filter((s) => s.police >= 0.95).length / Math.max(1, nationalTerms.length);
  const nationalCoverage = nationalTerms.reduce((s, x) => s + x.coverage, 0) / Math.max(1, nationalTerms.length);
  return [
    {
      id: 'normal-winnable-but-tense',
      description: 'The balanced bot wins re-election on Normal in 50–90% of seeds (winnable, not a formality)',
      pass: win('normal') >= 0.5 && win('normal') <= 0.9,
      detail: percent(win('normal')),
    },
    {
      id: 'difficulty-ordering',
      description: 'Balanced re-election rate: Easy ≥ Normal ≥ Hard, and Easy at least 20 points above Hard',
      pass: win('easy') >= win('normal') && win('normal') >= win('hard') && win('easy') - win('hard') >= 0.2,
      detail: `${percent(win('easy'))} / ${percent(win('normal'))} / ${percent(win('hard'))}`,
    },
    {
      id: 'hard-winnable',
      description: 'The balanced bot still wins re-election on Hard in ≥ 20% of seeds',
      pass: win('hard') >= 0.2,
      detail: percent(win('hard')),
    },
    {
      id: 'low-repetition',
      description: `No random event fires more than ${MAX_REPEATS} times in any run (all bots, all difficulties)`,
      pass: worst.fires <= MAX_REPEATS,
      detail: worst.fires > 0 ? `max ${worst.fires} (${worst.event})` : 'none',
    },
    {
      id: 'event-variety',
      description: 'A full balanced term on Normal sees at least 45 different events on average',
      pass: variety >= 45,
      detail: variety.toFixed(1),
    },
    {
      id: 'no-wars-option',
      description: 'With "no wars" on, no war ever starts (hands-off and balanced, Hard)',
      pass: options.warsWithNoWars === 0,
      detail: `${options.warsWithNoWars} runs with a war`,
    },
    {
      id: 'no-riots-option',
      description: `With "no riots" on, unrest never rises above ${NO_RIOTS_UNREST_CAP} and no riot event fires`,
      pass: options.peakUnrestWithNoRiots <= NO_RIOTS_UNREST_CAP && options.riotEventsWithNoRiots === 0,
      detail: `peak ${options.peakUnrestWithNoRiots.toFixed(1)}, ${options.riotEventsWithNoRiots} riot events`,
    },
    {
      id: 'calm-months-option',
      description: `With "calm months" on, no calendar month sees more than ${MAX_RANDOM_EVENTS_PER_MONTH} random event (hands-off and balanced, Normal)`,
      pass: options.busiestCalmMonth <= MAX_RANDOM_EVENTS_PER_MONTH,
      detail: `busiest month ${options.busiestCalmMonth}`,
    },
    {
      id: 'national-play-comparable',
      description: 'With Regional play off, balanced re-election on Normal is within 10 points of regional play',
      pass: Math.abs(nationalWin - win('normal')) <= 0.1,
      detail: `${percent(nationalWin)} vs ${percent(win('normal'))}`,
    },
    {
      id: 'national-play-governed',
      description:
        'With Regional play off, every region keeps ≥ 95% of the opening police per head in ≥ 90% of balanced terms, and mean coverage ends ≥ 1 point above the opening network',
      pass: nationalPolice >= 0.9 && nationalCoverage >= opening.coverage + 0.01,
      detail: `police ${percent(nationalPolice)} of terms; coverage ${(nationalCoverage * 100).toFixed(1)}% vs ${(opening.coverage * 100).toFixed(1)}%`,
    },
  ];
}
