import type { Kpi, RunResult } from './simulate';

/** Counts the inbox entries in which a country proposes a deal to India. */
const offersReceived = (r: RunResult) =>
  r.final.log.filter((e) => e.category === 'diplomacy' && / proposes /.test(e.title)).length;

/** True if a rival declared war on India during the run (a war the player did not choose). */
const attacked = (r: RunResult) =>
  [...r.final.military.wars, ...r.final.military.warHistory.map((w) => ({ declaredBy: 'rival', ...w }))].some(
    (w) => 'declaredBy' in w && w.declaredBy === 'rival',
  ) || r.final.log.some((e) => / invades$/.test(e.title));

const share = (runs: RunResult[], test: (r: RunResult) => boolean) =>
  runs.filter(test).length / Math.max(1, runs.length);
const percent = (v: number) => `${(v * 100).toFixed(0)}%`;

/** Phase 5 KPI bands (Normal): foreign policy pays, reputation holds, the AI makes offers but is not constantly at war. */
export function evaluateDiplomacy(results: RunResult[]): Kpi[] {
  const by = (bot: string) => results.filter((r) => r.bot === bot);
  const finished = (bot: string) => by(bot).filter((r) => r.endedInYear === null);
  const balanced = finished('balanced');
  const trades = (r: RunResult) => r.final.diplomacy.treaties.filter((t) => t.type === 'trade').length;
  const meanRep = balanced.reduce((s, r) => s + r.final.diplomacy.reputation, 0) / Math.max(1, balanced.length);
  const hasDeal = share(
    balanced,
    (r) => trades(r) >= 1 || r.final.log.some((e) => /Trade contract (signed|with)/.test(e.title)),
  );
  return [
    {
      id: 'foreign-policy-pays',
      description: 'The balanced bot signs at least one trade contract during the term in ≥ 80% of completed terms',
      pass: hasDeal >= 0.8,
      detail: percent(hasDeal),
    },
    {
      id: 'reputation-holds',
      description: 'Mean reputation of completed balanced terms stays between 50 and 80',
      pass: meanRep >= 50 && meanRep <= 80,
      detail: meanRep.toFixed(1),
    },
    {
      id: 'partners-make-offers',
      description: 'Other countries propose a deal to India during the term in ≥ 80% of balanced runs',
      pass: share(by('balanced'), (r) => offersReceived(r) >= 1) >= 0.8,
      detail: percent(share(by('balanced'), (r) => offersReceived(r) >= 1)),
    },
    {
      id: 'ai-war-frequency',
      description: 'Rivals invade India in at least 2% but at most 60% of all runs (a threat, not a certainty)',
      pass: share(results, attacked) >= 0.02 && share(results, attacked) <= 0.6,
      detail: percent(share(results, attacked)),
    },
  ];
}
