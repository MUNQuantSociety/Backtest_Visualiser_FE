import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { INDICATOR_TIPS } from '../indicator-tips';
import type { TickerIndicators } from '../types';

import { IndicatorsTable } from './indicators-table';

const AAPL: TickerIndicators = {
  ticker: 'AAPL',
  last: 190.5,
  change1d: 0.012,
  rsi14: 41,
  macdHistogram: 0.29,
  smaRegime: 'below',
  momentum20d: -0.05,
  sentiment7d: -0.13,
  sentimentDelta7d: 0.04,
  asOf: '2026-09-11',
};

const COLUMNS_WITH_TIPS = [
  ['Last', INDICATOR_TIPS.last],
  ['RSI 14', INDICATOR_TIPS.rsi14],
  ['MACD H', INDICATOR_TIPS.macdHistogram],
  ['SMA', INDICATOR_TIPS.smaRegime],
  ['Mom 20d', INDICATOR_TIPS.momentum20d],
  ['Sentiment 7d', INDICATOR_TIPS.sentiment7d],
  ['Δ7d', INDICATOR_TIPS.sentimentDelta7d],
] as const;

describe('IndicatorsTable', () => {
  it('shows one row per ticker with its values', () => {
    render(<IndicatorsTable rows={[AAPL]} isLoading={false} />);

    const row = screen.getByRole('row', { name: /AAPL/ });
    expect(within(row).getByText('190.50')).toBeInTheDocument();
    expect(within(row).getByText('41')).toBeInTheDocument();
    expect(within(row).getByText('50 < 200')).toBeInTheDocument();
  });

  it.each(COLUMNS_WITH_TIPS)('explains the %s column from its heading', async (label, tip) => {
    render(<IndicatorsTable rows={[AAPL]} isLoading={false} />);

    await userEvent.click(screen.getByRole('button', { name: `About ${label}` }));

    expect(screen.getByRole('tooltip')).toHaveTextContent(tip);
  });

  it('gives the ticker column no explanation', () => {
    render(<IndicatorsTable rows={[AAPL]} isLoading={false} />);

    expect(screen.queryByRole('button', { name: 'About Ticker' })).not.toBeInTheDocument();
  });

  it('labels every column heading', () => {
    render(<IndicatorsTable rows={[AAPL]} isLoading={false} />);

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Ticker',
      'Last',
      'RSI 14',
      'MACD H',
      'SMA',
      'Mom 20d',
      'Sentiment 7d',
      'Δ7d',
    ]);
  });

  it('says so when the universe is empty', () => {
    render(<IndicatorsTable rows={[]} isLoading={false} />);

    expect(screen.getByText('No tickers in the universe.')).toBeInTheDocument();
  });
});
