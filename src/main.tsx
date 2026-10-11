import '@fontsource-variable/inter';
import './ui/design/tokens.css';
import './ui/design/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { gameStore } from './store';
import { App } from './ui/App';

if (import.meta.env.DEV) {
  // Test/debug hook for Playwright and the browser console. Never included in production builds.
  Object.assign(window, {
    __APEX__: {
      advanceDays: (days: number) => gameStore.getState().advanceDays(days),
      getState: () => gameStore.getState(),
      /** Shallow-merges into game.nation / game.economy, e.g. to stage a crisis in an e2e test. */
      patchGame: (patch: { nation?: object; economy?: object }) => {
        const { game } = gameStore.getState();
        if (!game) return;
        gameStore.setState({
          game: {
            ...game,
            nation: { ...game.nation, ...patch.nation },
            economy: { ...game.economy, ...patch.economy },
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
