import type { BacktestDetail } from '@/features/backtests';
import { averageLoss, averageWin, calmarRatio, payoffRatio } from '@/utils/metrics';

/**
 * The classic backtest tearsheet, in the layout QuantStats and pyfolio produce.
 *
 * Kept as a pure function returning plain rows so the numbers can be tested
 * without rendering a table, and so the same data could feed a CSV export later
 * without the formatting being trapped inside JSX.
 *
 * Engine-supplied metrics win wherever they exist; anything the API does not
 * return is derived here from the equity curve and the trade list. That
 * ordering matters — the backtest engine sees intraday marks and financing
 * costs the client never receives, so its Sharpe is the authoritative one.
 */

export type TearsheetFormat = 'currency' | 'percent' | 'ratio' | 'integer' | 'date';

export interface TearsheetRow {
  label: string;
  value: number | string | null;
  format: TearsheetFormat;
  /** Colour the value by sign. Off for figures where sign carries no judgement. */
  signed?: boolean;
}

export interface TearsheetSection {
  category: string;
  rows: readonly TearsheetRow[];
}

export function buildTearsheet(detail: BacktestDetail): TearsheetSection[] {
  const { metrics, trades, initialCapital, finalEquity } = detail;
  const pnls = trades.filter((trade) => trade.exitDate !== null).map((trade) => trade.pnl);
  const equity = detail.equityCurve.map((point) => point.equity);

  const closed = trades.filter((trade) => trade.exitDate !== null);
  const winners = pnls.filter((pnl) => pnl > 0);
  const losers = pnls.filter((pnl) => pnl < 0);

  const metric = (key: Exclude<keyof typeof metrics, 'unavailable'>) =>
    metrics.unavailable?.[key] ? null : metrics[key];
  return [
    {
      category: 'Backtest summary',
      rows: [
        { label: 'Start date', value: detail.startDate, format: 'date' },
        { label: 'End date', value: detail.endDate, format: 'date' },
        { label: 'Initial capital', value: initialCapital, format: 'currency' },
        { label: 'Final capital', value: finalEquity, format: 'currency' },
      ],
    },
    {
      category: 'Overall performance',
      rows: [
        {
          label: 'Cumulative return',
          value: metric('totalReturn'),
          format: 'percent',
          signed: true,
        },
        { label: 'Annualised return', value: metric('cagr'), format: 'percent', signed: true },
        {
          label: 'Net profit',
          value: finalEquity - initialCapital,
          format: 'currency',
          signed: true,
        },
      ],
    },
    {
      category: 'Risk (annualised)',
      rows: [
        {
          label: 'Maximum drawdown',
          value: metric('maxDrawdown'),
          format: 'percent',
          signed: true,
        },
        { label: 'Volatility', value: metric('volatility'), format: 'percent' },
        { label: 'Sharpe ratio', value: metric('sharpe'), format: 'ratio', signed: true },
        { label: 'Sortino ratio', value: metric('sortino'), format: 'ratio', signed: true },
        { label: 'Calmar ratio', value: calmarRatio(equity), format: 'ratio', signed: true },
      ],
    },
    {
      category: 'Trade statistics',
      rows: [
        { label: 'Trade lots', value: trades.length, format: 'integer' },
        {
          label: 'Total fills',
          value:
            typeof detail.reportMetadata?.['fill_count'] === 'number'
              ? detail.reportMetadata['fill_count']
              : null,
          format: 'integer',
        },
        { label: 'Total closed trades', value: closed.length, format: 'integer' },
        { label: 'Winning trades', value: winners.length, format: 'integer' },
        { label: 'Losing trades', value: losers.length, format: 'integer' },
        { label: 'Win rate', value: metric('winRate'), format: 'percent' },
        {
          label: 'Profit factor',
          value: metric('profitFactor'),
          format: 'ratio',
        },
        { label: 'Payoff ratio', value: payoffRatio(pnls), format: 'ratio' },
        {
          label: 'Average winning trade',
          value: averageWin(pnls),
          format: 'currency',
          signed: true,
        },
        {
          label: 'Average losing trade',
          value: averageLoss(pnls),
          format: 'currency',
          signed: true,
        },
        {
          label: 'Largest win',
          value: winners.length > 0 ? Math.max(...winners) : 0,
          format: 'currency',
          signed: true,
        },
        {
          label: 'Largest loss',
          value: losers.length > 0 ? Math.min(...losers) : 0,
          format: 'currency',
          signed: true,
        },
      ],
    },
  ];
}
