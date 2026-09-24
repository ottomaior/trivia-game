import { expect, test, type Page } from '@playwright/test';
import { SLOW_BASE_URL } from '../playwright.config.ts';
import { joinByLink, openTv } from './helpers.ts';

// Throwing a power play takes three taps inside one vote: this test runs on the 40%-speed server.
test.use({ baseURL: SLOW_BASE_URL });

/** Votes for the first category, or answers A, whenever this phone asks (so rounds end early). */
async function playAlong(phone: Page) {
  if (await phone.getByRole('heading', { name: 'Válaszd ki a következő kategóriát' }).isVisible()) {
    await phone.getByRole('button').first().click({ timeout: 1_000 }).catch(() => {});
  }
  const answer = phone.getByTestId('choice-0');
  if ((await answer.isVisible()) && (await answer.isEnabled())) await answer.click({ timeout: 500 }).catch(() => {});
}

test('a power play freezes a phone until its player breaks the ice', async ({ browser }) => {
  test.setTimeout(150_000);
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  await anna.getByRole('button', { name: 'Indulhat a műsor' }).click();

  // Round 1 has no power plays; from round 2 Anna throws the ice at Béla, who keeps his.
  // (If a slow test machine ends the vote between her taps, she still holds it for the next round.)
  const annaPicker = anna.getByRole('heading', { name: 'Bevetsz egy csapdát?' });
  const belaPicker = bela.getByRole('heading', { name: 'Bevetsz egy csapdát?' });
  const ice = bela.getByTestId('ice');
  await expect(async () => {
    await Promise.all([playAlong(anna), playAlong(bela)]);
    if (await annaPicker.isVisible()) {
      await anna.getByRole('button', { name: /Jégcsapda/ }).click({ timeout: 500 }).catch(() => {});
      await anna.getByRole('button', { name: 'Béla' }).click({ timeout: 500 }).catch(() => {});
    }
    // Keeping his ends the vote sooner; if the vote's timer beats him to it, that's fine too.
    if (await belaPicker.isVisible()) {
      await bela.getByRole('button', { name: 'Nem most, megtartom' }).click({ timeout: 500 }).catch(() => {});
    }
    await expect(ice).toBeVisible({ timeout: 50 });
  }).toPass({ timeout: 120_000, intervals: [50] });

  // The TV puts the ice on Béla's desk. (Its "who hit whom" strip is gone too fast to check at E2E speed.)
  await expect(tv.locator('[data-desk] [data-testid="desk-freeze"]')).toHaveCount(1);

  // The ice covers Béla's answers until he taps through it.
  await expect(ice).toContainText('Koppints!');
  await expect(bela.getByTestId('choice-0')).toBeDisabled();
  for (let i = 0; i < 15; i++) await ice.dispatchEvent('pointerdown');
  await expect(ice).toBeHidden();

  // Free again: Béla answers in time.
  await bela.getByTestId('choice-0').click();
  await expect(bela.getByRole('heading', { name: 'Beküldve!' })).toBeVisible();
  expect(errors).toEqual([]);
});
