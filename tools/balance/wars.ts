import {
  RIVALS,
  advanceDays,
  createInitialState,
  dispatch,
  warScore,
  type Difficulty,
  type GameState,
  type RivalId,
} from '../../src/sim';
import type { Kpi } from './simulate';

export interface WarProbe {
  rival: RivalId;
  seeds: number;
  /** The enemy capitulated within the probe window. */
  won: number;
  /** India was forced to capitulate (game over). */
  lost: number;
  /** Still undecided at the end of the window. */
  undecided: number;
  meanScore: number;
  meanDays: number;
  meanCasualties: number;
}

/**
 * Declares war on a rival from the opening forces and lets the fighting run for `days` days, with no player
 * action. The probe shows how a war against each neighbour plays out; it is not a model of a skilled player.
 */
export function probeWars(seeds: number, days: number, difficulty: Difficulty = 'normal'): WarProbe[] {
  return RIVALS.map((rival) => {
    const row: WarProbe = { rival, seeds, won: 0, lost: 0, undecided: 0, meanScore: 0, meanDays: 0, meanCasualties: 0 };
    for (let seed = 1; seed <= seeds; seed++) {
      let state: GameState = createInitialState({ seed, difficulty, presidentName: 'Probe', startYear: 2026 });
      state = dispatch(state, { type: 'DECLARE_WAR', rival }).state;
      let ended = days;
      for (let d = 0; d < days; d++) {
        state = advanceDays(state, 1);
        const war = state.military.wars[0];
        if (state.status.kind === 'over' || !war || war.status === 'terms') {
          ended = d;
          break;
        }
      }
      const war = state.military.wars[0];
      if (state.status.kind === 'over') row.lost++;
      else if (war?.status === 'terms') row.won++;
      else row.undecided++;
      row.meanScore += war ? warScore(war) : 0;
      row.meanCasualties += war ? war.casualties.india : 0;
      row.meanDays += ended;
    }
    row.meanScore /= seeds;
    row.meanCasualties /= seeds;
    row.meanDays /= seeds;
    return row;
  });
}

/** KPI bands for wars (Normal difficulty), documented in planning/Phases/phase_4_military.md. */
export function evaluateWars(probes: WarProbe[]): Kpi[] {
  const by = (rival: RivalId) => probes.find((p) => p.rival === rival) as WarProbe;
  const share = (n: number, p: WarProbe) => n / p.seeds;
  const percent = (v: number) => `${(v * 100).toFixed(0)}%`;
  const weak = ['haldrin', 'velmora'].map((r) => by(r as RivalId));
  const middle = ['tirhan', 'oruvan'].map((r) => by(r as RivalId));
  const peer = by('zarnak');
  const costly = [...weak, ...middle].every((p) => p.meanCasualties > 5_000);
  return [
    {
      id: 'weak-neighbour-winnable',
      description: 'A war on a much weaker neighbour (Haldrin, Velmora) is won within 240 days in ≥ 90% of seeds',
      pass: weak.every((p) => share(p.won, p) >= 0.9),
      detail: weak.map((p) => `${p.rival} ${percent(share(p.won, p))}`).join(', '),
    },
    {
      id: 'wars-are-costly',
      description: 'Even a won war costs India more than 5,000 casualties on average',
      pass: costly,
      detail: [...weak, ...middle].map((p) => `${p.rival} ${Math.round(p.meanCasualties)}`).join(', '),
    },
    {
      id: 'mid-neighbour-takes-time',
      description: 'A war on a mid-sized neighbour (Tirhan, Oruvan) takes ≥ 60 days on average',
      pass: middle.every((p) => p.meanDays >= 60),
      detail: middle.map((p) => `${p.rival} ${Math.round(p.meanDays)} days`).join(', '),
    },
    {
      id: 'peer-war-stalemate',
      description: 'A war on the peer (Zarnak) is still undecided after 240 days in ≥ 60% of seeds',
      pass: share(peer.undecided, peer) >= 0.6,
      detail: `${percent(share(peer.undecided, peer))} undecided, ${percent(share(peer.won, peer))} won, ${percent(share(peer.lost, peer))} lost`,
    },
  ];
}
