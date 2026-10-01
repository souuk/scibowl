import type { Packet, TeamId } from '../types';
import { timeLeft, untimed } from '../game/competition';
import { downloadResults } from '../browser/exportResults';
import { ModeratorControls } from './ModeratorControls';
import type { Action, Match } from '../game/gameState';
import type { Command } from '../browser/keyboard';
import { Scoreboard } from './Scoreboard';
import { QuestionView } from './QuestionView';
import { Timer } from './Timer';
export function Game({ file, packet, match, names, now, review, blocked, command, send, append, onAdjust, onReset, onReplace }: { file: File | null; packet: Packet; match: Match; names: Record<TeamId, string>; now: number; review: number | null; blocked: boolean; command: (c: Command) => void; send: (a: Action) => void; append: (f: File) => void; onAdjust: (t: TeamId, d: number) => void; onReset: () => void; onReplace: () => void }) {
  const state = match.present, complete = state.phase === 'ROUND_COMPLETE', c = state.competition;
  const waiting = ['HALFTIME', 'TIEBREAK_READY', 'NEED_QUESTIONS'].includes(state.phase);
  const disabled = blocked || review !== null;
  const clockSeconds = c ? Math.ceil(timeLeft(c.matchTimer, now) / 1000) : 0;
  const pair = packet.pairs[review ?? state.index];
  const bonus = state.phase.includes('BONUS');
  const q = bonus ? c?.replacementBonus ?? pair.bonus : c?.replacementTossup ?? pair.tossup;
  const canBuzz = ['READING_TOSSUP', 'TOSSUP_OPEN', 'TOSSUP_EXPIRED'].includes(state.phase) && !(c?.config.format === 'multi-team-tiebreak' && state.phase === 'READING_TOSSUP');
  const canJudge = ['TOSSUP_ANSWERING', 'BONUS_OPEN', 'BONUS_EXPIRED', 'BONUS_ANSWERING'].includes(state.phase);
  const canSpace = ['READING_TOSSUP', 'READING_BONUS', 'TOSSUP_EXPIRED'].includes(state.phase) || state.phase.endsWith('_OPEN') && state.timer.deadline === null;
  return <>
    <Scoreboard names={names} scores={state.scores} disabled={blocked || review !== null} onAdjust={onAdjust} allowNegative={c?.config.format === 'multi-team-tiebreak'} />
    {c && <aside><p>{c.config.level} school · {c.config.venue} · {c.config.format} · {c.tiebreakSet ? `Tiebreak set ${c.tiebreakSet}, ${c.tiebreakQuestion}/5 completed` : `Half ${c.half}`}</p>
      {!untimed(c) && <p data-testid="match-clock">{state.phase === 'HALFTIME' ? 'Break' : 'Match clock'}: {Math.floor(clockSeconds / 60)}:{String(clockSeconds % 60).padStart(2, '0')}{c.matchTimer.deadline === null ? ' — PAUSED' : ''}</p>}
      <button disabled={disabled || complete || state.phase === 'NEED_QUESTIONS' || state.phase === 'TIEBREAK_READY'} onClick={() => command('CLOCK')}>G — Pause / resume clocks</button></aside>}
    {review !== null ? <section><h2>REVIEW — Question {review + 1} / {packet.pairs.length}</h2><p>Scores unchanged. Return to the active question to continue.</p><h3>Toss-up {pair.number}</h3><QuestionView file={file} question={pair.tossup} />{pair.bonus && <><h3>Bonus {pair.number}</h3><QuestionView file={file} question={pair.bonus} /></>}<button onClick={() => command('RETURN')}>Return to active question (Escape)</button></section>
      : complete ? <section><h2>Round complete</h2><p>{c?.forfeitWinner ? `${names[c.forfeitWinner]} wins by forfeit.` : c?.config.format === 'multi-team-tiebreak' ? `${names.A}: qualifying score ${state.scores.A}. Compare with other rooms.` : state.scores.A === state.scores.B ? 'Tie.' : `${names[state.scores.A > state.scores.B ? 'A' : 'B']} finishes ahead.`} Final scores are shown above.</p><button onClick={() => downloadResults(packet, state, names)}>Export results (.txt)</button></section>
      : waiting ? <section><h2>{state.phase === 'HALFTIME' ? 'Half-time' : state.phase === 'TIEBREAK_READY' ? 'Tiebreaker ready' : 'Reserve questions needed'}</h2><button disabled={disabled || state.phase === 'NEED_QUESTIONS' && state.index + 1 >= packet.pairs.length || state.phase === 'HALFTIME' && timeLeft(c!.matchTimer, now) > 0} onClick={() => send({ type: 'CONTINUE', now: performance.now() })}>C — Continue</button><p>Start the halftime break clock with G. Append a reserve PDF in Moderator rulings when needed.</p></section>
      : <section><p>Question {state.index + 1} / {packet.pairs.length}{pair.number !== state.index + 1 && ` — packet number ${pair.number ?? '?'}`}</p><h2 data-testid="phase">{bonus ? `BONUS — ${names[state.bonusOwner!]}` : 'TOSS-UP'}{state.answering && ` — ${names[state.answering]} ${state.phase === 'TOSSUP_RECOGNIZE' ? 'AWAITING RECOGNITION' : 'ANSWERING'}`}</h2>{c && !bonus && <p>Eligible: {(['A', 'B'] as const).filter(t => c.eligible[t]).map(t => names[t]).join(', ') || 'Neither team'}{c.interrupted && ' · INTERRUPT: an incorrect answer gives the opponent four points.'}</p>}{state.phase === 'READY_TOSSUP' && <p>Read the category, then C to enable buzzers.</p>}{q ? <QuestionView file={file} question={q} /> : <p className="warning">Bonus missing: supply a replacement in Moderator rulings.</p>}<Timer state={state} now={now} /></section>}
    <p role="status" aria-live="polite">{state.lastAction}</p>
    <div className="actions">{c && <><button disabled={disabled || state.phase !== 'READY_TOSSUP'} onClick={() => command('CATEGORY')}>C — Category read</button><button disabled={disabled || state.phase !== 'TOSSUP_RECOGNIZE'} onClick={() => command('RECOGNIZE')}>R — Player recognized</button><button disabled={disabled || !['TOSSUP_ANSWERING', 'BONUS_OPEN', 'BONUS_EXPIRED'].includes(state.phase)} onClick={() => command('ANSWER_STARTED')}>B — Answer began before TIME</button></>}
    <button disabled={blocked || review !== null || !canBuzz || !!c && !c.eligible.A} onClick={() => command('A')}>A — {names.A} buzz</button><button disabled={blocked || review !== null || !canBuzz || !!c && !c.eligible.B} onClick={() => command('D')}>D — {names.B} buzz</button><button disabled={blocked || review !== null || !canJudge || !!c && state.phase === 'BONUS_EXPIRED'} onClick={() => command('W')}>W — Correct</button><button disabled={blocked || review !== null || !canJudge} onClick={() => command('S')}>S — Incorrect</button><button disabled={blocked || review !== null || !canSpace || bonus && !q} onClick={() => command('SPACE')}>Space — {state.phase === 'TOSSUP_EXPIRED' ? 'Continue' : state.phase.endsWith('_OPEN') ? 'Resume timer' : 'Start timer'}</button></div>
    <div className="actions"><button disabled={blocked || (review === null ? state.index === 0 && !complete : review === 0)} onClick={() => command('PREVIOUS')}>Previous (P)</button><button disabled={blocked || (complete && review === null) || review === null && !!c && (waiting || state.phase === 'READY_TOSSUP')} onClick={() => command('NEXT')}>{review !== null ? 'Next in review (N)' : 'Next toss-up (N)'}</button><button disabled={blocked || !match.history.length} onClick={() => command('UNDO')}>Undo (Backspace)</button><button disabled={blocked} onClick={() => command('SOURCE')}>Source PDF (O)</button></div>
    <p className="muted">A/D: first buzz · W/S: correct/incorrect · Space: start/resume · N: next · Backspace: undo<br />{c ? 'C: category read · R: recognize · B: answer began · F/J: A/B blurt or communication · G: clocks · V: visual bonus. Moderator judges spoken answers.' : 'Simplified practice: an incorrect toss-up ends the pair.'}</p>
    {c?.config.venue === 'national-visual' && <button disabled={disabled || state.phase !== 'READING_BONUS'} onClick={() => command('VISUAL')}>V — {c.visual ? 'Use 20-second bonus' : 'Use 30-second visual bonus'}</button>}
    {c && <fieldset disabled={disabled}><ModeratorControls state={state} send={send} append={append} /></fieldset>}
    <div className="actions"><button onClick={onReset}>Reset Match</button><button onClick={onReplace}>Choose another packet</button></div>
  </>;
}
