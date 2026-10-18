import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * M6 demo, automated: the desktop game starts, the tutorial plays, the game saves to the user-data folder,
 * quits, relaunches and continues where it left off. Runs the unpacked build by default, or an installed or
 * packaged executable named by APEX_EXECUTABLE.
 */
const profile = mkdtempSync(join(tmpdir(), 'apex-desktop-'));
const savesDir = join(profile, 'saves');

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const env = { ...process.env, APEX_USER_DATA: profile } as Record<string, string>;
  delete env.VITE_DEV_SERVER_URL;
  const app = process.env.APEX_EXECUTABLE
    ? await electron.launch({ executablePath: process.env.APEX_EXECUTABLE, env })
    : await electron.launch({ args: ['.'], env });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Apex Sovereign' })).toBeVisible();
  return { app, page };
}

/**
 * Quits the app the way the game's own Quit button does (app.quit()). Playwright's app.close()
 * is awaited to ensure Playwright's worker teardown cleans up all handles cleanly.
 */
async function close(app: ElectronApplication): Promise<void> {
  const exited = app.waitForEvent('close').then(() => 'closed' as const);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), 10_000);
    timer.unref?.();
  });
  await app.evaluate(({ app: electronApp }) => electronApp.quit()).catch(() => undefined);
  if ((await Promise.race([exited, timeout])) === 'timeout') {
    const pid = app.process()?.pid;
    if (pid) {
      try {
        if (process.platform === 'win32') {
          app.process().kill('SIGKILL');
        } else {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            process.kill(pid, 'SIGKILL');
          }
        }
      } catch {
        // already exited
      }
    }
  }
  if (timer) clearTimeout(timer);
  await app.close().catch(() => undefined);
}

// Best-effort: Electron can hold the profile open for a moment after closing on Windows.
test.afterAll(() => {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    // A leftover temp folder is harmless.
  }
});

test('M6 demo: play the tutorial, save, quit, relaunch and continue', async () => {
  let { app, page } = await launch();

  // The desktop build can quit, and the page has no Node access.
  await expect(page.getByRole('button', { name: 'Quit' })).toBeVisible();
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.apexDesktop?.saves.read)).toBe('function');

  await page.getByRole('button', { name: 'New Game' }).click();
  await page.getByLabel("President's name").fill('Meera Iyer');
  await expect(page.getByRole('checkbox', { name: /Guided tutorial/ })).toBeChecked();
  await page.getByRole('button', { name: 'Begin term' }).click();

  const coach = page.getByTestId('tutorial');
  await coach.getByRole('button', { name: 'Next' }).click();
  await coach.getByRole('button', { name: 'Next' }).click();
  await page.keyboard.press('F4');
  await coach.getByRole('button', { name: 'Next' }).click();
  await page.keyboard.press('F5');
  await coach.getByRole('button', { name: 'Next' }).click();
  await expect(coach).toContainText('Build the country');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'Construction', exact: true })
    .click();
  await coach.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Speed 4×' }).click();
  await expect(coach).toContainText('Make the call', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: /Choose: Fund grain storage/ }).click();
  await page.keyboard.press('F8');
  await expect(coach).toContainText('Your advisor');
  await coach.getByRole('button', { name: 'Next' }).click();
  await coach.getByRole('button', { name: 'Next' }).click();
  await coach.getByRole('button', { name: 'Take office' }).click();
  await expect(coach).toHaveCount(0);

  const date = await page.getByTestId('game-date').textContent();
  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('button', { name: 'Save game' }).click();
  await page.getByRole('button', { name: 'Save to Slot 1' }).click();
  await expect(page.getByRole('status')).toContainText('Game saved');
  expect(existsSync(join(savesDir, 'slot-1.json'))).toBe(true);
  expect(readdirSync(savesDir).some((f) => f.endsWith('.tmp'))).toBe(false);

  // Quit through the game's own menu, then start the app again.
  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('button', { name: 'Quit to main menu' }).click();
  const closed = app.waitForEvent('close');
  await page
    .getByRole('button', { name: 'Quit' })
    .click()
    .catch(() => undefined);
  await closed;
  await app.close().catch(() => undefined);

  ({ app, page } = await launch());
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('game-date')).toHaveText(date ?? '');
  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText(savesDir)).toBeVisible();
  await close(app);
});

test('the window is locked down: sandboxed, isolated, no pop-ups or navigation away', async () => {
  const { app, page } = await launch();
  // Sandboxed and isolated: the page sees neither Node nor Electron, only the bridge the preload exposes.
  const exposed = await page.evaluate(() => ({
    process: typeof (window as unknown as { process?: unknown }).process,
    require: typeof (window as unknown as { require?: unknown }).require,
    bridge: Object.keys(window.apexDesktop ?? {}).sort(),
  }));
  expect(exposed).toEqual({
    process: 'undefined',
    require: 'undefined',
    bridge: ['platform', 'quit', 'saves', 'toggleFullscreen'],
  });
  expect(page.url()).toMatch(/^app:\/\/game\//);

  // No pop-ups.
  expect(await page.evaluate(() => window.open('https://example.com') === null)).toBe(true);
  expect(app.windows()).toHaveLength(1);

  // No navigating the game window away. The guard is exercised from the main process: a real refused
  // navigation leaves Chromium half-way through it, and on Linux the app then never quits cleanly.
  const refused = await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]!.webContents;
    const verdict = (url: string) => {
      let prevented = false;
      contents.emit('will-navigate', { preventDefault: () => (prevented = true) }, url);
      return prevented;
    };
    return { away: verdict('https://example.com/'), file: verdict('file:///etc/passwd'), home: verdict('app://game/') };
  });
  expect(refused).toEqual({ away: true, file: true, home: false });
  await close(app);
});
