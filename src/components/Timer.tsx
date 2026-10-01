import { remaining, type GameState } from '../game/gameState';
export function Timer({ state, now }: { state: GameState; now: number }) {
  const expired = state.phase.endsWith('EXPIRED'), open = state.phase.endsWith('_OPEN');
  return <div className="timer" data-testid="timer">Timer: {expired ? 'TIME' : (Math.ceil(remaining(state.timer, now) / 100) / 10).toFixed(1)}{open && state.timer.deadline === null && ' — PAUSED'}{state.phase === 'BONUS_OPEN' && state.timer.warned && <strong> · 5 SECONDS</strong>}</div>;
}
