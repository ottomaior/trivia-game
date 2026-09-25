import { expect, test } from '@playwright/test';
import { autoplay, joinByLink, openTv, startShow } from './helpers.ts';

test('the full studio plays a solo game with lights and particles, without errors', async ({ browser }) => {
  // A whole 10-round game: about a minute at test speed, whatever the machine; setting up the TV
  // and phone takes longer when other specs run alongside.
  test.setTimeout(150_000);
  const { tv, code, errors } = await openTv(browser, '/tv?fx=full');
  await expect(tv.locator('[data-fx="full"]')).toBeVisible();
  await expect(tv.getByTestId('fx-canvas')).toHaveCount(1);
  const solo = await joinByLink(browser, code, 'Otto');
  await expect(tv.getByTestId('seat')).toHaveCount(1);

  await startShow(solo);
  // (The slot spin outlasts vote_result at the tests' 15% timing, so it isn't checked here.)
  await expect(tv.getByTestId('prompt')).toBeVisible({ timeout: 15_000 });
  await autoplay(solo, 0);

  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  await expect(tv.getByTestId('podium')).toHaveCount(1);
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
