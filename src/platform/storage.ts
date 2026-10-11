/**
 * Save-slot persistence. The game only talks to the SaveStorage interface;
 * Phase 6 adds a filesystem adapter for Electron and Phase 7 one for Capacitor.
 */
export const MANUAL_SLOTS = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'] as const;
export const AUTOSAVE_SLOT = 'autosave';
export type SlotId = (typeof MANUAL_SLOTS)[number] | typeof AUTOSAVE_SLOT;
export const ALL_SLOTS: readonly SlotId[] = [AUTOSAVE_SLOT, ...MANUAL_SLOTS];

export interface SaveStorage {
  read(slot: SlotId): Promise<string | null>;
  write(slot: SlotId, data: string): Promise<void>;
  remove(slot: SlotId): Promise<void>;
}

const KEY_PREFIX = 'india-apex-sovereign:save:';

export class LocalStorageSaveStorage implements SaveStorage {
  async read(slot: SlotId): Promise<string | null> {
    return localStorage.getItem(KEY_PREFIX + slot);
  }

  async write(slot: SlotId, data: string): Promise<void> {
    localStorage.setItem(KEY_PREFIX + slot, data);
  }

  async remove(slot: SlotId): Promise<void> {
    localStorage.removeItem(KEY_PREFIX + slot);
  }
}

/** In-memory storage for tests and for browsers where localStorage is unavailable. */
export class MemorySaveStorage implements SaveStorage {
  private readonly data = new Map<SlotId, string>();

  async read(slot: SlotId): Promise<string | null> {
    return this.data.get(slot) ?? null;
  }

  async write(slot: SlotId, data: string): Promise<void> {
    this.data.set(slot, data);
  }

  async remove(slot: SlotId): Promise<void> {
    this.data.delete(slot);
  }
}

/** Uses localStorage when it works (it can throw in private windows), otherwise memory. */
export function createDefaultStorage(): SaveStorage {
  try {
    const probe = `${KEY_PREFIX}probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return new LocalStorageSaveStorage();
  } catch {
    return new MemorySaveStorage();
  }
}
