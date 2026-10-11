import { allEfficiencies, debtToGdp } from '../economy/model';
import { formatDate } from '../engine/calendar';
import type { System } from '../engine/system';
import { addTimedModifier } from '../politics/policy';
import { BANKRUPTCY_DEBT_RATIO, BANKRUPTCY_MONTHS, COUP_RISK_THRESHOLD } from '../security/constants';
import {
  assassinationAttemptChance,
  assassinationSuccessChance,
  coupChance,
  coupRisk,
  militaryLoyaltyTarget,
  presidentialSafety,
} from '../security/leadership';
import { clamp } from '../security/unrest';
import { endGame } from '../state/gameOver';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';

/**
 * Monthly threats to the President's survival other than the ballot box: the army's mood and coup risk,
 * assassination attempts, and national bankruptcy.
 */
export const leadershipSystem: System = {
  id: 'leadership',
  cadence: 'monthly',
  run(state, { rng }) {
    if (state.status.kind === 'over') return state;
    const eff = allEfficiencies(state);
    const name = state.meta.presidentName;
    const date = formatDate(state.clock.date);

    // The army's mood.
    const loyalty = clamp(
      state.security.militaryLoyalty +
        (militaryLoyaltyTarget(state, eff) - state.security.militaryLoyalty) * 0.1 +
        rng.range(-1, 1),
      0,
      100,
    );
    let next: GameState = { ...state, security: { ...state.security, militaryLoyalty: loyalty } };

    // Coup.
    const risk = coupRisk(next);
    if (risk > COUP_RISK_THRESHOLD && !next.security.coupAlert) {
      next = appendLog(
        { ...next, security: { ...next.security, coupAlert: true } },
        {
          severity: 'critical',
          category: 'security',
          title: 'Rumours of unrest in the barracks',
          body: 'Senior officers are said to be questioning your leadership. Keep the defence minister loyal, fund the forces and win back public support.',
        },
      );
    } else if (risk < COUP_RISK_THRESHOLD - 5 && next.security.coupAlert) {
      next = { ...next, security: { ...next.security, coupAlert: false } };
    }
    if (rng.chance(coupChance(risk))) {
      return endGame(
        next,
        'coup',
        'Overthrown in a coup',
        `Army units seized the capital and the generals declared the government dissolved. ${name} was removed from office on ${date}.`,
      );
    }

    // Assassination attempt.
    if (rng.chance(assassinationAttemptChance(next.security.terrorThreat))) {
      const safety = presidentialSafety(next, eff);
      if (rng.chance(assassinationSuccessChance(safety))) {
        return endGame(
          next,
          'assassination',
          'Assassinated',
          `An attack on the President's convoy succeeded despite the security cordon. ${name} died on ${date}, and the nation is in mourning.`,
        );
      }
      next = addTimedModifier(
        next,
        {
          source: 'security',
          label: 'Sympathy after an assassination attempt',
          target: 'politics.approvalTarget',
          kind: 'add',
          value: 2,
        },
        60,
      );
      next = appendLog(next, {
        severity: 'warning',
        category: 'terror',
        title: 'Assassination attempt foiled',
        body: `An attempt on your life failed (presidential safety was ${safety.toFixed(0)}/100). The public rallies behind you, but the security services face hard questions.`,
      });
    }

    // Bankruptcy.
    const insolvent = debtToGdp(next.economy) > BANKRUPTCY_DEBT_RATIO;
    const bankruptMonths = insolvent ? next.security.bankruptMonths + 1 : 0;
    next = { ...next, security: { ...next.security, bankruptMonths } };
    if (bankruptMonths === 1 || bankruptMonths === 6) {
      next = appendLog(next, {
        severity: 'critical',
        category: 'economy',
        title: 'Debt crisis',
        body: `Public debt is above ${Math.round(BANKRUPTCY_DEBT_RATIO * 100)}% of GDP and lenders are nervous. ${
          BANKRUPTCY_MONTHS - bankruptMonths
        } more months like this and the country will default.`,
      });
    }
    if (bankruptMonths >= BANKRUPTCY_MONTHS) {
      return endGame(
        next,
        'bankruptcy',
        'Bankrupt',
        `Debt stayed above ${Math.round(BANKRUPTCY_DEBT_RATIO * 100)}% of GDP for ${BANKRUPTCY_MONTHS} months. Lenders walked away, the government defaulted and ${name} resigned on ${date}.`,
      );
    }
    return next;
  },
};
