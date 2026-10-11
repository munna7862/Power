import { app, BrowserWindow, ipcMain, Menu, net, protocol, session, shell, type IpcMainInvokeEvent } from 'electron';
import { join, normalize, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isSlot, SaveFolder } from './saves.js';

/**
 * Electron main process for the desktop build. The game itself is the same web build as the browser
 * version; this file only opens a locked-down window and lets the renderer reach its save files.
 *
 * Security: context isolation on, Node integration off, the renderer sandboxed; navigation, new windows and
 * permission requests are refused; the page is served from a custom app:// scheme with a strict CSP, and
 * every IPC call checks who sent it and validates its arguments.
 */

const here = fileURLToPath(new URL('.', import.meta.url));
const devServer = process.env.VITE_DEV_SERVER_URL;
const SCHEME = 'app';
const ORIGIN = `${SCHEME}://game`;
const webRoot = join(here, '..', 'dist');

// Tests point the app at a throwaway profile; normal runs use the OS user-data folder.
if (process.env.APEX_USER_DATA) app.setPath('userData', process.env.APEX_USER_DATA);

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React writes inline style attributes; no inline <style> or scripts are used.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

let saves: SaveFolder;
let win: BrowserWindow | null = null;

/** Serves the built game from dist/ under app://game, refusing anything outside it. */
function serveGame(): void {
  protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const file = normalize(join(webRoot, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
    const inside = relative(webRoot, file);
    if (inside.startsWith('..') || inside.includes(`..${sep}`)) return new Response('Not found', { status: 404 });
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    return new Response(response.body, { status: response.status, headers });
  });
}

/** Only our own page may call into the main process. */
function trusted(event: IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  return url.startsWith(`${ORIGIN}/`) || (!!devServer && url.startsWith(devServer));
}

function registerIpc(): void {
  ipcMain.handle('saves:read', (event, slot: unknown) => {
    if (!trusted(event) || !isSlot(slot)) throw new Error('Refused.');
    return saves.read(slot);
  });
  ipcMain.handle('saves:write', (event, slot: unknown, data: unknown) => {
    if (!trusted(event) || !isSlot(slot) || typeof data !== 'string') throw new Error('Refused.');
    return saves.write(slot, data);
  });
  ipcMain.handle('saves:remove', (event, slot: unknown) => {
    if (!trusted(event) || !isSlot(slot)) throw new Error('Refused.');
    return saves.remove(slot);
  });
  ipcMain.handle('saves:folder', (event) => {
    if (!trusted(event)) throw new Error('Refused.');
    return saves.dir;
  });
  ipcMain.on('app:quit', (event) => {
    if (trusted(event)) app.quit();
  });
  ipcMain.on('app:fullscreen', (event) => {
    if (trusted(event) && win) win.setFullScreen(!win.isFullScreen());
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0a1020',
    title: 'India: Apex Sovereign',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  win.once('ready-to-show', () => win?.show());
  win.on('closed', () => (win = null));

  const contents = win.webContents;
  // No pop-ups. Links to the web (none today) open in the user's browser instead.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`) && !(devServer && url.startsWith(devServer))) event.preventDefault();
  });

  void (devServer ? win.loadURL(devServer) : win.loadURL(`${ORIGIN}/index.html`));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  void app.whenReady().then(() => {
    saves = new SaveFolder(join(app.getPath('userData'), 'saves'));
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    // macOS keeps a minimal menu for Cmd+Q and copy/paste; elsewhere the game needs none.
    Menu.setApplicationMenu(
      process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]) : null,
    );
    serveGame();
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
