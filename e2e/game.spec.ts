import { expect, test } from '@playwright/test';
import { SLOW_BASE_URL } from '../playwright.config.ts';
import { autoplay, joinByLink, openTv, startShow } from './helpers.ts';

// The 40%-speed server: at 15% a question is open for about 3s, less than it
// takes to reload a phone (or to notice a question and pause) when other specs
// run alongside.
test.use({ baseURL: SLOW_BASE_URL });

test('three phones play a full 10-round game on one TV', async ({ browser }) => {
  // About a minute and a half on its own; other spec files run alongside it, so give it room.
  test.setTimeout(240_000);
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  const cili = await joinByLink(browser, code, 'Cili');
  await expect(tv.getByTestId('seat')).toHaveCount(3);

  await startShow(anna);

  // First question: the TV and the phones show the same one.
  const prompt = anna.getByTestId('phone-prompt');
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  const first = (await prompt.textContent())!;
  await expect(tv.getByText(first)).toBeVisible({ timeout: 10_000 }); // on the question, or its reveal

  // Second question: a phone reloaded mid-question gets the question back. So
  // that the reload can't outlast the question, the game is held still
  // meanwhile: without a TV the server pauses (and the phones say so), and it
  // carries on from the same moment once the TV is back. A phone starts the
  // pause, as the phones show a new question before the busier TV page does.
  // Leaving the TV page closes its socket at once (closing the tab can leave
  // it to time out).
  const second = prompt.filter({ hasNotText: first });
  await expect(second).toBeVisible({ timeout: 30_000 });
  const text = (await second.textContent())!;
  const tvUrl = tv.url();
  await tv.goto('about:blank');
  await cili.reload();
  await expect(cili.getByText('A tévé kapcsolata megszakadt')).toBeVisible();
  await tv.goto(tvUrl);
  // The TV has to reconnect and reclaim its seat first (slow when other specs run alongside).
  await expect(cili.getByTestId('phone-prompt')).toHaveText(text, { timeout: 15_000 });
  // A freshly loaded TV page asks for a click to re-enable sound.
  const again = tv.getByRole('button', { name: 'Kattints a műsor folytatásához' });
  if (await again.isVisible().catch(() => false)) await again.click();

  await Promise.all([autoplay(anna, 0), autoplay(bela, 1), autoplay(cili, 0)]);

  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  await expect(tv.getByTestId('podium')).toHaveCount(3);
  await expect(tv.getByTestId('otto-line')).toBeVisible(); // Otto crowns the winner
  await expect(anna.getByRole('button', { name: 'Új játék' })).toBeVisible();
  await expect(bela.getByText('A VIP dönti el, mi jön.')).toBeVisible();

  // Everybody's name and final score is on the TV.
  const desks = (await tv.getByTestId('seat').allTextContents()).join(' ');
  for (const name of ['Anna', 'Béla', 'Cili']) expect(desks).toContain(name);
  expect(desks).toMatch(/\d+ pont/);

  // Back to a fresh lobby with the same players.
  await anna.getByRole('button', { name: 'Új váró' }).click();
  await expect(tv.getByTestId('seat')).toHaveCount(3);
  await expect(bela.getByRole('heading', { name: 'Melyik csomag legyen?' })).toBeVisible();

  // Sound, music and animations ran the whole game without a single error.
  expect(errors).toEqual([]);
});
