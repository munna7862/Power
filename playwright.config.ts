import { defineConfig } from '@playwright/test';

// Google Chrome only, matching the single-browser policy in AGENTS.md.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'reports/playwright' }]] : 'list',
  outputDir: 'reports/test-results',
  use: {
    baseURL: 'http://localhost:5180',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chrome-desktop', use: { viewport: { width: 1920, height: 1080 } }, grepInvert: /@responsive|@phone/ },
    { name: 'chrome-narrow', use: { viewport: { width: 768, height: 1024 } }, grep: /@responsive/ },
    // A typical Android phone with touch, as the Phase 7 app runs (412 × 915 CSS pixels).
    {
      name: 'chrome-phone',
      use: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
      grep: /@phone/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
