import { describe, expect, it } from 'vitest';
import { MobileSaveStorage, type AppFiles } from '../../src/platform/mobile';
import { backAction } from '../../src/ui/mobile/back';

/** An in-memory folder whose rename, like some phones', refuses to replace an existing file. */
class FakeFiles implements AppFiles {
  readonly files = new Map<string, string>();

  async read(path: string) {
    return this.files.get(path) ?? null;
  }

  async write(path: string, data: string) {
    this.files.set(path, data);
  }

  async rename(from: string, to: string) {
    const data = this.files.get(from);
    if (data === undefined) throw new Error(`no ${from}`);
    if (this.files.has(to)) throw new Error(`${to} exists`);
    this.files.delete(from);
    this.files.set(to, data);
  }

  async remove(path: string) {
    this.files.delete(path);
  }
}

describe('saves on a phone', () => {
  it('write through a temporary file, overwrite and read back', async () => {
    const files = new FakeFiles();
    const storage = new MobileSaveStorage(files);
    expect(await storage.read('slot-1')).toBeNull();
    await storage.write('slot-1', 'first');
    await storage.write('slot-1', 'second');
    expect(await storage.read('slot-1')).toBe('second');
    expect([...files.files.keys()]).toEqual(['saves/slot-1.json']);
  });

  it('recover a save from its temporary file if the app died before the rename', async () => {
    const files = new FakeFiles();
    await files.write('saves/autosave.json.tmp', 'nearly saved');
    expect(await new MobileSaveStorage(files).read('autosave')).toBe('nearly saved');
  });

  it('remove a slot and any half-written copy', async () => {
    const files = new FakeFiles();
    const storage = new MobileSaveStorage(files);
    await storage.write('slot-2', 'game');
    await files.write('saves/slot-2.json.tmp', 'stale');
    await storage.remove('slot-2');
    expect(await storage.read('slot-2')).toBeNull();
    expect(files.files.size).toBe(0);
  });
});

describe('the Android back button', () => {
  it('closes a dialog first, wherever the player is', () => {
    expect(backAction({ dialogOpen: true, screen: 'game', view: 'budget' })).toBe('close-dialog');
    expect(backAction({ dialogOpen: true, screen: 'menu', view: 'dashboard' })).toBe('close-dialog');
  });

  it('walks back to the dashboard, then sends the app to the background rather than quitting', () => {
    expect(backAction({ dialogOpen: false, screen: 'game', view: 'energy' })).toBe('dashboard');
    expect(backAction({ dialogOpen: false, screen: 'game', view: 'dashboard' })).toBe('background');
  });

  it('leaves New Game for the menu, and the app from the menu', () => {
    expect(backAction({ dialogOpen: false, screen: 'new-game', view: 'dashboard' })).toBe('menu');
    expect(backAction({ dialogOpen: false, screen: 'menu', view: 'dashboard' })).toBe('exit');
  });
});
