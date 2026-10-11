import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { gameStore, useGame } from '../store';
import { useSettings } from '../store/settingsStore';
import { useAudio } from './audio/useAudio';
import { Button } from './design/primitives';
import { GameScreen } from './screens/GameScreen';
import { MainMenu } from './screens/MainMenu';
import { NewGame } from './screens/NewGame';
import styles from './screens/screens.module.css';

function NoticeToast() {
  const { t } = useTranslation();
  const notice = useGame((s) => s.notice);

  useEffect(() => {
    if (notice?.tone !== 'info') return;
    const timer = setTimeout(() => gameStore.getState().dismissNotice(), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`}
    >
      <span>{notice.text}</span>
      <Button variant="ghost" aria-label={t('common.dismiss')} onClick={() => gameStore.getState().dismissNotice()}>
        ✕
      </Button>
    </div>
  );
}

/** Applies the display preferences to the document root, where the design tokens read them. */
function useDisplaySettings() {
  const theme = useSettings((s) => s.theme);
  const palette = useSettings((s) => s.palette);
  const motion = useSettings((s) => s.motion);
  const uiScale = useSettings((s) => s.uiScale);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.palette = palette;
    root.dataset.motion = motion;
    // CSS zoom scales the whole interface, layout included (Chromium, and so Electron, supports it natively).
    root.style.setProperty('zoom', String(uiScale / 100));
  }, [theme, palette, motion, uiScale]);
}

export function App() {
  const screen = useGame((s) => s.screen);
  useDisplaySettings();
  useAudio();

  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'new-game' && <NewGame />}
      {screen === 'game' && <GameScreen />}
      <NoticeToast />
    </>
  );
}
