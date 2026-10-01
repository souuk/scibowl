import type { Diagnostic, DraftQuestion, ParseResult, Question, QuestionPair } from '../types';
import { labels } from '../types';

export function questionDiagnostics(q: DraftQuestion): Diagnostic[] {
  const errors: [string, string][] = [];
  if (!Number.isInteger(q.number) || q.number! < 1) errors.push(['NUMBER', 'A positive printed question number is required.']);
  if (!q.category.trim()) errors.push(['CATEGORY', 'Category is missing.']);
  if (!q.type) errors.push(['TYPE', 'Question type is missing.']);
  if (!q.text.trim()) errors.push(['TEXT', 'Question text is missing.']);
  if (!q.answer.trim()) errors.push(['ANSWER', 'Official answer is missing.']);
  if (q.type === 'multiple-choice' && labels.some(l => !q.choices?.[l]?.trim())) errors.push(['CHOICES', 'All four W/X/Y/Z choices are required.']);
  return [
    ...errors.map(([code, message]): Diagnostic => ({ id: `${q.id}-${code}`, code, message, blockId: q.id, severity: 'error', pages: q.source.map(s => s.page), resolution: q.excluded ? 'excluded' : 'unresolved' })),
    ...q.parseIssues.map((message, i): Diagnostic => ({ id: `${q.id}-issue-${i}`, code: 'REVIEW', message, blockId: q.id, severity: 'warning', pages: q.source.map(s => s.page), resolution: q.excluded ? 'excluded' : q.acknowledged.includes(message) ? 'acknowledged' : 'unresolved' })),
  ];
}
export function validatePacket(draft: ParseResult): { diagnostics: Diagnostic[]; pairs: QuestionPair[]; canStart: boolean } {
  const diagnostics = [...draft.diagnostics];
  const pairs: QuestionPair[] = [];
  for (const p of draft.draftPairs) {
    if (p.tossup.excluded) continue;
    diagnostics.push(...questionDiagnostics(p.tossup));
    if (p.bonus && !p.bonus.excluded) {
      diagnostics.push(...questionDiagnostics(p.bonus));
      if (p.bonus.number !== p.tossup.number) diagnostics.push({ id: `${p.id}-mismatch`, code: 'MISMATCH', message: 'Printed toss-up and bonus numbers differ.', severity: 'error', pages: [], resolution: 'unresolved' });
    } else if (!p.missingBonusAcknowledged) diagnostics.push({ id: `${p.id}-missing`, code: 'MISSING_BONUS', message: 'This toss-up will be played without a bonus.', severity: 'warning', pages: [], resolution: 'unresolved' });
    const playable = (q: DraftQuestion): Question => ({
      ...q,
      playbackWarnings: questionDiagnostics(q).filter(d => d.resolution === 'unresolved').map(d => d.message),
      preferSource: q.preferSource ?? (/math/i.test(q.category) || questionDiagnostics(q).some(d => d.severity === 'error')),
    });
    pairs.push({ id: p.id, number: p.tossup.number, tossup: playable(p.tossup), bonus: p.bonus && !p.bonus.excluded ? playable(p.bonus) : null });
  }
  for (const q of draft.unassignedBlocks) if (!q.excluded) diagnostics.push({ id: `${q.id}-unassigned`, code: 'UNASSIGNED', message: 'Assign or exclude the unassigned bonus.', severity: 'error', pages: q.source.map(s => s.page), resolution: 'unresolved' });
  for (const s of draft.unparsedSegments) if (!s.excluded) diagnostics.push({ id: s.id, code: 'UNPARSED', message: 'Retained text has not been assigned to a question.', severity: 'error', pages: s.pages, resolution: 'unresolved' });
  // Review is optional. Keep incomplete questions and their source, never invent an answer.
  return { diagnostics, pairs, canStart: pairs.length > 0 };
}
