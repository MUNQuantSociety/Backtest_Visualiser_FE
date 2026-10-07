import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { parseRules } from '../rules';
import { fetchStrategySource } from '../strategies-api';
import type { Strategy } from '../types';

import { RuleBuilder } from './rule-builder';
import { StrategyEditor } from './strategy-editor';

/**
 * The editor, opened on a strategy that already exists.
 *
 * Same native `<dialog>` construction as "New strategy". The source is fetched
 * when the dialog opens rather than with the card list: a catalogue of twenty
 * strategies should not pull twenty Python files to render twenty rows.
 */
export function EditStrategyDialog({
  strategy,
  onClose,
}: {
  strategy: Strategy | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // A builder-made strategy opens on its rules; this switches it to the code.
  const [asCode, setAsCode] = useState(false);

  const source = useQuery({
    queryKey: ['strategies', 'source', strategy?.id],
    queryFn: () => fetchStrategySource(strategy?.id ?? ''),
    enabled: strategy !== null,
    // Cached only while it succeeded. A failure must not be: `retry: false`
    // plus an infinite staleTime meant one failed fetch poisoned Edit for the
    // rest of the session — reopening served the cached error even after the
    // store was repaired. `gcTime: 0` drops a failed result the moment the
    // dialog closes, so the next open really asks again.
    staleTime: ({ state }) => (state.error ? 0 : Number.POSITIVE_INFINITY),
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (strategy && !dialog.open) dialog.showModal();
    if (!strategy && dialog.open) dialog.close();
  }, [strategy]);

  // Each strategy opens the way it was made, whatever the last one was switched to.
  const [openedFor, setOpenedFor] = useState(strategy?.id);
  if (openedFor !== strategy?.id) {
    setOpenedFor(strategy?.id);
    setAsCode(false);
  }
  const rules = source.data ? parseRules(source.data.rules) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="edit-strategy-title"
      onClose={onClose}
      onClick={(event) => {
        const dialog = dialogRef.current;
        if (!dialog || event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) onClose();
      }}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(960px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/85"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card px-6 pt-5 pb-4">
        <div className="space-y-1">
          <h2 id="edit-strategy-title" className="text-[17px] font-semibold tracking-tight">
            Edit strategy
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {strategy ? strategy.name : 'Loading…'}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="px-6 py-5">
        {source.isPending && strategy ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading the saved source…
          </p>
        ) : null}

        {source.isError ? (
          <div role="alert" className="space-y-2 text-sm text-[var(--loss)]">
            <p>Could not load this strategy’s source: {source.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void source.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {strategy && source.data && rules && !asCode ? (
          <div className="space-y-4">
            <RuleBuilder
              editing={{ name: strategy.name, description: strategy.description, rules }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAsCode(true);
              }}
            >
              Edit the code instead
            </Button>
          </div>
        ) : null}

        {strategy && source.data && (!rules || asCode) ? (
          <StrategyEditor
            editing={{
              key: strategy.id,
              name: strategy.name,
              description: strategy.description,
              source: source.data.source,
              // A fragment-authored strategy reopens as its fragment, so the
              // member edits the lines they wrote rather than the generated
              // file around them. Null for an uploaded file.
              body: source.data.body,
              indicators: source.data.indicators,
              state: source.data.state,
            }}
          />
        ) : null}
      </div>
    </dialog>
  );
}
