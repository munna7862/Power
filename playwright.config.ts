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
    { name: 'chrome-desktop', use: { viewport: { width: 1920, height: 1080 } }, grepInvert: /@responsive/ },
    { name: 'chrome-narrow', use: { viewport: { width: 768, height: 1024 } }, grep: /@responsive/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
