import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameStore } from '../../store';
import { Button, Modal } from '../design/primitives';
import { HandbookModal } from '../handbook/HandbookModal';
import styles from '../screens/screens.module.css';
import { SaveLoadModal } from './SaveLoadModal';
import { SettingsModal } from './SettingsModal';

export function GameMenuModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [sub, setSub] = useState<'save' | 'load' | 'settings' | 'handbook' | null>(null);

  if (sub === 'save' || sub === 'load') return <SaveLoadModal mode={sub} onClose={onClose} />;
  if (sub === 'settings') return <SettingsModal onClose={onClose} />;
  if (sub === 'handbook') return <HandbookModal onClose={onClose} />;

  return (
    <Modal title={t('gameMenu.title')} onClose={onClose}>
      <div className={styles.menuButtons}>
        <Button block onClick={() => setSub('save')}>
          {t('gameMenu.save')}
        </Button>
        <Button block onClick={() => setSub('load')}>
          {t('gameMenu.load')}
        </Button>
        <Button block onClick={() => setSub('handbook')}>
          {t('gameMenu.handbook')}
        </Button>
        <Button block onClick={() => setSub('settings')}>
          {t('gameMenu.settings')}
        </Button>
        <Button block onClick={() => gameStore.getState().quitToMenu()}>
          {t('gameMenu.quit')}
        </Button>
      </div>
    </Modal>
  );
}
