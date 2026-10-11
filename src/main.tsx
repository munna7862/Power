import '@fontsource-variable/inter';
import './ui/design/tokens.css';
import './ui/design/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { raiseEvent, startWar, type RegionId, type RivalId } from './sim';
import { gameStore } from './store';
import { App } from './ui/App';

if (import.meta.env.DEV) {
  // Test/debug hook for Playwright and the browser console. Never included in production builds.
  Object.assign(window, {
    __APEX__: {
      advanceDays: (days: number) => gameStore.getState().advanceDays(days, { interrupt: false }),
      getState: () => gameStore.getState(),
      /** Shallow-merges into game.nation / game.economy, e.g. to stage a crisis in an e2e test. */
      /** Raises an event right now, e.g. to stage a decision in an e2e test. */
      raiseEvent: (eventId: string, region?: RegionId, ref?: string) => {
        const { game } = gameStore.getState();
        if (game) gameStore.setState({ game: raiseEvent(game, eventId, region ?? null, ref ?? null) });
      },
      /** A rival declares war on India right now. */
      invade: (rival: RivalId) => {
        const { game } = gameStore.getState();
        if (game) gameStore.setState({ game: startWar(game, rival, 'rival') });
      },
      /** Every enemy at war with India offers a ceasefire. */
      offerCeasefire: () => {
        const { game } = gameStore.getState();
        if (!game) return;
        const wars = game.military.wars.map((w) => ({ ...w, ceasefireOffered: true }));
        gameStore.setState({ game: { ...game, military: { ...game.military, wars } } });
      },
      patchGame: (patch: {
        nation?: object;
        economy?: object;
        security?: object;
        military?: object;
        diplomacy?: object;
      }) => {
        const { game } = gameStore.getState();
        if (!game) return;
        gameStore.setState({
          game: {
            ...game,
            nation: { ...game.nation, ...patch.nation },
            economy: { ...game.economy, ...patch.economy },
            security: { ...game.security, ...patch.security },
            military: { ...game.military, ...patch.military },
            diplomacy: { ...game.diplomacy, ...patch.diplomacy },
          },
        });
      },
    },
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
