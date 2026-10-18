import { useTranslation } from 'react-i18next';
import { dailyFinance, formatDate } from '../../sim';
import { gameStore, SPEEDS, useGame } from '../../store';
import { Button } from '../design/primitives';
import { formatCrore, formatCroreDelta } from '../format';
import { useTutorialTarget } from '../tutorial/tutorialStore';
import styles from './game.module.css';

export function TopBar({ onOpenMenu, onOpenHandbook }: { onOpenMenu: () => void; onOpenHandbook: () => void }) {
  const { t } = useTranslation();
  const game = useGame((s) => s.game);
  const speed = useGame((s) => s.speed);
  const target = useTutorialTarget();
  if (!game) return null;

  const { setSpeed } = gameStore.getState();
  const daily = dailyFinance(game).balance;

  return (
    <header className={styles.topbar}>
      <div className={styles.logo} aria-hidden="true">
        <span className={styles.logoEyebrow}>{t('menu.eyebrow')}</span>
        <span className={styles.logoName}>{t('menu.title')}</span>
      </div>

      <time className={styles.date} data-testid="game-date" aria-live="off">
        {formatDate(game.clock.date)}
      </time>

      <div
        className={styles.speed}
        role="group"
        aria-label={t('topbar.speed')}
        data-tutorial={target === 'speed' || undefined}
      >
        <button
          type="button"
          className={styles.speedButton}
          aria-label={t('topbar.pause')}
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
            aria-label={t('topbar.speedN', { speed: s })}
            aria-pressed={speed === s}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className={styles.topStats}>
        <div className={styles.topStat}>
          <span className={styles.topStatLabel}>{t('topbar.treasury')}</span>
          <span className={styles.topStatValue} data-testid="topbar-treasury">
            {formatCrore(game.nation.treasury)}
          </span>
          <span
            className={styles.topStatDelta}
            data-tone={daily < 0 ? 'danger' : 'good'}
            data-testid="topbar-daily"
            title={t('topbar.perDayHint')}
          >
            {t('topbar.perDay', { value: formatCroreDelta(daily) })}
          </span>
        </div>
        <div className={styles.topStat}>
          <span className={styles.topStatLabel}>{t('topbar.approval')}</span>
          <span className={styles.topStatValue} data-testid="topbar-approval">
            {game.nation.approval.toFixed(1)}%
          </span>
        </div>
        <Button
          variant="ghost"
          aria-label={t('topbar.handbook')}
          title={t('topbar.handbookHint')}
          data-tutorial={target === 'handbook' || undefined}
          onClick={onOpenHandbook}
        >
          ?
        </Button>
        <Button aria-label={t('topbar.menu')} onClick={onOpenMenu}>
          {t('topbar.menuButton')}
        </Button>
      </div>
    </header>
  );
}
