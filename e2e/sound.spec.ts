import { expect, test } from '@playwright/test';
import { joinByLink, openTv, trackErrors } from './helpers.ts';

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

test("Otto's voice: the TV credits the voice service and plays recorded lines without errors", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  // Pretend every line was recorded (one tiny silent clip) by a service that asks for a credit.
  const { allOttoLines } = await import('../packages/shared/src/strings.ts');
  const manifest = Object.fromEntries(allOttoLines().map((l) => [l.id, { file: 'clip.wav', hash: 'x' }]));
  const silentWav = (() => {
    const samples = 2205;
    const b = Buffer.alloc(44 + samples * 2);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + samples * 2, 4);
    b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(22050, 24);
    b.writeUInt32LE(44100, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(samples * 2, 40);
    return b;
  })();
  await context.route('**/voice/manifest.json', (r) => r.fulfill({ json: manifest }));
  await context.route('**/voice/credit.json', (r) => r.fulfill({ json: { voice: 'ElevenLabs' } }));
  await context.route('**/voice/clip.wav', (r) => r.fulfill({ body: silentWav, contentType: 'audio/wav' }));
  const tv = await context.newPage();
  const errors = trackErrors(tv);
  await tv.goto('/tv?fx=lite');
  await expect(tv.getByTestId('voice-credit')).toHaveText('Otto hangja: ElevenLabs');
  await tv.getByRole('button', { name: 'Kezdés' }).click();
  const code = (await tv.getByTestId('room-code').textContent())!;
  await expect(tv.getByTestId('voice-credit')).toBeVisible();
  const anna = await joinByLink(browser, code, 'Anna');
  await anna.getByRole('button', { name: 'Indulhat a műsor' }).click();
  await expect(tv.getByTestId('otto-line')).toBeVisible();
  // Otto's mouth follows the recording instead of flapping.
  await expect(tv.getByTestId('otto-rig')).toHaveAttribute('data-voiced', 'true');
  await tv.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
