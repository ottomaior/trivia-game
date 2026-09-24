import { expect, test } from '@playwright/test';
import { autoplay, joinByLink, openTv } from './helpers.ts';

test('one phone can play a whole game alone', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const solo = await joinByLink(browser, code, 'Otto');
  await expect(tv.getByText('A VIP a telefonjáról indítja a műsort')).toBeVisible();

  await solo.getByRole('button', { name: 'Indulhat a műsor' }).click();
  await autoplay(solo, 0);

  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  await expect(tv.getByTestId('podium')).toHaveCount(1);
  await expect(solo.getByRole('button', { name: 'Új játék' })).toBeVisible();
});
