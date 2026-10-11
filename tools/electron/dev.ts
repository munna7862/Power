/**
 * Desktop development: starts the Vite dev server (hot reload), compiles the main and preload scripts, then
 * opens Electron pointed at the dev server. Closing the window stops everything.
 *   npm run electron:dev
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const tsc = spawnSync('npx', ['tsc', '-p', 'electron/tsconfig.json'], { stdio: 'inherit', shell: true });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('The Vite dev server did not report a URL.');

// The electron package's main export is the path of its binary.
const electron = createRequire(import.meta.url)('electron') as string;
const app = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });
app.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
