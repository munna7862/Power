import { useEffect, useState } from 'react';
import { RIVAL_CONTENT } from '../../sim';
import { gameStore, useGame, type ViewId } from '../../store';
import { useGameLoop } from '../hooks/useGameLoop';
import { ViewIcon } from '../icons';
import { GameMenuModal } from '../modals/GameMenuModal';
import { DecisionModal } from '../modals/DecisionModal';
import { Button } from '../design/primitives';
import { GameOverModal } from '../modals/GameOverModal';
import { BudgetView } from '../views/BudgetView';
import { CabinetView } from '../views/CabinetView';
import { DashboardView } from '../views/DashboardView';
import { DiplomacyView } from '../views/DiplomacyView';
import { InboxView } from '../views/InboxView';
import { MilitaryView } from '../views/MilitaryView';
import { SecurityView } from '../views/SecurityView';
import { WorldView } from '../views/WorldView';
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
    case 'inbox':
      return <InboxView />;
    case 'security':
      return <SecurityView />;
    case 'military':
      return <MilitaryView />;
    case 'world':
      return <WorldView />;
    case 'diplomacy':
      return <DiplomacyView />;
    case 'reports':
      return <ReportsView />;
  }
}

export function GameScreen() {
  const view = useGame((s) => s.view);
  const unread = useGame((s) => s.game?.log.filter((e) => !e.read).length ?? 0);
  const waiting = useGame((s) => s.game?.events.pending ?? []);
  const wars = useGame((s) => s.game?.military.wars ?? []);
  const offers = useGame((s) => s.game?.diplomacy.offers.length ?? 0);
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
            {v === 'inbox' && unread > 0 && (
              <span className={styles.navBadge} aria-hidden="true">
                {unread}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        {waiting.length > 0 && (
          <div className={styles.alertBar} role="region" aria-label="Pending decisions">
            <span>
              {waiting.length} decision{waiting.length === 1 ? '' : 's'} awaiting the President
            </span>
            <Button
              variant="primary"
              onClick={() => {
                gameStore.getState().setView('inbox');
                gameStore.getState().openDecision(waiting[0]?.id ?? null);
              }}
            >
              Review
            </Button>
          </div>
        )}
        {offers > 0 && view !== 'diplomacy' && (
          <div className={styles.alertBar} role="region" aria-label="Diplomatic offers">
            <span>
              {offers} diplomatic offer{offers === 1 ? '' : 's'} awaiting an answer
            </span>
            <Button variant="primary" onClick={() => gameStore.getState().setView('diplomacy')}>
              Diplomacy
            </Button>
          </div>
        )}
        {wars.length > 0 && view !== 'military' && (
          <div className={styles.alertBar} role="region" aria-label="War">
            <span>At war with {wars.map((w) => RIVAL_CONTENT[w.rival].name).join(' and ')}</span>
            <Button variant="primary" onClick={() => gameStore.getState().setView('military')}>
              War room
            </Button>
          </div>
        )}
        <ActiveView view={view} />
      </main>

      {menuOpen && <GameMenuModal onClose={() => setMenuOpen(false)} />}
      <DecisionModal />
      <GameOverModal />
    </div>
  );
}
