/**
 * Application logging.
 *
 * Two sinks, one call site. Every entry goes to the browser console, and in
 * dev it is also shipped to the Vite process so it prints in the terminal you
 * ran `npm run dev` from — see `tools/client-logger-plugin.ts`. Without that
 * hop the terminal only ever shows Vite's own output and proxy errors, so
 * nothing about what the app actually did is visible where the server runs.
 *
 * Usage:
 *   const log = createLogger('api');
 *   log.info('request finished', { status: 200, ms: 42 });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  /** ISO-8601, stamped on the client so ordering survives batching. */
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

const SEVERITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Must match the route registered by `tools/client-logger-plugin.ts`.
 * Deliberately not shared through a module: `src/` is bundled into the client
 * and `tools/` runs in Node, so importing across them would drag build-time
 * code into the browser bundle.
 */
const TERMINAL_SINK = '/__client-log';

/** Everything in dev; only real problems in production. */
const threshold: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

/* ------------------------------------------------------------------ *
 * Shipping to the terminal
 * ------------------------------------------------------------------ */

const pending: LogEntry[] = [];
let flushHandle: number | null = null;

/**
 * Batched rather than one request per line. A page load emits dozens of
 * entries, and a fetch each would both flood the network panel and reorder
 * them — the queue keeps them in the order they were written.
 */
function scheduleFlush(): void {
  if (flushHandle !== null) return;
  flushHandle = window.setTimeout(() => {
    flushHandle = null;
    void flush();
  }, 200);
}

async function flush(): Promise<void> {
  if (pending.length === 0) return;
  const batch = pending.splice(0, pending.length);

  try {
    await fetch(TERMINAL_SINK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      // Survives a navigation that happens mid-flush.
      keepalive: true,
    });
  } catch {
    // Terminal logging is best-effort. Never let it surface as an app error,
    // and never log the failure — that would queue another entry and recurse.
  }
}

/**
 * Structured-cloneable copy of `data`.
 *
 * `JSON.stringify` throws on cycles and silently drops `Error` (its fields are
 * non-enumerable), which would lose exactly the detail worth logging.
 */
function serialise(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(import.meta.env.DEV ? { stack: value.stack } : {}),
      // ApiError carries status/code; pick them up without importing it here
      // (api-client imports this module, so the reverse would be a cycle).
      ...Object.fromEntries(
        Object.entries(value).filter(([, v]) => typeof v !== 'function' && v !== undefined),
      ),
    };
  }

  if (value === null || typeof value !== 'object') return value;
  if (depth >= 4) return '[depth limit]';

  if (Array.isArray(value)) {
    // Long arrays are noise in a terminal; the length is the useful part.
    if (value.length > 20) return `[array of ${String(value.length)}]`;
    return value.map((item) => serialise(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'function') continue;
    out[key] = serialise(item, depth + 1);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

const CONSOLE_STYLE: Record<LogLevel, string> = {
  debug: 'color:#8b8b8b',
  info: 'color:#4aa3ff',
  warn: 'color:#e0a030',
  error: 'color:#e05252',
};

function emit(level: LogLevel, scope: string, message: string, data?: unknown): void {
  if (SEVERITY[level] < SEVERITY[threshold]) return;

  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...(data === undefined ? {} : { data: serialise(data) }),
  };

  // Called through `console` rather than pulled into a local: detaching a
  // console method loses its `this` binding in some engines.
  const args: unknown[] = [`%c[${scope}]%c ${message}`, CONSOLE_STYLE[level], ''];
  if (data !== undefined) args.push(data);

  switch (level) {
    case 'debug':
      console.debug(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
  }

  if (import.meta.env.DEV) {
    pending.push(entry);
    scheduleFlush();
  }
}

export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  /** Narrower scope under the same sink, e.g. `api` -> `api:backtests`. */
  child: (childScope: string) => Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, data) => {
      emit('debug', scope, message, data);
    },
    info: (message, data) => {
      emit('info', scope, message, data);
    },
    warn: (message, data) => {
      emit('warn', scope, message, data);
    },
    error: (message, data) => {
      emit('error', scope, message, data);
    },
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}

/* A tab close would otherwise drop whatever is still queued. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    navigator.sendBeacon(TERMINAL_SINK, JSON.stringify(batch));
  });
}
