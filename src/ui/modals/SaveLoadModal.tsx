import { useEffect } from 'react';
import { ALL_SLOTS, AUTOSAVE_SLOT, MANUAL_SLOTS, type SlotId } from '../../platform/storage';
import { gameStore, useGame } from '../../store';
import { Button, Modal } from '../design/primitives';
import { formatSavedAt } from '../format';
import styles from '../screens/screens.module.css';

const slotName = (slot: SlotId) => (slot === AUTOSAVE_SLOT ? 'Autosave' : `Slot ${slot.replace('slot-', '')}`);

export function SaveLoadModal({ mode, onClose }: { mode: 'save' | 'load'; onClose: () => void }) {
  const slots = useGame((s) => s.slots);

  useEffect(() => {
    void gameStore.getState().refreshSlots();
  }, []);

  const shown: readonly SlotId[] = mode === 'save' ? MANUAL_SLOTS : ALL_SLOTS;

  const act = async (slot: SlotId) => {
    const ok = mode === 'save' ? await gameStore.getState().saveTo(slot) : await gameStore.getState().loadFrom(slot);
    if (ok) onClose();
  };

  return (
    <Modal title={mode === 'save' ? 'Save game' : 'Load game'} onClose={onClose}>
      <ul className={styles.slotList}>
        {shown.map((slot) => {
          const info = slots.find((s) => s.slot === slot);
          return (
            <li key={slot} className={styles.slot}>
              <div>
                <div className={styles.slotName}>{slotName(slot)}</div>
                {info ? (
                  <div className={styles.slotMeta}>
                    {info.summary.presidentName} · {info.summary.gameDate} · {info.summary.difficulty} · saved{' '}
                    {formatSavedAt(info.savedAt)}
                  </div>
                ) : (
                  <div className={`${styles.slotMeta} ${styles.empty}`}>Empty</div>
                )}
              </div>
              <Button
                variant={mode === 'save' ? 'primary' : 'secondary'}
                disabled={mode === 'load' && !info}
                aria-label={`${mode === 'save' ? 'Save to' : 'Load'} ${slotName(slot)}`}
                onClick={() => void act(slot)}
              >
                {mode === 'save' ? (info ? 'Overwrite' : 'Save') : 'Load'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
