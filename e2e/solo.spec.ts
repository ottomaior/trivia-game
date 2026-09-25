import { expect, test } from '@playwright/test';
import { autoplay, joinByLink, openTv, startShow } from './helpers.ts';

test('one phone can play a whole game alone', async ({ browser }) => {
  // A whole 10-round game: about a minute at test speed, whatever the machine; setting up the TV
  // and phone takes longer when other specs run alongside.
  test.setTimeout(150_000);
  const { tv, code } = await openTv(browser);
  const solo = await joinByLink(browser, code, 'Otto');
  await expect(tv.getByText('A VIP a telefonjáról indítja a műsort')).toBeVisible();

  await startShow(solo);
  await autoplay(solo, 0);

  await expect(tv.getByRole('heading', { name: 'Végeredmény' })).toBeVisible();
  await expect(tv.getByTestId('podium')).toHaveCount(1);
  await expect(solo.getByRole('button', { name: 'Új játék' })).toBeVisible();
});
