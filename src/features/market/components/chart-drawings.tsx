import type { IChartApi, ISeriesApi, Logical, SeriesType } from 'lightweight-charts';
import {
  ChevronDown,
  Magnet,
  Minus,
  MoveUpRight,
  PencilLine,
  RectangleHorizontal,
  Rows3,
  SeparatorVertical,
  Slash,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { withAlpha } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';

import { useDrawingStorage } from '../chart-drawings-api';

import {
  dateToLogical,
  fibPrices,
  loadDrawings,
  loadMagnet,
  logicalToDate,
  MAX_NOTE_LENGTH,
  moveDrawing,
  rayEnd,
  saveMagnet,
  snapToCandle,
  type Drawing,
  type DrawingPoint,
  type DrawingTool,
  type SnapCandle,
} from './chart-drawings-model';

const TOOLS: readonly { tool: DrawingTool; label: string; icon: LucideIcon; clicks: 1 | 2 }[] = [
  { tool: 'trend', label: 'Trend line', icon: Slash, clicks: 2 },
  { tool: 'ray', label: 'Ray', icon: MoveUpRight, clicks: 2 },
  { tool: 'horizontal', label: 'Horizontal line', icon: Minus, clicks: 1 },
  { tool: 'vertical', label: 'Vertical line', icon: SeparatorVertical, clicks: 1 },
  { tool: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal, clicks: 2 },
  { tool: 'fib', label: 'Fib retracement', icon: Rows3, clicks: 2 },
  { tool: 'text', label: 'Text note', icon: Type, clicks: 1 },
];

/** A note's font size, and a rough glyph width to size its click target. */
const NOTE_FONT = 12;
const NOTE_CHAR_WIDTH = 7;

let nextId = 0;
const newId = () => `d${String(Date.now())}-${String((nextId += 1))}`;

/** Ignore Delete while the reader is typing in a field. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** A drag in progress: the whole drawing, or one of its points. */
interface Drag {
  id: string;
  /** Which point moves, or null to move the whole drawing. */
  pointIndex: number | null;
  startLogical: number;
  startPrice: number;
  original: Drawing;
}

/** A text note being written: a new one at `point`, or an existing one by `id`. */
interface NoteEdit {
  id: string;
  point: DrawingPoint;
  value: string;
  isNew: boolean;
}

/**
 * TradingView-style drawing on a lightweight-charts chart: one Draw menu for
 * trend lines, rays, horizontal and vertical lines, rectangles, Fibonacci
 * retracements and text notes, drawn on an SVG layer over the price pane.
 *
 * Wrap the chart's container in it and pass the chart, the series whose price
 * scale the drawings use, and its candles. Points are kept as a date and a
 * price, so a drawing follows the chart as it pans, zooms or changes range,
 * and they are saved in this browser per `storageKey` (the ticker).
 *
 * Pick a tool and click once (horizontal, vertical, note) or twice. Drag a
 * drawing to move it, or a selected drawing's handle to move that point;
 * double-click a note to edit it. Delete removes the selected drawing and
 * Escape cancels. With the magnet on, points snap to the nearest open, high,
 * low or close.
 */
export function ChartDrawings({
  chart,
  series,
  candles,
  storageKey,
  color,
  children,
}: {
  chart: IChartApi | null;
  series: ISeriesApi<SeriesType> | null;
  /** The chart's sessions, oldest first. */
  candles: readonly SnapCandle[];
  storageKey: string;
  color: string;
  /** The chart's container; it should fill this box. */
  children: ReactNode;
}) {
  const storage = useDrawingStorage(storageKey);
  // `loaded` waits for the account's list, so an edit cannot overwrite drawings
  // that have not arrived yet. `version` counts the changes still to be saved.
  const [stored, setStored] = useState(() => ({
    key: storageKey,
    drawings: storage.remote ? [] : loadDrawings(storageKey),
    loaded: !storage.remote,
    version: 0,
  }));
  const savedVersion = useRef(0);
  const [tool, setTool] = useState<DrawingTool | null>(null);
  const [pending, setPending] = useState<DrawingPoint | null>(null);
  const [hover, setHover] = useState<DrawingPoint | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [magnet, setMagnet] = useState(loadMagnet);
  const [note, setNote] = useState<NoteEdit | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, setFrame] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const dates = useMemo(() => candles.map((candle) => candle.date), [candles]);

  // A new ticker brings its own drawings and drops anything half drawn.
  if (stored.key !== storageKey) {
    setStored({
      key: storageKey,
      drawings: storage.remote ? [] : loadDrawings(storageKey),
      loaded: !storage.remote,
      version: 0,
    });
    setTool(null);
    setPending(null);
    setSelectedId(null);
    setNote(null);
  }
  // The account's list arrived. Drawings this browser kept before they were
  // saved to the account are moved over the first time, then saved there.
  if (stored.key === storageKey && !stored.loaded && storage.saved !== undefined) {
    const local = storage.saved.length === 0 ? loadDrawings(storageKey) : [];
    setStored({
      key: storageKey,
      drawings: local.length > 0 ? local : storage.saved,
      loaded: true,
      version: local.length > 0 ? 1 : 0,
    });
  }
  const drawings = stored.key === storageKey ? stored.drawings : [];

  // Save once per change that asked to be saved, never per frame of a drag.
  const { persist } = storage;
  useEffect(() => {
    if (stored.version === 0) {
      savedVersion.current = 0;
      return;
    }
    if (stored.version === savedVersion.current) return;
    savedVersion.current = stored.version;
    persist(stored.key, stored.drawings);
  }, [stored, persist]);

  /** Change the drawings; `persist` is false for the frames of a drag, saved once at the end. */
  const update = (change: (drawings: Drawing[]) => Drawing[], persist = true) => {
    setStored((current) => ({
      ...current,
      drawings: change(current.drawings),
      version: persist ? current.version + 1 : current.version,
    }));
  };

  const cancel = () => {
    setTool(null);
    setPending(null);
    setHover(null);
  };

  // Redraw whenever the chart moves under the drawings: pan, zoom, resize, or
  // the price scale being dragged (which moves the crosshair). One per frame.
  useEffect(() => {
    if (!chart) return;
    let request = 0;
    const redraw = () => {
      cancelAnimationFrame(request);
      request = requestAnimationFrame(() => {
        setFrame((frame) => frame + 1);
      });
    };
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(redraw);
    timeScale.subscribeSizeChange(redraw);
    chart.subscribeCrosshairMove(redraw);
    return () => {
      cancelAnimationFrame(request);
      timeScale.unsubscribeVisibleLogicalRangeChange(redraw);
      timeScale.unsubscribeSizeChange(redraw);
      chart.unsubscribeCrosshairMove(redraw);
    };
  }, [chart]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTool(null);
        setPending(null);
        setHover(null);
        setSelectedId(null);
        setMenuOpen(false);
        setNote(null);
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedId !== null &&
        !isTyping(event.target)
      ) {
        event.preventDefault();
        setStored((current) => ({
          ...current,
          drawings: current.drawings.filter((drawing) => drawing.id !== selectedId),
          version: current.version + 1,
        }));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('pointerdown', onDown);
    };
  }, [menuOpen]);

  const ready = chart !== null && series !== null && dates.length > 0 && stored.loaded;
  const width = ready ? chart.timeScale().width() : 0;
  const height = ready ? (chart.panes()[0]?.getHeight() ?? 0) : 0;

  const toScreen = (point: DrawingPoint) => {
    if (!ready) return null;
    const logical = dateToLogical(dates, point.date);
    if (logical === null) return null;
    const x = chart.timeScale().logicalToCoordinate(logical as Logical);
    const y = series.priceToCoordinate(point.price);
    return x === null || y === null ? null : { x, y };
  };

  /** The bar position and price under a pointer, from page coordinates. */
  const chartAt = (svg: SVGSVGElement | null, clientX: number, clientY: number) => {
    const box = svg?.getBoundingClientRect();
    if (!ready || !box) return null;
    const logical = chart.timeScale().coordinateToLogical(clientX - box.left);
    const price = series.coordinateToPrice(clientY - box.top);
    return logical === null || price === null ? null : { logical, price };
  };

  /** The point under a pointer, on the magnet when it is on and `snap` allows. */
  const pointAt = (
    svg: SVGSVGElement | null,
    clientX: number,
    clientY: number,
    snap = true,
  ): DrawingPoint | null => {
    const at = chartAt(svg, clientX, clientY);
    const date = at ? logicalToDate(dates, at.logical) : null;
    if (!at || date === null) return null;
    const point = { date, price: at.price };
    return magnet && snap ? snapToCandle(candles, dates, point) : point;
  };

  const activeTool = TOOLS.find((option) => option.tool === tool);

  const place = (svg: SVGSVGElement | null, clientX: number, clientY: number) => {
    if (!activeTool) return;
    // A note is a label, not a price: it goes where it is put.
    const point = pointAt(svg, clientX, clientY, activeTool.tool !== 'text');
    if (!point) return;
    if (activeTool.tool === 'text') {
      setNote({ id: newId(), point, value: '', isNew: true });
      cancel();
      return;
    }
    if (activeTool.clicks === 2 && pending === null) {
      setPending(point);
      return;
    }
    const drawing: Drawing = {
      id: newId(),
      tool: activeTool.tool,
      points: activeTool.clicks === 1 || pending === null ? [point] : [pending, point],
    };
    update((current) => [...current, drawing]);
    setSelectedId(drawing.id);
    cancel();
  };

  /** Save the note being written; an emptied note is removed. */
  const commitNote = () => {
    if (!note) return;
    const text = note.value.trim().slice(0, MAX_NOTE_LENGTH);
    if (note.isNew) {
      if (text) {
        update((current) => [
          ...current,
          { id: note.id, tool: 'text', points: [note.point], text },
        ]);
        setSelectedId(note.id);
      }
    } else {
      update((current) =>
        text
          ? current.map((drawing) => (drawing.id === note.id ? { ...drawing, text } : drawing))
          : current.filter((drawing) => drawing.id !== note.id),
      );
    }
    setNote(null);
  };

  /**
   * Start dragging `drawing`, or one of its points. Follows the pointer on
   * the window, so a drag that leaves the chart still ends cleanly.
   */
  const startDrag = (
    event: ReactPointerEvent<SVGElement>,
    drawing: Drawing,
    pointIndex: number | null,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    setSelectedId(drawing.id);
    const svg = event.currentTarget.ownerSVGElement;
    const start = chartAt(svg, event.clientX, event.clientY);
    if (!start) return;
    const drag: Drag = {
      id: drawing.id,
      pointIndex,
      startLogical: start.logical,
      startPrice: start.price,
      original: drawing,
    };
    let moved = false;
    setDragging(true);

    const onMove = (move: PointerEvent) => {
      let next: Drawing;
      if (drag.pointIndex === null) {
        const at = chartAt(svg, move.clientX, move.clientY);
        if (!at) return;
        next = moveDrawing(
          drag.original,
          dates,
          Math.round(at.logical - drag.startLogical),
          at.price - drag.startPrice,
        );
      } else {
        const point = pointAt(svg, move.clientX, move.clientY);
        if (!point) return;
        const index = drag.pointIndex;
        next = {
          ...drag.original,
          points: drag.original.points.map((old, i) => (i === index ? point : old)),
        };
      }
      moved = true;
      const replacement = next;
      update((current) => current.map((item) => (item.id === drag.id ? replacement : item)), false);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDragging(false);
      if (moved) update((current) => current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const preview: Drawing | null =
    activeTool?.tool === 'text'
      ? null
      : activeTool?.clicks === 2 && pending && hover
        ? { id: 'preview', tool: activeTool.tool, points: [pending, hover] }
        : activeTool?.clicks === 1 && hover
          ? { id: 'preview', tool: activeTool.tool, points: [hover] }
          : null;

  /** One drawing's SVG, plus a wide invisible stroke to grab it by. */
  const renderDrawing = (drawing: Drawing, selected: boolean, interactive: boolean) => {
    const [a, b] = drawing.points.map(toScreen);
    if (!a) return null;
    const stroke = { stroke: color, strokeWidth: selected ? 2 : 1.5 };
    const shapes: ReactNode[] = [];
    const hits: ReactNode[] = [];
    const segment = (
      key: string,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      dashed = false,
    ) => {
      shapes.push(
        <line
          key={key}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          {...stroke}
          strokeDasharray={dashed ? '4 3' : undefined}
        />,
      );
      hits.push(<line key={`${key}-hit`} x1={x1} y1={y1} x2={x2} y2={y2} />);
    };

    switch (drawing.tool) {
      case 'horizontal': {
        segment('line', 0, a.y, width, a.y);
        shapes.push(
          <text key="price" x={width - 6} y={a.y - 4} textAnchor="end" fill={color} fontSize={11}>
            {drawing.points[0]?.price.toFixed(2)}
          </text>,
        );
        break;
      }
      case 'vertical':
        segment('line', a.x, 0, a.x, height);
        break;
      case 'trend':
        if (b) segment('line', a.x, a.y, b.x, b.y);
        break;
      case 'ray':
        if (b) {
          const end = rayEnd(a.x, a.y, b.x, b.y, width, height);
          segment('line', a.x, a.y, end.x, end.y);
        }
        break;
      case 'rectangle':
        if (b) {
          const [left, right] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
          const [top, bottom] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
          shapes.push(
            <rect
              key="fill"
              x={left}
              y={top}
              width={right - left}
              height={bottom - top}
              fill={withAlpha(color, 0.12)}
              {...stroke}
            />,
          );
          hits.push(<rect key="hit" x={left} y={top} width={right - left} height={bottom - top} />);
        }
        break;
      case 'fib': {
        const [start, end] = drawing.points;
        if (b && start && end) {
          const [left, right] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
          segment('trend', a.x, a.y, b.x, b.y, true);
          for (const { level, price } of fibPrices(start.price, end.price)) {
            const y = series?.priceToCoordinate(price);
            if (y === null || y === undefined) continue;
            segment(`level-${String(level)}`, left, y, right, y);
            shapes.push(
              <text
                key={`label-${String(level)}`}
                x={left + 4}
                y={y - 3}
                fill={color}
                fontSize={10}
              >
                {`${String(level)} (${price.toFixed(2)})`}
              </text>,
            );
          }
        }
        break;
      }
      case 'text': {
        // The note being edited is shown as its input instead.
        if (note?.id === drawing.id) return null;
        const text = drawing.text ?? '';
        shapes.push(
          <text
            key="note"
            x={a.x}
            y={a.y}
            fill={color}
            fontSize={NOTE_FONT}
            fontWeight={selected ? 600 : 400}
            stroke="var(--background)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {text}
          </text>,
        );
        hits.push(
          <rect
            key="hit"
            x={a.x - 3}
            y={a.y - NOTE_FONT - 2}
            width={text.length * NOTE_CHAR_WIDTH + 6}
            height={NOTE_FONT + 7}
            fill="transparent"
            pointerEvents="all"
          />,
        );
        break;
      }
    }

    // Notes move as a whole; every other drawing shows a handle per point.
    const handles = selected && drawing.tool !== 'text' ? [a, b] : [];

    return (
      <g key={drawing.id} data-drawing={drawing.tool}>
        {shapes}
        {interactive ? (
          <g
            stroke="transparent"
            strokeWidth={12}
            fill="none"
            pointerEvents="stroke"
            className={dragging ? 'cursor-grabbing' : 'cursor-move'}
            data-testid={`drawing-${drawing.tool}`}
            onPointerDown={(event) => {
              startDrag(event, drawing, null);
            }}
            onDoubleClick={() => {
              const point = drawing.points[0];
              if (drawing.tool === 'text' && point) {
                setNote({ id: drawing.id, point, value: drawing.text ?? '', isNew: false });
              }
            }}
          >
            {hits}
          </g>
        ) : null}
        {handles.map((point, index) =>
          point ? (
            <circle
              key={`handle-${String(index)}`}
              cx={point.x}
              cy={point.y}
              r={5}
              fill="var(--background)"
              stroke={color}
              strokeWidth={1.5}
              pointerEvents={interactive ? 'all' : 'none'}
              className="cursor-grab"
              data-testid="drawing-handle"
              onPointerDown={(event) => {
                startDrag(event, drawing, index);
              }}
            />
          ) : null,
        )}
      </g>
    );
  };

  const notePosition = note ? toScreen(note.point) : null;
  const menuItem = 'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs';

  return (
    <div
      className="relative size-full"
      onPointerDown={() => {
        if (tool === null) setSelectedId(null);
      }}
    >
      {children}
      {ready && width > 0 && height > 0 ? (
        <svg
          className="pointer-events-none absolute top-0 left-0 z-[1] overflow-hidden select-none"
          width={width}
          height={height}
          aria-label="Chart drawings"
          role="img"
        >
          {tool !== null ? (
            <rect
              width={width}
              height={height}
              fill="transparent"
              pointerEvents="all"
              className="cursor-crosshair"
              data-testid="drawing-surface"
              onPointerMove={(event) => {
                setHover(
                  pointAt(
                    event.currentTarget.ownerSVGElement,
                    event.clientX,
                    event.clientY,
                    tool !== 'text',
                  ),
                );
              }}
              onPointerLeave={() => {
                setHover(null);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                // Without this the press's default focus change lands after a
                // note's input has mounted and focused, blurring it at once.
                event.preventDefault();
                if (event.button === 0) {
                  place(event.currentTarget.ownerSVGElement, event.clientX, event.clientY);
                }
              }}
            />
          ) : null}
          {drawings.map((drawing) =>
            renderDrawing(drawing, drawing.id === selectedId, tool === null),
          )}
          {preview ? renderDrawing(preview, false, false) : null}
          {tool !== null && magnet && hover ? (
            <MagnetMark point={toScreen(hover)} color={color} />
          ) : null}
        </svg>
      ) : null}

      {note && notePosition ? (
        <input
          autoFocus
          aria-label="Note text"
          value={note.value}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Type a note, Enter to save"
          onChange={(event) => {
            setNote({ ...note, value: event.target.value });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitNote();
            if (event.key === 'Escape') {
              event.stopPropagation();
              setNote(null);
            }
          }}
          onBlur={commitNote}
          // Editing an existing note starts with its words selected, so typing replaces them.
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          style={{ left: notePosition.x - 4, top: notePosition.y - NOTE_FONT - 6 }}
          className="absolute z-20 h-6 w-56 rounded border border-border bg-background px-1.5 text-xs text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : null}

      <div
        ref={menuRef}
        className="absolute top-1.5 left-1.5 z-10 flex items-center gap-2"
        // Using the menu is not a click on the chart: keep the selection, so
        // "Delete selected" has something to delete.
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={!stored.loaded}
          onClick={() => {
            setMenuOpen((open) => !open);
          }}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background/90 px-2 text-xs shadow-sm backdrop-blur-sm hover:text-foreground',
            activeTool ? 'slant-active font-medium text-slant-foreground' : 'text-muted-foreground',
          )}
        >
          {activeTool ? (
            <activeTool.icon className="size-3.5" />
          ) : (
            <PencilLine className="size-3.5" />
          )}
          {activeTool ? activeTool.label : 'Draw'}
          {magnet ? <Magnet className="size-3" aria-label="Magnet on" /> : null}
          <ChevronDown className="size-3" />
        </button>
        {storage.loadError || storage.saveError ? (
          <span
            role="alert"
            className="rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-[var(--loss)]"
          >
            {storage.loadError
              ? `Drawings could not be loaded: ${storage.loadError}`
              : `Drawings could not be saved: ${storage.saveError ?? ''}`}
          </span>
        ) : null}
        {activeTool ? (
          <span className="rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {activeTool.tool === 'text'
              ? 'Click where the note goes. Esc cancels.'
              : activeTool.clicks === 1
                ? 'Click to place it. Esc cancels.'
                : pending === null
                  ? 'Click the first point. Esc cancels.'
                  : 'Click the second point.'}
          </span>
        ) : null}
        {menuOpen ? (
          <div
            role="menu"
            aria-label="Drawing tools"
            className="absolute top-8 left-0 w-52 rounded-md border border-border bg-background p-1 shadow-md"
          >
            {TOOLS.map((option) => (
              <button
                key={option.tool}
                type="button"
                role="menuitemradio"
                aria-checked={option.tool === tool}
                onClick={() => {
                  setTool(option.tool);
                  setPending(null);
                  setSelectedId(null);
                  setMenuOpen(false);
                }}
                className={cn(
                  menuItem,
                  'cursor-pointer hover:bg-accent',
                  option.tool === tool ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                <option.icon className="size-3.5" />
                {option.label}
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={magnet}
              onClick={() => {
                setMagnet(!magnet);
                saveMagnet(!magnet);
                setMenuOpen(false);
              }}
              className={cn(
                menuItem,
                'cursor-pointer hover:bg-accent',
                magnet ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              <Magnet className="size-3.5" />
              Magnet: snap to candles
              <span className="ml-auto text-[10px] tracking-wide uppercase">
                {magnet ? 'On' : 'Off'}
              </span>
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              role="menuitem"
              disabled={selectedId === null}
              onClick={() => {
                update((current) => current.filter((drawing) => drawing.id !== selectedId));
                setSelectedId(null);
                setMenuOpen(false);
              }}
              className={cn(
                menuItem,
                'cursor-pointer hover:bg-accent disabled:cursor-default disabled:opacity-40',
              )}
            >
              <Trash2 className="size-3.5" />
              Delete selected
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={drawings.length === 0}
              onClick={() => {
                update((current) => current.slice(0, -1));
                setSelectedId(null);
                setMenuOpen(false);
              }}
              className={cn(
                menuItem,
                'cursor-pointer hover:bg-accent disabled:cursor-default disabled:opacity-40',
              )}
            >
              <Undo2 className="size-3.5" />
              Undo last drawing
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={drawings.length === 0}
              onClick={() => {
                update(() => []);
                cancel();
                setSelectedId(null);
                setMenuOpen(false);
              }}
              className={cn(
                menuItem,
                'cursor-pointer text-[var(--loss)] hover:bg-accent disabled:cursor-default disabled:opacity-40',
              )}
            >
              <Trash2 className="size-3.5" />
              Clear all drawings
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Where the magnet will put the next point: a small ring on the snapped price. */
function MagnetMark({ point, color }: { point: { x: number; y: number } | null; color: string }) {
  if (!point) return null;
  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={4}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      data-testid="magnet-mark"
    />
  );
}
