import { IDEOLOGY_CONTENT, STRATEGY_CONTENT } from '../content';
import { IDEOLOGIES, MINISTRIES, STRATEGIES, type IdeologyId, type MinistryId, type StrategyId } from '../content/ids';
import { addDays, formatDate } from '../engine/calendar';
import { addTimedModifier, applyPolicy, POLICY_COOLDOWN_DAYS, type PolicySource } from '../politics/policy';
import { normalisePresidentName, PRESIDENT_NAME_MAX } from '../state/initialState';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';
import { enactBudget, validateBudget, type BudgetProposal } from './budget';
import { appointMinister, dismissMinister, validateAppointment } from './cabinet';

/** Player actions. Every change a player makes to GameState goes through dispatch(). */
export type Command =
  | { type: 'SET_PRESIDENT_NAME'; name: string }
  | { type: 'MARK_LOG_READ'; id: string }
  | { type: 'MARK_ALL_LOG_READ' }
  | { type: 'ENACT_BUDGET'; proposal: BudgetProposal }
  | { type: 'APPOINT_MINISTER'; ministry: MinistryId; candidateId: string }
  | { type: 'DISMISS_MINISTER'; ministry: MinistryId }
  | { type: 'SET_IDEOLOGY'; ideology: IdeologyId }
  | { type: 'SET_STRATEGY'; strategy: StrategyId };

export type CommandResult = { ok: true; state: GameState } | { ok: false; error: string; state: GameState };

/** Approval cost and duration of changing course. */
export const POLICY_CHANGE_COST: Record<PolicySource, { value: number; days: number }> = {
  ideology: { value: -5, days: 180 },
  strategy: { value: -2, days: 120 },
};

const fail = (state: GameState, error: string): CommandResult => ({ ok: false, error, state });
const ok = (state: GameState): CommandResult => ({ ok: true, state });

/** Days until the ideology or strategy can change again (0 = now). */
export function policyCooldownDays(state: GameState, source: PolicySource): number {
  const last = source === 'ideology' ? state.politics.ideologyChangedTick : state.politics.strategyChangedTick;
  return last === null ? 0 : Math.max(0, POLICY_COOLDOWN_DAYS - (state.clock.tick - last));
}

function changePolicy(state: GameState, source: PolicySource, id: IdeologyId | StrategyId): CommandResult {
  const current = source === 'ideology' ? state.politics.ideology : state.politics.strategy;
  const valid = source === 'ideology' ? IDEOLOGIES.includes(id as IdeologyId) : STRATEGIES.includes(id as StrategyId);
  if (!valid) return fail(state, `Unknown ${source} ${id}.`);
  if (id === current) return fail(state, `That is already your ${source}.`);
  const wait = policyCooldownDays(state, source);
  if (wait > 0) {
    const date = formatDate(addDays(state.clock.date, wait));
    return fail(state, `You changed your ${source} recently. You can change it again on ${date}.`);
  }

  const name =
    source === 'ideology' ? IDEOLOGY_CONTENT[id as IdeologyId].name : STRATEGY_CONTENT[id as StrategyId].name;
  const cost = POLICY_CHANGE_COST[source];
  let next = applyPolicy(state, source, id);
  next = {
    ...next,
    politics:
      source === 'ideology'
        ? { ...next.politics, ideology: id as IdeologyId, ideologyChangedTick: state.clock.tick }
        : { ...next.politics, strategy: id as StrategyId, strategyChangedTick: state.clock.tick },
  };
  next = addTimedModifier(
    next,
    {
      source: `${source}-change`,
      label: `Changed ${source}`,
      target: 'politics.approvalTarget',
      kind: 'add',
      value: cost.value,
    },
    cost.days,
  );
  return ok(
    appendLog(next, {
      severity: 'info',
      title: source === 'ideology' ? `New ideology: ${name}` : `New development strategy: ${name}`,
      body: 'Voters are wary of a change of course; expect a temporary dip in approval while the new direction beds in.',
    }),
  );
}

export function dispatch(state: GameState, command: Command): CommandResult {
  const gameOver = state.status.kind === 'over';
  switch (command.type) {
    case 'SET_PRESIDENT_NAME': {
      const trimmed = command.name.trim();
      if (trimmed.length < 2) return fail(state, 'Name must be at least 2 characters.');
      if (trimmed.length > PRESIDENT_NAME_MAX) {
        return fail(state, `Name must be at most ${PRESIDENT_NAME_MAX} characters.`);
      }
      return ok({ ...state, meta: { ...state.meta, presidentName: normalisePresidentName(trimmed) } });
    }
    case 'MARK_LOG_READ': {
      if (!state.log.some((e) => e.id === command.id)) return fail(state, `No inbox entry with id ${command.id}.`);
      return ok({ ...state, log: state.log.map((e) => (e.id === command.id ? { ...e, read: true } : e)) });
    }
    case 'MARK_ALL_LOG_READ':
      return ok({ ...state, log: state.log.map((e) => (e.read ? e : { ...e, read: true })) });
    case 'ENACT_BUDGET': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateBudget(state, command.proposal);
      return problem ? fail(state, problem) : ok(enactBudget(state, command.proposal));
    }
    case 'APPOINT_MINISTER': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateAppointment(state, command.ministry, command.candidateId);
      return problem ? fail(state, problem) : ok(appointMinister(state, command.ministry, command.candidateId));
    }
    case 'DISMISS_MINISTER': {
      if (gameOver) return fail(state, 'The game is over.');
      if (!MINISTRIES.includes(command.ministry)) return fail(state, `Unknown ministry ${command.ministry}.`);
      if (!state.cabinet.ministers[command.ministry]) return fail(state, 'That post is already vacant.');
      return ok(dismissMinister(state, command.ministry));
    }
    case 'SET_IDEOLOGY':
      return gameOver ? fail(state, 'The game is over.') : changePolicy(state, 'ideology', command.ideology);
    case 'SET_STRATEGY':
      return gameOver ? fail(state, 'The game is over.') : changePolicy(state, 'strategy', command.strategy);
  }
}

export type { BudgetProposal };
