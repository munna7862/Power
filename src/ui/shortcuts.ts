import { useEffect } from 'react';
import { appShell } from '../platform/shell';
import { gameStore, SPEEDS, type ViewId } from '../store';
import { VIEWS } from './views/viewLabels';

/** F1–F10 open the screens in navigation order. */
export const VIEW_KEYS: Record<ViewId, string> = Object.fromEntries(VIEWS.map((v, i) => [v, `F${i + 1}`])) as Record<
  ViewId,
  string
>;

export type ShortcutId = 'pause' | 'speed' | 'screens' | 'handbook' | 'menu' | 'fullscreen';

/** The keyboard map, for the Settings screen and the handbook. Labels live in i18n under shortcuts.<id>. */
export const SHORTCUTS: readonly { id: ShortcutId; keys: readonly string[] }[] = [
  { id: 'pause', keys: ['Space'] },
  { id: 'speed', keys: ['1', '2', '3'] },
  { id: 'screens', keys: ['F1', '–', 'F10'] },
  { id: 'handbook', keys: ['H'] },
  { id: 'menu', keys: ['Esc'] },
  ...(appShell.canFullscreen ? [{ id: 'fullscreen' as const, keys: ['F11'] }] : []),
];

export interface ShortcutHandlers {
  openMenu(): void;
  openHandbook(): void;
  /** True while a dialog is open: only Escape (handled by the dialog) works then. */
  blocked: boolean;
}

/** Game-screen shortcuts: Space pauses, 1/2/3 set the speed, F1–F10 switch screens, H opens the handbook. */
export function useShortcuts({ openMenu, openHandbook, blocked }: ShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'F11' && appShell.canFullscreen) {
        e.preventDefault();
        appShell.toggleFullscreen();
        return;
      }
      if (blocked || document.querySelector('[role="dialog"]')) return;
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
      const store = gameStore.getState();

      const fn = /^F(\d{1,2})$/.exec(e.key);
      if (fn) {
        const view = VIEWS[Number(fn[1]) - 1];
        if (view) {
          e.preventDefault();
          store.setView(view);
        }
        return;
      }
      if (typing) return;
      if (e.code === 'Space') {
        // Space still presses a focused button or link, as keyboard users expect.
        if (target?.closest('button, a, [role="button"]')) return;
        e.preventDefault();
        store.togglePause();
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        store.setSpeed(SPEEDS[Number(e.key) - 1] ?? 1);
      } else if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        openHandbook();
      } else if (e.key === 'Escape') {
        openMenu();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu, openHandbook, blocked]);
}
