import { formatDate } from '../../sim';
import { gameStore, SPEEDS, useGame } from '../../store';
import { Button } from '../design/primitives';
import { formatCrore } from '../format';
import styles from './game.module.css';

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const game = useGame((s) => s.game);
  const speed = useGame((s) => s.speed);
  if (!game) return null;

  const { setSpeed } = gameStore.getState();

  return (
    <header className={styles.topbar}>
      <div className={styles.logo} aria-hidden="true">
        <span className={styles.logoEyebrow}>INDIA</span>
        <span className={styles.logoName}>Apex Sovereign</span>
      </div>

      <time className={styles.date} data-testid="game-date" aria-live="off">
        {formatDate(game.clock.date)}
      </time>

      <div className={styles.speed} role="group" aria-label="Game speed">
        <button
          type="button"
          className={styles.speedButton}
          aria-label="Pause"
          aria-pressed={speed === 0}
          onClick={() => setSpeed(0)}
        >
          ❚❚
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={styles.speedButton}
            aria-label={`Speed ${s}×`}
            aria-pressed={speed === s}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className={styles.topStats}>
        <div className={styles.topStat}>
          <span className={styles.topStatLabel}>Treasury</span>
          <span className={styles.topStatValue} data-testid="topbar-treasury">
            {formatCrore(game.nation.treasury)}
          </span>
        </div>
        <div className={styles.topStat}>
          <span className={styles.topStatLabel}>Approval</span>
          <span className={styles.topStatValue} data-testid="topbar-approval">
            {game.nation.approval.toFixed(1)}%
          </span>
        </div>
        <Button aria-label="Game menu" onClick={onOpenMenu}>
          Menu
        </Button>
      </div>
    </header>
  );
}
