/**
 * Preload script: the only bridge between the sandboxed game page and the main process. It exposes a small,
 * fixed API as window.apexDesktop (typed in src/platform/desktop.ts) and nothing else; the page never gets
 * ipcRenderer or Node. Sandboxed preloads must be CommonJS, hence the .cts extension.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('apexDesktop', {
  platform: process.platform,
  quit: () => ipcRenderer.send('app:quit'),
  toggleFullscreen: () => ipcRenderer.send('app:fullscreen'),
  saves: {
    read: (slot: string): Promise<string | null> => ipcRenderer.invoke('saves:read', slot),
    write: (slot: string, data: string): Promise<void> => ipcRenderer.invoke('saves:write', slot, data),
    remove: (slot: string): Promise<void> => ipcRenderer.invoke('saves:remove', slot),
    folder: (): Promise<string> => ipcRenderer.invoke('saves:folder'),
  },
});
