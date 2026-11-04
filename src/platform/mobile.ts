import { App } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { Theme } from './settings';
import type { SaveStorage, SlotId } from './storage';

/**
 * The Android app (Phase 7). The same web build runs inside Capacitor; everything it does on the phone goes
 * through this file, as the desktop goes through desktop.ts.
 */

/** True inside the Android (or, later, iOS) app; false in the browser and on the desktop. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/** The few file operations save storage needs, so it can be tested without a phone. */
export interface AppFiles {
  read(path: string): Promise<string | null>;
  write(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

const SAVES = 'saves';
const fileOf = (slot: SlotId) => `${SAVES}/${slot}.json`;
const tempOf = (slot: SlotId) => `${fileOf(slot)}.tmp`;

/**
 * Saves as files in the app's private data folder (backed up with the phone when the owner allows it). A save is
 * written to a temporary file first and then renamed over the old one, so a crash mid-write never loses a slot;
 * if the app died between the two steps, the temporary file is read instead.
 */
export class MobileSaveStorage implements SaveStorage {
  constructor(private readonly files: AppFiles) {}

  async read(slot: SlotId): Promise<string | null> {
    return (await this.files.read(fileOf(slot))) ?? (await this.files.read(tempOf(slot)));
  }

  async write(slot: SlotId, data: string): Promise<void> {
    await this.files.write(tempOf(slot), data);
    // Not every platform's rename replaces an existing file, so clear the way first; read() covers the gap.
    await this.files.remove(fileOf(slot));
    await this.files.rename(tempOf(slot), fileOf(slot));
  }

  async remove(slot: SlotId): Promise<void> {
    await this.files.remove(fileOf(slot));
    await this.files.remove(tempOf(slot));
  }
}

/** The app's data folder through Capacitor Filesystem. A missing file reads as null and removes quietly. */
export const capacitorFiles: AppFiles = {
  async read(path) {
    try {
      const { data } = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
      return typeof data === 'string' ? data : null;
    } catch {
      return null;
    }
  },
  async write(path, data) {
    await Filesystem.writeFile({ path, data, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
  },
  async rename(from, to) {
    await Filesystem.rename({ from, to, directory: Directory.Data, toDirectory: Directory.Data });
  },
  async remove(path) {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data });
    } catch {
      // Already gone.
    }
  },
};

/** Phone events the game reacts to. Each returns a function that stops listening. */
export interface AppEvents {
  /** The Android back button or gesture. */
  onBack(handler: () => void): () => void;
  /** The app went to the background (home button, another app, screen off). */
  onPause(handler: () => void): () => void;
}

const listen = (add: () => Promise<{ remove(): Promise<void> }>): (() => void) => {
  const handle = add();
  return () => void handle.then((h) => h.remove());
};

export const appEvents: AppEvents = {
  onBack: (handler) => listen(() => App.addListener('backButton', handler)),
  onPause: (handler) => listen(() => App.addListener('pause', handler)),
};

/** Closes the app (Android only). */
export const exitApp = (): void => void App.exitApp();

/** Sends the app to the background, as the home button would (Android only). */
export const minimizeApp = (): void => void App.minimizeApp();

/** Light status-bar icons on the dark theme, dark ones on the light theme. */
export const setSystemBars = (theme: Theme): void =>
  void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
    () => undefined,
  );
