import { desktopBridge } from './desktop';

/** Host-environment capabilities. The browser build has no quit; the desktop (Electron) build does. */
export interface Shell {
  canQuit: boolean;
  quit(): void;
  /** True on the desktop build, where F11 toggles full screen. */
  canFullscreen: boolean;
  toggleFullscreen(): void;
  /** Wall-clock timestamp for save metadata. The simulation itself never reads the clock. */
  nowIso(): string;
  currentYear(): number;
}

export const browserShell: Shell = {
  canQuit: false,
  quit: () => undefined,
  canFullscreen: false,
  toggleFullscreen: () => undefined,
  nowIso: () => new Date().toISOString(),
  currentYear: () => new Date().getFullYear(),
};

/** The shell for wherever the game is running: Electron when its preload bridge is present, else the browser. */
export function detectShell(): Shell {
  const bridge = desktopBridge();
  if (!bridge) return browserShell;
  return {
    ...browserShell,
    canQuit: true,
    quit: () => bridge.quit(),
    canFullscreen: true,
    toggleFullscreen: () => bridge.toggleFullscreen(),
  };
}

export const appShell: Shell = detectShell();
