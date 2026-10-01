import { describe, expect, it } from 'vitest';
import { answerMetadata, parseScienceBowlText } from '../../src/parser/parseScienceBowlText';
import { validatePacket } from '../../src/parser/validatePacket';
import { reconstructLines } from '../../src/parser/reconstructLines';
import { sample } from '../helpers';
const parse = (text: string) => parseScienceBowlText({ pages: [{ page: 1, text }] });
describe('Science Bowl parsing', () => {
  it('extracts pairs, types, choices, and accepted answer clauses', () => {
    const d = parse(sample); expect(d.stats).toEqual({ pages: 1, tossups: 2, bonuses: 2, pairs: 2 });
    expect(validatePacket(d).canStart).toBe(true);
    expect(d.draftPairs[0].tossup.acceptedAnswers).toEqual(['DEOXYRIBONUCLEIC ACID']);
    expect(d.draftPairs[0].bonus!.choices!.X).toBe('Nucleus');
    expect(d.draftPairs[0].bonus!.answerChoice).toBe('X');
  });
  it('parses MC tossups and multiline SA bonuses across pages without mixing answers', () => {
    const d = parseScienceBowlText({ pages: [{ page: 1, text: 'TOSS-UP\n7) New Subject Multiple Choice Prompt\nW) first\nline\nX) second\nY) third\nZ) fourth\nANSWER:\nW) FIRST\nBONUS\n7) New Subject Short Answer This question' }, { page: 2, text: 'continues here.\nANSWER: ALPHA\nAND BETA\n(ACCEPT: GAMMA OR DELTA)TOSS-UP\n8) Test Short Answer Next?\nANSWER: END' }] });
    expect(d.draftPairs).toHaveLength(2); expect(d.draftPairs[0].tossup.choices!.W).toBe('first\nline');
    expect(d.draftPairs[0].bonus!.text).toContain('continues here');
    expect(d.draftPairs[0].bonus!.source.map(s => s.page)).toEqual([1, 2]);
    expect(d.draftPairs[0].bonus!.answer).toContain('ALPHA\nAND BETA');
    expect(d.draftPairs[0].bonus!.answer).not.toContain('TOSS-UP');
  });
  it('handles marker concatenations and inline choices', () => {
    const d = parse('TOSS–UP1) Earth and Space — Multiple Choice Which? W) one X) two Y) three Z) four ANSWER: W) ONEBONUS1) Earth and Space Short Answer Why? ANSWER: REASONTOSSUP2) Biology Short Answer Next? ANSWER: YES');
    expect(d.stats).toMatchObject({ tossups: 2, bonuses: 1, pairs: 1 }); expect(d.draftPairs[0].bonus!.answer).toBe('REASON');
    expect(d.draftPairs[0].tossup.choices!.Z).toBe('four');
  });
  it('does not treat ordinary prose marker words as boundaries', () => {
    const d = parse('TOSS-UP\n1) Biology Short Answer The word BONUS describes what?\nANSWER: EXTRA (DO NOT ACCEPT: ANSWER)');
    expect(d.stats.tossups).toBe(1); expect(d.stats.bonuses).toBe(0);
    expect(d.draftPairs[0].tossup.text).toContain('BONUS');
  });
  it('preserves DO NOT ACCEPT, notes, pronunciation guides, and math symbols', () => {
    const d = parse('TOSS-UP\n1) Math Short Answer Compute x² + √2 [root two].\nANSWER: 3 (do not accept: 4)\n(accept in either order)');
    const q = d.draftPairs[0].tossup; expect(q.text).toContain('x² + √2'); expect(q.text).toContain('[root two]');
    expect(q.rejectedAnswers).toEqual(['4']); expect(q.acceptedAnswers).toEqual([]); expect(q.answerNotes).toContain('accept in either order');
    expect(q.parseIssues.some(s => s.includes('notation'))).toBe(true);
  });
  it('retains malformed standalone sections, missing answers, and orphan bonuses', () => {
    const d = parse('intro\nBONUS\n1) Biology Short Answer Orphan?\nANSWER: O\nTOSS-UP\nbad header\nBONUS\n2) Biology Short Answer Mismatch?\nANSWER: M');
    expect(d.unparsedSegments[0].text).toBe('intro'); expect(d.unassignedBlocks).toHaveLength(2); expect(d.draftPairs).toHaveLength(1);
    expect(validatePacket(d).canStart).toBe(true); expect(validatePacket(d).diagnostics.some(d => d.code === 'ANSWER')).toBe(true);
    expect(validatePacket(d).pairs[0].tossup.number).toBeNull();
    expect(validatePacket(d).pairs[0].tossup.answer).toBe('');
  });
  it('recovers a header displaced by fraction glyphs without discarding them', () => {
    const d = parse('TOSS-UP\n14) MATH Short Answer Test?\nANSWER: YES\nBONUS\n1 rd\n14) MATH Short Answer Convert to a decimal:\n3\nANSWER: 0.3333');
    expect(d.stats.pairs).toBe(1); expect(d.draftPairs[0].bonus!.text).toContain('1 rd'); expect(d.draftPairs[0].bonus!.category).toBe('MATH');
    expect(d.draftPairs[0].bonus!.parseIssues.join(' ')).toContain('before the numbered header');
  });
  it('starts with unresolved flags and missing bonuses while honoring exclusions', () => {
    const d = parse('TOSS-UP\n90) Math Short Answer x²?\nANSWER: 4');
    expect(validatePacket(d).canStart).toBe(true);
    expect(validatePacket(d).pairs[0].tossup.preferSource).toBe(true);
    expect(validatePacket(d).pairs[0].bonus).toBeNull();
    d.draftPairs[0].missingBonusAcknowledged = true;
    d.draftPairs[0].tossup.acknowledged = [...d.draftPairs[0].tossup.parseIssues];
    expect(validatePacket(d).canStart).toBe(true);
    d.draftPairs[0].tossup.excluded = true; expect(validatePacket(d).canStart).toBe(false);
  });
  it('flags duplicate numbers, sequence gaps, malformed choices, and empty pages', () => {
    const d = parseScienceBowlText({ pages: [{ page: 1, text: 'TOSS-UP\n1) Biology Multiple Choice Test\nW) one\nW) two\nY) three\nZ) four\nANSWER: W) ONE\nTOSS-UP\n1) Biology Short Answer Again?\nANSWER: YES' }, { page: 2, text: '' }] });
    expect(d.draftPairs[0].tossup.parseIssues.join(' ')).toContain('Choice boundaries');
    expect(d.draftPairs[1].tossup.parseIssues.join(' ')).toContain('Duplicate');
    expect(d.unparsedSegments.some(s => s.id === 'empty-page-2')).toBe(true);
  });
  it('keeps answer options outside question choices', () => {
    expect(parse(sample).draftPairs[0].bonus!.choices!.Z).toBe('Planet');
    expect(answerMetadata('YES (ACCEPT: A, B OR C)')).toMatchObject({ acceptedAnswers: ['A, B OR C'] });
    expect(answerMetadata('YES (ACCEPT: a (with units)) (DO NOT ACCEPT: b)')).toMatchObject({ acceptedAnswers: ['a (with units)'], rejectedAnswers: ['b'] });
  });
  it('reconstructs geometry and records removed furniture', () => {
    const item = (str: string, x: number, y: number, height = 12) => ({ str, transform: [height, 0, 0, height, x, y], width: str.length * 6, height, fontName: 'test', hasEOL: false });
    const p = reconstructLines([item('Question', 10, 100), item('text', 70, 100), item('High School Round 1 Page 1', 10, 10), item('2', 100, 105, 8)], 1);
    expect(p.text).toContain('Question text'); expect(p.removed).toHaveLength(1); expect(p.notationRanges).toHaveLength(1);
  });
  it('preserves numeric superscripts and subscripts from glyph positions', () => {
    const item = (str: string, x: number, y: number, height = 12) => ({ str, transform: [height, 0, 0, height, x, y], width: str.length * 6, height, fontName: 'test', hasEOL: false });
    const p = reconstructLines([item('x', 10, 100), item('2', 16, 105, 8), item('H', 10, 70), item('2', 16, 66, 8), item('O', 22, 70)], 1);
    expect(p.text).toBe('x²\nH₂O\n');
    expect(p.regions).toHaveLength(2);
  });
  it('retains precise page crops for mathematical blocks', () => {
    const text = 'TOSS-UP\n1) Math Short Answer x²?\nANSWER: 4\nBONUS\n1) Math Short Answer y?\nANSWER: 2';
    const bonus = text.indexOf('BONUS');
    const d = parseScienceBowlText({ pages: [{ page: 1, text, regions: [{ start: 0, end: bonus, bounds: [20, 600, 500, 700] }, { start: bonus, end: text.length, bounds: [20, 400, 500, 500] }] }] });
    expect(d.draftPairs[0].tossup.source[0].bounds).toEqual([12, 592, 508, 708]);
    expect(d.draftPairs[0].bonus!.source[0].bounds).toEqual([12, 392, 508, 508]);
    expect(validatePacket(parse('')).canStart).toBe(false);
  });
});
