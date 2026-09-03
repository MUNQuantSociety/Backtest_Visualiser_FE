import { Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { StrategyEditor } from './strategy-editor';

/**
 * "New strategy" as a header action, opening the existing editor in a modal.
 *
 * Same construction as the run dialog: a native <dialog> for the focus trap,
 * Escape and backdrop, the element as the source of truth for openness, and
 * the editor mounted only while open so the Library does not fetch the
 * starter template until someone asks to write a strategy.
 */
export function NewStrategyDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setOpen(true);
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <Plus className="mr-2 size-4" aria-hidden />
        New strategy
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="new-strategy-title"
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
        className="m-auto max-h-[calc(100vh-2rem)] w-[min(960px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/85"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card px-6 pt-5 pb-4">
          <div className="space-y-1">
            <h2 id="new-strategy-title" className="text-[17px] font-semibold tracking-tight">
              New strategy
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Paste or write Python against <code className="tabular">BasePortfolio</code>, or
              upload an existing <code className="tabular">.py</code> file.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={closeDialog}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="px-6 py-5">{open ? <StrategyEditor /> : null}</div>
      </dialog>
    </>
  );
}
