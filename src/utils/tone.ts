/** Semantic colour for a signed number: gains, losses, or flat. */
export type Tone = 'profit' | 'loss' | 'neutral';

export function toneFromValue(value: number): Tone {
  if (value > 0) return 'profit';
  if (value < 0) return 'loss';
  return 'neutral';
}
