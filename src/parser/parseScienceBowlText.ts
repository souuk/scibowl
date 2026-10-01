import type { DraftQuestion, ExtractedDocument, ParseResult, SourceSpan, ChoiceLabel } from '../types';
import { labels } from '../types';

export function answerMetadata(answer: string) {
  const acceptedAnswers: string[] = [], rejectedAnswers: string[] = [], answerNotes: string[] = [];
  const clauses = [...answer.matchAll(/\b(DO\s+NOT\s+ACCEPT|ACCEPT)\s*:\s*/gi)];
  for (const [index, m] of clauses.entries()) {
    const start = m.index! + m[0].length;
    let end = clauses[index + 1]?.index ?? answer.length, depth = 0;
    for (let i = start; i < end; i++) {
      if (answer[i] === '(') depth++;
      else if (answer[i] === ')') { if (!depth) { end = i; break; } depth--; }
    }
    const value = answer.slice(start, end).trim();
    (/^DO/i.test(m[1]) ? rejectedAnswers : acceptedAnswers).push(value);
  }
  for (const m of answer.matchAll(/\(([^)]*(?:in (?:either|any) order|solution:|accept(?!\s*:))[^)]*)\)/gi)) answerNotes.push(m[1]);
  const choice = answer.match(/^\s*([WXYZ])\s*[).]/i)?.[1]?.toUpperCase() as ChoiceLabel | undefined;
  return { acceptedAnswers, rejectedAnswers, answerNotes, answerChoice: choice ?? null };
}

export function emptyQuestion(id: string, kind: 'tossup' | 'bonus'): DraftQuestion {
  return { id, kind, number: null, category: '', type: null, text: '', choices: null, answer: '', ...answerMetadata(''), source: [], rawBlock: '', excluded: false, acknowledged: [], parseIssues: [] };
}

export function parseScienceBowlText(document: ExtractedDocument): ParseResult {
  // Length-preserving matching normalization keeps source offsets exact.
  const pages = document.pages.map(p => ({ ...p, text: p.text.replace(/\r/g, ' ').replace(/\u00a0/g, ' ') }));
  let full = '';
  const ranges = pages.map(p => { const start = full.length; full += p.text + '\n'; return { ...p, start, end: full.length - 1 }; });
  const spans = (start: number, end: number): SourceSpan[] => ranges.filter(p => p.end > start && p.start < end).map(p => {
    const startOffset = Math.max(0, start - p.start), endOffset = Math.min(p.text.length, end - p.start);
    const regions = p.regions?.filter(r => r.end > startOffset && r.start < endOffset);
    return { page: p.page, startOffset, endOffset, ...(regions?.length ? { bounds: [
      Math.min(...regions.map(r => r.bounds[0])) - 8,
      Math.min(...regions.map(r => r.bounds[1])) - 8,
      Math.max(...regions.map(r => r.bounds[2])) + 8,
      Math.max(...regions.map(r => r.bounds[3])) + 8,
    ] as SourceSpan['bounds'] } : {}) };
  });
  const markers: { start: number; end: number; kind: 'tossup' | 'bonus' }[] = [];
  for (const m of full.matchAll(/TOSS[\s\-‐‑–—]*UP|BONUS/gi)) {
    const start = m.index!, end = start + m[0].length;
    const lineStart = full.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = full.indexOf('\n', end);
    const standalone = !full.slice(lineStart, start).trim() && !full.slice(end, lineEnd < 0 ? full.length : lineEnd).trim();
    const header = /^\s*\d+\s*[).]\s*[^\d]{1,100}?(?:Short\s+Answer|Multiple\s+Choice)\b/i.test(full.slice(end, end + 180));
    if (standalone || header) markers.push({ start, end, kind: /^TOSS/i.test(m[0]) ? 'tossup' : 'bonus' });
  }
  const result: ParseResult = { draftPairs: [], unassignedBlocks: [], unparsedSegments: [], diagnostics: [], stats: { pages: pages.length, tossups: 0, bonuses: 0, pairs: 0 } };
  const preamble = full.slice(0, markers[0]?.start ?? full.length).trim();
  if (preamble) result.unparsedSegments.push({ id: 'preamble', text: preamble, pages: spans(0, markers[0]?.start ?? full.length).map(s => s.page), excluded: false });
  for (const p of pages) {
    if (!p.text.trim()) result.unparsedSegments.push({ id: `empty-page-${p.page}`, text: `Page ${p.page} has no extractable text. Check the source page for missing questions.`, pages: [p.page], excluded: false });
    for (const [i, removed] of (p.removed ?? []).entries()) result.diagnostics.push({ id: `furniture-${p.page}-${i}`, code: 'PAGE_FURNITURE', message: `Removed page label: ${removed}`, severity: 'warning', pages: [p.page], resolution: 'fixed' });
  }
  let pending: ParseResult['draftPairs'][number] | undefined;
  markers.forEach((marker, index) => {
    const end = markers[index + 1]?.start ?? full.length;
    const block = full.slice(marker.end, end).trim();
    const q = emptyQuestion(`block-${index + 1}`, marker.kind);
    q.rawBlock = full.slice(marker.start, end).trim();
    q.source = spans(marker.start, end);
    let body = block;
    // Raised fraction glyphs can sort ahead of an otherwise intact header.
    // Recover the header but retain every displaced glyph for source review.
    let displaced = '';
    if (!/^\s*\d+\s*[).]/.test(body)) {
      const recovered = body.match(/(?:^|\n)\s*\d+\s*[).]\s*[^\d\n]{1,80}?(?:Short\s+Answer|Multiple\s+Choice)\b/i);
      if (recovered && recovered.index! < 160) {
        displaced = body.slice(0, recovered.index).trim();
        body = body.slice(recovered.index).trim();
        if (displaced) q.parseIssues.push('Text appeared before the numbered header. Check displaced mathematical glyphs against the source.');
      }
    }
    const number = body.match(/^\s*(\d+)\s*[).]\s*/);
    if (number) { q.number = Number(number[1]); body = body.slice(number[0].length); }
    const type = body.match(/\b(Short\s+Answer|Multiple\s+Choice)\b/i);
    if (type && type.index! < 100) {
      q.category = body.slice(0, type.index).trim().replace(/[—–-]\s*$/, '').trim();
      q.type = /^Short/i.test(type[0]) ? 'short-answer' : 'multiple-choice';
      body = body.slice(type.index! + type[0].length).trim();
    }
    const answers = [...body.matchAll(/\bANSWER\s*:/gi)];
    if (answers.length) {
      const first = answers[0];
      q.answer = body.slice(first.index! + first[0].length).trim();
      body = body.slice(0, first.index).trim();
      if (answers.length > 1) q.parseIssues.push('Multiple ANSWER markers: check the full answer block.');
    }
    q.text = body;
    if (q.type === 'multiple-choice') {
      let choices = [...body.matchAll(/(?:^|\n)\s*([WXYZ])\s*[).]\s*/g)];
      if (choices.length !== 4 || choices.map(m => m[1]).join('') !== 'WXYZ') {
        const inline = [...body.matchAll(/(?:^|\s)([WXYZ])\s*[).]\s*/g)];
        if (inline.length === 4 && inline.map(m => m[1]).join('') === 'WXYZ') choices = inline;
      }
      q.choices = { W: '', X: '', Y: '', Z: '' };
      if (choices.length) q.text = body.slice(0, choices[0].index).trim();
      for (let i = 0; i < choices.length; i++) q.choices[choices[i][1] as ChoiceLabel] = body.slice(choices[i].index! + choices[i][0].length, choices[i + 1]?.index ?? body.length).trim();
      if (choices.length !== 4 || choices.map(m => m[1]).join('') !== labels.join('')) q.parseIssues.push('Choice boundaries are incomplete, duplicated, or out of order. Check against source.');
    }
    if (displaced) q.text += `\n${displaced}`;
    Object.assign(q, answerMetadata(q.answer));
    if (/math/i.test(q.category) || /[\uFFFD\u0000-\u0008\u000e-\u001f²³⁰¹⁴-⁹₀-₉]/.test(block) || /\b(diagram|figure|pictured|graph shown)\b/i.test(block) || q.source.some(s => ranges.find(p => p.page === s.page)?.notationRanges?.some(n => n.end > s.startOffset && n.start < s.endOffset))) {
      q.parseIssues.push('Check mathematical notation, symbols, or figures against the source PDF.');
      q.preferSource = true;
    }
    if (marker.kind === 'tossup') {
      result.stats.tossups++;
      pending = { id: `pair-${index + 1}`, tossup: q, bonus: null, missingBonusAcknowledged: false };
      result.draftPairs.push(pending);
    } else {
      result.stats.bonuses++;
      if (pending && !pending.bonus && q.number !== null && q.number === pending.tossup.number) { pending.bonus = q; result.stats.pairs++; }
      else { q.parseIssues.push('Unassigned bonus: its number or position does not match the preceding toss-up.'); result.unassignedBlocks.push(q); }
      pending = undefined;
    }
  });
  const seen = new Set<number>();
  result.draftPairs.forEach((pair, i) => {
    const n = pair.tossup.number;
    if (n !== null && seen.has(n)) pair.tossup.parseIssues.push('Duplicate printed question number. Verify this is a distinct question.');
    if (n !== null && i && result.draftPairs[i - 1].tossup.number !== n - 1) pair.tossup.parseIssues.push('Printed question sequence has a gap or is out of order.');
    if (n !== null) seen.add(n);
  });
  return result;
}
