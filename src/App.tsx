import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Packet, ParseResult, TeamId } from './types';
import { extractPdf, hashFile } from './parser/extractPdf';
import { parseScienceBowlText } from './parser/parseScienceBowlText';
import { validatePacket } from './parser/validatePacket';
import { createGame, type Action, type Match } from './game/gameState';
import { reduceMatch } from './game/history';
import { tick } from './game/gameReducer';
import { defaultCompetition, type CompetitionConfig } from './game/competition';
import { CompetitionSetup } from './components/CompetitionSetup';
import { keyCommand, type Command } from './browser/keyboard';
import { createTicker } from './browser/clock';
import { beep, enableAudio } from './browser/audio';
import { readSession, saveSession, type SavedSession } from './browser/persistence';
import { Setup } from './components/Setup';
import { Game } from './components/Game';
import { SourcePreview } from './components/SourcePreview';

export default function App() {
  const [competition, setCompetition] = useState<CompetitionConfig | null>(defaultCompetition);
  const [initial] = useState(() => readSession());
  const [recovery, setRecovery] = useState(initial.session);
  const [names, setNames] = useState<Record<TeamId, string>>({ A: 'Team A', B: 'Team B' });
  const [file, setFile] = useState<File | null>(null), [fileName, setFileName] = useState(''), [fileHash, setFileHash] = useState('');
  const [draft, setDraft] = useState<ParseResult | null>(null), [packet, setPacket] = useState<Packet | null>(null);
  const [match, setMatch] = useState<Match | null>(null), matchRef = useRef<Match | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const [storageError, setStorageError] = useState(initial.error), [audioError, setAudioError] = useState(''), [muted, setMuted] = useState(false);
  const [review, setReview] = useState<number | null>(null), [source, setSource] = useState<number[] | null>(null);
  const [now, setNow] = useState(performance.now());
  useLayoutEffect(() => { if (match) window.scrollTo(0, 0); }, [!!match, match?.present.index, match?.present.phase.includes('BONUS'), review]);
  const commit = (m: Match | null) => { matchRef.current = m; setMatch(m); };
  const audio = () => { void enableAudio().then(ok => setAudioError(ok ? '' : 'Sound unavailable. Visual timer signals remain active.')); };
  const send = (action: Action) => {
    if (!matchRef.current || !packet) return;
    const previous = matchRef.current;
    const timed = tick(previous.present, action.now);
    if (timed !== previous.present) {
      if (timed.phase !== previous.present.phase && ['HALFTIME', 'ROUND_COMPLETE', 'TIEBREAK_READY'].includes(timed.phase) || timed.phase.endsWith('EXPIRED') || timed.competition?.matchTimer.warned && !previous.present.competition?.matchTimer.warned) beep('time', muted);
      else if (!previous.present.timer.warned && timed.timer.warned) beep('warning', muted);
    }
    const next = reduceMatch({ ...previous, present: timed }, action, packet);
    if (next.present !== previous.present || next.history !== previous.history) commit(next);
  };
  const showSource = (pages: number[]) => { send({ type: 'PAUSE', now: performance.now() }); setSource(pages); };
  const command = (c: Command) => {
    if (!packet || !matchRef.current || recovery) return;
    if (busy) return;
    const state = matchRef.current.present, time = performance.now();
    if (source) { if (c === 'SOURCE' || c === 'RETURN') setSource(null); else if (c === 'UNDO') { setSource(null); setReview(null); send({ type: 'UNDO', now: time }); } return; }
    if (c === 'RETURN') { setReview(null); return; }
    if (c === 'UNDO') { setReview(null); send({ type: 'UNDO', now: time }); return; }
    if (c === 'PREVIOUS') {
      if (review === null && state.index === 0 && state.phase !== 'ROUND_COMPLETE') return;
      send({ type: 'PAUSE', now: time });
      setReview(review === null ? Math.max(0, state.index - (state.phase === 'ROUND_COMPLETE' ? 0 : 1)) : Math.max(0, review - 1)); return;
    }
    if (c === 'SOURCE') { const p = packet.pairs[review ?? state.index]; showSource(review !== null ? [...p.tossup.source, ...(p.bonus?.source ?? [])].map(s => s.page) : (state.phase.includes('BONUS') ? state.competition?.replacementBonus ?? p.bonus : state.competition?.replacementTossup ?? p.tossup)?.source.map(s => s.page) ?? []); return; }
    if (review !== null) { if (c === 'NEXT') setReview(review >= state.index ? null : review + 1); return; }
    if (c === 'CATEGORY') send({ type: ['HALFTIME', 'TIEBREAK_READY', 'NEED_QUESTIONS'].includes(state.phase) ? 'CONTINUE' : 'CATEGORY', now: time });
    if (c === 'RECOGNIZE' || c === 'ANSWER_STARTED' || c === 'CLOCK' || c === 'VISUAL') send({ type: c, now: time });
    if (c === 'FOUL_A' || c === 'FOUL_B') send({ type: 'FOUL', team: c === 'FOUL_A' ? 'A' : 'B', now: time });
    if (c === 'A' || c === 'D') send({ type: 'BUZZ', team: c === 'A' ? 'A' : 'B', now: time });
    if (c === 'W' || c === 'S') send({ type: 'JUDGE', correct: c === 'W', now: time });
    if (c === 'SPACE' || c === 'NEXT') send({ type: c, now: time });
  };
  const live = useRef({ send, command }); live.current = { send, command };
  useEffect(() => {
    if (!match) return;
    const ticker = createTicker(time => { setNow(time); live.current.send({ type: 'TICK', now: time }); });
    ticker.start();
    const key = (event: KeyboardEvent) => { const c = keyCommand(event); if (c) { event.preventDefault(); live.current.command(c); } };
    const visibility = () => live.current.send({ type: 'TICK', now: performance.now() });
    window.addEventListener('keydown', key); document.addEventListener('visibilitychange', visibility);
    return () => { ticker.stop(); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility); };
  }, [!!match]);
  useEffect(() => {
    if (!source || match) return;
    const key = (e: KeyboardEvent) => { if (keyCommand(e) === 'RETURN' || keyCommand(e) === 'SOURCE') { e.preventDefault(); setSource(null); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [source, match]);
  const session: SavedSession = { version: 1, savedAt: Date.now(), packet, draft, fileName, fileHash, names, muted, match };
  const savedRef = useRef(session); savedRef.current = session;
  const persist = () => { if (!recovery && (savedRef.current.draft || savedRef.current.match)) setStorageError(saveSession(savedRef.current, performance.now())); };
  const persistRef = useRef(persist); persistRef.current = persist;
  useEffect(() => { persistRef.current(); }, [packet, draft, fileName, fileHash, names, muted, match, recovery]);
  useEffect(() => {
    const save = () => persistRef.current();
    const interval = window.setInterval(() => { if (matchRef.current && (matchRef.current.present.timer.deadline !== null || matchRef.current.present.competition?.matchTimer.deadline != null)) save(); }, 1000);
    window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', save);
    return () => { clearInterval(interval); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', save); };
  }, []);
  async function parse() {
    if (!file) { setError('Reselect the PDF before parsing. Your saved edits remain available.'); return; }
    if (draft && !window.confirm('Reparse this PDF and replace the current question edits?')) return;
    setBusy(true); setError('');
    try {
      const extracted = await extractPdf(file, setProgress);
      const result = parseScienceBowlText(extracted);
      setFileHash(await hashFile(file)); setDraft(result); setProgress('Extraction complete. Start now, or optionally review the parsed questions.');
      console.info('Science Bowl parser', result.stats, validatePacket(result).diagnostics);
    } catch (e) { setError(e instanceof Error ? e.message : 'The PDF could not be parsed.'); }
    finally { setBusy(false); }
  }
  function start() {
    if (!draft) return;
    const v = validatePacket(draft); if (!v.canStart) return;
    const p: Packet = { id: crypto.randomUUID(), fileName, fileHash, pairs: structuredClone(v.pairs), ...(competition ? { competition } : {}) };
    setNames({ A: names.A.trim() || 'Team A', B: names.B.trim() || 'Team B' });
    setPacket(p); commit({ present: createGame(p), history: [] }); setReview(null); setSource(null); audio();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  async function appendReserve(f: File) {
    if (!packet || !matchRef.current) return;
    send({ type: 'PAUSE', now: performance.now() }); setBusy(true); setError('');
    try {
      const parsed = parseScienceBowlText(await extractPdf(f, setProgress));
      const v = validatePacket(parsed);
      if (!v.pairs.length) throw new Error('No toss-ups found in the reserve PDF.');
      const prefix = crypto.randomUUID();
      const pairs = structuredClone(v.pairs).map(p => ({ ...p, id: prefix + p.id, tossup: { ...p.tossup, id: prefix + p.tossup.id, source: [], preferSource: false }, bonus: p.bonus ? { ...p.bonus, id: prefix + p.bonus.id, source: [], preferSource: false } : null }));
      const extend = (s: Match['present']) => ({ ...s, outcomes: [...s.outcomes, ...pairs.map(p => ({ tossup: { status: 'pending' as const }, bonus: { status: p.bonus ? 'pending' as const : 'unavailable' as const } }))] });
      const old = matchRef.current!;
      setPacket({ ...packet, pairs: [...packet.pairs, ...pairs] });
      commit({ present: { ...extend(old.present), lastAction: `${pairs.length} reserve pairs appended from ${f.name}. Check extracted math against the reserve PDF. C continues a waiting round.` }, history: old.history.map(extend) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not append reserve questions.'); }
    finally { setBusy(false); }
  }
  async function attach(f: File) {
    try { if (await hashFile(f) !== fileHash) { setError('This is a different PDF. Reselect the original packet to view its source.'); return; } setFile(f); setError(''); }
    catch { setError('Could not read the selected PDF.'); }
  }
  return <main><h1>Science Bowl Practice</h1>
    {busy && <p role="status">{progress}</p>}
    {storageError && <p role="alert" className="warning">{storageError}</p>}{error && <p role="alert" className="warning">{error}</p>}{audioError && <p role="alert">{audioError}</p>}
    {recovery ? <section><h2>Saved {recovery.match ? 'round' : 'packet review'}</h2><p>{recovery.fileName} — {recovery.names.A} / {recovery.names.B}</p><button onClick={() => { setNames(recovery.names); setPacket(recovery.packet); setDraft(recovery.draft); setFileName(recovery.fileName); setFileHash(recovery.fileHash); setMuted(recovery.muted); commit(recovery.match); setRecovery(null); audio(); }}>Resume saved {recovery.match ? 'round' : 'review'}</button> <button onClick={() => { if (window.confirm('Discard saved progress and start a new round?')) { setRecovery(null); try { localStorage.removeItem('science-bowl-practice:v1'); } catch {} } }}>Start new round</button></section>
      : <>{match && packet ? <Game file={file} packet={packet} match={match} names={names} now={now} review={review} blocked={source !== null || busy} command={command} send={send} append={f => void appendReserve(f)} onAdjust={(team, delta) => send({ type: 'ADJUST', team, delta, now: performance.now() })} onReset={() => { send({ type: 'PAUSE', now: performance.now() }); if (window.confirm('Reset scores and progress? The packet and team names will be kept.')) { send({ type: 'RESET', now: performance.now() }); setReview(null); setSource(null); } }} onReplace={() => { send({ type: 'PAUSE', now: performance.now() }); if (window.confirm('Leave this match and choose another packet?')) { commit(null); setPacket(null); setReview(null); setSource(null); } }} />
        : <><CompetitionSetup value={competition} onChange={setCompetition} /><Setup names={names} setNames={setNames} fileName={fileName} busy={busy} progress={progress} draft={draft} onFile={f => { if (draft && !window.confirm('Replace this packet and its edits?')) return; setFile(f); setFileName(f.name); setFileHash(''); setDraft(null); setError(''); setProgress(''); }} onParse={() => void parse()} onChange={setDraft} onStart={start} onSource={showSource} /></>}
        <footer><label><input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} />Mute timer sounds</label> <button onClick={() => { void enableAudio().then(ok => { setAudioError(ok ? '' : 'Sound unavailable.'); if (ok) beep('warning', false); }); }}>Test sound</button><p>Everything stays in this browser. No upload, account, or cloud service.</p></footer></>}
    {source && <SourcePreview key={source.join(',')} file={file} pages={source} onClose={() => setSource(null)} onAttach={f => void attach(f)} />}
  </main>;
}
