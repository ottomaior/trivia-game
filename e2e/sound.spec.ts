import { expect, test } from '@playwright/test';
import { joinByLink, openTv } from './helpers.ts';

test('every synthesized sound makes noise and none of them clips', async ({ browser }) => {
  const { tv } = await openTv(browser, '/tv?audiotest');
  await tv.waitForFunction(() => '__audioSelfTest' in window);
  const reports = await tv.evaluate(async () => {
    const run = (window as unknown as { __audioSelfTest: () => Promise<{ name: string; peak: number; rms: number }[]> })
      .__audioSelfTest;
    return (await run()).map(({ name, peak, rms }) => ({ name, peak, rms }));
  });
  // Crowd reactions without a synth version (ooh, aww, laugh, gasp, drumroll) only play from recordings.
  expect(reports.map((r) => r.name).sort()).toEqual(
    [
      'applause', 'cheer', 'join', 'start', 'vote', 'spinTick', 'spinLand', 'question', 'lockIn', 'tick', 'timeUp',
      'reveal', 'wrong', 'scoreboard', 'leadChange', 'winner', 'lobby', 'thinking',
    ].sort(),
  );
  for (const r of reports) {
    expect(r.peak, `${r.name} is audible`).toBeGreaterThan(0.05);
    expect(r.peak, `${r.name} does not clip`).toBeLessThan(1);
  }
});

test('M mutes the TV and the choice survives a reload', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  await joinByLink(browser, code, 'Anna');
  const mute = tv.getByTestId('mute');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await tv.keyboard.press('m');
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await tv.reload();
  const again = tv.getByRole('button', { name: 'Kattints a műsor folytatásához' });
  if (await again.isVisible().catch(() => false)) await again.click();
  await expect(tv.getByTestId('mute')).toHaveAttribute('aria-pressed', 'true');
  await tv.getByTestId('mute').click();
  await expect(tv.getByTestId('mute')).toHaveAttribute('aria-pressed', 'false');
});
