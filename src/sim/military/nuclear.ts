import { RIVAL_CONTENT } from '../content/military';
import { RIVALS } from '../content/ids';
import { allEfficiencies } from '../economy/model';
import { formatDate } from '../engine/calendar';
import { addTimedModifier, replaceTimedModifier } from '../politics/policy';
import { clamp } from '../security/unrest';
import { endGame } from '../state/gameOver';
import { appendLog } from '../state/log';
import type { GameState, NuclearDoctrine } from '../state/types';
import { NUCLEAR } from './constants';
import { patchMilitary } from './forces';
import { adjustRelation, patchRival } from './rivals';
import { activeWar, endWar } from './war';

const patchNuclear = (state: GameState, patch: Partial<GameState['military']['nuclear']>): GameState =>
  patchMilitary(state, { nuclear: { ...state.military.nuclear, ...patch } });

/** Where the program stands. */
export type NuclearStage = 'none' | 'research' | 'enrichment' | 'warheads';

export function nuclearStage(program: GameState['military']['nuclear']): NuclearStage {
  if (program.warheads > 0) return 'warheads';
  if (program.enrichment > 0 || program.research >= 100) return 'enrichment';
  if (program.research > 0 || program.active) return 'research';
  return 'none';
}

export const programStarted = (program: GameState['military']['nuclear']): boolean =>
  program.active || program.research > 0 || program.warheads > 0;

export function validateStartProgram(state: GameState): string | null {
  if (programStarted(state.military.nuclear)) return 'The nuclear program has already been launched.';
  if (state.nation.treasury < NUCLEAR.startCost) return 'The treasury cannot fund the launch of the program.';
  return null;
}

export function startProgram(state: GameState): GameState {
  const next = patchNuclear(
    { ...state, nation: { ...state.nation, treasury: state.nation.treasury - NUCLEAR.startCost } },
    { active: true },
  );
  return appendLog(next, {
    severity: 'warning',
    category: 'military',
    title: 'Nuclear program launched',
    body: `A secret research program begins, costing ₹${NUCLEAR.monthlyCost} crore a month. Once it becomes visible to foreign services, expect sanctions pressure. Research takes about ${NUCLEAR.researchMonths / 12} years, then enrichment, then warheads.`,
  });
}

export function validateSetActive(state: GameState, active: boolean): string | null {
  const program = state.military.nuclear;
  if (!programStarted(program)) return 'There is no nuclear program yet.';
  return program.active === active ? `The program is already ${active ? 'running' : 'paused'}.` : null;
}

export const setProgramActive = (state: GameState, active: boolean): GameState => patchNuclear(state, { active });

export function validateDoctrine(state: GameState, doctrine: NuclearDoctrine): string | null {
  return state.military.nuclear.doctrine === doctrine ? 'That is already the doctrine.' : null;
}

/** Changing doctrine. Abandoning No First Use alarms the neighbours and the public; both are temporary. */
export function setDoctrine(state: GameState, doctrine: NuclearDoctrine): GameState {
  let next = patchNuclear(state, { doctrine });
  if (doctrine === 'firstUse') {
    next = addTimedModifier(
      next,
      { source: 'nuclear', label: 'Abandoned No First Use', target: 'politics.approvalTarget', kind: 'add', value: -3 },
      180,
    );
    for (const r of RIVALS) if (!next.military.rivals[r].annexed) next = adjustRelation(next, r, -6);
  }
  return appendLog(next, {
    severity: doctrine === 'firstUse' ? 'warning' : 'info',
    category: 'military',
    title: doctrine === 'firstUse' ? 'Doctrine changed: first use reserved' : 'Doctrine changed: No First Use',
    body:
      doctrine === 'firstUse'
        ? 'India now reserves the right to use nuclear weapons first. Deterrence rises, but the neighbours and many voters are alarmed.'
        : 'India again pledges never to use nuclear weapons first.',
  });
}

/** Deterrence a declared arsenal adds (doctrine of first use is a stronger signal). */
export const nuclearDeterrence = (program: GameState['military']['nuclear']): number =>
  NUCLEAR.deterrence(program.warheads) * (program.doctrine === 'firstUse' ? 1.15 : 1);

/**
 * Monthly: the program advances while it is funded. Sanctions pressure builds once it is visible; the first
 * warhead makes India a declared nuclear state.
 */
export function advanceProgram(state: GameState): GameState {
  const program = state.military.nuclear;
  let next = state;
  if (!program.active) return next;

  if (next.nation.treasury < NUCLEAR.monthlyCost) {
    return appendLog(next, {
      severity: 'warning',
      category: 'military',
      title: 'Nuclear program stalls',
      body: 'The treasury could not meet this month’s bill and work has paused for the month.',
    });
  }
  next = { ...next, nation: { ...next.nation, treasury: next.nation.treasury - NUCLEAR.monthlyCost } };

  const skill = 0.8 + 0.2 * Math.min(allEfficiencies(state).defence, 1.8);
  let { research, enrichment, warheads, monthsSinceWarhead } = program;
  if (research < 100) {
    research = Math.min(100, research + (100 / NUCLEAR.researchMonths) * skill);
    if (research >= 100) {
      next = appendLog(next, {
        severity: 'info',
        category: 'military',
        title: 'Nuclear research complete',
        body: 'Scientists have completed the design work. Enrichment begins.',
      });
    }
  } else if (enrichment < 100) {
    enrichment = Math.min(100, enrichment + (100 / NUCLEAR.enrichmentMonths) * skill);
    if (enrichment >= 100) {
      next = appendLog(next, {
        severity: 'info',
        category: 'military',
        title: 'Enrichment complete',
        body: 'The program now has the material for a first warhead.',
      });
    }
  } else if (warheads < NUCLEAR.maxWarheads) {
    monthsSinceWarhead += 1;
    if (monthsSinceWarhead >= NUCLEAR.monthsPerWarhead && next.nation.treasury >= NUCLEAR.warheadCost) {
      warheads += 1;
      monthsSinceWarhead = 0;
      next = { ...next, nation: { ...next.nation, treasury: next.nation.treasury - NUCLEAR.warheadCost } };
      if (warheads === 1) {
        next = addTimedModifier(
          next,
          {
            source: 'nuclear',
            label: 'Sanctions after nuclear status',
            target: 'economy.growth',
            kind: 'add',
            value: -0.004,
          },
          1095,
        );
        next = addTimedModifier(
          next,
          {
            source: 'nuclear',
            label: 'National pride in nuclear status',
            target: 'politics.approvalTarget',
            kind: 'add',
            value: 4,
          },
          180,
        );
        for (const r of RIVALS) if (!next.military.rivals[r].annexed) next = adjustRelation(next, r, -8);
        next = appendLog(next, {
          severity: 'warning',
          category: 'military',
          title: 'India is a nuclear-armed state',
          body: 'The first warhead is complete. National pride runs high and rivals are deterred, but trading partners impose sanctions for three years.',
        });
      }
    }
  }

  next = patchNuclear(next, { research, enrichment, warheads, monthsSinceWarhead });
  if (research >= NUCLEAR.visibleAt) {
    next = replaceTimedModifier(
      next,
      {
        source: 'nuclear',
        label: 'Sanctions pressure (nuclear program)',
        target: 'economy.growth',
        kind: 'add',
        value: NUCLEAR.sanctionPressure,
      },
      40,
    );
  }
  return next;
}

export function validateNuclearStrike(state: GameState, warId: string): string | null {
  const program = state.military.nuclear;
  const war = activeWar(state, warId);
  if (!war) return 'That war is over.';
  if (war.status !== 'active') return 'The enemy has already capitulated.';
  if (program.warheads < 1) return 'India has no nuclear warheads.';
  if (program.doctrine === 'noFirstUse') {
    return 'India’s doctrine is No First Use. Change the doctrine before ordering a first strike.';
  }
  return null;
}

/**
 * Orders a nuclear strike. The enemy army is shattered and the war is won, but the world responds with
 * sanctions, the public is horrified and every neighbour turns hostile. On Hard difficulty the presidency
 * ends: the state is treated as a pariah and the government falls.
 */
export function nuclearStrike(state: GameState, warId: string): GameState {
  const war = activeWar(state, warId);
  if (!war) return state;
  const name = RIVAL_CONTENT[war.rival].name;
  let next = patchNuclear(state, { warheads: state.military.nuclear.warheads - 1 });
  const rival = next.military.rivals[war.rival];
  next = patchRival(next, war.rival, { strength: rival.strength * 0.3, readiness: 5 });
  next = addTimedModifier(
    next,
    {
      source: 'nuclear',
      label: 'Global sanctions after a nuclear strike',
      target: 'economy.growth',
      kind: 'add',
      value: -0.05,
    },
    1825,
  );
  next = addTimedModifier(
    next,
    {
      source: 'nuclear',
      label: 'Global sanctions after a nuclear strike',
      target: 'economy.revenue',
      kind: 'mult',
      value: -0.12,
    },
    1825,
  );
  next = addTimedModifier(
    next,
    {
      source: 'nuclear',
      label: 'Horror at the use of nuclear weapons',
      target: 'politics.approvalTarget',
      kind: 'add',
      value: -25,
    },
    540,
  );
  for (const r of RIVALS) if (!next.military.rivals[r].annexed) next = adjustRelation(next, r, -60);
  next = {
    ...next,
    security: {
      ...next.security,
      terrorThreat: clamp(next.security.terrorThreat + 15, 0, 100),
      unrest: Object.fromEntries(
        Object.entries(next.security.unrest).map(([r, v]) => [r, clamp(v + 15, 0, 100)]),
      ) as typeof next.security.unrest,
    },
  };
  next = endWar(next, war, 'nuclear', 'Nuclear strike: the enemy army was destroyed.');
  next = appendLog(next, {
    severity: 'critical',
    category: 'military',
    title: 'Nuclear weapon used',
    body: `India has used a nuclear weapon against ${name}. The war is over, but the world’s response is severe: near-universal sanctions for five years, a collapse of trust at home and hostile neighbours.`,
  });
  if (next.meta.difficulty === 'hard') {
    return endGame(
      next,
      'nuclear',
      'A pariah state',
      `After the nuclear strike on ${name}, sanctions strangled the economy and the government lost control. ${next.meta.presidentName} left office on ${formatDate(next.clock.date)}.`,
    );
  }
  return next;
}
