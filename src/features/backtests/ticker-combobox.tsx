import {
  autoUpdate,
  flip,
  offset,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from '@floating-ui/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import { cn } from '@/lib/utils';

import { SYMBOL_SEARCH_MIN_LENGTH, useSymbolSearch } from './backtests-api';

/** Keystrokes closer together than this are one query, not several. */
export const SYMBOL_SEARCH_DEBOUNCE_MS = 250;

interface TickerComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Verify and add: the typed text, or the suggestion that was picked. */
  onSubmit: (symbol?: string) => void;
  onBlur: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy: string;
  /**
   * The box the list should line up with — the whole chip container, not
   * the input. The input is whatever width the chips leave it, which can be
   * a hundred pixels; a list that narrow cannot show a company name.
   */
  anchorRef: RefObject<HTMLElement | null>;
}

/**
 * The "Add ticker" field, with suggestions from the provider as it is typed.
 *
 * The suggestions are only that. Picking one hands its symbol to the same
 * `onSubmit` the Enter key uses, so it is verified with FMP and added exactly
 * as a typed symbol would be; nothing about the universe's invariants moves
 * here. A search that fails leaves the field working as it always has.
 *
 * ARIA combobox with a virtual listbox: focus never leaves the input, and the
 * highlighted option is announced through `aria-activedescendant`.
 *
 * `strategy: 'fixed'` without a portal, for the same reason as `InfoTip`: the
 * form lives in a native modal `<dialog>` whose top layer inerts everything
 * outside it, and a fixed descendant still escapes the dialog's scrolling.
 */
export function TickerCombobox({
  id,
  value,
  onChange,
  onSubmit,
  onBlur,
  disabled,
  invalid,
  describedBy,
  anchorRef,
}: TickerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const listboxId = useId();

  const typed = value.trim().toUpperCase();
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(typed);
    }, SYMBOL_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [typed]);

  const canSearch = !disabled && typed.length >= SYMBOL_SEARCH_MIN_LENGTH;
  const search = useSymbolSearch(query, canSearch);
  const matches = canSearch && search.data ? search.data.matches : [];
  const truncated = canSearch && search.data ? search.data.truncated : false;
  const providerError = canSearch && search.data ? search.data.providerError : null;
  const failed = canSearch && search.isError;
  // Something to show: a page, or the reason there is none. The list is
  // rendered only while this holds, so `open` alone never shows a stale one;
  // every read of `activeIndex` below also checks the row still exists.
  const hasContent = canSearch && (search.data !== undefined || failed);

  const { refs, floatingStyles, context } = useFloating({
    open: open && hasContent,
    onOpenChange: setOpen,
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip(),
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            // Never squashed to a sliver when the viewport is tight: a list
            // shorter than a few rows is worse than one that scrolls the page.
            maxHeight: `${Math.max(Math.min(availableHeight, 320), 160)}px`,
          });
        },
        padding: 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    refs.setPositionReference(anchorRef.current);
  }, [refs, anchorRef]);
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useListNavigation(context, {
      listRef,
      activeIndex,
      onNavigate: setActiveIndex,
      virtual: true,
      loop: false,
    }),
    useDismiss(context),
    useRole(context, { role: 'listbox' }),
  ]);

  function choose(symbol: string) {
    setOpen(false);
    setActiveIndex(null);
    onSubmit(symbol);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const active = open && activeIndex !== null ? matches[activeIndex] : undefined;
      if (active) choose(active.symbol);
      else onSubmit();
      return;
    }
    if (event.key === 'Escape' && open) {
      // Ours, not the dialog's: Escape with the list open closes the list.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(null);
    }
  }

  const activeId =
    open && activeIndex !== null && matches[activeIndex]
      ? `${listboxId}-${activeIndex}`
      : undefined;

  return (
    <>
      <input
        ref={(node) => {
          refs.setReference(node);
        }}
        id={id}
        role="combobox"
        aria-label="Add ticker"
        aria-autocomplete="list"
        aria-expanded={open && hasContent}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={value}
        placeholder="Add ticker…"
        disabled={disabled}
        autoComplete="off"
        className="tabular min-w-24 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
        {...getReferenceProps({
          onChange: (event) => {
            onChange((event.target as HTMLInputElement).value);
            setOpen(true);
            setActiveIndex(null);
          },
          onFocus: () => {
            if (hasContent) setOpen(true);
          },
          onKeyDown,
          onBlur,
        })}
      />
      {open && hasContent ? (
        <ul
          ref={(node) => {
            refs.setFloating(node);
          }}
          id={listboxId}
          aria-label="Ticker suggestions"
          style={floatingStyles}
          className="z-20 overflow-y-auto rounded-md border border-[var(--border-strong)] bg-card py-1 text-xs shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
          {...getFloatingProps()}
        >
          {failed ? (
            <li className="px-3 py-2 text-muted-foreground">
              Suggestions unavailable — press Enter to verify {typed}.
            </li>
          ) : matches.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No FMP symbols start with {typed}.</li>
          ) : (
            matches.map((match, index) => (
              <li
                key={match.symbol}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                ref={(node) => {
                  listRef.current[index] = node;
                }}
                className={cn(
                  'flex cursor-pointer items-baseline gap-2 px-3 py-1.5',
                  activeIndex === index ? 'bg-selected' : 'hover:bg-muted/60',
                )}
                {...getItemProps({
                  // Selecting must not blur the input first: blur is what
                  // submits the typed text, and it would race the click.
                  onPointerDown: (event) => {
                    event.preventDefault();
                  },
                  onClick: () => {
                    choose(match.symbol);
                  },
                })}
              >
                <span className="tabular font-medium">{match.symbol}</span>
                {match.name ? <span className="min-w-0 truncate">{match.name}</span> : null}
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  {match.exchange ? <span>{match.exchange}</span> : null}
                  {match.source === 'database' || match.source === 'run' ? (
                    <span
                      className="rounded bg-muted px-1 text-[10px] uppercase"
                      title={
                        match.source === 'database'
                          ? 'Bars already loaded in this database'
                          : 'Backtested here before'
                      }
                    >
                      {match.source === 'database' ? 'loaded' : 'ran'}
                    </span>
                  ) : null}
                </span>
              </li>
            ))
          )}
          {truncated && !failed ? (
            <li className="border-t px-3 py-1.5 text-muted-foreground">
              Showing the first {matches.length} — keep typing.
            </li>
          ) : null}
          {providerError && !failed ? (
            <li className="border-t px-3 py-1.5 text-muted-foreground">
              Only tickers known here — the symbol provider is unavailable.
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}
