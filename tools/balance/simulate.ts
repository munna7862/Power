import { advanceDays, createInitialState, debtToGdp, type Difficulty, type GameState } from '../../src/sim';
import type { Bot } from './bots';

export interface YearRecord {
  seed: number;
  bot: string;
  year: number;
  status: 'playing' | 'over';
  approval: number;
  realGrowth: number;
  inflation: number;
  unemployment: number;
  debtToGdp: number;
  corruption: number;
}

export interface RunResult {
  seed: number;
  bot: string;
  years: YearRecord[];
  /** Year (1-based) the game ended in, or null if the term was completed. */
  endedInYear: number | null;
  final: GameState;
}

const finite = (v: unknown): boolean =>
  typeof v === 'number' ? Number.isFinite(v) : v && typeof v === 'object' ? Object.values(v).every(finite) : true;

/** Plays one game: the bot acts at the start of every month, then a month of days elapses. */
export function simulate(bot: Bot, seed: number, years: number, difficulty: Difficulty = 'normal'): RunResult {
  let state = createInitialState({ seed, difficulty, presidentName: `Bot ${bot.id}`, startYear: 2026 });
  const records: YearRecord[] = [];
  let endedInYear: number | null = null;

  for (let year = 1; year <= years; year++) {
    for (let month = 0; month < 12 && state.status.kind === 'playing'; month++) {
      state = bot.act(state);
      const target = { ...state.clock.date };
      // Advance to the first day of the next month.
      do state = advanceDays(state, 1);
      while (state.status.kind === 'playing' && state.clock.date.month === target.month);
    }
    if (!finite(state)) throw new Error(`Non-finite value in state (bot ${bot.id}, seed ${seed}, year ${year})`);
    const { economy } = state;
    records.push({
      seed,
      bot: bot.id,
      year,
      status: state.status.kind,
      approval: state.nation.approval,
      realGrowth: economy.realGrowth,
      inflation: economy.inflation,
      unemployment: economy.unemployment,
      debtToGdp: debtToGdp(economy),
      corruption: economy.corruption,
    });
    if (state.status.kind === 'over') {
      endedInYear = year;
      break;
    }
  }
  return { seed, bot: bot.id, years: records, endedInYear, final: state };
}

export interface Kpi {
  id: string;
  description: string;
  pass: boolean;
  detail: string;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/** KPI bands for Normal difficulty (documented in planning/Phases/phase_2_economy_governance.md). */
export function evaluate(results: RunResult[], years: number): Kpi[] {
  const by = (bot: string) => results.filter((r) => r.bot === bot);
  const survival = (bot: string) => by(bot).filter((r) => r.endedInYear === null).length / Math.max(1, by(bot).length);
  const finalApproval = (bot: string) => median(by(bot).map((r) => r.final.nation.approval));
  const earlyBankrupt = results.filter((r) => r.years.some((y) => y.year <= 2 && y.debtToGdp > 1));

  return [
    {
      id: 'no-early-bankruptcy',
      description: 'No bot has debt above 100% of GDP in years 1–2',
      pass: earlyBankrupt.length === 0,
      detail: `${earlyBankrupt.length} runs`,
    },
    {
      id: 'passive-survives',
      description: `A passive President completes the ${years}-year term in ≥ 95% of seeds`,
      pass: survival('passive') >= 0.95,
      detail: `${(survival('passive') * 100).toFixed(0)}%`,
    },
    {
      id: 'balanced-survives',
      description: `The balanced bot completes the term in ≥ 95% of seeds`,
      pass: survival('balanced') >= 0.95,
      detail: `${(survival('balanced') * 100).toFixed(0)}%`,
    },
    {
      id: 'balanced-beats-passive',
      description: 'Median final approval: balanced ≥ passive',
      pass: finalApproval('balanced') >= finalApproval('passive'),
      detail: `${finalApproval('balanced').toFixed(1)} vs ${finalApproval('passive').toFixed(1)}`,
    },
    {
      id: 'greedy-punished',
      description: 'Median final approval: greedy at least 5 points below passive',
      pass: finalApproval('greedy') <= finalApproval('passive') - 5,
      detail: `${finalApproval('greedy').toFixed(1)} vs ${finalApproval('passive').toFixed(1)}`,
    },
    {
      id: 'no-runaway-approval',
      description: 'No run ends with approval above 90%',
      pass: results.every((r) => r.final.nation.approval <= 90),
      detail: `max ${Math.max(...results.map((r) => r.final.nation.approval)).toFixed(1)}`,
    },
  ];
}
