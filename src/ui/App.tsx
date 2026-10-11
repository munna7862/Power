import { useEffect } from 'react';
import { gameStore, useGame } from '../store';
import { useSettings } from '../store/settingsStore';
import { Button } from './design/primitives';
import { GameScreen } from './screens/GameScreen';
import { MainMenu } from './screens/MainMenu';
import { NewGame } from './screens/NewGame';
import styles from './screens/screens.module.css';

function NoticeToast() {
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
      <Button variant="ghost" aria-label="Dismiss" onClick={() => gameStore.getState().dismissNotice()}>
        ✕
      </Button>
    </div>
  );
}

export function App() {
  const screen = useGame((s) => s.screen);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'new-game' && <NewGame />}
      {screen === 'game' && <GameScreen />}
      <NoticeToast />
    </>
  );
}
