import { useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { NewsArticle } from '../types';

import { NewsStoryDialog, type NewsStoryHandle } from './news-story-dialog';
import { DivergingBar } from './sentiment-gauge';

/**
 * The exchange date an article was published. News belongs to a backtest's
 * past window, so "412d ago" would say nothing useful; the date lines up with
 * the run's own dates, which are New York sessions.
 */
const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/** Scored articles; each row opens the full story as a card. */
export function NewsList({
  articles,
  isLoading,
}: {
  articles: readonly NewsArticle[];
  isLoading: boolean;
}) {
  const storyRef = useRef<NewsStoryHandle>(null);

  if (isLoading) return <Skeleton className="h-56" />;
  if (articles.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No scored articles for these tickers in this window.
      </p>
    );
  }

  return (
    <div>
      <NewsStoryDialog ref={storyRef} />
      {articles.map((article) => (
        <button
          key={article.id}
          type="button"
          aria-label={`Open story: ${article.headline}`}
          onClick={() => storyRef.current?.open(article)}
          className="grid w-full cursor-pointer items-start gap-2 border-b py-2.5 text-left last:border-b-0 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          style={{ gridTemplateColumns: '64px minmax(0,1fr) 96px' }}
        >
          {/* Spans, not <p>/<div>: a button may only hold phrasing content. */}
          <span className="block min-w-0">
            <span className="tabular block truncate text-[10px] text-foreground">
              {article.source}
            </span>
            <span className="tabular block text-[10px] text-muted-foreground">
              {dateFormat.format(new Date(article.publishedAt))}
            </span>
          </span>
          <span className="block min-w-0">
            <span className="line-clamp-2 text-[13px] leading-snug">{article.headline}</span>
            <span className="tabular mt-0.5 block text-[10px] text-muted-foreground">
              {article.tickers.join(' · ')}
            </span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <span className={cn('tabular text-xs', toneClass[toneFromValue(article.score)])}>
              {formatSigned(article.score, (n) => n.toFixed(2))}
            </span>
            <DivergingBar value={article.score} width={96} />
          </span>
        </button>
      ))}
    </div>
  );
}
