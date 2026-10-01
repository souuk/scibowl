export interface Clock { now(): number; schedule(callback: () => void): number; cancel(id: number): void }
export const browserClock: Clock = { now: () => performance.now(), schedule: cb => window.setTimeout(cb, 40), cancel: id => window.clearTimeout(id) };
// Generation is external to game history: canceled callbacks can never become valid again.
export function createTicker(callback: (now: number) => void, clock: Clock = browserClock) {
  let generation = 0, handle: number | undefined;
  function stop() { generation++; if (handle !== undefined) clock.cancel(handle); handle = undefined; }
  return { stop, start() { stop(); const token = generation; const run = () => { if (token !== generation) return; callback(clock.now()); if (token === generation) handle = clock.schedule(run); }; handle = clock.schedule(run); } };
}
