import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useRunNews, type RunNewsWindow } from '../market-api';

import { NewsList } from './news-list';

/** Articles shown per run: the newest in its window. */
const RUN_NEWS_LIMIT = 20;

/**
 * The scored articles published during one backtest, for the tickers it traded.
 *
 * News is not a live feed here: the article table is historical, so a run's
 * news is whatever was published between its own start and end dates.
 */
export function RunNewsPanel({ window }: { window: RunNewsWindow }) {
  const news = useRunNews(window, RUN_NEWS_LIMIT);
  const hasTickers = window.tickers.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">News during this run</CardTitle>
        <CardDescription>
          {hasTickers
            ? `${window.tickers.join(', ')} · ${window.start} to ${window.end}. The newest ${String(RUN_NEWS_LIMIT)} scored articles in the window; the bar is the model’s sentiment for each.`
            : 'This run did not record which tickers it traded, so there is no news to match.'}
        </CardDescription>
      </CardHeader>
      {hasTickers ? (
        <CardContent>
          {news.error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">News unavailable.</p>
          ) : (
            <NewsList articles={news.data ?? []} isLoading={news.isLoading} />
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
