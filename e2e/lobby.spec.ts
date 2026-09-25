import { expect, test } from '@playwright/test';
import { expectArtLoaded, joinByLink, openPhone, openTv } from './helpers.ts';

test('TV creates a room; phones join by QR link and by typing the code', async ({ browser }) => {
  const { tv, code } = await openTv(browser);

  const p1 = await joinByLink(browser, code, 'Anna');
  await expect(p1.getByText('VIP', { exact: true })).toBeVisible();
  await expectArtLoaded(p1);

  // Phone 2 types the code (lowercase) on the bare URL.
  const p2 = await openPhone(browser);
  await p2.locator('input[name=code]').fill(code.toLowerCase());
  await p2.locator('input[name=name]').fill('Győző');
  await p2.getByRole('button', { name: 'Belépés' }).click();
  await expect(p2.getByTestId('my-name')).toHaveText('Győző');

  await expect(tv.getByTestId('seat')).toHaveCount(2);
  await expect(tv.getByText('Anna')).toBeVisible();
  await expect(tv.getByText('Győző')).toBeVisible();

  // Refreshing a phone keeps the same seat instead of adding a new one.
  await p2.reload();
  await expect(p2.getByTestId('my-name')).toHaveText('Győző');
  await expect(tv.getByTestId('seat')).toHaveCount(2);

  // Refreshing the TV resumes the same room. Chrome usually keeps the earlier
  // click across a reload; if not, the TV asks for one to re-enable sound.
  await tv.reload();
  const again = tv.getByRole('button', { name: 'Kattints a műsor folytatásához' });
  if (await again.isVisible().catch(() => false)) await again.click();
  await expect(tv.getByTestId('room-code')).toHaveText(code);
  await expect(tv.getByTestId('seat')).toHaveCount(2);

  // The VIP can remove a player.
  await p1.getByRole('button', { name: 'Kiküld' }).click();
  await expect(p2.getByText('A VIP kiküldött a szobából.')).toBeVisible();
  await expect(tv.getByTestId('seat')).toHaveCount(1);
});

test('joining an unknown room shows a friendly error', async ({ browser }) => {
  const p = await openPhone(browser);
  await p.locator('input[name=code]').fill('ZZZZ');
  await p.locator('input[name=name]').fill('Anna');
  await p.getByRole('button', { name: 'Belépés' }).click();
  await expect(p.getByRole('alert')).toHaveText('Nincs ilyen kódú szoba.');
});
