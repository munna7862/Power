import { useEffect, useState } from 'react';
import { browserShell } from '../../platform/shell';
import { gameStore, useGame } from '../../store';
import { Button } from '../design/primitives';
import { SaveLoadModal } from '../modals/SaveLoadModal';
import { SettingsModal } from '../modals/SettingsModal';
import styles from './screens.module.css';

export function MainMenu() {
  const hasSaves = useGame((s) => s.slots.length > 0);
  const [modal, setModal] = useState<'load' | 'settings' | null>(null);

  useEffect(() => {
    void gameStore.getState().refreshSlots();
  }, []);

  return (
    <main className={styles.menuScreen}>
      <div className={styles.menuCard}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>India</span>
          <h1 className={styles.title}>Apex Sovereign</h1>
          <p className={styles.tagline}>You are the President. Every rupee, minister and crisis is your call.</p>
        </div>

        <nav className={styles.menuButtons} aria-label="Main menu">
          <Button variant="primary" size="large" block onClick={() => gameStore.getState().goTo('new-game')}>
            New Game
          </Button>
          <Button size="large" block disabled={!hasSaves} onClick={() => void gameStore.getState().continueLatest()}>
            Continue
          </Button>
          <Button size="large" block disabled={!hasSaves} onClick={() => setModal('load')}>
            Load Game
          </Button>
          <Button size="large" block onClick={() => setModal('settings')}>
            Settings
          </Button>
          {browserShell.canQuit && (
            <Button size="large" block onClick={browserShell.quit}>
              Quit
            </Button>
          )}
        </nav>

        <p className={styles.footer}>v0.1.0 · Phase 1 preview</p>
      </div>

      {modal === 'load' && <SaveLoadModal mode="load" onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
    </main>
  );
}
