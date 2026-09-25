import { expect, test, type Page } from '@playwright/test';
import { FREEZE_TAPS } from '../packages/shared/src/rules.ts';
import { SLOW_BASE_URL } from '../playwright.config.ts';
import { joinByLink, openTv, startShow } from './helpers.ts';

// Throwing a power play takes three taps inside one vote: this test runs on the 40%-speed server.
test.use({ baseURL: SLOW_BASE_URL });

/** Votes for the first category, or answers A, whenever this phone asks (so rounds end early). */
async function playAlong(phone: Page) {
  if (await phone.getByRole('heading', { name: 'Válaszd ki a következő kategóriát' }).isVisible()) {
    await phone.getByRole('button').first().click({ timeout: 1_000 }).catch(() => {});
  }
  const answer = phone.getByTestId('choice-0');
  if ((await answer.isVisible()) && (await answer.isEnabled({ timeout: 500 }).catch(() => false))) {
    await answer.click({ timeout: 500 }).catch(() => {});
  }
}

test('a power play freezes a phone until its player breaks the ice', async ({ browser }) => {
  test.setTimeout(150_000);
  const { tv, code, errors } = await openTv(browser);
  const anna = await joinByLink(browser, code, 'Anna');
  const bela = await joinByLink(browser, code, 'Béla');
  await startShow(anna);

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

  // Béla must break the ice and answer within one question, open for only ~8s at this speed.
  // So the TV check runs alongside (the desk keeps its cracked ice for the rest of the round),
  // and the fifteen taps go in one burst: one round trip instead of fifteen, each slow under load.
  const tvShowsIce = expect(tv.locator('[data-desk] [data-testid="desk-freeze"]')).toHaveCount(1);
  tvShowsIce.catch(() => {}); // awaited below; don't report it twice if the phone fails first

  // The ice covers Béla's answers until he taps through it; taps count once answers open.
  await expect(ice).toContainText('Koppints!');
  await expect(bela.getByTestId('choice-0')).toBeDisabled();
  await ice.evaluate((el, taps) => {
    for (let i = 0; i < taps; i++) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true }));
  }, FREEZE_TAPS);
  await expect(ice).toBeHidden();

  // Free again: Béla answers in time, so the reveal counts his answer (right or wrong, not
  // "Lejárt az idő"). Not "Beküldve!": as the last to answer he ends the question, and that
  // screen can be gone before a check sees it. The reveal comes once the question ends (≤8s).
  await bela.getByTestId('choice-0').click();
  await expect(bela.getByTestId('verdict')).toContainText(/Helyes!|Nem egészen/, { timeout: 15_000 });
  await tvShowsIce;
  expect(errors).toEqual([]);
});
