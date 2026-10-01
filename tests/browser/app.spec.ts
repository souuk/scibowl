import { expect, test, type Page } from '@playwright/test';
import { testPacket } from '../helpers';
import { createGame } from '../../src/game/gameState';
import { writeFile } from 'node:fs/promises';
import { syntheticPdf } from './syntheticPdf';

async function seed(page: Page, phase?: string) {
  const packet = testPacket();
  const state = createGame(packet);
  await page.goto('/');
  await page.evaluate(({ packet, state }) => localStorage.setItem('science-bowl-practice:v1', JSON.stringify({ version: 1, savedAt: Date.now(), packet, draft: null, fileName: packet.fileName, fileHash: packet.fileHash, names: { A: 'Alpha', B: 'Beta' }, muted: true, match: { present: state, history: [] } })), { packet, state });
  await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click();
  await page.locator('h1').click();
  if (phase) await expect(page.getByTestId('phase')).toContainText(phase);
}

test('real DOE PDFs extract the verified counts without missing fields or pair loss', async ({ page }) => {
  await page.goto('/');
  const failures: string[] = [];
  page.on('pageerror', e => failures.push(e.message));
  for (const [name, count] of [['hs-old', 25], ['hs-new', 18], ['ms-old', 25], ['ms-new', 18]] as const) {
    const result = await page.evaluate(async name => {
      // Exercise the exact browser extraction/parser modules, without internet.
      const extractionPath = '/src/parser/extractPdf.ts', parserPath = '/src/parser/parseScienceBowlText.ts', validationPath = '/src/parser/validatePacket.ts';
      const { extractPdf } = await import(extractionPath);
      const { parseScienceBowlText } = await import(parserPath);
      const { validatePacket } = await import(validationPath);
      const response = await fetch(`/tests/fixtures/${name}.pdf`);
      const file = new File([await response.blob()], `${name}.pdf`, { type: 'application/pdf' });
      const extracted = await extractPdf(file, () => {});
      const draft = parseScienceBowlText(extracted);
      return { draft, validation: validatePacket(draft), texts: extracted.pages.map((p: any) => p.text) };
    }, name);
    const output = test.info().outputPath(`${name}-extraction.json`);
    await writeFile(output, JSON.stringify(result, null, 2));
    await test.info().attach(`${name}-extraction`, { path: output, contentType: 'application/json' });
    expect.soft(result.draft.stats).toMatchObject({ tossups: count, bonuses: count, pairs: count });
    expect.soft(result.draft.unassignedBlocks).toHaveLength(0);
    expect.soft(result.draft.unparsedSegments).toHaveLength(0);
    expect.soft(result.validation.diagnostics.filter((d: any) => d.severity === 'error')).toEqual([]);
    expect(result.validation.diagnostics.some((d: any) => d.message.includes('notation'))).toBe(true);
    if (name === 'hs-new') {
      expect(result.draft.draftPairs[0].tossup.answer).toContain('SEMICIRCULAR CANALS');
      expect(result.draft.draftPairs[8].bonus.answer.toLowerCase()).toContain('do not accept: neutron star');
      expect(result.draft.draftPairs[2].tossup.choices.W).toContain('Tropical depression');
    }
    if (name === 'hs-old') expect(result.draft.draftPairs[6].tossup.acceptedAnswers.join(' ')).toContain('POLARIS');
    if (name === 'ms-new') expect(result.draft.draftPairs[14].tossup.choices.Y).toContain('Magnetic field');
    if (name === 'ms-old') expect(result.draft.draftPairs[0].tossup.answer).toBe('NUCLEUS');
  }
  expect(failures).toEqual([]);
});

test('actual PDF upload starts without acknowledging flags and completes by keyboard', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:5173')) external.push(r.url()); });
  await page.goto('/');
  await page.getByLabel('PDF', { exact: true }).setInputFiles('tests/fixtures/hs-new.pdf');
  await page.getByRole('button', { name: 'Parse PDF', exact: true }).click();
  await expect(page.getByTestId('parse-counts')).toContainText('18 toss-ups');
  await expect(page.getByRole('button', { name: 'Start Round', exact: true })).toBeEnabled();
  await page.locator('.pair summary').first().click();
  await page.getByRole('button', { name: 'Check source PDF', exact: true }).first().click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.locator('canvas').evaluate(c => (c as HTMLCanvasElement).width)).toBeGreaterThan(500);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start Round', exact: true }).click();
  await expect(page.getByTestId('phase')).toContainText('TOSS-UP');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: test.info().outputPath('moderator.png'), fullPage: true });
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('c'); await page.keyboard.press('a'); await page.keyboard.press('r'); await page.keyboard.press('w');
    await expect(page.getByTestId('phase')).toContainText('BONUS');
    await page.keyboard.press('w'); // Must not score before Space.
    await expect(page.getByTestId('score-A')).toHaveText(String(i * 14 + 4));
    await page.keyboard.press('Space'); await page.keyboard.press('w');
  }
  await expect(page.getByRole('heading', { name: 'Round complete', exact: true })).toBeVisible();
  await expect(page.getByTestId('score-A')).toHaveText('252');
  await page.keyboard.press('Backspace'); await expect(page.getByTestId('score-A')).toHaveText('242');
  await expect(page.getByTestId('timer')).toContainText('PAUSED');
  expect(external).toEqual([]);
});

test('rapid input, repeat keys, Undo, review, focus, and refresh recovery', async ({ page }) => {
  await seed(page);
  await page.keyboard.down('a'); await page.keyboard.down('a'); await page.keyboard.up('a');
  await page.keyboard.press('d'); await page.keyboard.press('w');
  await expect(page.getByTestId('score-A')).toHaveText('4'); await expect(page.getByTestId('score-B')).toHaveText('0');
  await page.keyboard.press('Space'); await page.keyboard.press('w');
  await expect(page.getByTestId('score-A')).toHaveText('14');
  await page.keyboard.press('Space');
  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: /REVIEW/ })).toBeVisible();
  await page.keyboard.press('a'); await page.keyboard.press('w'); await expect(page.getByTestId('score-A')).toHaveText('14');
  await page.keyboard.press('Escape'); await expect(page.getByTestId('timer')).toContainText('PAUSED');
  await page.keyboard.press('Backspace'); // Undo starting second toss-up timer.
  await page.keyboard.press('Backspace'); // Undo bonus award.
  await expect(page.getByTestId('score-A')).toHaveText('4'); await expect(page.getByTestId('phase')).toContainText('BONUS');
  await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click();
  await expect(page.getByTestId('timer')).toContainText('PAUSED'); await expect(page.getByTestId('score-A')).toHaveText('4');
  await page.getByRole('button', { name: 'W — Correct', exact: true }).focus();
  await page.keyboard.press('Space'); // Native button activation: score once, no timer start on next toss-up.
  await expect(page.getByTestId('score-A')).toHaveText('14');
  await expect(page.getByTestId('timer')).toHaveText('Timer: 5.0');
});

test('timers hold on expiry and refresh does not run a recovered countdown', async ({ page }) => {
  await page.clock.install(); await seed(page);
  await page.keyboard.press('Space'); await page.clock.runFor(5001);
  await expect(page.getByTestId('timer')).toContainText('TIME');
  await page.keyboard.press('d'); await page.keyboard.press('w'); await page.keyboard.press('Space');
  await page.clock.runFor(15001); await expect(page.getByTestId('timer')).toContainText('5 SECONDS');
  await page.clock.runFor(5001); await expect(page.getByTestId('timer')).toContainText('TIME');
  await expect(page.getByTestId('score-B')).toHaveText('4');
  await page.keyboard.press('s'); await page.keyboard.press('Space'); await page.clock.runFor(1001);
  await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click();
  await expect(page.getByTestId('timer')).toContainText('PAUSED');
  const paused = await page.getByTestId('timer').textContent(); await page.clock.runFor(10000); await expect(page.getByTestId('timer')).toHaveText(paused!);
});

test('text editor keys do not fire shortcuts and corrupted PDFs show clear errors', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Team A', { exact: true }).fill('wasd n');
  await expect(page.getByLabel('Team A', { exact: true })).toHaveValue('wasd n');
  await page.getByLabel('PDF', { exact: true }).setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') });
  await page.getByRole('button', { name: 'Parse PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be opened');
});

test('reset cancellation preserves scores and confirmation clears history', async ({ page }) => {
  await seed(page); await page.keyboard.press('a'); await page.keyboard.press('w');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Reset Match', exact: true }).click(); await expect(page.getByTestId('score-A')).toHaveText('4');
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Reset Match', exact: true }).click();
  await expect(page.getByTestId('score-A')).toHaveText('0'); await expect(page.getByRole('button', { name: 'Undo (Backspace)', exact: true })).toBeDisabled();
});

test('textless and encrypted PDFs fail clearly without inventing questions', async ({ page }) => {
  await page.goto('/');
  for (const encrypted of [false, true]) {
    await page.getByLabel('PDF', { exact: true }).setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: syntheticPdf(encrypted) });
    await page.getByRole('button', { name: 'Parse PDF', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(encrypted ? 'Password-protected' : 'No extractable question text');
    await expect(page.getByRole('button', { name: 'Start Round', exact: true })).toBeDisabled();
  }
});

test('bonus audio signals fire once and canceled timers cannot sound later', async ({ page }) => {
  await page.clock.install(); await seed(page);
  await page.evaluate(() => {
    (window as any).tones = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { (window as any).tones++; return original.call(this); };
  });
  await page.getByLabel('Mute timer sounds').uncheck(); await page.locator('h1').click();
  await page.keyboard.press('a'); await page.keyboard.press('w'); await page.keyboard.press('Space');
  await page.clock.runFor(15050); expect(await page.evaluate(() => (window as any).tones)).toBe(1);
  await page.clock.runFor(5000); expect(await page.evaluate(() => (window as any).tones)).toBe(2);
  await page.clock.runFor(1000); expect(await page.evaluate(() => (window as any).tones)).toBe(2);
  await page.keyboard.press('Backspace'); await page.clock.runFor(30000); expect(await page.evaluate(() => (window as any).tones)).toBe(2);
});

test('old math fractions render from the original PDF without manual review', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Rule set', { exact: true }).selectOption('simplified');
  await page.getByLabel('PDF', { exact: true }).setInputFiles('tests/fixtures/hs-old.pdf');
  await page.getByRole('button', { name: 'Parse PDF', exact: true }).click();
  await expect(page.getByTestId('parse-counts')).toContainText('25 toss-ups');
  await page.getByRole('button', { name: 'Start Round', exact: true }).click();
  await page.keyboard.press('n'); await page.keyboard.press('n'); await page.keyboard.press('n');
  await page.keyboard.press('a'); await page.keyboard.press('w');
  const original = page.getByRole('region', { name: 'Original PDF notation', exact: true });
  await expect(original.locator('canvas')).toBeVisible();
  const size = await original.locator('canvas').evaluate(c => ({ width: (c as HTMLCanvasElement).width, height: (c as HTMLCanvasElement).height }));
  expect(size.width).toBeGreaterThan(300); expect(size.height).toBeGreaterThan(100); expect(size.height).toBeLessThan(800);
  await page.screenshot({ path: test.info().outputPath('original-math.png'), fullPage: true });
  await page.keyboard.press('Space'); await expect(page.getByTestId('timer')).not.toContainText('PAUSED');
  await page.keyboard.press('w'); await expect(page.getByTestId('score-A')).toHaveText('14');
  await page.keyboard.press('Backspace');
  await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click();
  await expect(page.getByText('Press O and reselect the original PDF', { exact: false })).toBeVisible();
  await page.locator('h1').click(); await page.keyboard.press('o');
  await page.getByLabel('Reselect the original PDF to view its pages').setInputFiles('tests/fixtures/hs-old.pdf');
  await expect(page.locator('.source canvas')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(original.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('score-A')).toHaveText('4');
  expect(errors).toEqual([]);
});

test('missing answer and header fields remain playable and recoverable', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const parser = '/src/parser/parseScienceBowlText.ts';
    const { parseScienceBowlText } = await import(parser);
    const draft = parseScienceBowlText({ pages: [{ page: 1, text: 'TOSS-UP\nUnreadable header, no answer marker' }] });
    localStorage.setItem('science-bowl-practice:v1', JSON.stringify({ version: 1, savedAt: Date.now(), packet: null, draft, fileName: 'incomplete.pdf', fileHash: 'test', names: { A: 'Alpha', B: 'Beta' }, muted: true, match: null }));
  });
  await page.reload(); await page.getByRole('button', { name: 'Resume saved review' }).click();
  await page.getByLabel('Rule set', { exact: true }).selectOption('simplified');
  await page.getByRole('button', { name: 'Start Round', exact: true }).click();
  await expect(page.getByText('(Official answer missing — use Source PDF or skip this question)', { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click();
  await expect(page.getByTestId('phase')).toContainText('TOSS-UP');
  await page.locator('h1').click(); await page.keyboard.press('a'); await page.keyboard.press('w');
  await expect(page.getByRole('heading', { name: 'Round complete', exact: true })).toBeVisible();
  await expect(page.getByTestId('score-A')).toHaveText('4');
});
