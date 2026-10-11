import { useStore } from 'zustand';
import { appShell } from '../platform/shell';
import { createDefaultStorage } from '../platform/storage';
import { createGameStore, type GameStoreState } from './gameStore';

export const gameStore = createGameStore(createDefaultStorage(), appShell);

export function useGame<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector);
}

export * from './gameStore';
