import {
  COUNTRY_LIST,
  countriesInConflict,
  relationOf,
  sanctionsIndia,
  type CountryContent,
  type DiplomacyState,
} from '../../sim';

/** The slice of the game the map reads, so it only redraws when this changes. */
export interface MapWorld {
  diplomacy: DiplomacyState;
  military: { wars: readonly { rival: string }[] };
}

export const OVERLAYS = ['relation', 'power', 'trade', 'war'] as const;
export type OverlayId = (typeof OVERLAYS)[number];

export const OVERLAY_LABELS: Record<OverlayId, string> = {
  relation: 'Relation',
  power: 'Power',
  trade: 'Trade',
  war: 'War',
};

export interface LegendItem {
  label: string;
  colour: string;
}

/** The fill colour of India itself on every overlay. */
export const INDIA_FILL = 'color-mix(in srgb, var(--saffron) 85%, var(--surface))';
const NEUTRAL = 'color-mix(in srgb, var(--text-faint) 22%, var(--surface))';
const mix = (colour: string, amount: number) =>
  `color-mix(in srgb, var(${colour}) ${Math.round(amount)}%, var(--surface))`;

export const OVERLAY_LEGENDS: Record<OverlayId, LegendItem[]> = {
  relation: [
    { label: 'Hostile', colour: mix('--danger', 80) },
    { label: 'Cool', colour: mix('--danger', 35) },
    { label: 'Neutral', colour: NEUTRAL },
    { label: 'Friendly', colour: mix('--green', 40) },
    { label: 'Close friend', colour: mix('--green', 80) },
  ],
  power: [
    { label: 'Small', colour: mix('--chakra', 15) },
    { label: 'Middle', colour: mix('--chakra', 45) },
    { label: 'Great power', colour: mix('--chakra', 85) },
  ],
  trade: [
    { label: 'Trade contract', colour: mix('--green', 75) },
    { label: 'Embassy', colour: mix('--chakra', 45) },
    { label: 'Sanctioned', colour: mix('--danger', 70) },
    { label: 'No ties', colour: NEUTRAL },
  ],
  war: [
    { label: 'At war with India', colour: mix('--danger', 85) },
    { label: 'Crisis between states', colour: mix('--warning', 70) },
    { label: 'Sanctions India', colour: mix('--saffron', 55) },
    { label: 'Hostile', colour: mix('--danger', 28) },
    { label: 'Calm', colour: NEUTRAL },
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
      return `Relation ${Math.round(cs?.relation ?? 0)}`;
    case 'power':
      return `Power ${Math.round(c.power)}`;
    case 'trade': {
      const n = state.diplomacy.treaties.filter((t) => t.type === 'trade' && t.parties.includes(c.id)).length;
      return cs?.sanctioned
        ? 'Sanctioned by India'
        : n > 0
          ? `${n} trade contract${n === 1 ? '' : 's'}`
          : 'No trade contract';
    }
    case 'war':
      if (state.military.wars.some((w) => w.rival === c.id)) return 'At war with India';
      if (countriesInConflict(state).has(c.id)) return 'In a regional crisis';
      return sanctionsIndia(state, c.id) ? 'Sanctions India' : 'No conflict';
  }
}
