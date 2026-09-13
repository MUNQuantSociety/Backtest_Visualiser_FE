import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Backtests from '@/features/backtests';
import { backtestDetailSchema, useBacktest, type BacktestDetail } from '@/features/backtests';
import * as Performance from '@/features/performance';

import BacktestDetailPage from './backtest-detail-page';

const state = vi.hoisted(
  (): {
    data: BacktestDetail | undefined;
    isPending: boolean;
    isError: boolean;
    error: Error;
  } => ({ data: undefined, isPending: false, isError: false, error: new Error('Run not found') }),
);

vi.mock('@/features/backtests', async (importOriginal) => ({
  ...(await importOriginal<typeof Backtests>()),
  useBacktest: vi.fn(() => state),
  RunBacktestDialog: ({ initialStrategyKey }: { initialStrategyKey?: string }) => (
    <button data-strategy={initialStrategyKey}>Run backtest</button>
  ),
}));
vi.mock('@/features/performance', () => ({
  BetaScatter: vi.fn(() => null),
  DailyPnlBars: vi.fn(() => null),
  DrawdownChart: vi.fn(() => null),
  DrawdownTable: vi.fn(() => null),
  EquityCurveChart: vi.fn(() => null),
  MetricsGrid: () => null,
  MetricsTable: () => null,
  MonthlyReturnsHeatmap: vi.fn(() => null),
  PnlHistogram: () => null,
  ReturnsDistribution: vi.fn(() => null),
  RollingSharpeChart: vi.fn(() => null),
  RollingVolatilityChart: vi.fn(() => null),
  TradeDurationScatter: () => null,
}));

const diagnostics = {
  strategy: 'VolMomentum',
  volatilityMultiplier: 1.5,
  evaluationCount: 1260,
  warmupSkipCount: 0,
  missingMarketDataSkipCount: 0,
  bullishSignalCount: 0,
  buyRequestCount: 0,
  sellRequestCount: 0,
  tickers: {
    AMD: {
      strongestMomentum: {
        date: '2026-04-24',
        momentumPct: 70.6875398734,
        thresholdPct: 94.3104222864,
      },
    },
  },
};

function detail() {
  return backtestDetailSchema.parse({
    id: 'run-1',
    name: 'vol1',
    strategyId: 'portfolio_1',
    strategyName: 'Volatility Momentum',
    symbol: 'AAPL,AMD,MSFT,NVDA,TSLA',
    timeframe: '1d',
    status: 'completed',
    startDate: '2025-09-08',
    endDate: '2026-09-08',
    createdAt: '2026-09-10T00:00:00Z',
    initialCapital: 100_000,
    finalEquity: 100_000,
    totalReturn: 0,
    sharpe: 0,
    maxDrawdown: 0,
    metrics: {
      totalReturn: 0,
      cagr: 0,
      sharpe: 0,
      sortino: -15.87,
      maxDrawdown: 0,
      volatility: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
    },
    equityCurve: [],
    trades: [],
    reportMetadata: {
      execution: { fillCount: 0, message: 'No ticker exceeded the strategy entry threshold.' },
      strategyDiagnostics: diagnostics,
    },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/backtests/run-1']}>
      <Routes>
        <Route path="/backtests/:backtestId" element={<BacktestDetailPage />} />
        <Route path="/backtests" element={<h1>Backtests hub</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.data = detail();
  state.isPending = false;
  state.isError = false;
});

describe('backtest results context', () => {
  it('uses the selected run for every performance and risk chart', async () => {
    state.data!.equityCurve = [
      { date: '2026-01-01', equity: 95, benchmark: 100 },
      { date: '2026-01-02', equity: 110, benchmark: 102 },
    ];
    renderPage();
    expect(useBacktest).toHaveBeenCalledWith('run-1');
    for (const component of [
      Performance.EquityCurveChart,
      Performance.MonthlyReturnsHeatmap,
      Performance.DailyPnlBars,
    ]) {
      expect(vi.mocked(component).mock.calls.at(-1)?.[0].data).toBe(state.data!.equityCurve);
    }
    expect(vi.mocked(Performance.MonthlyReturnsHeatmap).mock.calls.at(-1)?.[0].initialCapital).toBe(
      state.data!.initialCapital,
    );
    expect(vi.mocked(Performance.DailyPnlBars).mock.calls.at(-1)?.[0].initialCapital).toBe(
      state.data!.initialCapital,
    );
    expect(vi.mocked(Performance.EquityCurveChart).mock.calls.at(-1)?.[0].trades).toBe(
      state.data!.trades,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Risk' }));
    for (const component of [
      Performance.RollingSharpeChart,
      Performance.RollingVolatilityChart,
      Performance.ReturnsDistribution,
      Performance.BetaScatter,
      Performance.DrawdownChart,
      Performance.DrawdownTable,
    ]) {
      expect(vi.mocked(component).mock.calls.at(-1)?.[0].data).toBe(state.data!.equityCurve);
    }
  });

  it('identifies the run, keeps its execution notice, and links back to the hub', async () => {
    renderPage();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(breadcrumb).getByRole('link', { name: 'Backtests' })).toHaveAttribute(
      'href',
      '/backtests',
    );
    expect(within(breadcrumb).getByText('vol1')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Backtest results' })).toBeInTheDocument();
    expect(screen.getByText(/vol1 · Volatility Momentum/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No ticker exceeded the strategy entry threshold.',
    );
    expect(screen.getByRole('button', { name: 'Run backtest' })).toHaveAttribute(
      'data-strategy',
      'portfolio_1',
    );
    expect(screen.getByRole('link', { name: 'Choose a strategy →' })).toHaveAttribute(
      'href',
      '/backtests',
    );
    await userEvent.click(screen.getByRole('link', { name: 'Back to backtests' }));
    expect(screen.getByRole('heading', { name: 'Backtests hub' })).toBeInTheDocument();
  });

  it('keeps the way back visible when a result cannot load', () => {
    state.isError = true;
    state.data = undefined;
    renderPage();
    expect(screen.getByText('Run not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to backtests' })).toHaveAttribute(
      'href',
      '/backtests',
    );
  });

  it('explains saved no-trade checks without multiplying percentages again', async () => {
    renderPage();
    const summary = screen.getByText('Why no trades?');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(/1,260 ticker checks evaluated/)).toHaveTextContent('0 entry signals');
    expect(
      screen.getByText('No checks were skipped for missing prices or insufficient history.'),
    ).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /AMD/ });
    expect(within(row).getByText('70.69%')).toBeInTheDocument();
    expect(within(row).getByText('94.31%')).toBeInTheDocument();
    expect(within(row).getByText('2026-04-24')).toBeInTheDocument();
    expect(screen.getByText(/Matching the threshold is not enough/)).toBeInTheDocument();
  });

  it.each([
    undefined,
    { ...diagnostics, strategy: 'AnotherStrategy' },
    { ...diagnostics, evaluationCount: -1 },
    {
      ...diagnostics,
      tickers: {
        AMD: { strongestMomentum: { date: '2026-04-24', momentumPct: Infinity, thresholdPct: 94 } },
      },
    },
  ])('keeps older or incompatible diagnostics out of the explanation (%s)', (value) => {
    state.data!.reportMetadata!['strategyDiagnostics'] = value;
    renderPage();
    expect(screen.queryByText('Why no trades?')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('supports snapshots without optional counts', async () => {
    state.data!.reportMetadata!['strategyDiagnostics'] = {
      strategy: 'VolMomentum',
      tickers: diagnostics.tickers,
    };
    renderPage();
    await userEvent.click(screen.getByText('Why no trades?'));
    expect(screen.getByText('70.69%')).toBeInTheDocument();
    expect(screen.queryByText(/ticker checks evaluated/)).not.toBeInTheDocument();
  });

  it('does not show a no-trades explanation when any fill was recorded', () => {
    state.data!.reportMetadata!.execution!.fillCount = 1;
    renderPage();
    expect(screen.queryByText('Why no trades?')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Choose a strategy →' })).not.toBeInTheDocument();
  });
});
