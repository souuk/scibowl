import { describe, expect, it } from 'vitest';
import { createGame, type Action, type Match } from '../../src/game/gameState';
import { reduceMatch } from '../../src/game/history';
import { testPacket } from '../helpers';
const packet = testPacket();
function round() {
  let m: Match = { present: createGame(packet), history: [] };
  return { get state() { return m.present; }, get match() { return m; }, act(a: Action) { m = reduceMatch(m, a, packet); return m; } };
}
describe('Simplified practice', () => {
  it.each(['A', 'B'] as const)('awards four, assigns %s bonus, and prevents duplicate scoring', team => {
    const r = round(); r.act({ type: 'BUZZ', team, now: 0 }); r.act({ type: 'JUDGE', correct: true, now: 1 });
    expect(r.state.scores[team]).toBe(4); expect(r.state.bonusOwner).toBe(team);
    const before = r.match; r.act({ type: 'JUDGE', correct: true, now: 2 }); expect(r.match).toBe(before);
    r.act({ type: 'SPACE', now: 3 }); r.act({ type: 'JUDGE', correct: true, now: 4 });
    expect(r.state.scores[team]).toBe(14); expect(r.state.index).toBe(1);
    r.act({ type: 'UNDO', now: 100 }); expect(r.state.scores[team]).toBe(4); expect(r.state.phase).toBe('BONUS_OPEN'); expect(r.state.timer.deadline).toBeNull(); expect(r.state.timer.remainingMs).toBe(19999);
  });
  it('incorrect toss-up skips bonus; Undo restores answering team', () => {
    const r = round(); r.act({ type: 'BUZZ', team: 'A', now: 0 }); r.act({ type: 'JUDGE', correct: false, now: 1 });
    expect(r.state.scores).toEqual({ A: 0, B: 0 }); expect(r.state.index).toBe(1);
    r.act({ type: 'UNDO', now: 2 }); expect(r.state.answering).toBe('A'); expect(r.state.index).toBe(0);
    r.act({ type: 'UNDO', now: 3 }); expect(r.state.phase).toBe('READING_TOSSUP');
  });
  it('B correct then bonus incorrect leaves four points', () => {
    const r = round(); r.act({ type: 'BUZZ', team: 'B', now: 0 }); r.act({ type: 'JUDGE', correct: true, now: 0 }); r.act({ type: 'SPACE', now: 0 }); r.act({ type: 'JUDGE', correct: false, now: 1 });
    expect(r.state.scores.B).toBe(4); r.act({ type: 'UNDO', now: 2 }); expect(r.state.phase).toBe('BONUS_OPEN');
    r.act({ type: 'UNDO', now: 3 }); expect(r.state.phase).toBe('READING_BONUS');
    r.act({ type: 'UNDO', now: 4 }); expect(r.state.phase).toBe('TOSSUP_ANSWERING'); expect(r.state.scores.B).toBe(0);
  });
  it('first buzz wins, countdown stops, Undo restores paused remaining duration', () => {
    const r = round(); r.act({ type: 'SPACE', now: 100 }); r.act({ type: 'BUZZ', team: 'A', now: 1100 }); r.act({ type: 'BUZZ', team: 'B', now: 1200 });
    expect(r.state.answering).toBe('A'); expect(r.state.timer.deadline).toBeNull();
    r.act({ type: 'UNDO', now: 3000 }); expect(r.state.timer.remainingMs).toBe(4000); expect(r.state.phase).toBe('TOSSUP_OPEN');
    r.act({ type: 'SPACE', now: 4000 }); expect(r.state.timer.deadline).toBe(8000);
  });
  it('holds at TIME, allows late-entered physical buzz, or continues unanswered', () => {
    const r = round(); r.act({ type: 'SPACE', now: 0 }); r.act({ type: 'TICK', now: 4999 }); expect(r.state.phase).toBe('TOSSUP_OPEN');
    r.act({ type: 'TICK', now: 5000 }); expect(r.state.phase).toBe('TOSSUP_EXPIRED'); expect(r.state.index).toBe(0);
    r.act({ type: 'BUZZ', team: 'B', now: 5001 }); expect(r.state.phase).toBe('TOSSUP_ANSWERING');
    r.act({ type: 'UNDO', now: 5002 }); r.act({ type: 'SPACE', now: 5003 }); expect(r.state.outcomes[0].tossup.status).toBe('unanswered');
  });
  it('bonus warning and expiry do not automatically adjudicate or add history', () => {
    const r = round(); r.act({ type: 'BUZZ', team: 'A', now: 0 }); r.act({ type: 'JUDGE', correct: true, now: 0 }); r.act({ type: 'SPACE', now: 0 });
    const length = r.match.history.length; r.act({ type: 'TICK', now: 15000 }); expect(r.state.timer.warned).toBe(true);
    const warned = r.match; r.act({ type: 'TICK', now: 15001 }); expect(r.match).toBe(warned);
    r.act({ type: 'TICK', now: 25000 }); expect(r.state.phase).toBe('BONUS_EXPIRED'); expect(r.match.history).toHaveLength(length); expect(r.state.scores.A).toBe(4);
    r.act({ type: 'JUDGE', correct: true, now: 25001 }); expect(r.state.scores.A).toBe(14);
  });
  it('pause consumes no history; manual adjustments clamp to zero and undo', () => {
    const r = round(); r.act({ type: 'SPACE', now: 0 }); r.act({ type: 'PAUSE', now: 1000 }); expect(r.match.history).toHaveLength(1); expect(r.state.timer.remainingMs).toBe(4000);
    r.act({ type: 'ADJUST', team: 'A', delta: -1, now: 1001 }); expect(r.match.history).toHaveLength(1);
    r.act({ type: 'ADJUST', team: 'A', delta: 1, now: 1002 }); expect(r.state.scores.A).toBe(1);
    r.act({ type: 'UNDO', now: 1003 }); expect(r.state.scores.A).toBe(0);
  });
  it('skip preserves earned points and reaches completion; reset clears history', () => {
    const r = round(); r.act({ type: 'BUZZ', team: 'A', now: 0 }); r.act({ type: 'JUDGE', correct: true, now: 0 }); r.act({ type: 'NEXT', now: 1 }); r.act({ type: 'NEXT', now: 2 });
    expect(r.state.scores.A).toBe(4); expect(r.state.phase).toBe('ROUND_COMPLETE');
    r.act({ type: 'UNDO', now: 3 }); expect(r.state.phase).toBe('READING_TOSSUP');
    r.act({ type: 'RESET', now: 4 }); expect(r.state.scores.A).toBe(0); expect(r.match.history).toHaveLength(0);
  });
  it('missing bonus advances after four points and limits history to 100', () => {
    const p = testPacket(); p.pairs[0].bonus = null;
    let m: Match = { present: createGame(p), history: [] };
    m = reduceMatch(m, { type: 'BUZZ', team: 'A', now: 0 }, p); m = reduceMatch(m, { type: 'JUDGE', correct: true, now: 0 }, p);
    expect(m.present.index).toBe(1); expect(m.present.scores.A).toBe(4);
    for (let i = 0; i < 110; i++) m = reduceMatch(m, { type: 'ADJUST', team: 'A', delta: 1, now: i }, p);
    expect(m.history).toHaveLength(100);
  });
});
