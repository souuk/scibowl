import type { Question, DraftQuestion } from '../types';
import { labels } from '../types';
import { QuestionSource } from './QuestionSource';
export function QuestionView({ question: q, file }: { question: Question | DraftQuestion; file?: File | null }) {
  const printed = q.preferSource && q.source.length > 0 && file !== undefined;
  const text = <>
    <div className="question">{q.text || '(Question text missing)'}</div>
    {q.choices && <dl className="choices">{labels.map(l => <div key={l}><dt>{l})</dt><dd>{q.choices![l]}</dd></div>)}</dl>}
    <section className="answer"><h3>Official answer</h3><div>{q.answer || '(Official answer missing — use Source PDF or skip this question)'}</div></section></>;
  return <><p className="category">{q.category || 'Category missing'} — {q.type === 'multiple-choice' ? 'Multiple Choice' : q.type === 'short-answer' ? 'Short Answer' : 'Type missing'}</p>
    {printed && file ? <><QuestionSource key={q.id} file={file} source={q.source} /><details><summary>Extracted text (may lose math formatting)</summary>{text}</details></> : <>{printed && <p className="warning">Press O and reselect the original PDF to restore its math notation. Extracted text is shown below.</p>}{text}</>}
    {q.playbackWarnings?.length ? <details><summary>Parsing notes ({q.playbackWarnings.length}) — optional</summary><ul>{q.playbackWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details> : null}
  </>;
}
