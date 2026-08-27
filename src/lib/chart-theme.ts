/**
 * lightweight-charts draws to canvas and cannot read `var(--profit)`, so CSS
 * custom properties have to be resolved to concrete colours first. Recharts
 * uses the same resolved values, which is what keeps the two libraries visually
 * identical instead of drifting apart with hardcoded hexes.
 *
 * Resolving the custom property is only half the job. Tailwind 4 emits its
 * tokens as `oklch(...)`, and lightweight-charts ships its own colour parser
 * that predates CSS Color 4 — it throws `Failed to parse color: oklch(...)` and
 * the whole chart fails to mount. Browsers will not convert for us either:
 * Chrome serialises `getComputedStyle(el).color` and `ctx.fillStyle` back as
 * `oklch(...)` verbatim. So the colour is painted to a 1×1 canvas and read back
 * as pixels, which forces a real sRGB conversion through the browser's own
 * colour engine and works for any colour space it supports.
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

/** One reused scratch context; creating a canvas per colour is needless churn. */
let scratch: CanvasRenderingContext2D | null | undefined;

function scratchContext(): CanvasRenderingContext2D | null {
    if (scratch !== undefined) return scratch;

    if (typeof document === 'undefined') {
        scratch = null;
        return scratch;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    // jsdom has no canvas implementation, so this is null under test — callers
    // fall back to the unconverted value rather than throwing.
    scratch = canvas.getContext('2d', { willReadFrequently: true });
    return scratch;
}

/**
 * Converts any CSS colour the browser understands into `rgb()` / `rgba()`,
 * which every chart library can parse. Returns the input untouched when there
 * is no canvas (SSR, jsdom) or the colour is unreadable.
 */
export function toRenderableColor(value: string): string {
    if (!value) return value;

    const ctx = scratchContext();
    if (!ctx) return value;

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);

    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (r === undefined || g === undefined || b === undefined || a === undefined) return value;

    return a === 255
        ? `rgb(${String(r)}, ${String(g)}, ${String(b)})`
        : `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${(a / 255).toFixed(3)})`;
}

/**
 * Re-emits a palette colour at a given alpha. Gradient stops need this, and
 * `color-mix(in oklab, …)` is no more parseable by lightweight-charts than
 * `oklch()` is — so the mixing happens here instead of in CSS.
 */
export function withAlpha(color: string, alpha: number): string {
    const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
    if (!match) return color;

    const [, r, g, b] = match;
    return `rgba(${r ?? '0'}, ${g ?? '0'}, ${b ?? '0'}, ${alpha.toFixed(3)})`;
}

/**
 * Reads a design token off `:root` and converts it to a renderable colour.
 * Returns '' during SSR or before mount.
 */
export function resolveToken(token: ChartToken): string {
    if (typeof window === 'undefined') return '';
    const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
    return toRenderableColor(raw);
}

export interface ChartPalette {
    text: string;
    mutedText: string;
    grid: string;
    background: string;
    profit: string;
    loss: string;
    /** For components that carry no directional meaning, e.g. a cash band. */
    neutral: string;
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
        neutral: resolveToken('neutral'),
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
