import { useState } from 'react';
import type { DraftQuestion, ParseResult } from '../types';
import { emptyQuestion } from '../parser/parseScienceBowlText';
import { questionDiagnostics, validatePacket } from '../parser/validatePacket';
import { QuestionEditor } from './QuestionEditor';
import { QuestionView } from './QuestionView';

export function ParserPreview({ draft, onChange, onSource }: { draft: ParseResult; onChange: (d: ParseResult) => void; onSource: (pages: number[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const validation = validatePacket(draft);
  const mutate = (fn: (d: ParseResult) => void) => { const d = structuredClone(draft); fn(d); onChange(d); };
  const update = (q: DraftQuestion) => mutate(d => { for (const p of d.draftPairs) { if (p.tossup.id === q.id) p.tossup = q; if (p.bonus?.id === q.id) p.bonus = q; } d.unassignedBlocks = d.unassignedBlocks.map(x => x.id === q.id ? q : x); });
  const row = (q: DraftQuestion) => <div className="preview-question" key={q.id}>
    <h4>{q.kind === 'tossup' ? 'Toss-up' : 'Bonus'} {q.number ?? '?'}{q.excluded ? ' — EXCLUDED' : ''}</h4>
    {editing === q.id ? <QuestionEditor key={q.id} question={q} onSave={next => { update(next); setEditing(null); }} onCancel={() => setEditing(null)} /> : <QuestionView question={q} />}
    <p>Source pages: {[...new Set(q.source.map(s => s.page))].join(', ') || 'Manual entry'}</p>
    <div className="actions"><button onClick={() => setEditing(q.id)}>Edit {q.kind}</button><button disabled={!q.source.length} onClick={() => onSource(q.source.map(s => s.page))}>Check source PDF</button><button onClick={() => update({ ...q, excluded: !q.excluded })}>{q.excluded ? 'Include' : 'Exclude'} {q.kind}</button></div>
    {questionDiagnostics(q).map(d => <p key={d.id} className={d.resolution === 'unresolved' ? 'warning' : 'resolved'}>{d.severity}: {d.message} {d.resolution === 'unresolved' && d.severity === 'warning' && <button onClick={() => update({ ...q, acknowledged: [...q.acknowledged, d.message] })}>Checked against source</button>}{d.resolution !== 'unresolved' && `(${d.resolution})`}</p>)}
    <details><summary>Original extracted text</summary><pre>{q.rawBlock}</pre></details>
  </div>;
  const add = (kind: 'tossup' | 'bonus', pairId?: string, text = '', pages: number[] = []) => mutate(d => {
    const q = emptyQuestion(crypto.randomUUID(), kind); q.rawBlock = text; q.source = pages.map(page => ({ page, startOffset: 0, endOffset: 0 }));
    if (pairId) { const p = d.draftPairs.find(p => p.id === pairId)!; q.number = p.tossup.number; p.bonus = q; p.missingBonusAcknowledged = false; }
    else d.draftPairs.push({ id: crypto.randomUUID(), tossup: q, bonus: null, missingBonusAcknowledged: false });
    setEditing(q.id);
  });
  return <section aria-label="Parsed question preview"><h2>Parsed question preview</h2>
    <p data-testid="parse-counts">{draft.stats.pages} pages · {draft.stats.tossups} toss-ups detected · {draft.stats.bonuses} bonuses detected · {draft.stats.pairs} pairs matched</p>
    <p>{validation.pairs.length} toss-ups included · {draft.draftPairs.filter(p => p.tossup.excluded).length} pairs excluded · {validation.diagnostics.filter(d => d.resolution === 'unresolved' && d.severity === 'error').length} errors · {validation.diagnostics.filter(d => d.resolution === 'unresolved' && d.severity === 'warning').length} warnings</p>
    <p>Flags are advisory and do not block Start Round. Math questions use the original PDF during play to preserve symbols. Unassigned bonuses and retained text remain here for optional repair; they are not automatically added to the round.</p>
    {draft.draftPairs.map((p, i) => <details key={p.id} className="pair" open={editing === p.tossup.id || editing === p.bonus?.id ? true : undefined}>
      <summary>Pair {i + 1} — packet {p.tossup.number ?? '?'} — {p.tossup.category || 'Missing category'} {p.tossup.excluded ? '(excluded)' : validation.diagnostics.some(d => d.resolution === 'unresolved' && (d.blockId === p.tossup.id || d.blockId === p.bonus?.id || d.id.startsWith(p.id))) ? '— FLAGS (optional review)' : '— ready'}</summary>
      {row(p.tossup)}{p.bonus && row(p.bonus)}
      <div className="actions"><button disabled={i === 0} onClick={() => mutate(d => { [d.draftPairs[i - 1], d.draftPairs[i]] = [d.draftPairs[i], d.draftPairs[i - 1]]; })}>Move pair earlier</button><button disabled={i === draft.draftPairs.length - 1} onClick={() => mutate(d => { [d.draftPairs[i + 1], d.draftPairs[i]] = [d.draftPairs[i], d.draftPairs[i + 1]]; })}>Move pair later</button></div>
      {!p.bonus && <button onClick={() => add('bonus', p.id)}>Add missing bonus</button>}
      {(!p.bonus || p.bonus.excluded) && !p.tossup.excluded && <label><input type="checkbox" checked={p.missingBonusAcknowledged} onChange={e => mutate(d => { d.draftPairs.find(x => x.id === p.id)!.missingBonusAcknowledged = e.target.checked; })} />Play this toss-up without a bonus</label>}
      {p.bonus && !p.bonus.excluded && p.bonus.number !== p.tossup.number && <p className="warning">Printed toss-up and bonus numbers differ.</p>}
    </details>)}
    {draft.unassignedBlocks.map(q => <details key={q.id} open><summary>Unassigned bonus {q.number ?? '?'}</summary>{row(q)}{!q.excluded && <label>Assign to toss-up<select value="" onChange={e => { const id = e.target.value; if (id) mutate(d => { const p = d.draftPairs.find(p => p.id === id)!; p.bonus = { ...q, number: p.tossup.number, acknowledged: [...q.acknowledged, ...q.parseIssues.filter(x => x.startsWith('Unassigned bonus'))] }; d.unassignedBlocks = d.unassignedBlocks.filter(x => x.id !== q.id); }); }}><option value="">Choose a pair</option>{draft.draftPairs.filter(p => !p.bonus && !p.tossup.excluded).map(p => <option key={p.id} value={p.id}>Toss-up {p.tossup.number}</option>)}</select></label>}</details>)}
    {draft.unparsedSegments.map(s => <details key={s.id}><summary>Retained source text — pages {s.pages.join(', ')} {s.excluded ? '(resolved)' : '— FLAGS (optional review)'}</summary><pre>{s.text}</pre><button onClick={() => onSource(s.pages)}>Check source PDF</button><button onClick={() => add('tossup', undefined, s.text, s.pages)}>Create question from this text</button><label><input type="checkbox" checked={s.excluded} onChange={e => mutate(d => { d.unparsedSegments.find(x => x.id === s.id)!.excluded = e.target.checked; })} />Resolved manually or confirmed this is not a question</label></details>)}
    <button onClick={() => add('tossup')}>Add a missing toss-up</button>
    <details><summary>Parser diagnostics</summary><pre>{JSON.stringify({ stats: draft.stats, diagnostics: validation.diagnostics }, null, 2)}</pre></details>
  </section>;
}
