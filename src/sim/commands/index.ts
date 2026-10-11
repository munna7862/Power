import { IDEOLOGY_CONTENT, STRATEGY_CONTENT } from '../content';
import { EVENT_CONTENT } from '../content/events';
import {
  IDEOLOGIES,
  MINISTRIES,
  OPERATION_KINDS,
  STRATEGIES,
  type DomainId,
  type DrillKind,
  type IdeologyId,
  type IntelKind,
  type MinistryId,
  type OperationKind,
  type CountryId,
  type RivalId,
  type SectorId,
  type StrategyId,
  type UnitId,
} from '../content/ids';
import { addDays, formatDate } from '../engine/calendar';
import { Rng } from '../engine/rng';
import type { AidSize, TradeSize } from '../diplomacy/constants';
import {
  acceptOffer,
  breakTreaty,
  declineOffer,
  imposeSanctions,
  liftSanctions,
  openEmbassy,
  proposePact,
  proposeTrade,
  sendAid,
  validateAid,
  validateBreak,
  validateEmbassy,
  validateLift,
  validateOffer,
  validatePact,
  validateSanctions,
  validateTrade,
} from '../diplomacy/treaties';
import { startDrill, validateDrill } from '../military/drills';
import {
  cancelOrder,
  placeOrder,
  startResearch,
  validateCancel,
  validateOrder,
  validateResearch,
} from '../military/forces';
import { launchIntelOp, validateIntelOp } from '../military/intel';
import {
  nuclearStrike,
  setDoctrine,
  setProgramActive,
  startProgram,
  validateDoctrine,
  validateNuclearStrike,
  validateSetActive,
  validateStartProgram,
} from '../military/nuclear';
import {
  acceptCeasefire,
  settleWar,
  startWar,
  suePeace,
  validateDeclareWar,
  validateWarAction,
  type PeaceTerms,
} from '../military/war';
import { resolvePending } from '../events/engine';
import { addTimedModifier, applyPolicy, POLICY_COOLDOWN_DAYS, type PolicySource } from '../politics/policy';
import { OPERATIONS } from '../security/constants';
import { startInvestigation, validateInvestigation } from '../security/investigations';
import { launchOperation, operationBlocked } from '../security/operations';
import { normalisePresidentName, PRESIDENT_NAME_MAX } from '../state/initialState';
import { appendLog } from '../state/log';
import type { GameState, NuclearDoctrine } from '../state/types';
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
  | { type: 'SET_STRATEGY'; strategy: StrategyId }
  | { type: 'RESOLVE_EVENT'; pendingId: string; choiceId: string }
  | { type: 'LAUNCH_INVESTIGATION'; ministry: MinistryId }
  | { type: 'LAUNCH_OPERATION'; kind: OperationKind }
  | { type: 'ORDER_UNITS'; unit: UnitId; quantity: number }
  | { type: 'CANCEL_ORDER'; orderId: string }
  | { type: 'START_RESEARCH'; domain: DomainId }
  | { type: 'START_DRILL'; kind: DrillKind }
  | { type: 'LAUNCH_INTEL_OP'; kind: IntelKind; target: RivalId | null }
  | { type: 'DECLARE_WAR'; rival: RivalId }
  | { type: 'SUE_FOR_PEACE'; warId: string }
  | { type: 'ACCEPT_CEASEFIRE'; warId: string }
  | { type: 'SETTLE_WAR'; warId: string; terms: PeaceTerms }
  | { type: 'START_NUCLEAR_PROGRAM' }
  | { type: 'SET_NUCLEAR_PROGRAM'; active: boolean }
  | { type: 'SET_NUCLEAR_DOCTRINE'; doctrine: NuclearDoctrine }
  | { type: 'USE_NUCLEAR_WEAPON'; warId: string }
  | { type: 'PROPOSE_TRADE'; country: CountryId; sector: SectorId; size: TradeSize; years: number }
  | { type: 'PROPOSE_PACT'; country: CountryId }
  | { type: 'OPEN_EMBASSY'; country: CountryId }
  | { type: 'SEND_AID'; country: CountryId; size: AidSize }
  | { type: 'IMPOSE_SANCTIONS'; country: CountryId }
  | { type: 'LIFT_SANCTIONS'; country: CountryId }
  | { type: 'BREAK_TREATY'; treatyId: string }
  | { type: 'ACCEPT_OFFER'; offerId: string }
  | { type: 'DECLINE_OFFER'; offerId: string }
  /** After winning re-election: stay in office with no further elections (endless mode). */
  | { type: 'CONTINUE_IN_OFFICE' };

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

/** Runs a command that needs randomness on a cursor over the game's own RNG state, then stores it back. */
function withRng(state: GameState, run: (rng: Rng) => GameState): GameState {
  const rng = new Rng(state.rng);
  const next = run(rng);
  return { ...next, rng: rng.state };
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
    case 'CONTINUE_IN_OFFICE': {
      if (state.status.kind !== 'over' || state.status.cause !== 'reelected') {
        return fail(state, 'Only a re-elected President can stay on in office.');
      }
      return ok(
        appendLog(
          { ...state, status: { kind: 'playing' }, meta: { ...state.meta, endless: true } },
          {
            severity: 'good',
            title: 'A second term begins',
            body: 'You stay on in endless mode: there are no more elections, but impeachment, coups and the other dangers remain.',
          },
        ),
      );
    }
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
    case 'RESOLVE_EVENT': {
      if (gameOver) return fail(state, 'The game is over.');
      const pending = state.events.pending.find((p) => p.id === command.pendingId);
      if (!pending) return fail(state, 'That decision is no longer waiting.');
      const choice = EVENT_CONTENT[pending.eventId]?.choices.find((c) => c.id === command.choiceId);
      if (!choice) return fail(state, 'That is not one of the available choices.');
      return ok(withRng(state, (rng) => resolvePending(state, pending, choice, rng, false)));
    }
    case 'LAUNCH_INVESTIGATION': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateInvestigation(state, command.ministry);
      return problem ? fail(state, problem) : ok(startInvestigation(state, command.ministry));
    }
    case 'LAUNCH_OPERATION': {
      if (gameOver) return fail(state, 'The game is over.');
      if (!OPERATION_KINDS.includes(command.kind)) return fail(state, `Unknown operation ${command.kind}.`);
      const problem = operationBlocked(state, command.kind);
      if (problem) return fail(state, problem);
      const paid = {
        ...state,
        nation: { ...state.nation, treasury: state.nation.treasury - OPERATIONS[command.kind].cost },
      };
      return ok(withRng(paid, (rng) => launchOperation(paid, command.kind, rng, null)));
    }
    case 'ORDER_UNITS': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateOrder(state, command.unit, command.quantity);
      return problem ? fail(state, problem) : ok(placeOrder(state, command.unit, command.quantity));
    }
    case 'CANCEL_ORDER': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateCancel(state, command.orderId);
      return problem ? fail(state, problem) : ok(cancelOrder(state, command.orderId));
    }
    case 'START_RESEARCH': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateResearch(state, command.domain);
      return problem ? fail(state, problem) : ok(startResearch(state, command.domain));
    }
    case 'START_DRILL': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateDrill(state, command.kind);
      return problem ? fail(state, problem) : ok(startDrill(state, command.kind));
    }
    case 'LAUNCH_INTEL_OP': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateIntelOp(state, command.kind, command.target);
      return problem ? fail(state, problem) : ok(launchIntelOp(state, command.kind, command.target));
    }
    case 'DECLARE_WAR': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateDeclareWar(state, command.rival);
      return problem ? fail(state, problem) : ok(startWar(state, command.rival, 'india'));
    }
    case 'SUE_FOR_PEACE': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateWarAction(state, command.warId, 'suePeace');
      return problem ? fail(state, problem) : ok(suePeace(state, command.warId));
    }
    case 'ACCEPT_CEASEFIRE': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateWarAction(state, command.warId, 'ceasefire');
      return problem ? fail(state, problem) : ok(acceptCeasefire(state, command.warId));
    }
    case 'SETTLE_WAR': {
      if (gameOver) return fail(state, 'The game is over.');
      if (!['annex', 'reparations', 'whitePeace'].includes(command.terms)) return fail(state, 'Unknown peace terms.');
      const problem = validateWarAction(state, command.warId, 'settle');
      return problem ? fail(state, problem) : ok(settleWar(state, command.warId, command.terms));
    }
    case 'START_NUCLEAR_PROGRAM': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateStartProgram(state);
      return problem ? fail(state, problem) : ok(startProgram(state));
    }
    case 'SET_NUCLEAR_PROGRAM': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateSetActive(state, command.active);
      return problem ? fail(state, problem) : ok(setProgramActive(state, command.active));
    }
    case 'SET_NUCLEAR_DOCTRINE': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateDoctrine(state, command.doctrine);
      return problem ? fail(state, problem) : ok(setDoctrine(state, command.doctrine));
    }
    case 'USE_NUCLEAR_WEAPON': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateNuclearStrike(state, command.warId);
      return problem ? fail(state, problem) : ok(nuclearStrike(state, command.warId));
    }
    case 'PROPOSE_TRADE': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateTrade(state, command.country, command.sector, command.size, command.years);
      return problem
        ? fail(state, problem)
        : ok(
            withRng(state, (rng) =>
              proposeTrade(state, rng, command.country, command.sector, command.size, command.years),
            ),
          );
    }
    case 'PROPOSE_PACT': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validatePact(state, command.country);
      return problem ? fail(state, problem) : ok(withRng(state, (rng) => proposePact(state, rng, command.country)));
    }
    case 'OPEN_EMBASSY': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateEmbassy(state, command.country);
      return problem ? fail(state, problem) : ok(openEmbassy(state, command.country));
    }
    case 'SEND_AID': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateAid(state, command.country, command.size);
      return problem ? fail(state, problem) : ok(sendAid(state, command.country, command.size));
    }
    case 'IMPOSE_SANCTIONS': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateSanctions(state, command.country);
      return problem ? fail(state, problem) : ok(imposeSanctions(state, command.country));
    }
    case 'LIFT_SANCTIONS': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateLift(state, command.country);
      return problem ? fail(state, problem) : ok(liftSanctions(state, command.country));
    }
    case 'BREAK_TREATY': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateBreak(state, command.treatyId);
      return problem ? fail(state, problem) : ok(breakTreaty(state, command.treatyId));
    }
    case 'ACCEPT_OFFER': {
      if (gameOver) return fail(state, 'The game is over.');
      const problem = validateOffer(state, command.offerId);
      return problem ? fail(state, problem) : ok(acceptOffer(state, command.offerId));
    }
    case 'DECLINE_OFFER': {
      if (gameOver) return fail(state, 'The game is over.');
      if (!state.diplomacy.offers.some((o) => o.id === command.offerId)) return fail(state, 'That offer has lapsed.');
      return ok(declineOffer(state, command.offerId));
    }
    case 'SET_IDEOLOGY':
      return gameOver ? fail(state, 'The game is over.') : changePolicy(state, 'ideology', command.ideology);
    case 'SET_STRATEGY':
      return gameOver ? fail(state, 'The game is over.') : changePolicy(state, 'strategy', command.strategy);
  }
}

export type { BudgetProposal, PeaceTerms };
