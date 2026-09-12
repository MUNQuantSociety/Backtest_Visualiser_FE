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

import { sanitiseLogData } from '@/lib/log-data';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  /** ISO-8601, stamped on the client so ordering survives batching. */
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
  clientId?: string;
  sequence?: number;
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
let flushing = false;
let deliveryFailures = 0;
let sequence = 0;
const clientId = crypto.randomUUID();
const MAX_PENDING = 500;
// Small batches remain below fetch keepalive's 64 KiB limit, even with UTF-8.
const MAX_BATCH_BYTES = 48 * 1024;
const terminalEnabled = import.meta.env.DEV && import.meta.env.MODE !== 'test';

/**
 * Batched rather than one request per line. A page load emits dozens of
 * entries, and a fetch each would both flood the network panel and reorder
 * them — the queue keeps them in the order they were written.
 */
function scheduleFlush(delay = 200): void {
  if (flushHandle !== null) return;
  flushHandle = window.setTimeout(() => {
    flushHandle = null;
    void flush();
  }, delay);
}

async function flush(): Promise<void> {
  if (flushing || pending.length === 0) return;
  flushing = true;
  const batch: LogEntry[] = [];
  let bytes = 2;
  while (pending.length > 0) {
    const entry = pending[0]!;
    const size = new TextEncoder().encode(JSON.stringify(entry)).length + 1;
    if (batch.length > 0 && bytes + size > MAX_BATCH_BYTES) break;
    batch.push(pending.shift()!);
    bytes += size;
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(TERMINAL_SINK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      // Survives a navigation that happens mid-flush.
      keepalive: bytes <= MAX_BATCH_BYTES,
      signal: controller.signal,
    });
    // A SPA fallback can answer 200 without receiving any logs.
    if (response.status !== 204 || response.headers.get('X-Client-Log-Sink') !== 'ready') {
      throw new Error(
        `Log receiver did not acknowledge delivery (HTTP ${String(response.status)})`,
      );
    }
    if (deliveryFailures > 0)
      console.info('[logging] Terminal delivery restored; queued logs delivered.');
    deliveryFailures = 0;
  } catch (error) {
    deliveryFailures += 1;
    pending.unshift(...batch);
    if (pending.length > MAX_PENDING) {
      const dropped = pending.splice(MAX_PENDING).length;
      console.warn(
        `[logging] Queue full; ${String(dropped)} new entries remain in the browser console only.`,
      );
    }
    // Direct console output avoids recursively sending transport failures.
    if (deliveryFailures === 1) {
      console.warn(
        '[logging] Terminal delivery failed; retaining logs and retrying. Check the Vite server.',
        error,
      );
    }
  } finally {
    window.clearTimeout(timeout);
    flushing = false;
    if (pending.length > 0) scheduleFlush(Math.min(1000 * 2 ** deliveryFailures, 10_000));
  }
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
    clientId,
    sequence: ++sequence,
    ...(data === undefined ? {} : { data: sanitiseLogData(data) }),
  };
  const encodedData = entry.data === undefined ? '' : JSON.stringify(entry.data);
  if (encodedData && new TextEncoder().encode(encodedData).length > 32 * 1024) {
    entry.data = {
      truncated: true,
      preview: encodedData.slice(0, 6000),
      originalCharacters: encodedData.length,
    };
  }

  // Called through `console` rather than pulled into a local: detaching a
  // console method loses its `this` binding in some engines.
  const args: unknown[] = [`%c[${scope}]%c ${message}`, CONSOLE_STYLE[level], ''];
  if (entry.data !== undefined) args.push(entry.data);

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

  if (terminalEnabled) {
    if (pending.length >= MAX_PENDING) {
      console.warn('[logging] Terminal queue full; this entry remains in the browser console.');
      return;
    }
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
if (terminalEnabled && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (pending.length === 0) return;
    // Do not remove entries unless the browser accepts the beacon.
    const body = JSON.stringify(pending);
    if (
      new TextEncoder().encode(body).length <= MAX_BATCH_BYTES &&
      navigator.sendBeacon(TERMINAL_SINK, body)
    ) {
      pending.length = 0;
    }
  });
}
