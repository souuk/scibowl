import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { testPacket } from '../helpers';
import { createGame } from '../../src/game/gameState';
import { defaultCompetition } from '../../src/game/competition';
async function seed(page: Page) {
  const packet = testPacket(); packet.competition = defaultCompetition;
  const state = createGame(packet);
  await page.goto('/');
  await page.evaluate(({ packet, state }) => localStorage.setItem('science-bowl-practice:v1', JSON.stringify({ version: 1, savedAt: Date.now(), packet, draft: null, fileName: packet.fileName, fileHash: packet.fileHash, names: { A: 'Alpha', B: 'Beta' }, muted: true, match: { present: state, history: [] } })), { packet, state });
  await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click(); await page.locator('h1').click();
}
test('competition rebound, recognition, interrupt penalty, recovery, and downloaded final results', async ({ page }) => {
  await seed(page);
  await page.keyboard.press('a'); await expect(page.getByTestId('phase')).not.toContainText('AWAITING');
  await page.keyboard.press('c'); await page.keyboard.press('a'); await page.keyboard.press('w'); await expect(page.getByTestId('score-A')).toHaveText('0');
  await page.keyboard.press('r'); await page.keyboard.press('s');
  await expect(page.getByTestId('score-B')).toHaveText('4'); await expect(page.getByRole('button', { name: 'A — Alpha buzz' })).toBeDisabled();
  await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click(); await page.locator('h1').click();
  await expect(page.getByTestId('match-clock')).toContainText('PAUSED');
  await expect(page.getByRole('button', { name: 'A — Alpha buzz' })).toBeDisabled();
  await page.keyboard.press('Space'); await page.keyboard.press('d'); await page.keyboard.press('r'); await page.keyboard.press('w');
  await expect(page.getByTestId('score-B')).toHaveText('8'); await page.keyboard.press('Space'); await page.keyboard.press('w');
  await expect(page.getByTestId('score-B')).toHaveText('18');
  await page.keyboard.press('c'); await page.keyboard.press('Space'); await page.keyboard.press('a'); await page.keyboard.press('r'); await page.keyboard.press('s');
  await expect(page.getByTestId('score-B')).toHaveText('18'); await page.keyboard.press('d'); await page.keyboard.press('r'); await page.keyboard.press('s');
  await expect(page.getByRole('heading', { name: 'Round complete', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export results (.txt)' }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/^scibowl-results-.*\.txt$/);
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('Beta (B): 18'); expect(text).toContain('interrupt penalty'); expect(text).toContain('Status: Complete'); expect(text).toContain('middle school');
});
test('match clock finishes started question, pauses for source, and recovers alongside bonus timer', async ({ page }) => {
  await page.clock.install(); await seed(page); await page.keyboard.press('c');
  await page.clock.runFor(1000); await page.keyboard.press('o'); await expect(page.getByTestId('match-clock')).toContainText('PAUSED');
  await page.keyboard.press('Escape'); await page.keyboard.press('g'); await page.keyboard.press('a'); await page.keyboard.press('r'); await page.keyboard.press('w'); await page.keyboard.press('Space');
  await page.clock.runFor(1000); await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click();
  await expect(page.getByTestId('match-clock')).toContainText('PAUSED'); await expect(page.getByTestId('timer')).toContainText('PAUSED');
  await page.locator('h1').click(); await page.keyboard.press('g'); await page.clock.fastForward(500000);
  await expect(page.getByTestId('phase')).toContainText('BONUS'); await expect(page.getByRole('button', { name: 'W — Correct', exact: true })).toBeDisabled();
  await page.keyboard.press('b'); await page.keyboard.press('w'); await expect(page.getByRole('heading', { name: 'Half-time', exact: true })).toBeVisible();
  await page.keyboard.press('c'); await expect(page.getByRole('heading', { name: 'Half-time', exact: true })).toBeVisible();
  await page.keyboard.press('g'); await page.clock.fastForward(120001); await page.keyboard.press('c');
  await expect(page.getByText('Half 2', { exact: false })).toBeVisible();
});
test('typing replacement text never triggers shortcuts and refresh keeps replacement', async ({ page }) => {
  await seed(page); await page.getByText('Moderator rulings, challenges, replacements, and reserve questions', { exact: true }).click();
  await page.getByLabel('Replacement prompt (include W/X/Y/Z choices if needed)').fill('What are a, d, w, s, c, r, b, g, f, j?');
  await page.getByLabel('Replacement official answer').fill('Letters'); await page.getByRole('button', { name: 'Use replacement for current question' }).click();
  await expect(page.getByTestId('score-A')).toHaveText('0'); await page.reload(); await page.getByRole('button', { name: 'Resume saved round' }).click();
  await expect(page.getByText('What are a, d, w, s, c, r, b, g, f, j?', { exact: true })).toBeVisible();
});
