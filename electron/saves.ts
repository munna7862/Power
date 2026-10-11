import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Save files on the desktop, in the OS user-data folder. Pure Node (no Electron), so it is unit-tested.
 *
 * Crash safety: a save is written to a temporary file, flushed to disk, then renamed over the old one, so a
 * crash or power cut mid-save leaves either the old save or the new one, never half of each. The last three
 * autosaves are kept (autosave, autosave-1, autosave-2); if the newest cannot be read, the next one is used.
 */

/** The slots the game may use. Anything else from the renderer is refused, so it can never name a path. */
export const SLOTS = ['autosave', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'] as const;
export type Slot = (typeof SLOTS)[number];

/** Autosaves kept, newest first: autosave.json, autosave-1.json, autosave-2.json. */
export const AUTOSAVES_KEPT = 3;

export const isSlot = (value: unknown): value is Slot =>
  typeof value === 'string' && (SLOTS as readonly string[]).includes(value);

/** The largest save accepted (a five-year game is well under 1 MB). */
export const MAX_SAVE_BYTES = 16 * 1024 * 1024;

const isJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

export class SaveFolder {
  constructor(readonly dir: string) {}

  private file(name: string): string {
    return join(this.dir, `${name}.json`);
  }

  /** The autosave generations, newest first. */
  private autosaves(): string[] {
    return Array.from({ length: AUTOSAVES_KEPT }, (_, i) => this.file(i === 0 ? 'autosave' : `autosave-${i}`));
  }

  private async readText(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  }

  /** The save in a slot, or null if empty. A damaged autosave falls back to the newest readable older one. */
  async read(slot: Slot): Promise<string | null> {
    if (slot !== 'autosave') return this.readText(this.file(slot));
    for (const path of this.autosaves()) {
      const text = await this.readText(path);
      if (text !== null && isJson(text)) return text;
    }
    return null;
  }

  /** Writes a save safely; writing the autosave first moves the older autosaves down one generation. */
  async write(slot: Slot, data: string): Promise<void> {
    if (Buffer.byteLength(data, 'utf8') > MAX_SAVE_BYTES) throw new Error('Save is too large.');
    await mkdir(this.dir, { recursive: true });
    const target = this.file(slot);
    const temp = `${target}.tmp`;
    const handle = await open(temp, 'w');
    try {
      await handle.writeFile(data, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (slot === 'autosave') await this.rotate();
    await rename(temp, target);
  }

  /** autosave-1 → autosave-2, autosave → autosave-1 (the oldest is overwritten). */
  private async rotate(): Promise<void> {
    const generations = this.autosaves();
    for (let i = generations.length - 1; i > 0; i--) {
      const from = generations[i - 1] as string;
      const to = generations[i] as string;
      try {
        await rename(from, to);
      } catch {
        // Nothing to move yet.
      }
    }
  }

  async remove(slot: Slot): Promise<void> {
    const paths = slot === 'autosave' ? this.autosaves() : [this.file(slot)];
    await Promise.all(paths.map((p) => rm(p, { force: true })));
  }
}
