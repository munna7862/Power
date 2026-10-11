/** Equirectangular projection used by the committed world map (content/world/map.json). */
export const WORLD_WIDTH = 1000;
const MAX_LAT = 84;
const MIN_LAT = -58;
const SCALE = WORLD_WIDTH / 360;
export const WORLD_HEIGHT = Math.round((MAX_LAT - MIN_LAT) * SCALE * 10) / 10;

export const project = (lon: number, lat: number): [number, number] => [(lon + 180) * SCALE, (MAX_LAT - lat) * SCALE];

export const unproject = (x: number, y: number): [number, number] => [x / SCALE - 180, MAX_LAT - y / SCALE];
