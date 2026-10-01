import { expect, it } from 'vitest';
import { createTicker } from '../../src/browser/clock';
it('rejects stale scheduled callbacks across cancellation and restart', () => {
  const pending: (() => void)[] = [], calls: number[] = [];
  const ticker = createTicker(now => calls.push(now), { now: () => 100, schedule: cb => pending.push(cb), cancel: () => {} });
  ticker.start(); const stale = pending[0]; ticker.stop(); ticker.start(); stale(); expect(calls).toEqual([]); pending[1](); expect(calls).toEqual([100]); ticker.stop(); pending.at(-1)!(); expect(calls).toEqual([100]);
});
