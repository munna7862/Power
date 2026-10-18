import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RIVAL_CONTENT } from '../../sim';
import { gameStore, useGame, type ViewId } from '../../store';
import { useGameLoop } from '../hooks/useGameLoop';
import { HandbookModal } from '../handbook/HandbookModal';
import { ViewIcon } from '../icons';
import { GameMenuModal } from '../modals/GameMenuModal';
import { DecisionModal } from '../modals/DecisionModal';
import { Button } from '../design/primitives';
import { GameOverModal } from '../modals/GameOverModal';
import { useShortcuts, VIEW_KEYS } from '../shortcuts';
import { TutorialCoach } from '../tutorial/TutorialCoach';
import { useTutorialTarget } from '../tutorial/tutorialStore';
import { BudgetView } from '../views/BudgetView';
import { ConstructionView } from '../views/ConstructionView';
import { DepartmentsView } from '../views/DepartmentsView';
import { DashboardView } from '../views/DashboardView';
import { DiplomacyView } from '../views/DiplomacyView';
import { EnergyView } from '../views/EnergyView';
import { InboxView } from '../views/InboxView';
import { MilitaryView } from '../views/MilitaryView';
import { PoliceView } from '../views/PoliceView';
import { SecurityView } from '../views/SecurityView';
import { WorldView } from '../views/WorldView';
import { EconomyView } from '../views/EconomyView';
import { ReportsView } from '../views/ReportsView';
import { VIEWS } from '../views/viewLabels';
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
    case 'departments':
      return <DepartmentsView />;
    case 'construction':
      return <ConstructionView />;
    case 'energy':
      return <EnergyView />;
    case 'inbox':
      return <InboxView />;
    case 'security':
      return <SecurityView />;
    case 'police':
      return <PoliceView />;
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
  const { t } = useTranslation();
  const view = useGame((s) => s.view);
  const unread = useGame((s) => s.game?.log.filter((e) => !e.read).length ?? 0);
  const waiting = useGame((s) => s.game?.events.pending ?? []);
  const wars = useGame((s) => s.game?.military.wars ?? []);
  const offers = useGame((s) => s.game?.diplomacy.offers.length ?? 0);
  const target = useTutorialTarget();
  const [modal, setModal] = useState<'menu' | 'handbook' | null>(null);
  useGameLoop();

  const openMenu = useCallback(() => {
    gameStore.getState().setSpeed(0);
    setModal('menu');
  }, []);
  const openHandbook = useCallback(() => {
    gameStore.getState().setSpeed(0);
    setModal('handbook');
  }, []);
  useShortcuts({ openMenu, openHandbook, blocked: modal !== null });

  return (
    <div className={styles.shell}>
      <TopBar onOpenMenu={openMenu} onOpenHandbook={openHandbook} />

      <nav className={styles.nav} aria-label={t('nav.label')} data-testid="nav">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={styles.navItem}
            aria-current={view === v ? 'page' : undefined}
            aria-keyshortcuts={VIEW_KEYS[v]}
            title={VIEW_KEYS[v] ? t('nav.shortcut', { key: VIEW_KEYS[v] }) : undefined}
            data-tutorial={target === v || undefined}
            onClick={() => gameStore.getState().setView(v)}
          >
            <ViewIcon view={v} className={styles.navIcon} />
            {t(`nav.views.${v}`)}
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
          <div
            className={styles.alertBar}
            role="region"
            aria-label={t('alerts.decisionsLabel')}
            data-tutorial={target === 'decisions' || undefined}
          >
            <span>{t('alerts.decisions', { count: waiting.length })}</span>
            <Button
              variant="primary"
              onClick={() => {
                gameStore.getState().setView('inbox');
                // The most urgent decision first: the one whose deadline comes soonest.
                const urgent = [...waiting].sort((a, b) => a.expiresTick - b.expiresTick)[0];
                gameStore.getState().openDecision(urgent?.id ?? null);
              }}
            >
              {t('alerts.review')}
            </Button>
          </div>
        )}
        {offers > 0 && view !== 'diplomacy' && (
          <div className={styles.alertBar} role="region" aria-label={t('alerts.offersLabel')}>
            <span>{t('alerts.offers', { count: offers })}</span>
            <Button variant="primary" onClick={() => gameStore.getState().setView('diplomacy')}>
              {t('nav.views.diplomacy')}
            </Button>
          </div>
        )}
        {wars.length > 0 && view !== 'military' && (
          <div className={styles.alertBar} role="region" aria-label={t('alerts.warLabel')}>
            <span>
              {t('alerts.war', { countries: wars.map((w) => RIVAL_CONTENT[w.rival].name).join(t('common.and')) })}
            </span>
            <Button variant="primary" onClick={() => gameStore.getState().setView('military')}>
              {t('alerts.warRoom')}
            </Button>
          </div>
        )}
        <ActiveView view={view} />
      </main>

      {modal === 'menu' && <GameMenuModal onClose={() => setModal(null)} />}
      {modal === 'handbook' && <HandbookModal onClose={() => setModal(null)} />}
      <DecisionModal />
      <GameOverModal />
      <TutorialCoach />
    </div>
  );
}
