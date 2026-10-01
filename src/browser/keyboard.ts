export type Command = 'A' | 'D' | 'W' | 'S' | 'SPACE' | 'NEXT' | 'UNDO' | 'PREVIOUS' | 'RETURN' | 'SOURCE' | 'CATEGORY' | 'RECOGNIZE' | 'ANSWER_STARTED' | 'CLOCK' | 'FOUL_A' | 'FOUL_B' | 'VISUAL';
export function keyCommand(event: KeyboardEvent): Command | null {
  if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return null;
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return null;
  if ((event.key === ' ' || event.key === 'Enter') && target?.closest('button, a')) return null;
  return ({ a: 'A', d: 'D', w: 'W', s: 'S', ' ': 'SPACE', n: 'NEXT', backspace: 'UNDO', p: 'PREVIOUS', escape: 'RETURN', o: 'SOURCE', c: 'CATEGORY', r: 'RECOGNIZE', b: 'ANSWER_STARTED', g: 'CLOCK', f: 'FOUL_A', j: 'FOUL_B', v: 'VISUAL' } as Record<string, Command>)[event.key.toLowerCase()] ?? null;
}
