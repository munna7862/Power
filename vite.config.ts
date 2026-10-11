import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the same build loads from file:// inside Electron (Phase 6).
  base: './',
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
});
