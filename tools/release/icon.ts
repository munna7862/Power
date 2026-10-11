/**
 * Renders the desktop app icon (build/icon.png, 1024 × 1024) from the game's own favicon, public/favicon.svg,
 * so the browser tab and the installed app share one original mark. electron-builder derives the Windows
 * .ico, the macOS .icns and the Linux icons from this PNG.
 *   npm run icon
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SIZE = 1024;
const svg = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8');

mkdirSync(new URL('../../build/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await page.setContent(
  `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${SIZE}" height="${SIZE}" `)}</body></html>`,
);
await page.locator('svg').screenshot({
  path: new URL('../../build/icon.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
  omitBackground: true,
});
await browser.close();
console.log('Wrote build/icon.png');
