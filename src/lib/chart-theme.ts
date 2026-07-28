/**
 * lightweight-charts draws to canvas and cannot read `var(--profit)`, so CSS
 * custom properties have to be resolved to concrete colours first. Recharts
 * uses the same resolved values, which is what keeps the two libraries visually
 * identical instead of drifting apart with hardcoded hexes.
 */

export type ChartToken =
  | 'foreground'
  | 'muted-foreground'
  | 'border'
  | 'background'
  | 'card'
  | 'profit'
  | 'loss'
  | 'neutral'
  | 'chart-1'
  | 'chart-2'
  | 'chart-3'
  | 'chart-4'
  | 'chart-5';

/** Reads a design token off `:root`. Returns '' during SSR or before mount. */
export function resolveToken(token: ChartToken): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
}

export interface ChartPalette {
  text: string;
  mutedText: string;
  grid: string;
  background: string;
  profit: string;
  loss: string;
  series: [string, string, string, string, string];
}

export function readChartPalette(): ChartPalette {
  return {
    text: resolveToken('foreground'),
    mutedText: resolveToken('muted-foreground'),
    grid: resolveToken('border'),
    background: resolveToken('card'),
    profit: resolveToken('profit'),
    loss: resolveToken('loss'),
    series: [
      resolveToken('chart-1'),
      resolveToken('chart-2'),
      resolveToken('chart-3'),
      resolveToken('chart-4'),
      resolveToken('chart-5'),
    ],
  };
}

/** Cycles the 5-colour series palette for an arbitrary number of series. */
export function seriesColor(palette: ChartPalette, index: number): string {
  return palette.series[index % palette.series.length] ?? palette.series[0];
}
