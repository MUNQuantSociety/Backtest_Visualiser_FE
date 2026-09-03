import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeDay, formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import type { NewsArticle } from '../types';

import { DivergingBar } from './sentiment-gauge';

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

export function NewsList({
  articles,
  isLoading,
}: {
  articles: readonly NewsArticle[];
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-56" />;
  if (articles.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No scored articles.</p>;
  }

  return (
    <div>
      {articles.map((article) => (
        <div
          key={article.id}
          className="grid items-start gap-2 border-b py-2.5 last:border-b-0 hover:bg-muted/60"
          style={{ gridTemplateColumns: '64px minmax(0,1fr) 96px' }}
        >
          <div className="min-w-0">
            <p className="tabular truncate text-[10px] text-foreground">{article.source}</p>
            <p className="tabular text-[10px] text-muted-foreground">
              {formatRelativeDay(article.publishedAt)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[13px] leading-snug">{article.headline}</p>
            <p className="tabular mt-0.5 text-[10px] text-muted-foreground">
              {article.tickers.join(' · ')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={cn('tabular text-xs', toneClass[toneFromValue(article.score)])}>
              {formatSigned(article.score, (n) => n.toFixed(2))}
            </span>
            <DivergingBar value={article.score} width={96} />
          </div>
        </div>
      ))}
    </div>
  );
}
