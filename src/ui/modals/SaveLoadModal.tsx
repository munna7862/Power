import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_SLOTS, AUTOSAVE_SLOT, MANUAL_SLOTS, type SlotId } from '../../platform/storage';
import { gameStore, useGame } from '../../store';
import { Button, Modal } from '../design/primitives';
import { formatSavedAt } from '../format';
import { t as translate } from '../i18n';
import styles from '../screens/screens.module.css';

const slotName = (slot: SlotId) =>
  slot === AUTOSAVE_SLOT ? translate('saves.autosave') : translate('saves.slot', { n: slot.replace('slot-', '') });

export function SaveLoadModal({ mode, onClose }: { mode: 'save' | 'load'; onClose: () => void }) {
  const { t } = useTranslation();
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
    <Modal title={mode === 'save' ? t('saves.saveTitle') : t('saves.loadTitle')} onClose={onClose}>
      <ul className={styles.slotList}>
        {shown.map((slot) => {
          const info = slots.find((s) => s.slot === slot);
          const name = slotName(slot);
          return (
            <li key={slot} className={styles.slot}>
              <div>
                <div className={styles.slotName}>{name}</div>
                {info ? (
                  <div className={styles.slotMeta}>
                    {t('saves.meta', {
                      president: info.summary.presidentName,
                      date: info.summary.gameDate,
                      difficulty: t(`difficulty.${info.summary.difficulty}.title`),
                      saved: formatSavedAt(info.savedAt),
                    })}
                  </div>
                ) : (
                  <div className={`${styles.slotMeta} ${styles.empty}`}>{t('saves.empty')}</div>
                )}
              </div>
              <Button
                variant={mode === 'save' ? 'primary' : 'secondary'}
                disabled={mode === 'load' && !info}
                aria-label={mode === 'save' ? t('saves.saveTo', { slot: name }) : t('saves.loadFrom', { slot: name })}
                onClick={() => void act(slot)}
              >
                {mode === 'save' ? (info ? t('saves.overwrite') : t('saves.save')) : t('saves.load')}
              </Button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
