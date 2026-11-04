import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app (Phase 7, Sprint 7.1): the same Vite build as the browser and the desktop, inside Capacitor.
 * The page reaches the phone only through `src/platform/mobile.ts`.
 */
const config: CapacitorConfig = {
  appId: 'io.github.munna7862.apexsovereign',
  appName: 'India Apex Sovereign',
  webDir: 'dist',
  // The dark theme's page colour (--bg), so the WebView never flashes white while the game loads.
  backgroundColor: '#0a1020',
};

export default config;
