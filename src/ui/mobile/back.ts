import type { Screen, ViewId } from '../../store/gameStore';

/** What the Android back button does, from the innermost thing on screen outwards. */
export type BackAction = 'close-dialog' | 'menu' | 'dashboard' | 'background' | 'exit';

export interface BackContext {
  /** A dialog (settings, a decision, the game menu…) is open. */
  dialogOpen: boolean;
  screen: Screen;
  view: ViewId;
}

/**
 * Back closes the open dialog, then leaves New Game for the menu, then returns a game to the dashboard. From the
 * dashboard it sends the app to the background (the game is paused and autosaved) rather than quitting a
 * presidency by accident; from the main menu it leaves the app.
 */
export function backAction({ dialogOpen, screen, view }: BackContext): BackAction {
  if (dialogOpen) return 'close-dialog';
  if (screen === 'new-game') return 'menu';
  if (screen === 'game') return view === 'dashboard' ? 'background' : 'dashboard';
  return 'exit';
}
