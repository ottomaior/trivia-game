import { expect, test } from '@playwright/test';
import { autoplay, joinByLink, openTv } from './helpers.ts';

test('three phones play a full 10-round game on one TV', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  const cili = await joinByLink(browser, code, 'Cili');
  await expect(tv.getByTestId('seat')).toHaveCount(3);

  await anna.getByRole('button', { name: 'Indulhat a műsor' }).click();

  // First question: check the TV and phones agree, and survive a phone reload.
  await expect(tv.getByTestId('prompt')).toBeVisible({ timeout: 10_000 });
  const prompt = await tv.getByTestId('prompt').textContent();
  await cili.reload();
  await expect(cili.getByText(prompt!)).toBeVisible();

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

  // Sound, music and animations ran the whole game without a single error.
  expect(errors).toEqual([]);
});
