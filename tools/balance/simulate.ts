import {
  advanceDays,
  createInitialState,
  debtToGdp,
  type Difficulty,
  type GameOverCause,
  type GameState,
} from '../../src/sim';
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
  /** What ended the game, or null if the term was completed. */
  cause: GameOverCause | null;
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
      // Advance to the first day of the next month, letting the bot react to anything that needs a decision.
      do {
        state = advanceDays(state, 1);
        if (bot.react && state.status.kind === 'playing') state = bot.react(state);
      } while (state.status.kind === 'playing' && state.clock.date.month === target.month);
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
  const cause = state.status.kind === 'over' ? state.status.cause : null;
  return { seed, bot: bot.id, years: records, endedInYear, cause, final: state };
}

export interface Kpi {
  id: string;
  description: string;
  pass: boolean;
  detail: string;
}

/** KPI bands for Normal difficulty (documented in planning/Phases/phase_3_domestic_security.md). */
export function evaluate(results: RunResult[], years: number): Kpi[] {
  const by = (bot: string) => results.filter((r) => r.bot === bot);
  const survival = (bot: string) => by(bot).filter((r) => r.endedInYear === null).length / Math.max(1, by(bot).length);
  const endedByYear3 = (bot: string) =>
    by(bot).filter((r) => r.endedInYear !== null && r.endedInYear <= 3).length / Math.max(1, by(bot).length);
  const earlyBankrupt = results.filter((r) => r.years.some((y) => y.year <= 2 && y.debtToGdp > 1));
  const percent = (v: number) => `${(v * 100).toFixed(0)}%`;

  return [
    {
      id: 'no-early-bankruptcy',
      description: 'No bot has debt above 100% of GDP in years 1–2',
      pass: earlyBankrupt.length === 0,
      detail: `${earlyBankrupt.length} runs`,
    },
    {
      id: 'passive-loses-early',
      description: 'The median passive President is out of office by year 3 (≥ 50% of seeds)',
      pass: endedByYear3('passive') >= 0.5,
      detail: percent(endedByYear3('passive')),
    },
    {
      id: 'balanced-survives',
      description: `The balanced bot completes the ${years}-year term in ≥ 60% of seeds`,
      pass: survival('balanced') >= 0.6,
      detail: percent(survival('balanced')),
    },
    {
      id: 'balanced-beats-passive',
      description: 'Term completion: balanced at least 30 points above passive',
      pass: survival('balanced') - survival('passive') >= 0.3,
      detail: `${percent(survival('balanced'))} vs ${percent(survival('passive'))}`,
    },
    {
      id: 'greedy-punished',
      description: 'Term completion: greedy at least 30 points below balanced',
      pass: survival('balanced') - survival('greedy') >= 0.3,
      detail: `${percent(survival('greedy'))} vs ${percent(survival('balanced'))}`,
    },
    {
      id: 'no-runaway-approval',
      description: 'No run ends with approval above 90%',
      pass: results.every((r) => r.final.nation.approval <= 90),
      detail: `max ${Math.max(...results.map((r) => r.final.nation.approval)).toFixed(1)}`,
    },
  ];
}
