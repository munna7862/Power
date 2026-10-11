import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTOSAVES_KEPT, isSlot, MAX_SAVE_BYTES, SaveFolder } from '../../electron/saves';

const save = (n: number) => JSON.stringify({ n });

describe('desktop save folder', () => {
  let dir: string;
  let folder: SaveFolder;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'apex-saves-'));
    folder = new SaveFolder(join(dir, 'saves'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('writes, reads and removes a manual slot, creating the folder on first save', async () => {
    expect(await folder.read('slot-1')).toBeNull();
    await folder.write('slot-1', save(1));
    expect(await folder.read('slot-1')).toBe(save(1));
    expect(await readdir(folder.dir)).toEqual(['slot-1.json']);
    await folder.remove('slot-1');
    expect(await folder.read('slot-1')).toBeNull();
  });

  it(`keeps the last ${AUTOSAVES_KEPT} autosaves and reads the newest`, async () => {
    for (let n = 1; n <= 5; n++) await folder.write('autosave', save(n));
    expect(await folder.read('autosave')).toBe(save(5));
    expect((await readdir(folder.dir)).sort()).toEqual(['autosave-1.json', 'autosave-2.json', 'autosave.json']);
    expect(await readFile(join(folder.dir, 'autosave-1.json'), 'utf8')).toBe(save(4));
    expect(await readFile(join(folder.dir, 'autosave-2.json'), 'utf8')).toBe(save(3));
  });

  it('falls back to the newest readable autosave when the latest is damaged or missing', async () => {
    for (let n = 1; n <= 3; n++) await folder.write('autosave', save(n));
    await writeFile(join(folder.dir, 'autosave.json'), '{"n": 3, "cut off mid-wri');
    expect(await folder.read('autosave')).toBe(save(2));
    await rm(join(folder.dir, 'autosave.json'));
    await rm(join(folder.dir, 'autosave-1.json'));
    expect(await folder.read('autosave')).toBe(save(1));
    await folder.remove('autosave');
    expect(await folder.read('autosave')).toBeNull();
  });

  it('never leaves a temporary file behind and overwrites a slot in place', async () => {
    await folder.write('slot-2', save(1));
    await folder.write('slot-2', save(2));
    expect(await readdir(folder.dir)).toEqual(['slot-2.json']);
    expect(await folder.read('slot-2')).toBe(save(2));
  });

  it('accepts only the game’s slot names, so the renderer can never choose a path', () => {
    expect(isSlot('slot-3')).toBe(true);
    expect(isSlot('autosave')).toBe(true);
    for (const bad of ['../../evil', 'slot-9', 'autosave-1', '', null, 3, 'slot-1/../x'])
      expect(isSlot(bad)).toBe(false);
  });

  it('refuses absurdly large saves', async () => {
    await expect(folder.write('slot-1', 'x'.repeat(MAX_SAVE_BYTES + 1))).rejects.toThrow(/too large/);
    expect(await folder.read('slot-1')).toBeNull();
  });
});
