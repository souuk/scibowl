import type { Packet, TeamId } from '../types';
import { initialCompetition, timeLeft, type CompetitionState } from './competition';
export const rules = { mode: 'simplified', tossupPoints: 4, bonusPoints: 10, tossupMs: 5000, bonusMs: 20000 } as const;
export type Phase = 'READY_TOSSUP' | 'TOSSUP_RECOGNIZE' | 'BONUS_ANSWERING' | 'HALFTIME' | 'TIEBREAK_READY' | 'NEED_QUESTIONS' | 'READING_TOSSUP' | 'TOSSUP_OPEN' | 'TOSSUP_EXPIRED' | 'TOSSUP_ANSWERING' | 'READING_BONUS' | 'BONUS_OPEN' | 'BONUS_EXPIRED' | 'ROUND_COMPLETE';
export interface TimerState { remainingMs: number; deadline: number | null; warned: boolean }
export type Outcome = { status: 'pending' | 'correct' | 'incorrect' | 'unanswered' | 'skipped' | 'unavailable'; team?: TeamId };
export interface GameState {
  packetId: string; index: number; phase: Phase; answering: TeamId | null; bonusOwner: TeamId | null;
  scores: Record<TeamId, number>; outcomes: { tossup: Outcome; bonus: Outcome }[];
  timer: TimerState; lastAction: string;
  competition?: CompetitionState;
}
export interface Match { present: GameState; history: GameState[] }
export type Action = { type: 'SPACE' | 'NEXT' | 'TICK' | 'PAUSE' | 'UNDO' | 'RESET' | 'CATEGORY' | 'RECOGNIZE' | 'ANSWER_STARTED' | 'CLOCK' | 'CONTINUE' | 'VISUAL' | 'REVEALED'; now: number }
  | { type: 'CLOCK_ADJUST'; seconds: number; now: number }
  | { type: 'FOUL' | 'ACCIDENTAL' | 'FORFEIT'; team: TeamId; now: number }
  | { type: 'DISTRACTION'; team: TeamId; runoff: boolean; now: number }
  | { type: 'CHALLENGE'; team: TeamId; kind: 'science' | 'rules'; upheld: boolean; now: number }
  | { type: 'REPLACEMENT'; question: import('../types').Question; now: number }
  | { type: 'BUZZ'; team: TeamId; now: number }
  | { type: 'JUDGE'; correct: boolean; now: number }
  | { type: 'ADJUST'; team: TeamId; delta: number; now: number };
export function createGame(packet: Packet): GameState {
  return { ...(packet.competition ? { competition: initialCompetition(packet.competition) } : {}), packetId: packet.id, index: 0, phase: packet.pairs.length ? packet.competition ? 'READY_TOSSUP' : 'READING_TOSSUP' : 'ROUND_COMPLETE', answering: null, bonusOwner: null,
    scores: { A: 0, B: 0 }, outcomes: packet.pairs.map(p => ({ tossup: { status: 'pending' }, bonus: { status: p.bonus ? 'pending' : 'unavailable' } })),
    timer: { remainingMs: rules.tossupMs, deadline: null, warned: false }, lastAction: packet.competition ? 'G starts the match clock. Read the category, then C to enable buzzers.' : 'Read the toss-up. Space starts the timer.' };
}
export function remaining(timer: TimerState, now: number) { return timer.deadline === null ? timer.remainingMs : Math.max(0, timer.deadline - now); }
export function snapshot(state: GameState, now: number): GameState {
  return { ...state, ...(state.competition ? { competition: { ...state.competition, matchTimer: { ...state.competition.matchTimer, remainingMs: timeLeft(state.competition.matchTimer, now), deadline: null } } } : {}), timer: { ...state.timer, remainingMs: remaining(state.timer, now), deadline: null } };
}
