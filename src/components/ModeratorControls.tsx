import { answerMetadata } from '../parser/parseScienceBowlText';
import { useState } from 'react';
import type { Action, GameState } from '../game/gameState';
import type { Question, TeamId } from '../types';
export function ModeratorControls({ state, send, append }: { state: GameState; send: (a: Action) => void; append: (file: File) => void }) {
  const [team, setTeam] = useState<TeamId>('A'), [seconds, setSeconds] = useState('0'), [runoff, setRunoff] = useState(false);
  const [kind, setKind] = useState<'science' | 'rules'>('science');
  const [prompt, setPrompt] = useState(''), [answer, setAnswer] = useState(''), [category, setCategory] = useState('Replacement');
  const act = (a: Omit<Action, 'now'>) => send({ ...a, now: performance.now() } as Action);
  const c = state.competition!;
  const replace = () => {
    const q: Question = { id: crypto.randomUUID(), number: null, category, type: 'short-answer', text: prompt, answer, choices: null, ...answerMetadata(answer), source: [], rawBlock: prompt + '\nANSWER: ' + answer };
    send({ type: 'REPLACEMENT', question: q, now: performance.now() });
  };
  return <details><summary>Moderator rulings, challenges, replacements, and reserve questions</summary>
    <p>G pauses both clocks. Use Undo for a mistaken ruling. Physical buzz order, spoken recognition, answer accuracy, stalls, and timely challenges require an official's judgment. Never announce whether a blurt was correct.</p>
    <label>Team for ruling<select value={team} onChange={e => setTeam(e.target.value as TeamId)}><option value="A">A</option><option value="B">B</option></select></label>
    <div className="actions"><button onClick={() => send({ type: 'FOUL', team, now: performance.now() })}>Blurt / communication</button><button onClick={() => send({ type: 'ACCIDENTAL', team, now: performance.now() })}>Accidental ineligible buzz</button><button onClick={() => send({ type: 'DISTRACTION', team, runoff, now: performance.now() })}>Distraction by selected team</button></div>
    <label><input type="checkbox" checked={runoff} onChange={e => setRunoff(e.target.checked)} />Opponent elects distraction runoff (20 seconds toss-up / 40 bonus)</label>
    <p>Accidental warnings: A {c.accidental.A} · B {c.accidental.B}. A second accidental buzz is a distraction; use a clock correction for an elected runoff.</p>
    <label>Match-clock adjustment in seconds (negative removes time)<input type="number" value={seconds} onChange={e => setSeconds(e.target.value)} /></label><button onClick={() => send({ type: 'CLOCK_ADJUST', seconds: Number(seconds), now: performance.now() })}>Apply clock correction</button>
    <h3>Challenge decision</h3><p>Only between questions. Two unsuccessful scientific challenges per team, including tiebreaks. Officials enforce the three-second end-of-half deadline.</p>
    <label>Challenge type<select value={kind} onChange={e => setKind(e.target.value as 'science' | 'rules')}><option value="science">Scientific content</option><option value="rules">Rules administration</option></select></label>
    <p>Unsuccessful scientific challenges: A {c.failedChallenges.A}/2 · B {c.failedChallenges.B}/2</p>
    <button onClick={() => send({ type: 'CHALLENGE', team, kind, upheld: false, now: performance.now() })}>Challenge denied</button>{' '}<button onClick={() => send({ type: 'CHALLENGE', team, kind, upheld: true, now: performance.now() })}>Challenge upheld — pause for correction</button>
    <p>For an upheld challenge, Undo to the disputed answer, apply the new ruling, and restore clock time as directed. For Rule 7-6, mark the restored answer incorrect, then use “Answer revealed” to offer a fresh toss-up to the remaining team. Record the successful challenge after correction. Undo may also remove later challenge counts; re-enter any still-applicable decisions.</p>
    <h3>Replacement</h3><p>Use “Answer revealed” for a toss-up spoiled by the moderator. For invalid questions with scoring, Undo the affected awards first. Buzzer faults: pause, replace, and repair the physical buzzer before resuming. For a bonus spoiled by an official, replace it here for the same team and restore the lost time.</p>
    <button onClick={() => act({ type: 'REVEALED' })}>Answer revealed — next replacement toss-up</button>
    <label>Replacement category<input value={category} onChange={e => setCategory(e.target.value)} /></label><label>Replacement prompt (include W/X/Y/Z choices if needed)<textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} /></label><label>Replacement official answer<textarea rows={2} value={answer} onChange={e => setAnswer(e.target.value)} /></label><button disabled={!prompt.trim() || !answer.trim()} onClick={replace}>Use replacement for current question</button>
    <label>Append a reserve PDF (keeps scores and history)<input type="file" accept="application/pdf,.pdf" onChange={e => { if (e.target.files?.[0]) { append(e.target.files[0]); e.target.value = ''; } }} /></label>
    <p>Use unused reserve questions for tiebreakers. Reserve PDFs are extracted to text; inspect math in the original file separately.</p>
    <button onClick={() => { if (window.confirm(`Record a forfeit by Team ${team}?`)) send({ type: 'FORFEIT', team, now: performance.now() }); }}>Selected team forfeits</button>
  </details>;
}
