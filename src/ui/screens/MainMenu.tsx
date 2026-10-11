import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appShell } from '../../platform/shell';
import { gameStore, useGame } from '../../store';
import { Button } from '../design/primitives';
import { HandbookModal } from '../handbook/HandbookModal';
import { SaveLoadModal } from '../modals/SaveLoadModal';
import { SettingsModal } from '../modals/SettingsModal';
import styles from './screens.module.css';

export function MainMenu() {
  const { t } = useTranslation();
  const hasSaves = useGame((s) => s.slots.length > 0);
  const [modal, setModal] = useState<'load' | 'settings' | 'handbook' | null>(null);

  useEffect(() => {
    void gameStore.getState().refreshSlots();
  }, []);

  return (
    <main className={styles.menuScreen}>
      <div className={styles.menuCard}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>{t('menu.eyebrow')}</span>
          <h1 className={styles.title}>{t('menu.title')}</h1>
          <p className={styles.tagline}>{t('menu.tagline')}</p>
        </div>

        <nav className={styles.menuButtons} aria-label={t('menu.label')}>
          <Button variant="primary" size="large" block onClick={() => gameStore.getState().goTo('new-game')}>
            {t('menu.newGame')}
          </Button>
          <Button size="large" block disabled={!hasSaves} onClick={() => void gameStore.getState().continueLatest()}>
            {t('menu.continue')}
          </Button>
          <Button size="large" block disabled={!hasSaves} onClick={() => setModal('load')}>
            {t('menu.loadGame')}
          </Button>
          <Button size="large" block onClick={() => setModal('handbook')}>
            {t('menu.handbook')}
          </Button>
          <Button size="large" block onClick={() => setModal('settings')}>
            {t('menu.settings')}
          </Button>
          {appShell.canQuit && (
            <Button size="large" block onClick={appShell.quit}>
              {t('menu.quit')}
            </Button>
          )}
        </nav>

        <p className={styles.footer}>{t('menu.footer', { version: __APP_VERSION__ })}</p>
      </div>

      {modal === 'load' && <SaveLoadModal mode="load" onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'handbook' && <HandbookModal onClose={() => setModal(null)} />}
    </main>
  );
}
