import { useState } from 'react';
import { debtToGdp, formatDate } from '../../sim';
import { gameStore, useGame } from '../../store';
import { Button, Modal } from '../design/primitives';
import { pct } from '../format';
import styles from '../views/views.module.css';
import { SaveLoadModal } from './SaveLoadModal';

/** Shown when the presidency ends. Time is stopped; the player can load a save or return to the menu. */
export function GameOverModal() {
  const game = useGame((s) => s.game);
  const [loading, setLoading] = useState(false);
  if (!game || game.status.kind !== 'over') return null;
  if (loading) return <SaveLoadModal mode="load" onClose={() => setLoading(false)} />;

  const { status, economy, meta, clock, nation } = game;
  const years = clock.tick / 365.25;
  const stats = [
    { label: 'Time in office', value: `${years.toFixed(1)} years` },
    { label: 'Final approval', value: `${nation.approval.toFixed(1)}%` },
    { label: 'Real growth', value: pct(economy.realGrowth) },
    { label: 'Inflation', value: pct(economy.inflation) },
    { label: 'Unemployment', value: pct(economy.unemployment) },
    { label: 'Debt (% of GDP)', value: pct(debtToGdp(economy), 0) },
  ];

  return (
    <Modal title={status.title} onClose={() => gameStore.getState().quitToMenu()}>
      <p>{status.summary}</p>
      <p className={styles.muted}>
        President {meta.presidentName} · {formatDate(meta.startDate)} – {formatDate(status.date)}
      </p>
      <div className={styles.tiles}>
        {stats.map((s) => (
          <div key={s.label} className={styles.tile}>
            <span className={styles.tileLabel}>{s.label}</span>
            <span className={styles.tileValue}>{s.value}</span>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <Button onClick={() => setLoading(true)}>Load a save</Button>
        <Button variant="primary" onClick={() => gameStore.getState().quitToMenu()}>
          Main menu
        </Button>
      </div>
    </Modal>
  );
}
