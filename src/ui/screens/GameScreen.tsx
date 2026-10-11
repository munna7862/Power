import { useEffect, useState } from 'react';
import { gameStore, useGame, type ViewId } from '../../store';
import { useGameLoop } from '../hooks/useGameLoop';
import { ViewIcon } from '../icons';
import { GameMenuModal } from '../modals/GameMenuModal';
import { GameOverModal } from '../modals/GameOverModal';
import { BudgetView } from '../views/BudgetView';
import { CabinetView } from '../views/CabinetView';
import { ComingSoonView } from '../views/ComingSoonView';
import { DashboardView } from '../views/DashboardView';
import { EconomyView } from '../views/EconomyView';
import { ReportsView } from '../views/ReportsView';
import { VIEW_LABELS, VIEWS } from '../views/viewLabels';
import styles from './game.module.css';
import { TopBar } from './TopBar';

function ActiveView({ view }: { view: ViewId }) {
  switch (view) {
    case 'dashboard':
      return <DashboardView />;
    case 'economy':
      return <EconomyView />;
    case 'budget':
      return <BudgetView />;
    case 'cabinet':
      return <CabinetView />;
    case 'reports':
      return <ReportsView />;
    default:
      return <ComingSoonView view={view} />;
  }
}

export function GameScreen() {
  const view = useGame((s) => s.view);
  const [menuOpen, setMenuOpen] = useState(false);
  useGameLoop();

  // Space toggles pause, unless the player is typing or a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || menuOpen) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [role="dialog"]')) return;
      e.preventDefault();
      gameStore.getState().togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openMenu = () => {
    gameStore.getState().setSpeed(0);
    setMenuOpen(true);
  };

  return (
    <div className={styles.shell}>
      <TopBar onOpenMenu={openMenu} />

      <nav className={styles.nav} aria-label="Sections" data-testid="nav">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={styles.navItem}
            aria-current={view === v ? 'page' : undefined}
            onClick={() => gameStore.getState().setView(v)}
          >
            <ViewIcon view={v} className={styles.navIcon} />
            {VIEW_LABELS[v]}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        <ActiveView view={view} />
      </main>

      {menuOpen && <GameMenuModal onClose={() => setMenuOpen(false)} />}
      <GameOverModal />
    </div>
  );
}
