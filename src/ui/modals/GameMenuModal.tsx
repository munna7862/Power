import { useState } from 'react';
import { gameStore } from '../../store';
import { Button, Modal } from '../design/primitives';
import styles from '../screens/screens.module.css';
import { SaveLoadModal } from './SaveLoadModal';
import { SettingsModal } from './SettingsModal';

export function GameMenuModal({ onClose }: { onClose: () => void }) {
  const [sub, setSub] = useState<'save' | 'load' | 'settings' | null>(null);

  if (sub === 'save' || sub === 'load') return <SaveLoadModal mode={sub} onClose={onClose} />;
  if (sub === 'settings') return <SettingsModal onClose={onClose} />;

  return (
    <Modal title="Game menu" onClose={onClose}>
      <div className={styles.menuButtons}>
        <Button block onClick={() => setSub('save')}>
          Save game
        </Button>
        <Button block onClick={() => setSub('load')}>
          Load game
        </Button>
        <Button block onClick={() => setSub('settings')}>
          Settings
        </Button>
        <Button block onClick={() => gameStore.getState().quitToMenu()}>
          Quit to main menu
        </Button>
      </div>
    </Modal>
  );
}
