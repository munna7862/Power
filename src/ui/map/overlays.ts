import {
  COUNTRY_LIST,
  countriesInConflict,
  relationOf,
  sanctionsIndia,
  type CountryContent,
  type DiplomacyState,
} from '../../sim';
import { t } from '../i18n';

/** The slice of the game the map reads, so it only redraws when this changes. */
export interface MapWorld {
  diplomacy: DiplomacyState;
  military: { wars: readonly { rival: string }[] };
}

export const OVERLAYS = ['relation', 'power', 'trade', 'war'] as const;
export type OverlayId = (typeof OVERLAYS)[number];

export type LegendId =
  | 'hostile'
  | 'cool'
  | 'neutral'
  | 'friendly'
  | 'closeFriend'
  | 'small'
  | 'middle'
  | 'great'
  | 'contract'
  | 'embassy'
  | 'sanctioned'
  | 'noTies'
  | 'atWar'
  | 'crisis'
  | 'sanctionsIndia'
  | 'calm';

/** A legend entry: its text is world.legend.<id> in i18n. */
export interface LegendItem {
  id: LegendId;
  colour: string;
}

/** The fill colour of India itself on every overlay. */
export const INDIA_FILL = 'color-mix(in srgb, var(--saffron) 85%, var(--surface))';
const NEUTRAL = 'color-mix(in srgb, var(--text-faint) 22%, var(--surface))';
const mix = (colour: string, amount: number) =>
  `color-mix(in srgb, var(${colour}) ${Math.round(amount)}%, var(--surface))`;

export const OVERLAY_LEGENDS: Record<OverlayId, LegendItem[]> = {
  relation: [
    { id: 'hostile', colour: mix('--danger', 80) },
    { id: 'cool', colour: mix('--danger', 35) },
    { id: 'neutral', colour: NEUTRAL },
    { id: 'friendly', colour: mix('--green', 40) },
    { id: 'closeFriend', colour: mix('--green', 80) },
  ],
  power: [
    { id: 'small', colour: mix('--chakra', 15) },
    { id: 'middle', colour: mix('--chakra', 45) },
    { id: 'great', colour: mix('--chakra', 85) },
  ],
  trade: [
    { id: 'contract', colour: mix('--green', 75) },
    { id: 'embassy', colour: mix('--chakra', 45) },
    { id: 'sanctioned', colour: mix('--danger', 70) },
    { id: 'noTies', colour: NEUTRAL },
  ],
  war: [
    { id: 'atWar', colour: mix('--danger', 85) },
    { id: 'crisis', colour: mix('--warning', 70) },
    { id: 'sanctionsIndia', colour: mix('--saffron', 55) },
    { id: 'hostile', colour: mix('--danger', 28) },
    { id: 'calm', colour: NEUTRAL },
  ],
};

function relationFill(relation: number): string {
  if (Math.abs(relation) < 8) return NEUTRAL;
  const strength = Math.min(1, Math.abs(relation) / 80);
  return relation < 0 ? mix('--danger', 20 + 60 * strength) : mix('--green', 20 + 60 * strength);
}

function fillFor(state: MapWorld, c: CountryContent, overlay: OverlayId, trading: Set<string>, crisis: Set<string>) {
  const cs = state.diplomacy.countries[c.id];
  switch (overlay) {
    case 'relation':
      return relationFill(relationOf(state, c.id));
    case 'power':
      return mix('--chakra', 10 + 0.78 * c.power);
    case 'trade':
      if (cs?.sanctioned) return mix('--danger', 70);
      if (trading.has(c.id)) return mix('--green', 75);
      if (cs?.embassy) return mix('--chakra', 45);
      return NEUTRAL;
    case 'war':
      if (state.military.wars.some((w) => w.rival === c.id)) return mix('--danger', 85);
      if (crisis.has(c.id)) return mix('--warning', 70);
      if (sanctionsIndia(state, c.id)) return mix('--saffron', 55);
      return relationOf(state, c.id) < -45 ? mix('--danger', 28) : NEUTRAL;
  }
}

/** A fill colour for every country (and India) under the chosen overlay. */
export function overlayFills(state: MapWorld, overlay: OverlayId): Record<string, string> {
  const trading = new Set(
    state.diplomacy.treaties
      .filter((t) => t.type === 'trade')
      .map((t) => (t.parties[0] === 'IND' ? t.parties[1] : t.parties[0])),
  );
  const crisis = countriesInConflict(state);
  const fills: Record<string, string> = { IND: INDIA_FILL };
  for (const c of COUNTRY_LIST) fills[c.id] = fillFor(state, c, overlay, trading, crisis);
  return fills;
}

/** The one-line value shown in the map tooltip for a country under the overlay. */
export function overlayValue(state: MapWorld, c: CountryContent, overlay: OverlayId): string {
  const cs = state.diplomacy.countries[c.id];
  switch (overlay) {
    case 'relation':
      return t('world.tip.relation', { value: Math.round(cs?.relation ?? 0) });
    case 'power':
      return t('world.tip.power', { value: Math.round(c.power) });
    case 'trade': {
      const n = state.diplomacy.treaties.filter((x) => x.type === 'trade' && x.parties.includes(c.id)).length;
      return cs?.sanctioned ? t('world.tip.sanctioned') : t('world.tip.contracts', { count: n });
    }
    case 'war':
      if (state.military.wars.some((w) => w.rival === c.id)) return t('world.legend.atWar');
      if (countriesInConflict(state).has(c.id)) return t('world.tip.crisis');
      return sanctionsIndia(state, c.id) ? t('world.legend.sanctionsIndia') : t('world.tip.noConflict');
  }
}
