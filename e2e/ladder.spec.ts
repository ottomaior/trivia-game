import { expect, test } from '@playwright/test';
import { autoplay, joinByLink, openTv, startShow } from './helpers.ts';

test('Milliomos-létra: the staircase, a lifeline, walking away, and a final in rungs', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  await bela.getByRole('button', { name: /^Milliomos-létra/ }).click();
  await startShow(anna, 'Milliomos-létra');

  // Rung 1: the TV shows the staircase; nobody can walk away yet.
  await expect(tv.getByTestId('ladder-board')).toBeVisible({ timeout: 15_000 });
  await expect(anna.getByText('Indul a létra!', { exact: false })).toBeVisible();

  // 50:50 takes two choices away, and can't be used twice.
  const fifty = anna.getByRole('button', { name: 'Felezés' });
  await expect(fifty).toBeEnabled({ timeout: 15_000 });
  await fifty.click();
  const visibleChoices = async () => {
    const left: number[] = [];
    for (let i = 0; i < 4; i++) if (await anna.getByTestId(`choice-${i}`).isVisible()) left.push(i);
    return left;
  };
  await expect.poll(async () => (await visibleChoices()).length).toBe(2);
  await expect(fifty).toBeDisabled();
  const left = await visibleChoices();
  // Asking the audience needs someone off the ladder: nobody is, yet.
  await expect(anna.getByRole('button', { name: 'Közönség' })).toBeDisabled();

  await anna.getByTestId(`choice-${left[0]}`).click();
  await bela.getByTestId('choice-0').click();
  await expect(anna.getByTestId('verdict')).toBeVisible();

  // If Anna climbed, she stops at rung 2 and keeps rung 1.
  const walk = anna.getByRole('button', { name: 'Megállok' });
  if (await walk.isVisible({ timeout: 12_000 }).catch(() => false)) {
    await walk.click();
    await expect(walk).toHaveAttribute('aria-pressed', 'true');
  }

  await Promise.all([autoplay(anna, 0), autoplay(bela, 1)]);
  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  await expect(anna.getByText(/lépcső|Start/).first()).toBeVisible();
  expect(errors).toEqual([]);
});
