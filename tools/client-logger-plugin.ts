import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { inspect } from 'node:util';

import type { Plugin, ViteDevServer } from 'vite';

import { sanitiseLogData, sanitiseLogUrl } from '../src/lib/log-data';

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
  clientId?: string;
  sequence?: number;
}

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

/** Include the full UTC timestamp so terminal history is unambiguous. */
function clockTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toISOString();
}

function formatData(data: unknown): string {
  if (data === undefined) return '';
  try {
    const json = JSON.stringify(sanitiseLogData(data));
    if (json === undefined) return '';
    // Keep one entry to one line so the terminal stays greppable.
    return json;
  } catch {
    // `String(obj)` would render '[object Object]' and tell us nothing;
    // `inspect` still shows the shape when the value will not serialise.
    return inspect(data, { depth: 2, breakLength: Infinity });
  }
}

function print(server: ViteDevServer, entry: LogEntry, origin = 'client'): string {
  const level = entry.level.toUpperCase().padEnd(5);
  const data = formatData(entry.data);

  const rawLine =
    `${clockTime(entry.time)} ` +
    `${level} ` +
    `[${origin}:${entry.scope}] ` +
    entry.message +
    (data ? ` ${data}` : '');
  // Escape control characters so one entry cannot forge terminal lines.
  const line = Array.from(rawLine, (char) =>
    char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
      ? JSON.stringify(char).slice(1, -1)
      : char,
  ).join('');

  // Vite's logger rather than console.log, so these interleave correctly with
  // Vite's own output instead of fighting its screen clearing.
  if (entry.level === 'error') {
    server.config.logger.error(line, { timestamp: false });
  } else if (entry.level === 'warn') {
    server.config.logger.warn(line, { timestamp: false });
  } else {
    server.config.logger.info(line, { timestamp: false });
  }
  return line;
}

export function clientLoggerPlugin(): Plugin {
  return {
    name: 'mqs:client-logger',
    apply: 'serve',
    config: () => ({ clearScreen: false }),

    configureServer(server) {
      const logFile = resolve(server.config.root, 'logs/dev.log');
      const delivered = new Set<string>();
      const timers = new Set<ReturnType<typeof setInterval>>();
      let fileWarning = false;
      function write(entry: LogEntry, origin = 'client') {
        const line = print(server, entry, origin);
        try {
          mkdirSync(dirname(logFile), { recursive: true });
          appendFileSync(logFile, `${line}\n`, 'utf8');
        } catch (error) {
          if (!fileWarning)
            server.config.logger.warn(`[logging] Cannot append ${logFile}: ${String(error)}`);
          fileWarning = true;
        }
      }
      function log(level: LogLevel, scope: string, message: string, data?: unknown) {
        write({ time: new Date().toISOString(), level, scope, message, data }, 'server');
      }
      const proxy = server.config.server.proxy?.['/api'];
      const target = typeof proxy === 'string' ? proxy : proxy?.target;
      log('info', 'logging', 'terminal logging ready', {
        pid: process.pid,
        receiver: ROUTE,
        logFile,
        timestamps: 'UTC',
        apiProxyTarget:
          typeof target === 'string'
            ? sanitiseLogUrl(target)
            : target
              ? 'configured target object'
              : 'not configured',
      });

      // Visible even when browser log forwarding is unavailable.
      server.middlewares.use((req, res, next) => {
        if (!req.url || !/^\/api(?:\/|\?|$)/.test(req.url)) return next();
        const startedAt = performance.now();
        const header = req.headers['x-client-request-id'];
        const requestId = typeof header === 'string' ? header.slice(0, 100) : randomUUID();
        const context = { requestId, method: req.method, url: sanitiseLogUrl(req.url) };
        const elapsed = () => Math.round(performance.now() - startedAt);
        log('info', 'api', 'request received by dev proxy', context);
        const timer = setInterval(() => {
          log('warn', 'api', 'still waiting for the API response to finish', {
            ...context,
            ms: elapsed(),
          });
        }, 5000);
        timer.unref();
        timers.add(timer);
        let finished = false;
        function finish(disconnected: boolean) {
          if (finished) return;
          finished = true;
          clearInterval(timer);
          timers.delete(timer);
          log(
            disconnected || res.statusCode >= 400 ? 'warn' : 'info',
            'api',
            disconnected
              ? 'client disconnected before response completed'
              : 'response sent to client',
            { ...context, ms: elapsed(), status: disconnected ? null : res.statusCode },
          );
        }
        res.once('finish', () => finish(false));
        res.once('close', () => finish(!res.writableFinished));
        next();
      });
      server.httpServer?.once('close', () => {
        for (const timer of timers) clearInterval(timer);
      });

      server.middlewares.use(ROUTE, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        let aborted = false;

        req.on('data', (chunk: Buffer) => {
          if (aborted) return;
          bytes += chunk.length;
          if (bytes > MAX_BODY_BYTES) {
            aborted = true;
            res.statusCode = 413;
            res.end();
            log('warn', 'logging', 'rejected oversized browser log batch', { bytes });
          } else chunks.push(chunk);
        });
        req.on('error', (error) => log('warn', 'logging', 'browser log upload failed', { error }));

        req.on('end', () => {
          if (aborted) return;

          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
            if (!entries.every(isLogEntry)) throw new Error('Invalid log entry shape');
            for (const entry of entries) {
              // Anything reaching this route is untrusted input from the page,
              // so shape-check before formatting rather than trusting it.
              const id =
                typeof entry.clientId === 'string' && typeof entry.sequence === 'number'
                  ? `${entry.clientId}:${String(entry.sequence)}`
                  : null;
              if (id && delivered.has(id)) continue;
              write(entry);
              if (id) delivered.add(id);
            }
            while (delivered.size > 10_000) delivered.delete(delivered.values().next().value!);
            res.setHeader('X-Client-Log-Sink', 'ready');
            res.statusCode = 204;
          } catch (error) {
            log('warn', 'logging', 'rejected malformed browser log batch', { error });
            res.statusCode = 400;
          }

          res.end();
        });
      });
    },
  };
}
