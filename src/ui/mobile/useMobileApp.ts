import { useEffect } from 'react';
import { appEvents, exitApp, isNativeApp, minimizeApp, setSystemBars } from '../../platform/mobile';
import { gameStore } from '../../store';
import { useSettings } from '../../store/settingsStore';
import { backAction } from './back';

/**
 * Wires the phone to the game in the Android app; does nothing in the browser or on the desktop. The back button
 * walks out of the UI (see `backAction`), the clock pauses and the game autosaves when the app goes to the
 * background, and the status bar follows the theme.
 */
export function useMobileApp(): void {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    if (isNativeApp()) setSystemBars(theme);
  }, [theme]);

  useEffect(() => {
    if (!isNativeApp()) return;
    const stopBack = appEvents.onBack(() => {
      const store = gameStore.getState();
      const dialogOpen = document.querySelector('[role="dialog"]') !== null;
      switch (backAction({ dialogOpen, screen: store.screen, view: store.view })) {
        case 'close-dialog':
          // Every dialog is a Modal; the topmost one closes on Escape.
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          break;
        case 'menu':
          store.goTo('menu');
          break;
        case 'dashboard':
          store.setView('dashboard');
          break;
        case 'background':
          // Android then fires 'pause', whose handler below pauses the clock and autosaves.
          minimizeApp();
          break;
        case 'exit':
          exitApp();
          break;
      }
    });
    const stopPause = appEvents.onPause(() => void gameStore.getState().suspend());
    return () => {
      stopBack();
      stopPause();
    };
  }, []);
}
