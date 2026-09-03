import { TriangleAlert, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/utils/format';

import { useFlattenBook } from '../portfolios-api';

const CONFIRM_WORD = 'FLATTEN';

interface FlattenBookDialogProps {
  positionCount: number;
  /** Gross notional across the book, so the dialog says what it is closing. */
  grossNotional: number;
  disabled?: boolean | undefined;
}

/**
 * Close every position across every sleeve.
 *
 * Two deliberate frictions: the word has to be typed, and the confirm button
 * names the consequence rather than saying "OK". Real money, no undo — the
 * dialog should feel like the thing it does.
 */
export function FlattenBookDialog({
  positionCount,
  grossNotional,
  disabled = false,
}: FlattenBookDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [sent, setSent] = useState(false);
  const flatten = useFlattenBook();
  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setTyped('');
    setSent(false);
    flatten.reset();
    setOpen(true);
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={openDialog} disabled={disabled}>
        Flatten book
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="flatten-book-title"
        onClose={() => {
          setOpen(false);
        }}
        onClick={(event) => {
          const dialog = dialogRef.current;
          if (!dialog || event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          const inside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
          if (!inside) closeDialog();
        }}
        className="m-auto max-h-[calc(100vh-2rem)] w-[min(480px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--loss)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/85"
      >
        {open ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[var(--loss)]" aria-hidden />
                <div>
                  <h2 id="flatten-book-title" className="text-[15px] font-semibold tracking-tight">
                    Flatten the book?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sends market orders to close every open position across all sleeves:{' '}
                    <span className="tabular text-foreground">
                      {formatNumber(positionCount, 0)} positions
                    </span>
                    , about{' '}
                    <span className="tabular text-foreground">{formatCurrency(grossNotional)}</span>{' '}
                    of notional. The engines keep running but start flat. This cannot be undone.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={closeDialog}>
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            {sent ? (
              <>
                <p className="rounded-md border px-3 py-2 text-sm">
                  Flatten orders sent. Positions update as the fills arrive.
                </p>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={closeDialog}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">
                    Type <span className="tabular font-medium text-foreground">{CONFIRM_WORD}</span>{' '}
                    to confirm
                  </span>
                  <input
                    value={typed}
                    onChange={(event) => {
                      setTyped(event.target.value);
                    }}
                    spellCheck={false}
                    autoComplete="off"
                    className="tabular w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                {flatten.isError ? (
                  <p className="text-sm text-[var(--loss)]">{flatten.error.message}</p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={closeDialog}>
                    Keep positions
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!armed || flatten.isPending}
                    onClick={() => {
                      flatten.mutate(undefined, {
                        onSuccess: () => {
                          setSent(true);
                        },
                      });
                    }}
                  >
                    {flatten.isPending ? 'Sending…' : 'Flatten every position'}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
