/**
 * Renders the Android launcher icons and splash screens from the game's own favicon, public/favicon.svg, as
 * tools/release/icon.ts does for the desktop, so the phone shows the same original mark. Writes into
 * android/app/src/main/res and sets the adaptive icon's background colour.
 *   npm run android:icons
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { chromium, type Page } from 'playwright';

const RES = 'android/app/src/main/res';
/** The favicon's tile colour, also the dark theme's page colour (--bg). */
const TILE = '#0a1020';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;

const favicon = readFileSync('public/favicon.svg', 'utf8');
/** The mark alone: the favicon without its rounded tile. */
const mark = favicon.replace(/<rect[^>]*\/>\s*/, '');
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** An SVG of the mark over a 32-unit tile, framed by a viewBox (in favicon units). */
const svg = (viewBox: string, background = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">${background}${inner}</svg>`;

const ICONS = {
  // The square icon for launchers that predate adaptive icons: the favicon as it is.
  legacy: (size: number) => favicon.replace('<svg ', `<svg width="${size}" height="${size}" `),
  // A round tile, with the mark a little smaller so its corners stay inside the circle.
  round: () => svg('-2 -2 36 36', `<circle cx="16" cy="16" r="18" fill="${TILE}"/>`),
  // Adaptive foreground: 108 dp, of which the launcher may show only the central 66 dp. The 32-unit favicon
  // square maps onto the central 72 dp, so the mark (about 22 units wide) sits well inside the safe zone.
  foreground: () => svg('-8 -8 48 48'),
};

async function render(page: Page, html: string, width: number, height: number, path: string, transparent: boolean) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<html><body style="margin:0;background:transparent;width:${width}px;height:${height}px">${html}</body></html>`,
  );
  writeFileSync(`${RES}/${path}`, await page.screenshot({ omitBackground: transparent }));
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
try {
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const launcher = 48 * scale;
    const adaptive = 108 * scale;
    const box = (html: string, size: number) => `<div style="width:${size}px;height:${size}px">${html}</div>`;
    await render(page, ICONS.legacy(launcher), launcher, launcher, `mipmap-${density}/ic_launcher.png`, true);
    await render(
      page,
      box(ICONS.round(), launcher),
      launcher,
      launcher,
      `mipmap-${density}/ic_launcher_round.png`,
      true,
    );
    await render(
      page,
      box(ICONS.foreground(), adaptive),
      adaptive,
      adaptive,
      `mipmap-${density}/ic_launcher_foreground.png`,
      true,
    );
  }

  // Splash screens keep the template's sizes: the mark centred on the page colour.
  const splashes = readdirSync(RES)
    .filter((dir) => dir.startsWith('drawable'))
    .flatMap((dir) =>
      readdirSync(`${RES}/${dir}`)
        .filter((f) => f === 'splash.png')
        .map((f) => `${dir}/${f}`),
    );
  for (const path of splashes) {
    const { width, height } = PNG.sync.read(readFileSync(`${RES}/${path}`));
    const size = Math.round(Math.min(width, height) * 0.32);
    const html = `<div style="width:100%;height:100%;display:grid;place-items:center;background:${TILE}">${favicon.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;
    await render(page, html, width, height, path, false);
  }
} finally {
  await browser.close();
}

writeFileSync(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${TILE.toUpperCase()}</color>\n</resources>\n`,
);
console.log(`Wrote the launcher icons and splash screens in ${RES}`);
