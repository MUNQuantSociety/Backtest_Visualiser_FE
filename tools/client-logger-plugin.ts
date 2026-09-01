import { inspect } from 'node:util';

import type { Plugin, ViteDevServer } from 'vite';

/**
 * Prints browser-side log entries in the dev-server terminal.
 *
 * A Vite SPA logs to the browser console, which means the terminal running
 * `npm run dev` shows nothing about what the app did — only Vite's own output
 * and proxy errors. This receives the batches posted by `src/lib/logger.ts` and
 * writes them out, so one terminal carries both sides.
 *
 * Dev only (`apply: 'serve'`): the route does not exist in a production build,
 * and the client only ships entries when `import.meta.env.DEV` is true.
 */

/** Must match `TERMINAL_SINK` in `src/lib/logger.ts`. */
const ROUTE = '/__client-log';

/** Refuse absurd payloads rather than buffering them into memory. */
const MAX_BODY_BYTES = 512 * 1024;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

const RESET = '[0m';
const DIM = '[2m';
const LEVEL_COLOUR: Record<LogLevel, string> = {
  debug: '[90m',
  info: '[36m',
  warn: '[33m',
  error: '[31m',
};

const LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);

function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['time'] === 'string' &&
    typeof candidate['scope'] === 'string' &&
    typeof candidate['message'] === 'string' &&
    typeof candidate['level'] === 'string' &&
    LEVELS.has(candidate['level'] as LogLevel)
  );
}

/** `2026-08-16T19:41:02.123Z` -> `19:41:02.123`, which is all a tail needs. */
function clockTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toISOString().slice(11, 23);
}

function formatData(data: unknown): string {
  if (data === undefined) return '';
  try {
    const json = JSON.stringify(data);
    if (json === undefined) return '';
    // Keep one entry to one line so the terminal stays greppable.
    return json.length > 500 ? `${json.slice(0, 500)}…` : json;
  } catch {
    // `String(obj)` would render '[object Object]' and tell us nothing;
    // `inspect` still shows the shape when the value will not serialise.
    return inspect(data, { depth: 2, breakLength: Infinity });
  }
}

function print(server: ViteDevServer, entry: LogEntry): void {
  const colour = LEVEL_COLOUR[entry.level];
  const level = entry.level.toUpperCase().padEnd(5);
  const data = formatData(entry.data);

  const line =
    `${DIM}${clockTime(entry.time)}${RESET} ` +
    `${colour}${level}${RESET} ` +
    `${DIM}[client:${entry.scope}]${RESET} ` +
    entry.message +
    (data ? ` ${DIM}${data}${RESET}` : '');

  // Vite's logger rather than console.log, so these interleave correctly with
  // Vite's own output instead of fighting its screen clearing.
  if (entry.level === 'error') {
    server.config.logger.error(line, { timestamp: false });
  } else if (entry.level === 'warn') {
    server.config.logger.warn(line, { timestamp: false });
  } else {
    server.config.logger.info(line, { timestamp: false });
  }
}

export function clientLoggerPlugin(): Plugin {
  return {
    name: 'mqs:client-logger',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use(ROUTE, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        let body = '';
        let aborted = false;

        req.on('data', (chunk: Buffer | string) => {
          if (aborted) return;
          body += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
          if (body.length > MAX_BODY_BYTES) {
            aborted = true;
            res.statusCode = 413;
            res.end();
          }
        });

        req.on('end', () => {
          if (aborted) return;

          try {
            const parsed: unknown = JSON.parse(body);
            const entries = Array.isArray(parsed) ? parsed : [parsed];
            for (const entry of entries) {
              // Anything reaching this route is untrusted input from the page,
              // so shape-check before formatting rather than trusting it.
              if (isLogEntry(entry)) print(server, entry);
            }
          } catch {
            // Malformed batch: drop it. Never crash the dev server over a log.
          }

          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}
