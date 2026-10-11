import { beforeEach, describe, expect, it } from 'vitest';
import { serializeSave } from '../../src/sim';
import type { Shell } from '../../src/platform/shell';
import { MemorySaveStorage } from '../../src/platform/storage';
import { createGameStore, type GameStore } from '../../src/store/gameStore';
import { newGame } from '../helpers';

let clock = 0;
const testShell: Shell = {
  canQuit: false,
  quit: () => undefined,
  canFullscreen: false,
  toggleFullscreen: () => undefined,
  nowIso: () => new Date(Date.UTC(2026, 9, 11, 0, 0, clock++)).toISOString(),
  currentYear: () => 2026,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('game store', () => {
  let storage: MemorySaveStorage;
  let store: GameStore;

  beforeEach(() => {
    storage = new MemorySaveStorage();
    store = createGameStore(storage, testShell);
  });

  it('starts a new game paused on the dashboard', () => {
    store.getState().startNewGame({ presidentName: 'Asha Rao', difficulty: 'hard', seed: 1 });
    const s = store.getState();
    expect(s.screen).toBe('game');
    expect(s.speed).toBe(0);
    expect(s.game?.meta).toMatchObject({ presidentName: 'Asha Rao', difficulty: 'hard', seed: 1 });
    expect(s.game?.clock.date).toEqual({ year: 2026, month: 1, day: 1 });
  });

  it('starts with the chosen ideology and strategy', () => {
    store.getState().startNewGame({
      presidentName: 'A',
      difficulty: 'normal',
      seed: 1,
      ideology: 'socialism',
      strategy: 'agrarian',
    });
    expect(store.getState().game?.politics).toMatchObject({ ideology: 'socialism', strategy: 'agrarian' });
  });

  it('stops the clock and refuses to restart it when the presidency ends', async () => {
    store.getState().startNewGame({ presidentName: 'A', difficulty: 'normal', seed: 1 });
    const game = store.getState().game!;
    store.setState({
      game: {
        ...game,
        nation: { ...game.nation, approval: 2 },
        economy: { ...game.economy, inflation: 0.45, unemployment: 0.35, corruption: 100 },
      },
    });
    store.getState().setSpeed(4);
    store.getState().advanceDays(200, { interrupt: false });
    expect(store.getState().game?.status.kind).toBe('over');
    expect(store.getState().speed).toBe(0);
    store.getState().togglePause();
    store.getState().setSpeed(2);
    expect(store.getState().speed).toBe(0);
    await flush();
    expect((await storage.read('autosave')) ?? '').not.toContain('"kind":"over"');
  });

  it('pauses and resumes at the last chosen speed', () => {
    const s = store.getState();
    s.setSpeed(4);
    s.togglePause();
    expect(store.getState().speed).toBe(0);
    store.getState().togglePause();
    expect(store.getState().speed).toBe(4);
  });

  it('autosaves when a month closes, and only then', async () => {
    store.getState().startNewGame({ presidentName: 'A', difficulty: 'normal', seed: 1 });
    store.getState().advanceDays(10, { interrupt: false });
    await flush();
    expect(await storage.read('autosave')).toBeNull();
    store.getState().advanceDays(25, { interrupt: false });
    await flush();
    expect(await storage.read('autosave')).toContain('"tick":35');
  });

  it('saves to a slot and loads it back', async () => {
    store.getState().startNewGame({ presidentName: 'Saver', difficulty: 'normal', seed: 7 });
    store.getState().advanceDays(95, { interrupt: false });
    const saved = store.getState().game;
    expect(await store.getState().saveTo('slot-3')).toBe(true);
    expect(store.getState().slots.map((s) => s.slot)).toContain('slot-3');

    store.getState().advanceDays(50, { interrupt: false });
    expect(await store.getState().loadFrom('slot-3')).toBe(true);
    expect(store.getState().game).toEqual(saved);
    expect(store.getState().speed).toBe(0);
  });

  it('continues from the most recently written save', async () => {
    await storage.write('slot-1', serializeSave(newGame({ presidentName: 'Older' }), '2026-01-01T00:00:00.000Z'));
    await storage.write('slot-2', serializeSave(newGame({ presidentName: 'Newer' }), '2026-06-01T00:00:00.000Z'));
    expect(await store.getState().continueLatest()).toBe(true);
    expect(store.getState().game?.meta.presidentName).toBe('Newer');
  });

  it('reports empty and corrupt slots without crashing', async () => {
    expect(await store.getState().loadFrom('slot-4')).toBe(false);
    expect(store.getState().notice?.text).toMatch(/empty/);

    await storage.write('slot-5', '{"format":"india-apex-sovereign/save"}');
    expect(await store.getState().loadFrom('slot-5')).toBe(false);
    expect(store.getState().notice?.tone).toBe('error');
    await store.getState().refreshSlots();
    expect(store.getState().slots).toEqual([]);
  });

  it('routes commands through the simulation and surfaces validation errors', () => {
    store.getState().startNewGame({ presidentName: 'A', difficulty: 'normal', seed: 1 });
    expect(store.getState().dispatch({ type: 'SET_PRESIDENT_NAME', name: 'X' })).toBe(false);
    expect(store.getState().notice?.tone).toBe('error');
    expect(store.getState().dispatch({ type: 'MARK_ALL_LOG_READ' })).toBe(true);
    expect(store.getState().game?.log.every((e) => e.read)).toBe(true);
  });

  it('quits to the menu and pauses', () => {
    store.getState().startNewGame({ presidentName: 'A', difficulty: 'normal', seed: 1 });
    store.getState().setSpeed(2);
    store.getState().quitToMenu();
    expect(store.getState()).toMatchObject({ screen: 'menu', speed: 0 });
  });
});
