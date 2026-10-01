import type { Packet } from '../types';
import { reduceCompetition, tickCompetition } from './competition';
import { createGame, remaining, rules, snapshot, type Action, type GameState } from './gameState';

export function tick(state: GameState, now: number): GameState {
  if (state.competition) return tickCompetition(state, now);
  if (state.timer.deadline === null) return state;
  const ms = remaining(state.timer, now);
  if (ms <= 0) return { ...state, phase: state.phase === 'BONUS_OPEN' ? 'BONUS_EXPIRED' : 'TOSSUP_EXPIRED', timer: { remainingMs: 0, deadline: null, warned: true }, lastAction: 'TIME — moderator decides what happens next.' };
  if (state.phase === 'BONUS_OPEN' && ms <= 5000 && !state.timer.warned) return { ...state, timer: { ...state.timer, warned: true }, lastAction: '5 SECONDS' };
  return state;
}
function advance(state: GameState, packet: Packet, message: string): GameState {
  const index = state.index + 1;
  return { ...state, index: Math.min(index, packet.pairs.length - 1), phase: index >= packet.pairs.length ? 'ROUND_COMPLETE' : 'READING_TOSSUP', answering: null, bonusOwner: null, timer: { remainingMs: 5000, deadline: null, warned: false }, lastAction: message };
}
export function reduceGame(state: GameState, action: Action, packet: Packet): GameState {
  if (action.type === 'RESET') return createGame(packet);
  if (action.type === 'TICK') return tick(state, action.now);
  if (state.competition) return reduceCompetition(state, action, packet);
  if (action.type === 'PAUSE') return state.timer.deadline === null ? state : snapshot(state, action.now);
  if (action.type === 'ADJUST') {
    const score = Math.max(0, state.scores[action.team] + action.delta);
    return score === state.scores[action.team] ? state : { ...state, scores: { ...state.scores, [action.team]: score }, lastAction: `Team ${action.team}: manual ${action.delta > 0 ? '+' : ''}${action.delta}` };
  }
  if (state.phase === 'ROUND_COMPLETE') return state;
  const current = state.outcomes[state.index];
  const outcomes = () => state.outcomes.map((o, i) => i === state.index ? { tossup: { ...o.tossup }, bonus: { ...o.bonus } } : o);
  if (action.type === 'SPACE') {
    if (state.phase === 'TOSSUP_EXPIRED') {
      const next = outcomes(); next[state.index].tossup = { status: 'unanswered' }; if (current.bonus.status === 'pending') next[state.index].bonus = { status: 'skipped' };
      return advance({ ...state, outcomes: next }, packet, 'No buzz — next toss-up.');
    }
    if (state.phase === 'READING_TOSSUP' || state.phase === 'READING_BONUS') {
      const bonus = state.phase === 'READING_BONUS', duration = bonus ? rules.bonusMs : rules.tossupMs;
      return { ...state, phase: bonus ? 'BONUS_OPEN' : 'TOSSUP_OPEN', timer: { remainingMs: duration, deadline: action.now + duration, warned: false }, lastAction: bonus ? 'Bonus timer started.' : 'Toss-up open.' };
    }
    if ((state.phase === 'TOSSUP_OPEN' || state.phase === 'BONUS_OPEN') && state.timer.deadline === null) return { ...state, timer: { ...state.timer, deadline: action.now + state.timer.remainingMs }, lastAction: 'Timer resumed.' };
  }
  if (action.type === 'BUZZ' && ['READING_TOSSUP', 'TOSSUP_OPEN', 'TOSSUP_EXPIRED'].includes(state.phase)) return { ...snapshot(state, action.now), phase: 'TOSSUP_ANSWERING', answering: action.team, lastAction: `Team ${action.team} answering.` };
  if (action.type === 'JUDGE') {
    if (state.phase === 'TOSSUP_ANSWERING' && state.answering && current.tossup.status === 'pending') {
      const next = outcomes(), team = state.answering;
      next[state.index].tossup = { status: action.correct ? 'correct' : 'incorrect', team };
      if (!action.correct) { if (current.bonus.status === 'pending') next[state.index].bonus = { status: 'skipped' }; return advance({ ...state, outcomes: next }, packet, `Team ${team} incorrect — next toss-up.`); }
      const scored = { ...state, outcomes: next, scores: { ...state.scores, [team]: state.scores[team] + rules.tossupPoints } };
      if (!packet.pairs[state.index].bonus) return advance(scored, packet, `Team ${team} +4 — bonus unavailable.`);
      return { ...scored, phase: 'READING_BONUS', bonusOwner: team, answering: null, timer: { remainingMs: 20000, deadline: null, warned: false }, lastAction: `Team ${team} +4 — bonus ready. Space enables judging.` };
    }
    if (['BONUS_OPEN', 'BONUS_EXPIRED'].includes(state.phase) && state.bonusOwner && current.bonus.status === 'pending') {
      const next = outcomes(), team = state.bonusOwner;
      next[state.index].bonus = { status: action.correct ? 'correct' : 'incorrect', team };
      return advance({ ...state, outcomes: next, scores: { ...state.scores, [team]: state.scores[team] + (action.correct ? rules.bonusPoints : 0) } }, packet, `Team ${team} ${action.correct ? '+10' : 'bonus incorrect'} — next toss-up.`);
    }
  }
  if (action.type === 'NEXT') {
    const next = outcomes();
    if (current.tossup.status === 'pending') next[state.index].tossup = { status: 'skipped' };
    if (current.bonus.status === 'pending') next[state.index].bonus = { status: 'skipped' };
    return advance({ ...state, outcomes: next }, packet, 'Skipped remaining question — next toss-up.');
  }
  return state;
}
