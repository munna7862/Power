/** Host-environment capabilities. The browser build has no quit; Electron (Phase 6) will. */
export interface Shell {
  canQuit: boolean;
  quit(): void;
  /** Wall-clock timestamp for save metadata. The simulation itself never reads the clock. */
  nowIso(): string;
  currentYear(): number;
}

export const browserShell: Shell = {
  canQuit: false,
  quit: () => undefined,
  nowIso: () => new Date().toISOString(),
  currentYear: () => new Date().getFullYear(),
};
