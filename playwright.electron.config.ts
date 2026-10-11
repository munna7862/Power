import { defineConfig } from '@playwright/test';

/**
 * Desktop smoke tests: Playwright drives the real Electron app (its own Chromium), not Google Chrome.
 *   npm run test:electron                       # the unpacked build in dist/ + dist-electron/
 *   APEX_EXECUTABLE="release/win-unpacked/India Apex Sovereign.exe" npx playwright test -c playwright.electron.config.ts
 */
export default defineConfig({
  testDir: 'e2e-desktop',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  outputDir: 'reports/test-results-desktop',
  use: { trace: 'retain-on-failure' },
});
