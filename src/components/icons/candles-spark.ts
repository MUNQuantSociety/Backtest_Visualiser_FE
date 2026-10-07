import { createLucideIcon } from 'lucide-react';

/**
 * Two candlesticks and a small spark: the Build tab's mark.
 *
 * Drawn on lucide's 24px grid with its stroke, caps and joins, so it sits
 * beside the stock icons as one of them. The candles say charting; the spark
 * says making something new, which is what the page is for.
 */
export const CandlesSpark = createLucideIcon('candles-spark', [
  ['path', { d: 'M6 4v3', key: 'wick-a-top' }],
  ['rect', { x: '4', y: '7', width: '4', height: '7', rx: '1', key: 'body-a' }],
  ['path', { d: 'M6 14v3', key: 'wick-a-bottom' }],
  ['path', { d: 'M13 9v2', key: 'wick-b-top' }],
  ['rect', { x: '11', y: '11', width: '4', height: '6', rx: '1', key: 'body-b' }],
  ['path', { d: 'M13 17v3', key: 'wick-b-bottom' }],
  ['path', { d: 'M19.5 2v5', key: 'spark-vertical' }],
  ['path', { d: 'M17 4.5h5', key: 'spark-horizontal' }],
]);
