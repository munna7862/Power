import { INDUSTRY_CONTENT } from '../content/goods';
import { INDUSTRIES, REGION_LABELS, REGIONS, type IndustryId, type RegionId } from '../content/ids';
import type { Rng } from '../engine/rng';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';
import { CLIMATE_DEAD_BAND, PRIVATE_RESPONSE } from './constants';
import { changePlants } from './build';
import { businessClimate } from './flows';
import { OPENING_PLANTS, ownedCount } from './opening';

/**
 * Monthly: private investors open plants when the business climate is better than at the start and close them when
 * it is worse. Draws exactly two random numbers per industry every month (how many, and where), so one
 * industry's luck never shifts another's and the random stream does not depend on the state.
 */
export function privateInvestment(state: GameState, rng: Rng): GameState {
  const raw = businessClimate(state).total - 1;
  // Within the dead band nothing happens; beyond it, only the part outside the band counts.
  const climate = Math.sign(raw) * Math.max(0, Math.abs(raw) - CLIMATE_DEAD_BAND);
  let next = state;
  const opened: string[] = [];
  const closed: string[] = [];
  for (const i of INDUSTRIES) {
    const roll = rng.next();
    const where = rng.next();
    const expected = (Math.abs(climate) * PRIVATE_RESPONSE * ownedCount(OPENING_PLANTS, i, 'private')) / 12;
    const count = Math.floor(expected) + (roll < expected - Math.floor(expected) ? 1 : 0);
    if (count === 0) continue;
    const region = pickRegion(next, i, where, climate > 0);
    if (!region) continue;
    const change = climate > 0 ? count : -Math.min(count, next.industry.plants[region][i].private);
    if (change === 0) continue;
    next = changePlants(next, i, region, 'private', change);
    (change > 0 ? opened : closed).push(
      `${Math.abs(change)} × ${INDUSTRY_CONTENT[i].name.toLowerCase()} (${REGION_LABELS[region]})`,
    );
  }
  if (opened.length > 0) {
    next = appendLog(next, {
      severity: 'good',
      title: 'Private investors build',
      body: `Encouraged by the business climate, investors open ${opened.join(', ')}.`,
    });
  }
  if (closed.length > 0) {
    next = appendLog(next, {
      severity: 'warning',
      title: 'Private plants close',
      body: `A poor business climate drives owners to close ${closed.join(', ')}.`,
    });
  }
  return next;
}

/**
 * Where investors act: new plants go where the industry already is (weighted by its plants plus one, so every
 * region has a chance); closures come from regions that have private plants of that kind.
 */
function pickRegion(state: GameState, industry: IndustryId, roll: number, opening: boolean): RegionId | null {
  const weights = REGIONS.map((r) => {
    const here = state.industry.plants[r][industry];
    return opening ? here.state + here.private + 1 : here.private;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let pick = roll * total;
  for (let k = 0; k < REGIONS.length; k++) {
    pick -= weights[k] ?? 0;
    if (pick < 0) return REGIONS[k] ?? null;
  }
  return REGIONS[REGIONS.length - 1] ?? null;
}
