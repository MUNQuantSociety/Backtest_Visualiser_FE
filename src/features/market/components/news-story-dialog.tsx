import { ExternalLink, X } from 'lucide-react';
import { useId, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatSigned } from '@/utils/format';
import { toneFromValue } from '@/utils/tone';

import { useNewsStory } from '../market-api';
import type { NewsArticle } from '../types';

import { DivergingBar } from './sentiment-gauge';

/** Opens the story card from a list row. */
export interface NewsStoryHandle {
  open: (article: NewsArticle) => void;
}

/** Publication time on the exchange clock the backtests run on. */
const publishedFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** The card's sentiment bar: larger than a list row's, so the score reads at a glance. */
const STORY_BAR_WIDTH = 260;
const STORY_BAR_HEIGHT = 12;

const toneClass = {
  profit: 'text-[var(--profit)]',
  loss: 'text-[var(--loss)]',
  neutral: 'text-foreground',
} as const;

/**
 * One news story, opened from a list as a card.
 *
 * Shows the story's own title and summary paragraph, which the backend reads
 * from the publisher's page (`GET /news/{id}/story`) because the stored text is
 * title and summary joined; plus when it was published, which ticker it was
 * scored for, the model's score, and a link to the publisher's page. When no
 * summary can be found it says so, rather than repeat the title.
 *
 * A native `<dialog>` opened through a ref handle, like the run form's quick
 * start, so `showModal()` runs on the click itself rather than from an effect.
 */
export function NewsStoryDialog({ ref }: { ref: Ref<NewsStoryHandle> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [article, setArticle] = useState<NewsArticle | null>(null);

  useImperativeHandle(ref, () => ({
    open(next) {
      setArticle(next);
      const dialog = dialogRef.current;
      // `showModal()` throws InvalidStateError if the dialog is already open.
      if (dialog && !dialog.open) dialog.showModal();
    },
  }));

  function close() {
    dialogRef.current?.close();
  }

  const story = useNewsStory(article?.id ?? null);
  const title = story.data?.title || article?.headline || '';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) close();
      }}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(600px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/60"
    >
      {article ? (
        <article>
          <header className="flex items-start justify-between gap-4 border-b px-5 pt-4 pb-3">
            <div className="min-w-0 space-y-1">
              <p className="tabular text-[11px] text-muted-foreground">
                {article.source} · {publishedFormat.format(new Date(article.publishedAt))} ET ·{' '}
                {article.tickers.join(' · ')}
              </p>
              <h2 id={titleId} className="text-[15px] leading-snug font-semibold tracking-tight">
                {title}
              </h2>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close story" onClick={close}>
              <X className="size-4" aria-hidden />
            </Button>
          </header>

          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-muted-foreground">Model sentiment</span>
              <span
                className={cn(
                  'tabular text-[15px] font-semibold',
                  toneClass[toneFromValue(article.score)],
                )}
              >
                {formatSigned(article.score, (n) => n.toFixed(2))}
              </span>
              <DivergingBar
                value={article.score}
                width={STORY_BAR_WIDTH}
                height={STORY_BAR_HEIGHT}
              />
            </div>

            {story.isLoading ? (
              <div className="space-y-2" aria-label="Loading summary">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-3/5" />
              </div>
            ) : story.data?.summary ? (
              <p className="text-[13px] leading-relaxed">{story.data.summary}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                No summary available for this story.
              </p>
            )}
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-selected-foreground underline-offset-4 hover:underline"
              >
                Read on {article.source}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={close}>
              Close
            </Button>
          </footer>
        </article>
      ) : null}
    </dialog>
  );
}
