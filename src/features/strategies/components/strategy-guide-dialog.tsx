import { X } from 'lucide-react';
import { useId, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

import { STARTER_TEMPLATE_FALLBACK } from '../starter-template';
import { useStrategyTemplate } from '../strategies-api';

import { StrategyGuideContent } from './strategy-guide-content';

const log = createLogger('strategy-guide');

/** Opens the guide from outside, e.g. from a help-menu entry. */
export interface StrategyGuideHandle {
  open: () => void;
}

/**
 * "Writing a strategy", as a pop-up reference opened from the `?` help menu.
 *
 * Same native-dialog construction as the run form's quick start, opened
 * through a ref handle for the same reason. The body is mounted only while
 * open: it fetches the starter template, and the app shell should not pay for
 * that on every page load.
 */
export function StrategyGuideDialog({ ref }: { ref: Ref<StrategyGuideHandle> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog) return;
      setOpen(true);
      // `showModal()` throws InvalidStateError if the dialog is already open.
      if (!dialog.open) dialog.showModal();
      log.info('strategy guide opened');
    },
  }));

  function closeGuide() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={(event) => {
        // Keep a parent dialog's own onClose from seeing this one close.
        event.stopPropagation();
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
        if (!inside) closeGuide();
      }}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(780px,calc(100vw-2rem))] overflow-y-auto rounded-[10px] border border-[var(--border-strong)] bg-card p-0 text-card-foreground shadow-[0_40px_100px_rgb(0_0_0/0.6)] backdrop:bg-background/70"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card px-6 pt-5 pb-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
            Writing a strategy
          </h2>
          <p className="text-[13px] text-muted-foreground">
            From a blank editor to a validated strategy you can backtest here.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close guide" onClick={closeGuide}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="px-6 py-5">{open ? <GuideBody /> : null}</div>
    </dialog>
  );
}

function GuideBody() {
  const template = useStrategyTemplate();
  return (
    <StrategyGuideContent starterSource={template.data?.source ?? STARTER_TEMPLATE_FALLBACK} />
  );
}
