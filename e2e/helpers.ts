import { devices, expect, type Browser, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions from a page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/**
 * Opens the TV and starts the show. Headless Chromium renders without a GPU,
 * so tests default to the light studio (`?fx=lite`); `?fx=full` and `?fx=flat`
 * pick the other modes, and any `?fx=` also skips the automatic FPS check.
 */
export async function openTv(browser: Browser, path = '/tv?fx=lite'): Promise<{ tv: Page; code: string; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await context.newPage();
  const errors = trackErrors(tv);
  await tv.goto(path);
  await tv.getByRole('button', { name: 'Kezdés' }).click();
  const codeEl = tv.getByTestId('room-code');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/);
  return { tv, code: (await codeEl.textContent())!, errors };
}

/** Every paper drawing on the page has loaded and decoded (no missing or broken bitmap). */
export async function expectArtLoaded(page: Page): Promise<void> {
  // Resolves to the drawings still missing, so a failure names them. Slow under
  // a full suite run, when several games download the art at once.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const art = [...document.images].filter((img) => img.src.includes('/art/'));
          if (art.length === 0) return ['(no art on the page)'];
          return art.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src);
        }),
      { timeout: 20_000 },
    )
    .toEqual([]);
}

export async function openPhone(browser: Browser, path = '/'): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

export async function joinByLink(browser: Browser, code: string, name: string, query = ''): Promise<Page> {
  const phone = await openPhone(browser, `/${code}${query}`);
  await phone.locator('input[name=name]').fill(name);
  await phone.getByRole('button', { name: 'Belépés' }).click();
  await expect(phone.getByTestId('my-name')).toHaveText(name);
  return phone;
}

/**
 * Plays like a person until the final screen: votes for the first category,
 * keeps climbing the ladder, taps answer `choice`, and in the party modes
 * writes a lie and picks the first option it may, sends the order as shown,
 * guesses `choice + 1` and bets both chips on the smallest guess.
 */
export async function autoplay(phone: Page, choice = 0): Promise<void> {
  const final = phone.getByRole('heading', { name: 'Végeredmény' });
  while (!(await final.isVisible())) {
    const vote = phone.getByRole('heading', { name: 'Válaszd ki a következő kategóriát' });
    if (await vote.isVisible()) {
      await phone.locator('button').filter({ hasNotText: 'Belépés' }).first().click({ timeout: 1_000 }).catch(() => {});
    }
    // Milliomos-létra: keep climbing.
    const stay = phone.getByRole('button', { name: 'Maradok' });
    if ((await stay.isVisible()) && (await stay.getAttribute('aria-pressed', { timeout: 500 }).catch(() => 'true')) !== 'true') {
      await stay.click({ timeout: 1_000 }).catch(() => {});
    }
    const answer = phone.getByTestId(`choice-${choice}`);
    // Checks after isVisible() are bounded: without a timeout they wait for the element,
    // which never comes back if the phase ended in between (e.g. the last question).
    if ((await answer.isVisible()) && (await answer.isEnabled({ timeout: 500 }).catch(() => false))) {
      await answer.click({ timeout: 1_000 }).catch(() => {});
    }
    // Party modes (one cheap check first, so the quiz polls as fast as ever).
    const party = phone.locator('[data-testid="lie-input"], [data-testid^="option-"], [data-testid="order-done"], [data-testid="guess-input"], [data-testid="bet-0"]');
    if ((await party.count()) > 0) await playPartyPhase(phone, choice);
    await phone.waitForTimeout(50);
  }
}

/** One step of a Blöffölő, Időrend or Tippelj! round, for autoplay. */
async function playPartyPhase(phone: Page, choice: number): Promise<void> {
  // Blöffölő: write a lie, then pick the first option that isn't your own.
  const lie = phone.getByTestId('lie-input');
  if (await lie.isVisible()) {
    await lie.fill(`kamu ${choice} ${Math.floor(Math.random() * 1e6)}`, { timeout: 1_000 }).catch(() => {});
    await phone.getByTestId('lie-submit').click({ timeout: 1_000 }).catch(() => {});
  }
  const option = phone.locator('[data-testid^="option-"]:enabled').first();
  if (await option.isVisible()) await option.click({ timeout: 1_000 }).catch(() => {});
  // Időrend: send the order as it is.
  const done = phone.getByTestId('order-done');
  if ((await done.isVisible()) && (await done.isEnabled({ timeout: 500 }).catch(() => false))) await done.click({ timeout: 1_000 }).catch(() => {});
  // Tippelj!: guess, then both chips on the first guess.
  const guess = phone.getByTestId('guess-input');
  if (await guess.isVisible()) {
    await guess.fill(String(choice + 1), { timeout: 1_000 }).catch(() => {});
    await phone.getByTestId('guess-submit').click({ timeout: 1_000 }).catch(() => {});
  }
  const bet = phone.getByTestId('bet-0');
  if ((await bet.isVisible()) && (await bet.isEnabled({ timeout: 500 }).catch(() => false))) await bet.click({ timeout: 1_000 }).catch(() => {});
}

/** The mode cards of the lobby, as their buttons are named. */
const MODE_NAMES = ['Kvíz', 'Milliomos-létra', 'Blöffölő', 'Időrend', 'Tippelj!'];

/**
 * The VIP's way into the show. `choice` is a mode card ('Milliomos-létra'…)
 * or a quiz pack ('Nagy mix'); with none, the quiz plays its default pack.
 * In the quiz the pack vote is closed with "Tovább"; a mode with one pack
 * lands on the category screen at once. Then "Indulhat a műsor".
 */
export async function startShow(vip: Page, choice?: string): Promise<void> {
  const mode = choice && MODE_NAMES.includes(choice) ? choice : 'Kvíz';
  await vip.getByTestId('mode-picker').getByRole('button', { name: new RegExp(`^${mode}`) }).click();
  if (mode === 'Kvíz') {
    if (choice) await vip.getByRole('button', { name: new RegExp(`^${choice}`) }).click();
    await vip.getByRole('button', { name: 'Tovább' }).click();
  }
  await vip.getByRole('button', { name: 'Indulhat a műsor' }).click();
}
