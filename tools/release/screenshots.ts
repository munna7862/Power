/**
 * Release media: plays a scripted tour of the game in Google Chrome and saves the Phase 6 screenshots
 * (docs/screenshots/phase-6) and a short trailer GIF (docs/release/trailer.gif) for the store page.
 * Uses the dev server because staging a victory needs the dev-only window.__APEX__ hook.
 *   npm run screenshots
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import gifenc from 'gifenc';
import { chromium, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

// gifenc is CommonJS without export hints, so Node needs the default import.
const { GIFEncoder, applyPalette, quantize } = gifenc;

const SHOTS = 'docs/screenshots/phase-6';
const TRAILER = 'docs/release/trailer.gif';
const VIEWPORT = { width: 1440, height: 900 };
/** Trailer frames are scaled to this width to keep the GIF small. */
const GIF_WIDTH = 960;

/** The dev-only staging hook (src/main.tsx). */
interface DevWindow {
  __APEX__: {
    advanceDays(days: number): void;
    getState(): { game: { clock: { tick: number } } };
    patchGame(patch: object): void;
  };
}

interface Frame {
  png: Buffer;
  /** How long the frame stays up, ms. */
  hold: number;
}

const frames: Frame[] = [];

async function shot(page: Page, name: string | null, hold = 1600): Promise<void> {
  const png = await page.screenshot();
  if (name) writeFileSync(`${SHOTS}/${name}.png`, png);
  frames.push({ png, hold });
}

/** Nearest-neighbour downscale of an RGBA image (good enough for UI frames at 2:3). */
function downscale(src: PNG, width: number): { data: Uint8Array; width: number; height: number } {
  const height = Math.round((src.height * width) / src.width);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.floor((y * src.height) / height);
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x * src.width) / width);
      const s = (sy * src.width + sx) * 4;
      const d = (y * width + x) * 4;
      data[d] = src.data[s] as number;
      data[d + 1] = src.data[s + 1] as number;
      data[d + 2] = src.data[s + 2] as number;
      data[d + 3] = 255;
    }
  }
  return { data, width, height };
}

function writeTrailer(): void {
  const gif = GIFEncoder();
  for (const frame of frames) {
    const { data, width, height } = downscale(PNG.sync.read(frame.png), GIF_WIDTH);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: frame.hold });
  }
  gif.finish();
  writeFileSync(TRAILER, gif.bytes());
}

mkdirSync(SHOTS, { recursive: true });
mkdirSync('docs/release', { recursive: true });
const server = await createServer({ logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5180/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

try {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await shot(page, 'main-menu', 1400);

  await page.getByRole('button', { name: 'New Game' }).click();
  await page.getByLabel("President's name").fill('Meera Iyer');
  await shot(page, 'new-game', 1800);
  await page.getByRole('button', { name: 'Begin term' }).click();

  const coach = page.getByTestId('tutorial');
  await shot(page, 'tutorial-welcome', 1800);
  await coach.getByRole('button', { name: 'Next' }).click();
  await coach.getByRole('button', { name: 'Next' }).click();
  await shot(page, null, 1400);
  await page.keyboard.press('F4');
  await shot(page, 'tutorial-budget', 1600);
  await coach.getByRole('button', { name: 'Skip tutorial' }).click();

  await page.evaluate(() => (window as unknown as DevWindow).__APEX__.advanceDays(420));
  await page.keyboard.press('F1');
  await shot(page, 'dashboard-election', 1800);

  await page.keyboard.press('F8');
  await page.getByRole('button', { name: 'Power' }).click();
  await shot(page, null, 1600);
  await page.getByRole('button', { name: 'Relation' }).click();
  await shot(page, null, 1600);

  await page.keyboard.press('h');
  await page.getByRole('dialog').getByRole('searchbox').fill('fatigue');
  await shot(page, 'handbook', 2000);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Colour-blind safe' }).click();
  await shot(page, 'settings-accessibility', 1800);
  await page.keyboard.press('Escape');
  await page.keyboard.press('F6');
  await shot(page, 'security-colour-blind', 1600);

  // Win the election: approval held high to election day (the staging hook is dev-only).
  await page.evaluate(() => {
    const apex = (window as unknown as DevWindow).__APEX__;
    const left = 1826 - apex.getState().game.clock.tick;
    for (let day = 0; day < left; day += 25) {
      apex.patchGame({ nation: { approval: 78 }, security: { militaryLoyalty: 90, terrorThreat: 5 } });
      apex.advanceDays(Math.min(25, left - day));
    }
  });
  await page.getByRole('dialog', { name: 'Re-elected' }).waitFor();
  await shot(page, 'victory', 2600);
} finally {
  await browser.close();
  await server.close();
}

writeTrailer();
console.log(`Wrote ${SHOTS}/*.png and ${TRAILER} (${frames.length} frames)`);
