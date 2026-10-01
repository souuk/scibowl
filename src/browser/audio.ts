let context: AudioContext | null = null;
export async function enableAudio(): Promise<boolean> {
  try { context ??= new AudioContext(); await context.resume(); return context.state === 'running'; } catch { return false; }
}
export function beep(kind: 'warning' | 'time', muted: boolean) {
  if (muted || !context || context.state !== 'running') return;
  const oscillator = context.createOscillator(), gain = context.createGain();
  const duration = kind === 'warning' ? 0.12 : 0.35;
  oscillator.frequency.value = kind === 'warning' ? 880 : 440;
  gain.gain.setValueAtTime(0.12, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
