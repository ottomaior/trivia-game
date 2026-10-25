import { expect, test } from '@playwright/test';
import { joinByLink, openTv, startShow } from './helpers.ts';

test('the VIP pauses the show, carries on, then calls the game off back to the lobby', async ({ browser }) => {
  test.setTimeout(90_000);
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  await startShow(anna);

  // Only the VIP can call a break.
  await expect(anna.getByTestId('pause')).toBeVisible();
  await expect(bela.getByTestId('pause')).toHaveCount(0);

  await anna.getByTestId('pause').click();
  await expect(tv.getByTestId('tv-paused')).toContainText('Anna szünetet kért');
  await expect(bela.getByTestId('paused')).toContainText('Anna szünetet kért');
  await expect(bela.getByTestId('resume')).toHaveCount(0);

  await anna.getByTestId('resume').click();
  await expect(tv.getByTestId('tv-paused')).toHaveCount(0);
  await expect(bela.getByTestId('paused')).toHaveCount(0);

  // Calling it off asks first; then everyone is back in the lobby, still joined.
  await anna.getByTestId('pause').click();
  await anna.getByTestId('cancel-game').click();
  await anna.getByTestId('cancel-yes').click();
  await expect(tv.getByText('A VIP a telefonján választ játékmódot')).toBeVisible();
  await expect(tv.getByText('2/6 versenyző')).toBeVisible();
  await expect(bela.getByTestId('paused')).toHaveCount(0);
  await expect(anna.getByTestId('mode-picker')).toBeVisible();
  expect(errors).toEqual([]);
});
