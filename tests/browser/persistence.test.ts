import { expect, it } from 'vitest';
import { readSession, saveSession, type SavedSession } from '../../src/browser/persistence';
import { createGame } from '../../src/game/gameState';
import { reduceMatch } from '../../src/game/history';
import { testPacket } from '../helpers';
function session(): SavedSession { const packet = testPacket(); return { version: 1, savedAt: 0, packet, draft: null, fileName: packet.fileName, fileHash: packet.fileHash, names: { A: 'Alpha', B: 'Beta' }, muted: false, match: { present: createGame(packet), history: [] } }; }
it('recovers a running clock as paused with saved scores and history', () => {
  const s = session(); s.match = reduceMatch(s.match!, { type: 'SPACE', now: 1000 }, s.packet!);
  let raw = ''; const store = { getItem: () => raw, setItem: (_k: string, v: string) => { raw = v; } };
  expect(saveSession(s, 2000, store)).toBe(''); const restored = readSession(store).session!;
  expect(restored.match!.present.timer).toMatchObject({ remainingMs: 4000, deadline: null }); expect(restored.match!.history).toHaveLength(1);
});
it('rejects corrupt or incompatible state rather than throwing', () => {
  for (const raw of ['{', '{}', '{"version":2}', JSON.stringify({ ...session(), match: { present: {}, history: [] } })]) expect(readSession({ getItem: () => raw, setItem() {} }).error).toContain('Recovery unavailable');
});
it('retries quota errors without history and reports permanent failures', () => {
  let count = 0; const s = session(); expect(saveSession(s, 0, { getItem: () => null, setItem() { if (++count === 1) throw new Error(); } })).toContain('without Undo');
  expect(saveSession(s, 0, { getItem: () => null, setItem() { throw new Error(); } })).toContain('Recovery unavailable');
});
it('recovers playable questions with missing fields and preserved source crops', () => {
  const s = session(), q = s.packet!.pairs[0].tossup;
  q.number = null; q.type = null; q.answer = ''; q.preferSource = true;
  q.source = [{ page: 1, startOffset: 0, endOffset: 100, bounds: [20, 100, 400, 300] }];
  let raw = ''; const storage = { getItem: () => raw, setItem: (_k: string, value: string) => { raw = value; } };
  saveSession(s, 0, storage);
  const recovered = readSession(storage);
  expect(recovered.error).toBe('');
  expect(recovered.session!.packet!.pairs[0].tossup).toMatchObject({ number: null, type: null, answer: '', source: q.source });
});
