import type { Packet } from '../types';
import { createGame, snapshot, type Action, type Match } from './gameState';
import { reduceGame, tick } from './gameReducer';
export function reduceMatch(match: Match, action: Action, packet: Packet): Match {
  if (action.type === 'RESET') return { present: createGame(packet), history: [] };
  if (action.type === 'UNDO') {
    if (!match.history.length) return match;
    return { present: snapshot(match.history.at(-1)!, action.now), history: match.history.slice(0, -1) };
  }
  const current = tick(match.present, action.now);
  let next = reduceGame(current, action, packet);
  if (next === match.present) return match;
  const meaningful = next !== current && !['TICK', 'PAUSE'].includes(action.type);
  if (meaningful && next.competition) next = { ...next, competition: { ...next.competition, log: [...next.competition.log, `Q${current.index + 1} | ${action.type} | ${next.lastAction} | A ${next.scores.A}, B ${next.scores.B}`] } };
  return { present: next, history: meaningful ? [...match.history.slice(-99), snapshot(current, action.now)] : match.history };
}
