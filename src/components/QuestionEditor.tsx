import { useState } from 'react';
import type { DraftQuestion } from '../types';
import { labels } from '../types';
import { answerMetadata } from '../parser/parseScienceBowlText';
export function QuestionEditor({ question, onSave, onCancel }: { question: DraftQuestion; onSave: (q: DraftQuestion) => void; onCancel: () => void }) {
  const [q, set] = useState(structuredClone(question));
  return <form className="editor" onSubmit={e => { e.preventDefault(); onSave({ ...q, preferSource: false, ...answerMetadata(q.answer) }); }}>
    <label>Printed number<input type="number" min="1" value={q.number ?? ''} onChange={e => set({ ...q, number: e.target.value ? Number(e.target.value) : null })} /></label>
    <label>Category<input value={q.category} onChange={e => set({ ...q, category: e.target.value })} /></label>
    <label>Type<select value={q.type ?? ''} onChange={e => set({ ...q, type: e.target.value as DraftQuestion['type'], choices: e.target.value === 'multiple-choice' ? q.choices ?? { W: '', X: '', Y: '', Z: '' } : null })}><option value="">Choose type</option><option value="short-answer">Short Answer</option><option value="multiple-choice">Multiple Choice</option></select></label>
    <label>Question<textarea rows={5} value={q.text} onChange={e => set({ ...q, text: e.target.value })} /></label>
    {q.type === 'multiple-choice' && labels.map(l => <label key={l}>{l})<textarea rows={2} value={q.choices?.[l] ?? ''} onChange={e => set({ ...q, choices: { W: '', X: '', Y: '', Z: '', ...q.choices, [l]: e.target.value } })} /></label>)}
    <label>Complete official answer, including acceptance notes<textarea rows={4} value={q.answer} onChange={e => set({ ...q, answer: e.target.value })} /></label>
    <button type="submit">Save question</button> <button type="button" onClick={onCancel}>Cancel edit</button>
  </form>;
}
