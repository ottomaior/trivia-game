import { devices, expect, type Browser, type Page } from '@playwright/test';

export async function openTv(browser: Browser): Promise<{ tv: Page; code: string }> {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await context.newPage();
  await tv.goto('/tv');
  await tv.getByRole('button', { name: 'Kezdés' }).click();
  const codeEl = tv.getByTestId('room-code');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/);
  return { tv, code: (await codeEl.textContent())! };
}

export async function openPhone(browser: Browser, path = '/'): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

export async function joinByLink(browser: Browser, code: string, name: string): Promise<Page> {
  const phone = await openPhone(browser, `/${code}`);
  await phone.locator('input[name=name]').fill(name);
  await phone.getByRole('button', { name: 'Belépés' }).click();
  await expect(phone.getByTestId('my-name')).toHaveText(name);
  return phone;
}

/**
 * Plays like a person: votes for the first category and taps answer
 * `choice` whenever those buttons are on screen, until the final screen.
 */
export async function autoplay(phone: Page, choice = 0): Promise<void> {
  const final = phone.getByRole('heading', { name: 'Végeredmény' });
  while (!(await final.isVisible())) {
    const vote = phone.getByRole('heading', { name: 'Válaszd ki a következő kategóriát' });
    if (await vote.isVisible()) {
      await phone.locator('button').filter({ hasNotText: 'Belépés' }).first().click({ timeout: 1_000 }).catch(() => {});
    }
    const answer = phone.getByTestId(`choice-${choice}`);
    if ((await answer.isVisible()) && (await answer.isEnabled())) {
      await answer.click({ timeout: 1_000 }).catch(() => {});
    }
    await phone.waitForTimeout(50);
  }
}
