import { devices, expect, test, type Browser } from '@playwright/test';

async function phone(browser: Browser) {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  return context.newPage();
}

test('TV creates a room; phones join by QR link and by typing the code', async ({ page: tv, browser }) => {
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto('/tv');
  await tv.getByRole('button', { name: 'English' }).click();

  const codeEl = tv.getByTestId('room-code');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/);
  const code = (await codeEl.textContent())!;

  // Phone 1 arrives via the QR link, so the code is prefilled.
  const p1 = await phone(browser);
  await p1.goto(`/${code}`);
  await p1.locator('input[name=name]').fill('Anna');
  await p1.getByRole('button', { name: 'Join' }).click();
  await expect(p1.getByTestId('my-name')).toHaveText('Anna');
  await expect(p1.getByText('VIP', { exact: true })).toBeVisible();

  // Phone 2 types the code (lowercase) on the bare URL.
  const p2 = await phone(browser);
  await p2.goto('/');
  await p2.locator('input[name=code]').fill(code.toLowerCase());
  await p2.locator('input[name=name]').fill('Győző');
  await p2.getByRole('button', { name: 'Join' }).click();
  await expect(p2.getByTestId('my-name')).toHaveText('Győző');

  await expect(tv.getByTestId('seat')).toHaveCount(2);
  await expect(tv.getByText('Anna')).toBeVisible();
  await expect(tv.getByText('Győző')).toBeVisible();

  // Refreshing a phone keeps the same seat instead of adding a new one.
  await p2.reload();
  await expect(p2.getByTestId('my-name')).toHaveText('Győző');
  await expect(tv.getByTestId('seat')).toHaveCount(2);

  // Refreshing the TV resumes the same room.
  await tv.reload();
  await expect(tv.getByTestId('room-code')).toHaveText(code);
  await expect(tv.getByTestId('seat')).toHaveCount(2);
});

test('joining an unknown room shows a friendly error', async ({ browser }) => {
  const p = await phone(browser);
  await p.goto('/');
  await p.locator('input[name=code]').fill('ZZZZ');
  await p.locator('input[name=name]').fill('Anna');
  await p.getByRole('button', { name: 'Join' }).click();
  await expect(p.getByRole('alert')).toHaveText('No room with that code.');
});
