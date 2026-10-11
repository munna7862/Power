import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { debtToGdp, formatDate, VICTORY_CAUSES } from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Modal } from '../design/primitives';
import { pct } from '../format';
import styles from '../views/views.module.css';
import { SaveLoadModal } from './SaveLoadModal';

/**
 * Shown when the presidency ends, in defeat or in victory. Time is stopped; the player can load a save,
 * return to the menu or, after winning re-election, stay on in endless mode.
 */
export function GameOverModal() {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const [loading, setLoading] = useState(false);
  if (!game || game.status.kind !== 'over') return null;
  if (loading) return <SaveLoadModal mode="load" onClose={() => setLoading(false)} />;

  const { status, economy, meta, clock, nation } = game;
  const won = VICTORY_CAUSES.includes(status.cause);
  const years = clock.tick / 365.25;
  const stats = [
    { id: 'years', value: t('gameOver.yearsValue', { years: years.toFixed(1) }) },
    { id: 'approval', value: `${nation.approval.toFixed(1)}%` },
    { id: 'growth', value: pct(economy.realGrowth) },
    { id: 'inflation', value: pct(economy.inflation) },
    { id: 'unemployment', value: pct(economy.unemployment) },
    { id: 'debt', value: pct(debtToGdp(economy), 0) },
  ] as const;

  return (
    <Modal title={status.title} onClose={() => gameStore.getState().quitToMenu()}>
      <p className={won ? styles.victory : styles.defeat} data-testid="game-over-verdict">
        {won ? t('gameOver.victory') : t('gameOver.defeat')}
      </p>
      <p>{status.summary}</p>
      <p className={styles.muted}>
        {t('gameOver.term', {
          name: meta.presidentName,
          from: formatDate(meta.startDate),
          to: formatDate(status.date),
        })}
      </p>
      <div className={styles.tiles}>
        {stats.map((s) => (
          <div key={s.id} className={styles.tile}>
            <span className={styles.tileLabel}>{t(`gameOver.stats.${s.id}`)}</span>
            <span className={styles.tileValue}>{s.value}</span>
          </div>
        ))}
      </div>
      {won && <p className={styles.note}>{t('gameOver.endlessNote')}</p>}
      <div className={styles.actions}>
        <Button onClick={() => setLoading(true)}>{t('gameOver.load')}</Button>
        {won && (
          <Button onClick={() => gameStore.getState().dispatch({ type: 'CONTINUE_IN_OFFICE' })}>
            {t('gameOver.endless')}
          </Button>
        )}
        <Button variant="primary" onClick={() => gameStore.getState().quitToMenu()}>
          {t('gameOver.menu')}
        </Button>
      </div>
    </Modal>
  );
}
