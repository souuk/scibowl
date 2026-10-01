import type { ExtractedPage, TextItem } from '../types';

export function reconstructLines(items: TextItem[], page: number): ExtractedPage {
  type Line = { y: number; height: number; items: TextItem[]; notation: boolean };
  const lines: Line[] = [];
  // Larger glyphs establish baselines before small super/subscripts are attached.
  for (const item of [...items].filter(i => i.str.trim()).sort((a, b) => b.height - a.height)) {
    const y = item.transform[5];
    let line = lines.find(l => Math.abs(l.y - y) <= Math.max(2, l.height * 0.22));
    if (!line) line = lines.find(l => item.height < l.height * 0.9 && Math.abs(l.y - y) < l.height * 0.8 && l.items.some(i => Math.abs(i.transform[4] + i.width - item.transform[4]) < l.height));
    if (line) { line.items.push(item); if (Math.abs(line.y - y) > 2) line.notation = true; }
    else lines.push({ y, height: item.height, items: [item], notation: false });
  }
  lines.sort((a, b) => b.y - a.y);
  let text = '';
  const notationRanges: { start: number; end: number }[] = [];
  const removed: string[] = [];
  const regions: NonNullable<ExtractedPage['regions']> = [];
  for (const line of lines) {
    line.items.sort((a, b) => a.transform[4] - b.transform[4]);
    let value = '';
    let last: TextItem | undefined;
    for (const item of line.items) {
      const gap = last ? item.transform[4] - last.transform[4] - last.width : 0;
      if (last && gap > Math.max(1, line.height * 0.12) && !value.endsWith(' ') && !item.str.startsWith(' ')) value += ' ';
      // Preserve isolated numeric super/subscripts when geometry clearly identifies them.
      // Complex stacked expressions are kept for source rendering rather than guessed.
      const offset = item.transform[5] - line.y;
      const raised = offset > Math.max(2, line.height * 0.22), lowered = offset < -Math.max(2, line.height * 0.22);
      const scriptable = item.height < line.height * 0.9 && /^[0-9+−=()\-]+$/.test(item.str.trim());
      const normal = '0123456789+-−=()', script = raised ? '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾' : '₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎';
      value += scriptable && (raised || lowered) ? [...item.str.trim()].map(c => script[normal.indexOf(c)]).join('') : item.str;
      last = item;
    }
    value = value.trim();
    if (/^(?:(?:High|Middle)\s+School\s+)?(?:Round\s+[\w -]+\s+)?Page\s+\d+$/i.test(value) || /^ROUND\s+\d+$/i.test(value) || /^[_—-]{5,}$/.test(value)) { removed.push(value); continue; }
    const start = text.length;
    text += value + '\n';
    regions.push({ start, end: text.length, bounds: [
      Math.min(...line.items.map(i => i.transform[4])),
      Math.min(...line.items.map(i => i.transform[5] - i.height * 0.3)),
      Math.max(...line.items.map(i => i.transform[4] + i.width)),
      Math.max(...line.items.map(i => i.transform[5] + i.height)),
    ] });
    if (line.notation) notationRanges.push({ start, end: text.length });
  }
  return { page, text, items, notationRanges, regions, removed };
}
