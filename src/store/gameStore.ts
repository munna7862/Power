import { createStore } from 'zustand/vanilla';
import {
  advanceDays as simAdvanceDays,
  advanceUntilAttention,
  createInitialState,
  dispatch as simDispatch,
  parseSave,
  serializeSave,
  type Command,
  type Difficulty,
  type GameOptions,
  type GameState,
  type IdeologyId,
  type SaveSummary,
  type StrategyId,
} from '../sim';
import { browserShell, type Shell } from '../platform/shell';
import { ALL_SLOTS, AUTOSAVE_SLOT, type SaveStorage, type SlotId } from '../platform/storage';

export type Screen = 'menu' | 'new-game' | 'game';
export const SPEEDS = [1, 2, 4] as const;
/** 0 = paused; otherwise in-game days per real second. */
export type Speed = 0 | (typeof SPEEDS)[number];
export type ViewId =
  | 'dashboard'
  | 'inbox'
  | 'economy'
  | 'budget'
  | 'departments'
  | 'construction'
  | 'security'
  | 'police'
  | 'military'
  | 'world'
  | 'diplomacy'
  | 'reports';

export interface SlotInfo {
  slot: SlotId;
  savedAt: string;
  summary: SaveSummary;
}

export interface NewGameInput {
  presidentName: string;
  difficulty: Difficulty;
  seed?: number;
  ideology?: IdeologyId;
  strategy?: StrategyId;
  options?: Partial<GameOptions>;
}

export interface Notice {
  tone: 'info' | 'error';
  text: string;
}

export interface GameStoreState {
  screen: Screen;
  game: GameState | null;
  speed: Speed;
  /** Speed to resume at when un-pausing. */
  lastSpeed: Exclude<Speed, 0>;
  view: ViewId;
  /** The country open in the World screen, by ISO code. */
  country: string | null;
  slots: SlotInfo[];
  notice: Notice | null;
  /** The pending decision open in the decision dialog, if any. */
  decisionId: string | null;

  goTo(screen: Screen): void;
  setView(view: ViewId): void;
  /** Opens a country in the World screen. */
  openCountry(id: string | null): void;
  /** Opens a pending decision in the decision dialog and pauses the clock; null closes the dialog. */
  openDecision(pendingId: string | null): void;
  startNewGame(input: NewGameInput): void;
  /**
   * Advances the simulation. With `interrupt` (the default) the clock pauses as soon as a critical
   * event arrives or a new decision is waiting, so the player never sleeps through a crisis.
   */
  advanceDays(days: number, options?: { interrupt?: boolean }): void;
  setSpeed(speed: Speed): void;
  togglePause(): void;
  dispatch(command: Command): boolean;
  refreshSlots(): Promise<void>;
  saveTo(slot: SlotId): Promise<boolean>;
  loadFrom(slot: SlotId): Promise<boolean>;
  continueLatest(): Promise<boolean>;
  quitToMenu(): void;
  dismissNotice(): void;
}

export function createGameStore(storage: SaveStorage, shell: Shell = browserShell) {
  const store = createStore<GameStoreState>()((set, get) => {
    const writeSlot = async (slot: SlotId, game: GameState): Promise<void> => {
      await storage.write(slot, serializeSave(game, shell.nowIso()));
    };

    return {
      screen: 'menu',
      game: null,
      speed: 0,
      lastSpeed: 1,
      view: 'dashboard',
      country: null,
      slots: [],
      notice: null,
      decisionId: null,

      goTo: (screen) => set({ screen }),
      setView: (view) => set({ view }),
      openCountry: (country) => set(country ? { country, view: 'world' } : { country }),
      // Time stops while a decision is on screen, so it cannot lapse (with an indecision penalty) mid-read.
      openDecision: (decisionId) => set(decisionId ? { decisionId, speed: 0 } : { decisionId }),

      startNewGame: ({ presidentName, difficulty, seed, ideology, strategy, options }) => {
        const game = createInitialState({
          presidentName,
          difficulty,
          seed: seed ?? Math.floor(Math.random() * 0xffffffff),
          startYear: shell.currentYear(),
          ...(ideology && { ideology }),
          ...(strategy && { strategy }),
          ...(options && { options }),
        });
        set({
          game,
          screen: 'game',
          speed: 0,
          lastSpeed: 1,
          view: 'dashboard',
          country: null,
          notice: null,
          decisionId: null,
        });
      },

      advanceDays: (days, options) => {
        const { game } = get();
        if (!game || days <= 0) return;
        const interrupt = options?.interrupt ?? true;
        const { state: next, interrupted } = interrupt
          ? advanceUntilAttention(game, days)
          : { state: simAdvanceDays(game, days), interrupted: false };
        if (next.status.kind === 'over') {
          // Time stops when the presidency ends; keep the last autosave so the player can retry.
          set({ game: next, speed: 0 });
          return;
        }
        set(interrupted ? { game: next, speed: 0 } : { game: next });
        // Autosave whenever a month closes.
        if (next.clock.date.month !== game.clock.date.month || next.clock.date.year !== game.clock.date.year) {
          writeSlot(AUTOSAVE_SLOT, next).catch(() =>
            set({ notice: { tone: 'error', text: 'Autosave failed. Save manually to keep your progress.' } }),
          );
        }
      },

      setSpeed: (speed) => {
        if (speed !== 0 && get().game?.status.kind === 'over') return;
        set(speed === 0 ? { speed } : { speed, lastSpeed: speed });
      },
      togglePause: () => {
        const { speed, lastSpeed } = get();
        get().setSpeed(speed === 0 ? lastSpeed : 0);
      },

      dispatch: (command) => {
        const { game } = get();
        if (!game) return false;
        const result = simDispatch(game, command);
        set(result.ok ? { game: result.state } : { notice: { tone: 'error', text: result.error } });
        return result.ok;
      },

      refreshSlots: async () => {
        const slots: SlotInfo[] = [];
        for (const slot of ALL_SLOTS) {
          const json = await storage.read(slot);
          if (!json) continue;
          const parsed = parseSave(json);
          if (parsed.ok) slots.push({ slot, savedAt: parsed.save.savedAt, summary: parsed.save.summary });
        }
        set({ slots });
      },

      saveTo: async (slot) => {
        const { game } = get();
        if (!game) return false;
        try {
          await writeSlot(slot, game);
        } catch {
          set({ notice: { tone: 'error', text: 'Could not save the game. Storage may be full or unavailable.' } });
          return false;
        }
        await get().refreshSlots();
        set({ notice: { tone: 'info', text: 'Game saved.' } });
        return true;
      },

      loadFrom: async (slot) => {
        const json = await storage.read(slot);
        if (!json) {
          set({ notice: { tone: 'error', text: 'That save slot is empty.' } });
          return false;
        }
        const parsed = parseSave(json);
        if (!parsed.ok) {
          set({ notice: { tone: 'error', text: parsed.error } });
          return false;
        }
        set({ game: parsed.save.state, screen: 'game', speed: 0, view: 'dashboard', notice: null, decisionId: null });
        return true;
      },

      continueLatest: async () => {
        await get().refreshSlots();
        const latest = [...get().slots].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
        return latest ? get().loadFrom(latest.slot) : false;
      },

      quitToMenu: () => {
        set({ screen: 'menu', speed: 0 });
        void get().refreshSlots();
      },

      dismissNotice: () => set({ notice: null }),
    };
  });
  return store;
}

export type GameStore = ReturnType<typeof createGameStore>;
