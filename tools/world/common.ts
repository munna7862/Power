/** Shared by the world build scripts: which Natural Earth features become countries on the map. */
export interface Feature {
  properties: Record<string, string | number>;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

export const countryId = (p: Feature['properties']): string => {
  const eh = String(p['ISO_A3_EH']);
  return eh !== '-99' ? eh : String(p['ADM0_A3']);
};

/** Sovereign states and their near-equivalents are playable; dependencies and uninhabited rocks are left off the map. */
export const isCountry = (p: Feature['properties']): boolean => {
  const type = String(p['TYPE']);
  return ['Sovereign country', 'Country', 'Sovereignty'].includes(type) || ['ISR', 'PSE'].includes(countryId(p));
};
