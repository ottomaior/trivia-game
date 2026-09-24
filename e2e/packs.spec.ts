import { expect, test } from '@playwright/test';
import { joinByLink, openTv } from './helpers.ts';

test('phones vote for a pack, the VIP trims its categories, and the TV follows along', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');

  // Votes show up on the TV as they come in, and can be changed.
  await bela.getByRole('button', { name: /^Alap/ }).click();
  await expect(tv.getByTestId('pack-tally')).toContainText('Alap');
  await bela.getByRole('button', { name: /^Nagy mix/ }).click();
  await anna.getByRole('button', { name: /^Nagy mix/ }).click();
  await expect(tv.getByTestId('pack-tally')).toContainText('Nagy mix');
  await expect(tv.getByTestId('pack-tally')).not.toContainText('Alap');
  await expect(bela.getByRole('button', { name: 'Tovább' })).toHaveCount(0);

  // The VIP closes the vote; only they can switch categories off.
  await anna.getByRole('button', { name: 'Tovább' }).click();
  await expect(tv.getByTestId('pack-setup')).toContainText('Nagy mix');
  await expect(bela.getByText('A VIP válogatja a kategóriákat…')).toBeVisible();
  const sport = anna.getByRole('switch', { name: /^Sport/ });
  await expect(sport).toHaveAttribute('aria-checked', 'true');
  await sport.click();
  await expect(sport).toHaveAttribute('aria-checked', 'false');
  await expect(bela.getByRole('listitem').filter({ hasText: /^Sport$/ })).toHaveCount(0);

  // "Vissza" reopens the vote; locking again brings every category back.
  await anna.getByRole('button', { name: 'Vissza' }).click();
  await anna.getByRole('button', { name: 'Tovább' }).click();
  await expect(anna.getByRole('switch', { name: /^Sport/ })).toHaveAttribute('aria-checked', 'true');
  await anna.getByRole('switch', { name: /^Sport/ }).click();

  await anna.getByRole('button', { name: 'Indulhat a műsor' }).click();
  await expect(tv.getByRole('heading', { name: 'Válasszatok kategóriát' })).toBeVisible({ timeout: 15_000 });
  await expect(tv.getByText('Nagy mix').first()).toBeVisible();
  await expect(tv.getByRole('listitem').filter({ hasText: /^Sport$/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});
