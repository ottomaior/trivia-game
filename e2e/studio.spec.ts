import { expect, test } from '@playwright/test';
import { autoplay, joinByLink, openTv, startShow } from './helpers.ts';

test('the full studio plays a solo game with lights and particles, without errors', async ({ browser }) => {
  // A whole 10-round game: about a minute at test speed, whatever the machine; setting up the TV
  // and phone takes longer when other specs run alongside.
  test.setTimeout(150_000);
  const { tv, code, errors } = await openTv(browser, '/tv?fx=full');
  await expect(tv.locator('[data-fx="full"]')).toBeVisible();
  const solo = await joinByLink(browser, code, 'Otto');
  await expect(tv.getByTestId('seat')).toHaveCount(1);

  await startShow(solo);
  // (The slot spin outlasts vote_result at the tests' 15% timing, so it isn't checked here.)
  await expect(tv.getByTestId('prompt')).toBeVisible({ timeout: 15_000 });
  await autoplay(solo, 0);

  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  await expect(tv.getByTestId('podium')).toHaveCount(1);
  // The light/particle canvas, checked once the game is over: without a GPU, Pixi starts WebGL
  // in software, which can take ~8s when other specs run alongside.
  await expect(tv.getByTestId('fx-canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('flat mode has no studio or particle canvas but the same screens', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser, '/tv?fx=flat');
  await expect(tv.locator('[data-fx="flat"]')).toBeVisible();
  const anna = await joinByLink(browser, code, 'Anna');
  await expect(tv.getByTestId('seat')).toHaveCount(1);
  await startShow(anna);
  await expect(tv.getByTestId('otto-line')).toBeVisible();
  await expect(tv.getByTestId('prompt')).toBeVisible({ timeout: 15_000 });
  await expect(tv.getByTestId('fx-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a slow TV steps down from the full studio to lite, then to flat', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(() => {
    (window as unknown as { __fakeFps: number }).__fakeFps = 10;
    // Start from a clean slate: no remembered mode from an earlier run.
    localStorage.removeItem('otto.fxmode');
  });
  const tv = await context.newPage();
  await tv.goto('/tv');
  await tv.getByRole('button', { name: 'Kezdés' }).click();
  await expect(tv.locator('[data-fx="flat"]')).toBeVisible({ timeout: 10_000 });
  await expect(tv.getByTestId('fx-canvas')).toHaveCount(0);
  await expect(tv.getByTestId('room-code')).toHaveText(/^[A-Z]{4}$/);
  // The choice is remembered, so the next visit starts flat without measuring again.
  expect(await tv.evaluate(() => localStorage.getItem('otto.fxmode'))).toContain('flat');
});

test('a TV that idles fine but stutters in the reveal steps down to lite', async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(() => {
    // Smooth while idle in every mode; the full studio's reveal is too much.
    (window as unknown as { __fakeFps: (kind: string, mode: string) => number }).__fakeFps = (kind, mode) =>
      kind === 'reveal' && mode === 'full' ? 10 : 60;
    localStorage.removeItem('otto.fxmode');
  });
  const tv = await context.newPage();
  await tv.goto('/tv');
  await tv.getByRole('button', { name: 'Kezdés' }).click();
  await expect(tv.locator('[data-fx="full"]')).toBeVisible();
  const code = (await tv.getByTestId('room-code').textContent())!;
  const solo = await joinByLink(browser, code, 'Otto');
  await startShow(solo);
  await expect(tv.getByTestId('prompt')).toBeVisible({ timeout: 15_000 });
  await expect(tv.locator('[data-fx="full"]')).toBeVisible(); // the idle sample passed
  const game = autoplay(solo, 0);
  await expect(tv.locator('[data-fx="lite"]')).toBeVisible({ timeout: 60_000 }); // the first reveal
  expect(await tv.evaluate(() => localStorage.getItem('otto.fxmode'))).toContain('lite');
  await game;
  await expect(tv.locator('[data-fx="lite"]')).toBeVisible(); // lite keeps up, so it stays
});

test('the intro plays the show open, or the title card when the clip is missing', async ({ browser }) => {
  // With the clip: it plays over the studio through the intro (in a browser with H.264).
  const { tv, code, errors } = await openTv(browser);
  const h264 = await tv.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') !== '');
  const anna = await joinByLink(browser, code, 'Anna');
  await startShow(anna);
  if (h264) await expect(tv.getByTestId('show-open')).toBeVisible();
  await expect(tv.getByTestId('prompt')).toBeVisible({ timeout: 20_000 });
  await expect(tv.getByTestId('show-open')).toHaveCount(0);
  expect(errors).toEqual([]);

  // Without it (a missing file here): the title card and the usual sounds instead.
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.route('**/clips/show-open.mp4', (r) => r.fulfill({ status: 404, body: '' }));
  const tv2 = await context.newPage();
  await tv2.goto('/tv?fx=lite');
  await tv2.getByRole('button', { name: 'Kezdés' }).click();
  const code2 = (await tv2.getByTestId('room-code').textContent())!;
  const bela = await joinByLink(browser, code2, 'Béla');
  await startShow(bela);
  await expect(tv2.getByRole('heading', { name: "Otto's Quiz Show" })).toBeVisible();
  await expect(tv2.getByTestId('show-open')).toHaveCount(0);
});
