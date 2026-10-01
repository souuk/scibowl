import type { Packet, ParseResult } from '../types';
import { snapshot, type Match, type GameState } from '../game/gameState';
export const STORAGE_KEY = 'science-bowl-practice:v1';
export interface SavedSession { version: 1; savedAt: number; packet: Packet | null; draft: ParseResult | null; fileName: string; fileHash: string; names: { A: string; B: string }; muted: boolean; match: Match | null }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
const phases = ['READING_TOSSUP', 'TOSSUP_OPEN', 'TOSSUP_EXPIRED', 'TOSSUP_ANSWERING', 'READING_BONUS', 'BONUS_OPEN', 'BONUS_EXPIRED', 'ROUND_COMPLETE', 'READY_TOSSUP', 'TOSSUP_RECOGNIZE', 'BONUS_ANSWERING', 'HALFTIME', 'TIEBREAK_READY', 'NEED_QUESTIONS'];
function object(value: unknown): value is Record<string, any> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(s => typeof s === 'string'); }
function validDraftQuestion(q: unknown): boolean {
  return object(q) && typeof q.id === 'string' && ['tossup', 'bonus'].includes(q.kind) && (q.number === null || Number.isInteger(q.number)) && [null, 'short-answer', 'multiple-choice'].includes(q.type) && typeof q.category === 'string' && typeof q.text === 'string' && typeof q.answer === 'string' && typeof q.rawBlock === 'string' && typeof q.excluded === 'boolean' && strings(q.parseIssues) && strings(q.acknowledged) && strings(q.acceptedAnswers) && strings(q.rejectedAnswers) && strings(q.answerNotes) && Array.isArray(q.source) && q.source.every((s: any) => object(s) && Number.isInteger(s.page) && s.page > 0) && (q.choices === null || object(q.choices) && ['W', 'X', 'Y', 'Z'].every(l => typeof q.choices[l] === 'string'));
}
function validQuestion(q: unknown): boolean { return object(q) && typeof q.id === 'string' && (q.number === null || Number.isInteger(q.number)) && typeof q.category === 'string' && [null, 'short-answer', 'multiple-choice'].includes(q.type) && typeof q.text === 'string' && typeof q.answer === 'string' && Array.isArray(q.source) && q.source.every((s: any) => object(s) && Number.isInteger(s.page) && s.page > 0) && (q.choices === null || object(q.choices) && ['W', 'X', 'Y', 'Z'].every(l => typeof q.choices[l] === 'string')); }
function validConfig(c: any): boolean {
  return object(c) && ['middle', 'high'].includes(c.level) && ['regional', 'national', 'national-visual'].includes(c.venue) && ['round-robin', 'elimination', 'two-team-tiebreak', 'multi-team-tiebreak', 'practice'].includes(c.format) && typeof c.longBreak === 'boolean';
}
function validCompetition(c: any, config: any): boolean {
  if (!object(c) || !validConfig(c.config) || ['level', 'venue', 'format', 'longBreak'].some(k => c.config[k] !== config[k])) return false;
  if (!object(c.eligible) || !['A','B'].every(t => typeof c.eligible[t] === 'boolean')) return false;
  if (!['interrupted', 'readComplete', 'recognized', 'answerStarted', 'visual', 'exhausted'].every(k => typeof c[k] === 'boolean')) return false;
  if (![1,2].includes(c.half) || !Number.isInteger(c.tiebreakSet) || c.tiebreakSet < 0 || !Number.isInteger(c.tiebreakQuestion) || c.tiebreakQuestion < 0 || c.tiebreakQuestion > 5) return false;
  if (!object(c.matchTimer) || c.matchTimer.deadline !== null || !Number.isFinite(c.matchTimer.remainingMs) || c.matchTimer.remainingMs < 0 || typeof c.matchTimer.warned !== 'boolean') return false;
  if (!object(c.failedChallenges) || !object(c.accidental) || !['A','B'].every(t => [0,1,2].includes(c.failedChallenges[t]) && [0,1].includes(c.accidental[t]))) return false;
  return strings(c.log) && [null, 'A', 'B'].includes(c.forfeitWinner) && (c.replacementTossup === null || validQuestion(c.replacementTossup)) && (c.replacementBonus === null || validQuestion(c.replacementBonus));
}
function validState(s: unknown, packet: Packet): s is GameState {
  if (!object(s) || s.packetId !== packet.id || !Number.isInteger(s.index) || s.index < 0 || s.index >= packet.pairs.length || !phases.includes(s.phase)) return false;
  if (packet.competition ? !validCompetition(s.competition, packet.competition) : s.competition !== undefined) return false;
  if (!object(s.scores) || !['A', 'B'].every(t => Number.isFinite(s.scores[t]) && (packet.competition?.format === 'multi-team-tiebreak' || s.scores[t] >= 0))) return false;
  if (!object(s.timer) || !Number.isFinite(s.timer.remainingMs) || s.timer.remainingMs < 0 || s.timer.remainingMs > 30000 || s.timer.deadline !== null || typeof s.timer.warned !== 'boolean') return false;
  if (![null, 'A', 'B'].includes(s.answering) || ![null, 'A', 'B'].includes(s.bonusOwner) || typeof s.lastAction !== 'string') return false;
  if (['TOSSUP_ANSWERING', 'TOSSUP_RECOGNIZE'].includes(s.phase) && !s.answering || s.phase.includes('BONUS') && (!s.bonusOwner || !packet.pairs[s.index].bonus && !s.competition)) return false;
  return Array.isArray(s.outcomes) && s.outcomes.length === packet.pairs.length && s.outcomes.every((o: any) => object(o) && ['tossup', 'bonus'].every(k => object(o[k]) && ['pending', 'correct', 'incorrect', 'unanswered', 'skipped', 'unavailable'].includes(o[k].status) && (o[k].team === undefined || ['A', 'B'].includes(o[k].team))));
}
export function readSession(storage?: StorageLike): { session: SavedSession | null; error: string } {
  try {
    const raw = (storage ?? localStorage).getItem(STORAGE_KEY);
    if (!raw) return { session: null, error: '' };
    const s = JSON.parse(raw);
    if (!object(s) || s.version !== 1 || !object(s.names) || typeof s.names.A !== 'string' || typeof s.names.B !== 'string' || typeof s.muted !== 'boolean' || typeof s.fileName !== 'string' || typeof s.fileHash !== 'string') throw new Error();
    if (s.packet !== null && (!object(s.packet) || typeof s.packet.id !== 'string' || !Array.isArray(s.packet.pairs) || !s.packet.pairs.length || !s.packet.pairs.every((p: any) => object(p) && typeof p.id === 'string' && validQuestion(p.tossup) && (p.bonus === null || validQuestion(p.bonus))))) throw new Error();
    if (s.packet?.competition !== undefined && !validConfig(s.packet.competition)) throw new Error();
    if (s.match !== null && (!s.packet || !object(s.match) || !validState(s.match.present, s.packet as Packet) || !Array.isArray(s.match.history) || s.match.history.length > 100 || !s.match.history.every((h: any) => validState(h, s.packet as Packet)))) throw new Error();
    if (s.draft !== null) {
      if (!object(s.draft) || !Array.isArray(s.draft.draftPairs) || !Array.isArray(s.draft.unassignedBlocks) || !Array.isArray(s.draft.unparsedSegments) || !Array.isArray(s.draft.diagnostics) || !object(s.draft.stats)) throw new Error();
      if (!s.draft.draftPairs.every((p: any) => object(p) && typeof p.id === 'string' && typeof p.missingBonusAcknowledged === 'boolean' && validDraftQuestion(p.tossup) && (p.bonus === null || validDraftQuestion(p.bonus))) || !s.draft.unassignedBlocks.every(validDraftQuestion)) throw new Error();
      if (!s.draft.unparsedSegments.every((p: any) => object(p) && typeof p.id === 'string' && typeof p.text === 'string' && Array.isArray(p.pages) && typeof p.excluded === 'boolean')) throw new Error();
      if (!s.draft.diagnostics.every((d: any) => object(d) && typeof d.id === 'string' && typeof d.message === 'string' && ['error', 'warning'].includes(d.severity) && ['unresolved', 'fixed', 'acknowledged', 'excluded'].includes(d.resolution))) throw new Error();
    }
    return { session: s as unknown as SavedSession, error: '' };
  } catch { return { session: null, error: 'Recovery unavailable: saved data could not be read or is incompatible. You can start a new round.' }; }
}
export function saveSession(session: SavedSession, now: number, storage?: StorageLike): string {
  const value = { ...session, savedAt: Date.now(), match: session.match ? { ...session.match, present: snapshot(session.match.present, now) } : null };
  try { (storage ?? localStorage).setItem(STORAGE_KEY, JSON.stringify(value)); return ''; }
  catch {
    try { (storage ?? localStorage).setItem(STORAGE_KEY, JSON.stringify({ ...value, match: value.match ? { ...value.match, history: [] } : null })); return 'Recovery saved without Undo history (storage is full).'; }
    catch { return 'Recovery unavailable: browser storage is unavailable or full. Keep this page open.'; }
  }
}
