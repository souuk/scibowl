import type { Packet, TeamId } from '../types';
import type { GameState } from '../game/gameState';
export function resultsText(packet: Packet, state: GameState, names: Record<TeamId, string>, date = new Date()): string {
  const c = state.competition;
  const winner = c?.forfeitWinner ?? (state.scores.A === state.scores.B ? null : state.scores.A > state.scores.B ? 'A' : 'B');
  const result = c?.config.format === 'multi-team-tiebreak' ? `Individual qualifying score: ${state.scores.A}` : winner ? `${names[winner]} wins${c?.forfeitWinner ? ' by forfeit' : ''}` : 'Tie';
  return [
    'SCIENCE BOWL RESULTS', `Exported: ${date.toISOString()}`, `Packet: ${packet.fileName}`, `Packet ID: ${packet.id}`,
    `Rules: ${c ? `DOE 2026 in-person; ${c.config.level} school; ${c.config.venue}; ${c.config.format}` : 'Legacy simplified practice'}`,
    `Status: ${state.phase === 'ROUND_COMPLETE' ? 'Complete' : 'In progress'}`, '',
    `${names.A} (A): ${state.scores.A}`, ...(c?.config.format === 'multi-team-tiebreak' ? [] : [`${names.B} (B): ${state.scores.B}`]), result,
    ...(c ? [`Unsuccessful scientific challenges: A ${c.failedChallenges.A}/2; B ${c.failedChallenges.B}/2`, `Accidental buzz warnings: A ${c.accidental.A}; B ${c.accidental.B}`] : []),
    '', 'QUESTION RESULTS', ...state.outcomes.map((o, i) => `Question ${i + 1} (packet ${packet.pairs[i].number ?? '?'}): toss-up ${o.tossup.status}${o.tossup.team ? ` — ${names[o.tossup.team]}` : ''}; bonus ${o.bonus.status}${o.bonus.team ? ` — ${names[o.bonus.team]}` : ''}`),
    '', 'RULING / SCORE LOG (undone actions removed)', ...(c?.log ?? ['Detailed event log is unavailable for legacy rounds.']), '',
    'Moderator adjudicated spoken answers and exceptions. Full rules: https://science.osti.gov/-/media/wdts/nsb/pdf/NSB-Resources/Rules2026.pdf', '',
  ].join('\r\n');
}
export function downloadResults(packet: Packet, state: GameState, names: Record<TeamId, string>) {
  const url = URL.createObjectURL(new Blob([resultsText(packet, state, names)], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `scibowl-results-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
