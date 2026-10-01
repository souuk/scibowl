import { describe, expect, it } from 'vitest';
import { createGame, type Action, type Match } from '../../src/game/gameState';
import { defaultCompetition, type CompetitionConfig } from '../../src/game/competition';
import { reduceMatch } from '../../src/game/history';
import { testPacket } from '../helpers';
import { readSession, saveSession } from '../../src/browser/persistence';
import { resultsText } from '../../src/browser/exportResults';
function round(config: Partial<CompetitionConfig> = {}, count = 12) {
  const packet = testPacket(); packet.competition = { ...defaultCompetition, ...config };
  packet.pairs = Array.from({ length: count }, (_, i) => ({ ...packet.pairs[i % 2], id: `p${i}` }));
  let m: Match = { present: createGame(packet), history: [] };
  return { packet, get state() { return m.present; }, get match() { return m; }, act(a: Action) { m = reduceMatch(m, a, packet); return m; },
    key(type: 'CATEGORY' | 'SPACE' | 'RECOGNIZE' | 'ANSWER_STARTED' | 'NEXT' | 'CLOCK' | 'CONTINUE' | 'UNDO', now = 0) { m = reduceMatch(m, { type, now }, packet); },
    buzz(team: 'A' | 'B', now = 0) { m = reduceMatch(m, { type: 'BUZZ', team, now }, packet); },
    judge(correct: boolean, now = 0) { m = reduceMatch(m, { type: 'JUDGE', correct, now }, packet); } };
}
describe('DOE competition question rules', () => {
  it('requires category and recognition; full-read miss rebounds with a fresh five seconds and no penalty', () => {
    const r = round(); const initial = r.match; r.buzz('A'); expect(r.match).toBe(initial);
    r.key('CATEGORY'); r.key('SPACE', 100); r.buzz('A', 500); r.judge(true, 501); expect(r.state.scores.A).toBe(0);
    r.key('RECOGNIZE', 600); r.judge(false, 700);
    expect(r.state.scores).toEqual({ A: 0, B: 0 }); expect(r.state.timer.deadline).toBe(5700); expect(r.state.competition!.eligible).toEqual({ A: false, B: true });
    r.buzz('A', 800); expect(r.state.answering).toBeNull(); r.buzz('B', 900); r.key('RECOGNIZE', 901); r.judge(true, 1000);
    expect(r.state.scores.B).toBe(4); expect(r.state.bonusOwner).toBe('B'); r.judge(true, 1001); expect(r.state.scores.B).toBe(4);
    r.key('SPACE', 1002); r.judge(true, 1003); expect(r.state.scores.B).toBe(14);
  });
  it('interrupt penalty awards the opponent four, with a reread and one remaining attempt', () => {
    const r = round(); r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(false);
    expect(r.state.scores).toEqual({ A: 0, B: 4 }); expect(r.state.phase).toBe('READING_TOSSUP');
    r.buzz('B'); r.key('RECOGNIZE'); r.judge(false);
    expect(r.state.scores).toEqual({ A: 4, B: 4 }); expect(r.state.index).toBe(1);
    r.key('UNDO'); expect(r.state.answering).toBe('B'); expect(r.state.scores).toEqual({ A: 0, B: 4 }); expect(r.state.competition!.eligible.A).toBe(false);
  });
  it('a rebound can earn another four plus ten after the interrupt penalty', () => {
    const r = round(); r.key('CATEGORY'); r.buzz('A'); r.act({ type: 'FOUL', team: 'A', now: 0 });
    r.key('SPACE'); r.buzz('B'); r.key('RECOGNIZE'); r.judge(true); r.key('SPACE'); r.judge(true);
    expect(r.state.scores.B).toBe(18);
  });
  it('communication without a buzz has no interrupt penalty and does not displace the other buzzer', () => {
    const r = round(); r.key('CATEGORY'); r.buzz('A'); r.act({ type: 'FOUL', team: 'B', now: 0 });
    expect(r.state.answering).toBe('A'); expect(r.state.competition!.eligible.B).toBe(false); expect(r.state.scores).toEqual({ A: 0, B: 0 });
    r.key('RECOGNIZE'); r.judge(false); expect(r.state.scores.B).toBe(4); expect(r.state.index).toBe(1);
  });
  it('natural pause expiry does not reject an answer already being delivered', () => {
    const r = round(); r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.act({ type: 'TICK', now: 2000 });
    expect(r.state.phase).toBe('TOSSUP_ANSWERING'); expect(r.state.lastAction).toContain('stall'); r.judge(true, 2200); expect(r.state.scores.A).toBe(4);
  });
  it('bonus TIME requires confirmation of a timely start before a correct award; a bonus never rebounds', () => {
    const r = round(); r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(true); r.key('SPACE'); r.act({ type: 'TICK', now: 20000 });
    r.judge(true, 20001); expect(r.state.scores.A).toBe(4); r.key('ANSWER_STARTED', 20002); r.judge(true, 20003); expect(r.state.scores.A).toBe(14);
    r.key('UNDO'); expect(r.state.phase).toBe('BONUS_ANSWERING'); r.judge(false, 20004); expect(r.state.index).toBe(1); expect(r.state.scores.A).toBe(4);
  });
  it('visual bonuses use thirty seconds with a five-second warning', () => {
    const r = round({ venue: 'national-visual' }); r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(true);
    r.act({ type: 'VISUAL', now: 0 }); r.key('SPACE'); expect(r.state.timer.deadline).toBe(30000);
    r.act({ type: 'TICK', now: 25000 }); expect(r.state.timer.warned).toBe(true); r.act({ type: 'TICK', now: 30000 }); expect(r.state.phase).toBe('BONUS_EXPIRED');
  });
  it('excuses one accidental buzz, then awards distraction points; explicit runoff is optional', () => {
    const r = round(); r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(true); r.key('SPACE');
    r.act({ type: 'ACCIDENTAL', team: 'B', now: 100 }); expect(r.state.scores.A).toBe(4); expect(r.state.timer.deadline).toBe(20000);
    r.act({ type: 'DISTRACTION', team: 'B', runoff: true, now: 200 }); expect(r.state.scores.A).toBe(14); expect(r.state.competition!.matchTimer.deadline).toBe(440000);
    r.key('UNDO', 300); r.act({ type: 'ACCIDENTAL', team: 'B', now: 400 }); expect(r.state.scores.A).toBe(14);
  });
  it('replaces a revealed toss-up while retaining opponent-only eligibility', () => {
    const r = round(); r.key('CATEGORY'); r.key('SPACE'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(false); r.act({ type: 'REVEALED', now: 0 });
    expect(r.state.index).toBe(1); expect(r.state.competition!.eligible).toEqual({ A: false, B: true }); r.key('CATEGORY'); r.buzz('A'); expect(r.state.answering).toBeNull();
  });
  it('requires a supplied bonus instead of silently dropping an earned competition bonus', () => {
    const r = round(); r.packet.pairs[0].bonus = null; r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(true); r.key('SPACE');
    expect(r.state.phase).toBe('READING_BONUS');
    r.act({ type: 'REPLACEMENT', question: r.packet.pairs[1].bonus!, now: 0 }); r.key('SPACE'); r.judge(true); expect(r.state.scores.A).toBe(14);
  });
});
describe('match clocks, tiebreaks, records', () => {
  it('finishes a begun question and earned bonus after the half expires; enforces the break', () => {
    const r = round(); r.key('CATEGORY'); r.act({ type: 'TICK', now: 480000 }); expect(r.state.phase).toBe('READING_TOSSUP');
    r.buzz('A', 480001); r.key('RECOGNIZE', 480002); r.judge(true, 480003); r.key('SPACE', 480004); r.judge(true, 480005);
    expect(r.state.phase).toBe('HALFTIME'); expect(r.state.index).toBe(1); r.key('CONTINUE', 480006); expect(r.state.phase).toBe('HALFTIME');
    r.key('CLOCK', 480010); r.act({ type: 'TICK', now: 600010 }); r.key('CONTINUE', 600011); expect(r.state.competition!.half).toBe(2); expect(r.state.phase).toBe('READY_TOSSUP');
  });
  it('a question whose category has not been read does not continue past the half', () => {
    const r = round(); r.key('CLOCK'); r.act({ type: 'TICK', now: 480000 }); expect(r.state.phase).toBe('HALFTIME'); expect(r.state.index).toBe(0);
  });
  it('uses all five tiebreak toss-ups even after one team leads; repeats tied sets', () => {
    const r = round({ format: 'two-team-tiebreak' });
    for (let i = 0; i < 5; i++) { r.key('CATEGORY'); r.key('NEXT'); }
    expect(r.state.phase).toBe('TIEBREAK_READY'); expect(r.state.competition!.tiebreakSet).toBe(2); r.key('CONTINUE');
    r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(true); expect(r.state.phase).toBe('READY_TOSSUP'); expect(r.state.scores.A).toBe(4);
    for (let i = 0; i < 4; i++) { r.key('CATEGORY'); r.key('NEXT'); }
    expect(r.state.phase).toBe('ROUND_COMPLETE');
  });
  it('requests additional reserve questions rather than silently ending an incomplete set', () => {
    const r = round({ format: 'two-team-tiebreak' }, 2); for (let i = 0; i < 2; i++) { r.key('CATEGORY'); r.key('NEXT'); }
    expect(r.state.phase).toBe('NEED_QUESTIONS'); expect(r.state.competition!.tiebreakQuestion).toBe(2);
  });
  it('multi-team qualifying mode plays one team: +1/-1/0 with no interrupt penalties', () => {
    const r = round({ format: 'multi-team-tiebreak' }); r.key('CATEGORY'); r.buzz('A'); expect(r.state.answering).toBeNull();
    r.key('SPACE'); r.buzz('B'); expect(r.state.answering).toBeNull(); r.buzz('A'); r.key('RECOGNIZE'); r.judge(false); expect(r.state.scores.A).toBe(-1);
    r.key('CATEGORY'); r.act({ type: 'FOUL', team: 'A', now: 0 }); expect(r.state.scores.A).toBe(-1);
    r.key('CATEGORY'); r.key('SPACE'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(true); expect(r.state.scores.A).toBe(0);
  });
  it('limits unsuccessful scientific challenges, leaves rules challenges unlimited, and records forfeits', () => {
    const r = round(); for (let i = 0; i < 3; i++) r.act({ type: 'CHALLENGE', team: 'A', kind: 'science', upheld: false, now: 0 });
    expect(r.state.competition!.failedChallenges.A).toBe(2); r.act({ type: 'CHALLENGE', team: 'A', kind: 'rules', upheld: false, now: 0 }); expect(r.state.lastAction).toContain('rules challenge');
    r.act({ type: 'FORFEIT', team: 'A', now: 0 }); expect(r.state.competition!.forfeitWinner).toBe('B'); expect(r.state.phase).toBe('ROUND_COMPLETE');
  });
  it('saves both clocks paused and rejects malformed competition state', () => {
    const r = round(); r.key('CATEGORY'); r.key('SPACE'); let raw = '';
    const store = { getItem: () => raw, setItem: (_: string, v: string) => { raw = v; } };
    saveSession({ version: 1, savedAt: 0, packet: r.packet, match: r.match, draft: null, names: { A: 'Alpha', B: 'Beta' }, fileName: 'test.pdf', fileHash: 'hash', muted: true }, 1000, store);
    const saved = readSession(store); expect(saved.error).toBe(''); expect(saved.session!.match!.present.competition!.matchTimer).toMatchObject({ deadline: null, remainingMs: 479000 }); expect(saved.session!.match!.present.timer.remainingMs).toBe(4000);
    const broken = JSON.parse(raw); broken.match.present.competition.eligible = null; raw = JSON.stringify(broken); expect(readSession(store).session).toBeNull();
  });
  it('exports scores, settings, outcomes and penalty log, with undone rulings removed', () => {
    const r = round(); r.key('CATEGORY'); r.buzz('A'); r.key('RECOGNIZE'); r.judge(false);
    let text = resultsText(r.packet, r.state, { A: 'Alpha', B: 'Beta' }, new Date(0)); expect(text).toContain('Beta (B): 4'); expect(text).toContain('interrupt penalty');
    r.key('UNDO'); text = resultsText(r.packet, r.state, { A: 'Alpha', B: 'Beta' }); expect(text).not.toContain('interrupt penalty'); expect(text).toContain('Beta (B): 0');
  });
});
