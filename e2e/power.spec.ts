import { expect, test, type Page } from '@playwright/test';
import { joinByLink, openTv } from './helpers.ts';

/** Votes for the first category whenever the vote is on this phone. */
async function voteIfAsked(phone: Page) {
  if (await phone.getByRole('heading', { name: 'Válaszd ki a következő kategóriát' }).isVisible()) {
    await phone.getByRole('button').first().click({ timeout: 1_000 }).catch(() => {});
  }
}

test('a power play freezes a phone until its player breaks the ice', async ({ browser }) => {
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  await anna.getByRole('button', { name: 'Indulhat a műsor' }).click();

  // Round 1 has no power plays; in round 2 Anna throws the ice at Béla, who keeps his.
  const annaPicker = anna.getByRole('heading', { name: 'Bevetsz egy csapdát?' });
  const belaPicker = bela.getByRole('heading', { name: 'Bevetsz egy csapdát?' });
  await expect(async () => {
    await Promise.all([voteIfAsked(anna), voteIfAsked(bela)]);
    await expect(annaPicker).toBeVisible({ timeout: 50 });
  }).toPass({ timeout: 30_000, intervals: [50] });
  await anna.getByRole('button', { name: /Jégcsapda/ }).click();
  await anna.getByRole('button', { name: 'Béla' }).click();
  // Keeping it ends the vote sooner; if the vote's timer beats him to it, that's fine too.
  if (await belaPicker.isVisible()) {
    await bela.getByRole('button', { name: 'Nem most, megtartom' }).click({ timeout: 1_000 }).catch(() => {});
  }
  // The TV puts the ice on Béla's desk. (Its "who hit whom" strip is gone too fast to check at E2E speed.)
  await expect(tv.locator('[data-desk] [data-testid="desk-freeze"]')).toHaveCount(1);

  // The ice covers Béla's answers until he taps through it (E2E answers are open for only 3s: tap fast).
  const ice = bela.getByTestId('ice');
  await expect(ice).toContainText('Koppints!');
  await expect(bela.getByTestId('choice-0')).toBeDisabled();
  for (let i = 0; i < 15; i++) await ice.dispatchEvent('pointerdown');
  await expect(ice).toBeHidden();

  // Free again: Béla answers in time.
  await bela.getByTestId('choice-0').click();
  await expect(bela.getByRole('heading', { name: 'Beküldve!' })).toBeVisible();
  expect(errors).toEqual([]);
});
