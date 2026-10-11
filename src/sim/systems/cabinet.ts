import { refreshCandidates } from '../cabinet/generate';
import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, type MinistryId } from '../content/ids';
import { allEfficiencies } from '../economy/model';
import type { System } from '../engine/system';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { GameState, Minister } from '../state/types';

/** Approval hit while a scandal is in the news. */
export const SCANDAL_APPROVAL = -4;
export const SCANDAL_DAYS = 120;
const REPORT_MONTHS = new Set([1, 4, 7, 10]);

/** Monthly cabinet dynamics: loyalty drift, corruption scandals and a quarterly performance report. */
export const cabinetSystem: System = {
  id: 'cabinet',
  cadence: 'monthly',
  run(state, { rng }) {
    const eff = allEfficiencies(state);
    const exposure = 0.5 + 0.5 * Math.min(eff.antiCorruption, 2);
    const ministers = { ...state.cabinet.ministers };
    const scandals: { ministry: MinistryId; minister: Minister }[] = [];

    for (const m of MINISTRIES) {
      const minister = ministers[m];
      if (!minister) continue;
      const loyaltyTarget = minister.ideology === state.politics.ideology ? 80 : 50;
      const loyalty = minister.loyalty + (loyaltyTarget - minister.loyalty) * 0.03 + rng.range(-1, 1);
      ministers[m] = { ...minister, loyalty: Math.round(Math.max(0, Math.min(100, loyalty)) * 10) / 10 };
      if (rng.chance((minister.corruption / 100) ** 2 * 0.04 * exposure)) scandals.push({ ministry: m, minister });
    }

    let next: GameState = { ...state, cabinet: { ...state.cabinet, ministers } };
    for (const { ministry, minister } of scandals) {
      next = addTimedModifier(
        next,
        {
          source: 'scandal',
          label: `Scandal: ${minister.name}`,
          target: 'politics.approvalTarget',
          kind: 'add',
          value: SCANDAL_APPROVAL,
        },
        SCANDAL_DAYS,
      );
      next = appendLog(next, {
        severity: 'warning',
        title: `Scandal in ${MINISTRY_CONTENT[ministry].shortName}`,
        body: `${minister.name} faces allegations of misusing ministry funds. The opposition demands a resignation. Consider replacing the minister in the Cabinet room.`,
      });
    }

    if (REPORT_MONTHS.has(state.clock.date.month)) {
      const ranked = [...MINISTRIES].sort((a, b) => eff[b] - eff[a]);
      const best = ranked[0] as MinistryId;
      const worst = ranked[ranked.length - 1] as MinistryId;
      next = appendLog(next, {
        severity: 'info',
        title: 'Quarterly cabinet report',
        body: `Best run: ${MINISTRY_CONTENT[best].shortName} (${Math.round(eff[best] * 100)}% efficiency). Weakest: ${MINISTRY_CONTENT[worst].shortName} (${Math.round(eff[worst] * 100)}%).`,
      });
    }
    return next;
  },
};

/** Every 1 January a new pool of candidates becomes available. */
export const candidateRefreshSystem: System = {
  id: 'candidate-refresh',
  cadence: 'yearly',
  run(state, { rng }) {
    return appendLog(refreshCandidates(state, rng), {
      severity: 'info',
      title: 'New cabinet candidates',
      body: 'A fresh set of candidates is available for every ministry. Review them in the Cabinet room.',
    });
  },
};
