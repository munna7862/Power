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

  it('keep a slot when two writes overlap (pausing the app during the monthly autosave)', async () => {
    // Each step takes a turn of the event loop, as calls over the Capacitor bridge do, so unqueued writes interleave.
    const files = new SlowFiles();
    const storage = new MobileSaveStorage(files);
    await storage.write('autosave', 'old');
    await Promise.all([storage.write('autosave', 'month'), storage.write('autosave', 'paused')]);
    expect(await storage.read('autosave')).toBe('paused');
    expect([...files.files.keys()]).toEqual(['saves/autosave.json']);
  });

  it('carry on after a failed write, and let a removal wait for a write in progress', async () => {
    const files = new SlowFiles();
    const storage = new MobileSaveStorage(files);
    files.failNextWrite = true;
    await expect(storage.write('slot-3', 'lost')).rejects.toThrow('disk full');
    await storage.write('slot-3', 'kept');
    expect(await storage.read('slot-3')).toBe('kept');

    await Promise.all([storage.write('slot-3', 'newer'), storage.remove('slot-3')]);
    expect(await storage.read('slot-3')).toBeNull();
    expect(files.files.size).toBe(0);
  });
});

/** FakeFiles whose every step yields to the event loop first, and whose next write can be made to fail. */
class SlowFiles extends FakeFiles {
  failNextWrite = false;
  private readonly tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  override async read(path: string) {
    await this.tick();
    return super.read(path);
  }

  override async write(path: string, data: string) {
    await this.tick();
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('disk full');
    }
    return super.write(path, data);
  }

  override async rename(from: string, to: string) {
    await this.tick();
    return super.rename(from, to);
  }

  override async remove(path: string) {
    await this.tick();
    return super.remove(path);
  }
}

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
