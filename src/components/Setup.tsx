import type { ParseResult, TeamId } from '../types';
import { validatePacket } from '../parser/validatePacket';
import { ParserPreview } from './ParserPreview';
export function Setup({ names, setNames, fileName, busy, progress, draft, onFile, onParse, onChange, onStart, onSource }: { names: Record<TeamId, string>; setNames: (n: Record<TeamId, string>) => void; fileName: string; busy: boolean; progress: string; draft: ParseResult | null; onFile: (f: File) => void; onParse: () => void; onChange: (d: ParseResult) => void; onStart: () => void; onSource: (p: number[]) => void }) {
  return <><label>PDF<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} /></label>{fileName && <p>Selected: {fileName}</p>}
    <div className="team-inputs">{(['A', 'B'] as const).map(t => <label key={t}>Team {t}<input maxLength={80} value={names[t]} onChange={e => setNames({ ...names, [t]: e.target.value })} /></label>)}</div>
    <button disabled={busy || !fileName} onClick={onParse}>Parse PDF</button><p role="status">{progress}</p>
    <button className="start" disabled={busy || !draft || !validatePacket(draft).canStart} onClick={onStart}>Start Round</button>
    {draft && <><p>Ready to start. Reviewing flags is optional; questions with extraction issues stay in the round.</p><ParserPreview draft={draft} onChange={onChange} onSource={onSource} /></>}
  </>;
}
