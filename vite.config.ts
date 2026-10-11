import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the same build loads from file:// inside Electron.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
});
