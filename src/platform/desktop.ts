import type { SaveStorage, SlotId } from './storage';

/**
 * The bridge the Electron preload script exposes as `window.apexDesktop` (see electron/preload.ts). The
 * renderer has no Node access: everything it may do on the desktop goes through these few calls.
 */
export interface DesktopBridge {
  /** "win32", "darwin" or "linux". */
  platform: string;
  quit(): void;
  toggleFullscreen(): void;
  saves: {
    read(slot: SlotId): Promise<string | null>;
    write(slot: SlotId, data: string): Promise<void>;
    remove(slot: SlotId): Promise<void>;
    /** The folder saves are kept in, for the Settings screen. */
    folder(): Promise<string>;
  };
}

declare global {
  interface Window {
    apexDesktop?: DesktopBridge;
  }
}

export const desktopBridge = (): DesktopBridge | undefined =>
  typeof window === 'undefined' ? undefined : window.apexDesktop;

/**
 * Saves as files in the OS user-data folder, through the main process. Writes there are crash-safe
 * (temporary file, then rename) and the last three autosaves are kept (electron/saves.ts).
 */
export class DesktopSaveStorage implements SaveStorage {
  constructor(private readonly bridge: DesktopBridge) {}

  read(slot: SlotId): Promise<string | null> {
    return this.bridge.saves.read(slot);
  }

  write(slot: SlotId, data: string): Promise<void> {
    return this.bridge.saves.write(slot, data);
  }

  remove(slot: SlotId): Promise<void> {
    return this.bridge.saves.remove(slot);
  }
}
