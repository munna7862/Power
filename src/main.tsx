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
