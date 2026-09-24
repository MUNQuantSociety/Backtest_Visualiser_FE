/**
 * Fallback starter code, reached only when the real one cannot be fetched.
 *
 * `GET /strategies/template` is the source of truth. It lives beside the check
 * that judges it, with a test asserting it passes. This copy exists so the
 * editor and the strategy guide are never empty when the backend is
 * unreachable, and it is deliberately the same text: a fallback teaching a
 * different contract is worse than none.
 *
 * Keeping a copy here is what went wrong before. The previous one was written
 * from memory against a base class that never existed, and nothing caught it
 * because nothing compared the two.
 */
export const STARTER_TEMPLATE_FALLBACK = `from engine.strategies.order_interface import StrategyContext
from engine.strategies.portfolio_BASE.strategy import BasePortfolio


class MyStrategy(BasePortfolio):
    """One sentence on what edge this is trying to capture."""

    # "attribute_name": ("IndicatorName", {parameters}). One instance per
    # ticker, so self.fast_sma[ticker] is the indicator for that ticker.
    # BasePortfolio builds and warms them before the first bar; self.tickers,
    # self.lookback_days and self.logger are ready by then too.
    INDICATORS = {
        "fast_sma": ("SimpleMovingAverage", {"period": 20}),
        "slow_sma": ("SimpleMovingAverage", {"period": 50}),
    }

    # Anything you want to remember between bars: "attribute_name": default.
    # Each default is copied per run, so self.last_price is your own dict.
    STATE = {"last_price": {}}

    def OnData(self, context: StrategyContext):
        """Called once per bar. Trade through \`context\`; return nothing."""
        for ticker in self.tickers:
            asset = context.Market[ticker]
            fast = self.fast_sma[ticker]
            slow = self.slow_sma[ticker]

            # Indicators need their full period before they mean anything.
            if not (asset.Exists and fast.IsReady and slow.IsReady):
                continue

            holding = context.Portfolio.positions.get(ticker, 0)

            if fast.Current > slow.Current and holding <= 0:
                context.buy(ticker, confidence=1.0)
            elif fast.Current < slow.Current and holding > 0:
                context.sell(ticker, confidence=1.0)

            # Whatever you put in STATE is yours to keep across bars.
            self.last_price[ticker] = asset.Close
`;
