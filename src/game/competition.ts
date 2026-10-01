import type { Packet, Question, TeamId } from '../types';
import type { Action, GameState, TimerState } from './gameState';

export interface CompetitionConfig {
  level: 'middle' | 'high';
  venue: 'regional' | 'national' | 'national-visual';
  format: 'round-robin' | 'elimination' | 'two-team-tiebreak' | 'multi-team-tiebreak' | 'practice';
  longBreak: boolean;
}
export const defaultCompetition: CompetitionConfig = { level: 'middle', venue: 'regional', format: 'round-robin', longBreak: false };
export interface CompetitionState {
  config: CompetitionConfig;
  eligible: Record<TeamId, boolean>;
  interrupted: boolean;
  readComplete: boolean;
  recognized: boolean;
  answerStarted: boolean;
  matchTimer: TimerState;
  half: 1 | 2;
  tiebreakSet: number;
  tiebreakQuestion: number;
  accidental: Record<TeamId, number>;
  failedChallenges: Record<TeamId, number>;
  visual: boolean;
  replacementTossup: Question | null;
  replacementBonus: Question | null;
  exhausted: boolean;
  forfeitWinner: TeamId | null;
  log: string[];
}
export const idleTimer = (ms: number): TimerState => ({ remainingMs: ms, deadline: null, warned: false });
export const timeLeft = (t: TimerState, now: number) => t.deadline === null ? t.remainingMs : Math.max(0, t.deadline - now);
export const other = (team: TeamId): TeamId => team === 'A' ? 'B' : 'A';
export const halfDuration = (config: CompetitionConfig) => (config.venue === 'regional' ? 8 : config.venue === 'national' ? 10 : 12) * 60000;
export const untimed = (c: CompetitionState) => c.tiebreakSet > 0 || c.config.format === 'practice' || c.config.format === 'multi-team-tiebreak';
export function initialCompetition(config: CompetitionConfig): CompetitionState {
  return { config, eligible: { A: true, B: config.format !== 'multi-team-tiebreak' }, interrupted: false, readComplete: false, recognized: false, answerStarted: false,
    matchTimer: idleTimer(halfDuration(config)), half: 1, tiebreakSet: config.format === 'two-team-tiebreak' ? 1 : 0, tiebreakQuestion: 0,
    accidental: { A: 0, B: 0 }, failedChallenges: { A: 0, B: 0 }, visual: false, replacementTossup: null, replacementBonus: null,
    exhausted: false, forfeitWinner: null, log: [] };
}
function change(s: GameState, fields: Partial<CompetitionState>): GameState { return { ...s, competition: { ...s.competition!, ...fields } }; }
function message(s: GameState, text: string): GameState { return { ...s, lastAction: text }; }
function stop(s: GameState, now: number): GameState {
  return { ...change(s, { matchTimer: { ...s.competition!.matchTimer, remainingMs: timeLeft(s.competition!.matchTimer, now), deadline: null } }), timer: { ...s.timer, remainingMs: timeLeft(s.timer, now), deadline: null } };
}
function resumeClock(s: GameState, now: number): GameState {
  const c = s.competition!;
  if (untimed(c) || c.matchTimer.deadline !== null || c.matchTimer.remainingMs <= 0) return s;
  return change(s, { matchTimer: { ...c.matchTimer, deadline: now + c.matchTimer.remainingMs } });
}
function finish(s: GameState, now: number): GameState {
  s = stop(s, now);
  const c = s.competition!;
  if (s.scores.A === s.scores.B && (c.config.format === 'elimination' || c.config.format === 'two-team-tiebreak')) {
    return message({ ...change(s, { tiebreakSet: c.tiebreakSet + 1, tiebreakQuestion: 0 }), phase: 'TIEBREAK_READY' }, 'Tie — play all five toss-ups in the next set. No bonuses or match clock.');
  }
  return message({ ...s, phase: 'ROUND_COMPLETE' }, 'Round complete — allow three seconds for final challenges.');
}
function endHalf(s: GameState, now: number): GameState {
  if (s.competition!.half === 2) return finish(s, now);
  return message({ ...stop(change(s, { matchTimer: idleTimer(s.competition!.config.longBreak ? 300000 : 120000) }), now), phase: 'HALFTIME' }, 'Half-time — collect scratch paper; substitutions and captain changes are allowed. G starts the break clock.');
}
function resetQuestion(s: GameState): GameState {
  return { ...change(s, { eligible: { A: true, B: s.competition!.config.format !== 'multi-team-tiebreak' }, interrupted: false, readComplete: false, recognized: false, answerStarted: false, visual: false, replacementTossup: null, replacementBonus: null }), phase: 'READY_TOSSUP', answering: null, bonusOwner: null, timer: idleTimer(5000) };
}
function advance(s: GameState, packet: Packet, now: number, text: string): GameState {
  const old = s.competition!;
  s = resetQuestion(s);
  const exhausted = s.index + 1 >= packet.pairs.length;
  s = change({ ...s, index: Math.min(s.index + 1, packet.pairs.length - 1) }, { exhausted });
  if (old.tiebreakSet > 0 || old.config.format === 'multi-team-tiebreak') {
    s = change(s, { tiebreakQuestion: old.tiebreakQuestion + 1 });
    if (s.competition!.tiebreakQuestion === 5) return finish(s, now);
    if (exhausted) return message({ ...stop(s, now), phase: 'NEED_QUESTIONS' }, 'More reserve questions are needed to finish this five-question set.');
  } else {
    if (exhausted) return finish(s, now);
    if (!untimed(old) && timeLeft(old.matchTimer, now) <= 0) return endHalf(s, now);
  }
  return message(s, text);
}
function resolve(s: GameState, part: 'tossup' | 'bonus', status: 'correct' | 'incorrect' | 'unanswered' | 'skipped', team?: TeamId): GameState {
  return { ...s, outcomes: s.outcomes.map((o, i) => i === s.index ? { ...o, [part]: { status, ...(team ? { team } : {}) } } : o) };
}
function award(s: GameState, team: TeamId, points: number): GameState { return { ...s, scores: { ...s.scores, [team]: s.scores[team] + points } }; }
function correctTossup(s: GameState, team: TeamId, packet: Packet, now: number): GameState {
  const c = s.competition!, solo = c.config.format === 'multi-team-tiebreak';
  s = award(resolve(s, 'tossup', 'correct', team), team, solo ? 1 : 4);
  if (c.tiebreakSet || solo) return advance(resolve(s, 'bonus', 'skipped'), packet, now, `Team ${team} +${solo ? 1 : 4} — next toss-up.`);
  return message({ ...change(s, { answerStarted: false }), phase: 'READING_BONUS', answering: null, bonusOwner: team, timer: idleTimer(20000) }, packet.pairs[s.index].bonus ? `Team ${team} +4 — bonus ready. Only the captain may answer.` : `Team ${team} +4 — bonus missing. Supply a replacement bonus in Moderator rulings.`);
}
function loseAttempt(s: GameState, team: TeamId, packet: Packet, now: number, foul: boolean): GameState {
  const c = s.competition!, opponent = other(team), solo = c.config.format === 'multi-team-tiebreak';
  const penalty = !solo && s.answering === team && c.interrupted;
  s = change(s, { eligible: { ...c.eligible, [team]: false } });
  if (penalty) s = award(s, opponent, 4);
  if (solo && !foul) s = award(s, team, -1);
  const text = `Team ${team} ${foul ? 'blurt / communication — do not disclose answer correctness' : 'incorrect'}${penalty ? `; Team ${opponent} +4 interrupt penalty` : ''}.`;
  if (!s.competition!.eligible[opponent]) return advance(resolve(resolve(s, 'tossup', 'incorrect', team), 'bonus', 'skipped'), packet, now, text + ' No eligible team remains.');
  // Communication by the non-buzzing team must not displace the legitimate buzzer.
  if (s.answering && s.answering !== team) return message(s, text + ` Team ${s.answering} keeps its answer opportunity.`);
  return message({ ...change(s, { interrupted: false, recognized: false }), answering: null,
    phase: c.readComplete ? 'TOSSUP_OPEN' : 'READING_TOSSUP',
    timer: c.readComplete ? { ...idleTimer(5000), deadline: now + 5000 } : idleTimer(5000) }, text + (c.readComplete ? ` Team ${opponent} has a fresh five seconds.` : ` Reread from the beginning for Team ${opponent}.`));
}
export function tickCompetition(s: GameState, now: number): GameState {
  const c = s.competition!;
  if (s.phase === 'READY_TOSSUP' && !untimed(c) && timeLeft(c.matchTimer, now) <= 0) return endHalf(s, now);
  if (c.matchTimer.deadline !== null && timeLeft(c.matchTimer, now) <= 0) {
    s = change(s, { matchTimer: { ...c.matchTimer, remainingMs: 0, deadline: null, warned: true } });
    if (s.phase === 'READY_TOSSUP') return endHalf(s, now);
    s = message(s, s.phase === 'HALFTIME' ? 'Break over — C begins the second half.' : 'Half time reached — finish this toss-up and any earned bonus.');
  }
  if (s.timer.deadline === null || timeLeft(s.timer, now) > 5000) return s;
  if (timeLeft(s.timer, now) <= 0) {
    if (s.phase === 'TOSSUP_ANSWERING') return message({ ...s, timer: { ...idleTimer(0), warned: true } }, 'Natural pause elapsed — judge a stall only if the player has not begun answering.');
    if (s.phase !== 'TOSSUP_OPEN' && s.phase !== 'BONUS_OPEN') return s;
    return message({ ...s, phase: s.phase === 'BONUS_OPEN' ? 'BONUS_EXPIRED' : 'TOSSUP_EXPIRED', timer: { ...idleTimer(0), warned: true } }, 'TIME — record only a buzz / answer begun before the time call.');
  }
  if (s.phase === 'BONUS_OPEN' && !s.timer.warned) return message({ ...s, timer: { ...s.timer, warned: true } }, '5 SECONDS');
  return s;
}
export function reduceCompetition(s: GameState, a: Action, packet: Packet): GameState {
  const c = s.competition!, now = a.now;
  if (a.type === 'PAUSE') return c.matchTimer.deadline === null && s.timer.deadline === null ? s : stop(s, now);
  if (a.type === 'CLOCK') {
    if (['ROUND_COMPLETE', 'TIEBREAK_READY', 'NEED_QUESTIONS'].includes(s.phase)) return s;
    if (c.matchTimer.deadline !== null || s.timer.deadline !== null) return message(stop(s, now), 'Clocks paused for an official ruling.');
    let next = s.phase === 'HALFTIME' ? change(s, { matchTimer: { ...c.matchTimer, deadline: now + c.matchTimer.remainingMs } }) : resumeClock(s, now);
    if (!c.answerStarted && ['TOSSUP_OPEN', 'BONUS_OPEN', 'TOSSUP_ANSWERING'].includes(s.phase) && s.timer.remainingMs > 0) next = { ...next, timer: { ...s.timer, deadline: now + s.timer.remainingMs } };
    return message(next, 'Clocks resumed.');
  }
  if (a.type === 'CLOCK_ADJUST') {
    if (!Number.isFinite(a.seconds)) return s;
    const timer = c.matchTimer, ms = Math.max(0, timeLeft(timer, now) + a.seconds * 1000);
    return message(change(s, { matchTimer: { ...timer, remainingMs: ms, deadline: timer.deadline === null ? null : now + ms, warned: false } }), `Match clock adjusted by ${a.seconds} seconds.`);
  }
  if (a.type === 'ADJUST') { const delta = c.config.format === 'multi-team-tiebreak' ? a.delta : Math.max(-s.scores[a.team], a.delta); return delta === 0 || !Number.isFinite(delta) ? s : message(award(s, a.team, delta), `Team ${a.team}: manual score correction ${delta}.`); }
  if (a.type === 'FORFEIT') return message({ ...change(stop(s, now), { forfeitWinner: other(a.team) }), phase: 'ROUND_COMPLETE' }, `Team ${a.team} forfeits. Team ${other(a.team)} wins; scores retained.`);
  if (a.type === 'CHALLENGE') {
    if (!['READY_TOSSUP', 'READING_BONUS', 'HALFTIME', 'ROUND_COMPLETE', 'TIEBREAK_READY', 'NEED_QUESTIONS'].includes(s.phase)) return s;
    if (a.kind === 'science' && c.failedChallenges[a.team] >= 2) return s;
    s = stop(s, now);
    if (a.kind === 'science' && !a.upheld) s = change(s, { failedChallenges: { ...c.failedChallenges, [a.team]: c.failedChallenges[a.team] + 1 } });
    return message(s, `Team ${a.team} ${a.kind} challenge ${a.upheld ? 'upheld — use Undo to restore the disputed answer, then correct the ruling and clock' : 'denied'}. Clocks paused.`);
  }
  if (a.type === 'CONTINUE') {
    if (s.phase === 'HALFTIME' && timeLeft(c.matchTimer, now) > 0) return s;
    if (s.phase === 'HALFTIME') return message(resetQuestion(change(s, { half: 2, matchTimer: idleTimer(halfDuration(c.config)) })), 'Second half ready. G starts the match clock; C after reading the category.');
    if (s.phase === 'TIEBREAK_READY' || s.phase === 'NEED_QUESTIONS') {
      if (c.exhausted && s.index + 1 >= packet.pairs.length) return message({ ...s, phase: 'NEED_QUESTIONS' }, 'Append a reserve PDF to continue.');
      return message(change(resetQuestion(change({ ...s, index: c.exhausted ? s.index + 1 : s.index }, { exhausted: false })), { eligible: c.eligible }), 'Tiebreaker ready — substitutions allowed at the start of each five-question set.');
    }
  }
  if (['ROUND_COMPLETE', 'HALFTIME', 'TIEBREAK_READY', 'NEED_QUESTIONS'].includes(s.phase)) return s;
  if (a.type === 'CATEGORY' && s.phase === 'READY_TOSSUP') return message({ ...resumeClock(s, now), phase: 'READING_TOSSUP' }, 'Category read — buzzers eligible. Space when the entire question has been read.');
  if (a.type === 'VISUAL' && s.phase === 'READING_BONUS' && c.config.venue === 'national-visual') return message({ ...change(s, { visual: !c.visual }), timer: idleTimer(c.visual ? 20000 : 30000) }, c.visual ? 'Standard bonus: 20 seconds.' : 'Visual bonus: 30 seconds.');
  if (a.type === 'REPLACEMENT') {
    if (!a.question.text.trim() || !a.question.answer.trim()) return s;
    s = stop(s, now);
    if (s.phase.includes('BONUS')) return message({ ...change(s, { replacementBonus: a.question, visual: false }), phase: 'READING_BONUS', timer: idleTimer(20000) }, 'Replacement bonus ready for the same team. Restore lost match time if directed.');
    return message({ ...change(s, { replacementTossup: a.question, readComplete: false, interrupted: false, recognized: false }), phase: 'READY_TOSSUP', answering: null, timer: idleTimer(5000) }, 'Replacement toss-up ready; eligibility retained. Restore lost match time if directed.');
  }
  if (a.type === 'REVEALED' && !s.phase.includes('BONUS')) {
    const eligible = c.eligible;
    const next = advance(resolve(resolve(s, 'tossup', 'skipped'), 'bonus', 'skipped'), packet, now, 'Answer revealed — next question replaces this one; eligibility retained.');
    // Replacement questions do not consume a tiebreak question or end an expired half.
    return message({ ...change(next, { eligible, tiebreakQuestion: c.tiebreakQuestion, tiebreakSet: c.tiebreakSet, matchTimer: c.matchTimer }), phase: next.competition!.exhausted ? 'NEED_QUESTIONS' : 'READY_TOSSUP' }, 'Answer revealed — use the next question for the still-eligible team(s).');
  }
  if (a.type === 'SPACE') {
    if (s.phase === 'TOSSUP_EXPIRED') return advance(resolve(resolve(s, 'tossup', 'unanswered'), 'bonus', 'skipped'), packet, now, 'No timely buzz — next toss-up.');
    if (s.phase === 'READING_TOSSUP' || s.phase === 'READING_BONUS') {
      const bonus = s.phase === 'READING_BONUS';
      if (bonus && !packet.pairs[s.index].bonus && !c.replacementBonus) return s;
      const ms = bonus ? c.visual ? 30000 : 20000 : 5000;
      return message({ ...resumeClock(change(s, { readComplete: true }), now), phase: bonus ? 'BONUS_OPEN' : 'TOSSUP_OPEN', timer: { ...idleTimer(ms), deadline: now + ms } }, bonus ? 'Bonus open — only the captain may answer.' : 'Toss-up fully read — five seconds to buzz.');
    }
    if (s.phase.endsWith('_OPEN') && s.timer.deadline === null) return { ...resumeClock(s, now), timer: { ...s.timer, deadline: now + s.timer.remainingMs } };
  }
  if (a.type === 'BUZZ' && ['READING_TOSSUP', 'TOSSUP_OPEN', 'TOSSUP_EXPIRED'].includes(s.phase) && c.eligible[a.team]) {
    if (c.config.format === 'multi-team-tiebreak' && s.phase === 'READING_TOSSUP') return s;
    return message({ ...change(s, { interrupted: !c.readComplete, recognized: false }), phase: 'TOSSUP_RECOGNIZE', answering: a.team, timer: idleTimer(2000) }, `Team ${a.team} buzzed${!c.readComplete ? ' — INTERRUPT' : ''}. Verbally recognize the player, then R.`);
  }
  if (a.type === 'RECOGNIZE' && s.phase === 'TOSSUP_RECOGNIZE') return message({ ...change(s, { recognized: true }), phase: 'TOSSUP_ANSWERING', timer: { ...idleTimer(2000), deadline: now + 2000 } }, 'Player recognized — allow a natural pause up to two seconds; judge stalls manually.');
  if (a.type === 'ANSWER_STARTED' && ['TOSSUP_ANSWERING', 'BONUS_OPEN', 'BONUS_EXPIRED'].includes(s.phase)) return message({ ...change(s, { answerStarted: true }), phase: s.phase.includes('BONUS') ? 'BONUS_ANSWERING' : s.phase, timer: { ...s.timer, remainingMs: timeLeft(s.timer, now), deadline: null } }, 'Answer began — allow completion without stalling. After TIME, use this only to record a response that began before the call.');
  if (a.type === 'FOUL' && s.phase.includes('TOSSUP') && s.phase !== 'READY_TOSSUP' && c.eligible[a.team]) return loseAttempt(s, a.team, packet, now, true);
  if ((a.type === 'DISTRACTION' || a.type === 'ACCIDENTAL') && (s.phase.includes('BONUS') || s.phase.includes('TOSSUP') && s.phase !== 'READY_TOSSUP')) {
    const victim = other(a.team), bonus = s.phase.includes('BONUS');
    if (bonus ? s.bonusOwner !== victim : c.eligible[a.team] || !c.eligible[victim]) return s;
    if (a.type === 'ACCIDENTAL' && c.accidental[a.team] === 0) return message(change(s, { accidental: { ...c.accidental, [a.team]: 1 } }), `Team ${a.team}: first accidental buzz excused; clocks continue.`);
    if (a.type === 'DISTRACTION' && a.runoff && !untimed(c)) s = change(s, { matchTimer: { ...c.matchTimer, remainingMs: Math.max(0, timeLeft(c.matchTimer, now) - (bonus ? 40000 : 20000)), deadline: c.matchTimer.deadline === null ? null : Math.max(now, c.matchTimer.deadline - (bonus ? 40000 : 20000)) } });
    return bonus ? advance(award(resolve(s, 'bonus', 'correct', victim), victim, 10), packet, now, `Team ${victim} +10 for distraction.`) : correctTossup(s, victim, packet, now);
  }
  if (a.type === 'JUDGE') {
    if (s.phase === 'TOSSUP_ANSWERING' && s.answering) return a.correct ? correctTossup(s, s.answering, packet, now) : loseAttempt(s, s.answering, packet, now, false);
    if (['BONUS_OPEN', 'BONUS_ANSWERING', 'BONUS_EXPIRED'].includes(s.phase) && s.bonusOwner) {
      if (a.correct && s.phase === 'BONUS_EXPIRED') return s;
      return advance(award(resolve(s, 'bonus', a.correct ? 'correct' : 'incorrect', s.bonusOwner), s.bonusOwner, a.correct ? 10 : 0), packet, now, `Team ${s.bonusOwner} ${a.correct ? '+10' : 'bonus incorrect'} — next toss-up.`);
    }
  }
  if (a.type === 'NEXT') {
    if (s.phase === 'READY_TOSSUP') return s;
    s = s.outcomes[s.index].tossup.status === 'pending' ? resolve(s, 'tossup', 'skipped') : s;
    return advance(resolve(s, 'bonus', 'skipped'), packet, now, 'Moderator skipped remaining question.');
  }
  return s;
}
