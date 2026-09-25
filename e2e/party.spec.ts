import { expect, test } from '@playwright/test';
import { SLOW_BASE_URL } from '../playwright.config.ts';
import { autoplay, joinByLink, openTv, startShow } from './helpers.ts';

// Each party round takes several taps and some typing: these run on the 40%-speed server.
test.use({ baseURL: SLOW_BASE_URL });
test.describe.configure({ timeout: 240_000 });

test('Blöffölő: lies are written, a friend falls for one, and the game runs to the final', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  await expect(bela.getByText('A VIP választja a játékmódot…')).toBeVisible();
  await startShow(anna, 'Blöffölő');

  // Everyone writes a lie; the phone keeps it, the TV only counts who's done.
  await expect(anna.getByTestId('lie-input')).toBeVisible({ timeout: 30_000 });
  await anna.getByTestId('lie-input').fill('Anna kamuja');
  await anna.getByTestId('lie-submit').click();
  await expect(anna.getByTestId('my-lie')).toHaveText('Anna kamuja');
  await expect(tv.getByTestId('bluff-board')).not.toContainText('Anna kamuja');
  await bela.getByTestId('lie-input').fill('Béla kamuja');
  await bela.getByTestId('lie-submit').click();

  // The lies and the truth, mixed: at least four options on the TV, your own one greyed out.
  await expect(tv.getByTestId('bluff-board')).toContainText('Anna kamuja');
  await expect(tv.locator('[data-testid="bluff-board"] li')).not.toHaveCount(3);
  await expect(anna.getByRole('button', { name: /Anna kamuja/ })).toBeDisabled();
  await bela.getByRole('button', { name: /Anna kamuja/ }).click();
  await anna.locator('[data-testid^="option-"]:enabled').first().click();

  // The reveal: the truth on the TV, Béla fooled by Anna.
  await expect(tv.getByTestId('correct-tile')).toBeVisible();
  await expect(bela.getByTestId('verdict')).toContainText('Anna');
  await expect(anna.getByTestId('verdict')).toContainText('1 embert átvertél');

  await Promise.all([autoplay(anna, 0), autoplay(bela, 1)]);
  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Időrend: one phone drags a row, the other uses the arrows, and the years come out', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla', '?order=arrows');
  await startShow(anna, 'Időrend');

  await expect(anna.getByTestId('order-list')).toBeVisible({ timeout: 30_000 });
  await expect(tv.getByTestId('order-board')).toBeVisible();

  // Anna drags the top row to the bottom with her finger (a mouse, here).
  const first = await anna.getByTestId('order-item-0').getAttribute('data-item');
  const top = (await anna.getByTestId('order-item-0').boundingBox())!;
  const bottom = (await anna.getByTestId('order-item-4').boundingBox())!;
  await anna.mouse.move(top.x + top.width / 2, top.y + top.height / 2);
  await anna.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await anna.mouse.move(top.x + top.width / 2, top.y + top.height / 2 + ((bottom.y - top.y + 20) * step) / 8);
  }
  await anna.mouse.up();
  await expect(anna.getByTestId('order-item-4')).toHaveAttribute('data-item', first!);

  // Béla's phone has arrows instead: moving the top row down one place.
  const belaFirst = await bela.getByTestId('order-item-0').getAttribute('data-item');
  await bela.getByTestId('order-down-0').click();
  await expect(bela.getByTestId('order-item-1')).toHaveAttribute('data-item', belaFirst!);

  await anna.getByTestId('order-done').click();
  await bela.getByTestId('order-done').click();
  await expect(tv.getByTestId('correct-tile')).toBeVisible();
  await expect(anna.getByTestId('verdict')).toBeVisible();

  await Promise.all([autoplay(anna, 0), autoplay(bela, 1)]);
  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Tippelj!: two guesses, chips on the guesses, and the exact answer at the reveal', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  await startShow(anna, 'Tippelj!');

  await expect(anna.getByTestId('guess-input')).toBeVisible({ timeout: 30_000 });
  await anna.getByTestId('guess-input').fill('abc');
  await anna.getByTestId('guess-submit').click();
  await expect(anna.getByRole('alert')).toBeVisible();
  await anna.getByTestId('guess-input').fill('1');
  await anna.getByTestId('guess-submit').click();
  await bela.getByTestId('guess-input').fill('1 000 000');
  await bela.getByTestId('guess-submit').click();

  // Both guesses on the TV, smallest first; each player puts two chips down.
  await expect(tv.getByTestId('guess-board')).toContainText(/1\s000\s000/);
  await anna.getByTestId('bet-0').click();
  await anna.getByTestId('bet-1').click();
  await bela.getByTestId('bet-1').click();
  await bela.getByTestId('bet-1').click();
  await expect(tv.getByTestId('correct-tile')).toBeVisible();
  await expect(anna.getByTestId('verdict')).toBeVisible();

  await Promise.all([autoplay(anna, 0), autoplay(bela, 1)]);
  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  expect(errors).toEqual([]);
});
