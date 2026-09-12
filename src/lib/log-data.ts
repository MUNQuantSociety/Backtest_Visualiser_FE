/** Keep diagnostic context useful without copying credentials into logs. */
const SECRET_KEY = /password|passphrase|token|secret|authorization|cookie|api[-_]?key|credential/i;

export function sanitiseLogUrl(value: string): string {
  try {
    const url = new URL(value, 'http://log.local');
    for (const key of url.searchParams.keys()) {
      if (SECRET_KEY.test(key)) url.searchParams.set(key, '[redacted]');
    }
    url.username = '';
    url.password = '';
    url.hash = '';
    return value.startsWith('/') ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return '[invalid URL]';
  }
}

export function sanitiseLogData(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  if (typeof value === 'string') {
    return value.length > 6000
      ? `${value.slice(0, 6000)}… [${String(value.length)} characters]`
      : value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  if (depth >= 8) return '[depth limit]';
  seen.add(value);
  try {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof URLSearchParams)
      return sanitiseLogData(Object.fromEntries(value), depth + 1, seen);
    if (Array.isArray(value)) {
      const items = value.slice(0, 100).map((item) => sanitiseLogData(item, depth + 1, seen));
      if (value.length > 100) items.push(`[${String(value.length - 100)} more items]`);
      return items;
    }
    const fields: Record<string, unknown> =
      value instanceof Error
        ? { ...value, name: value.name, message: value.message, stack: value.stack }
        : Object.fromEntries(Object.entries(value));
    return Object.fromEntries(
      Object.entries(fields).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : sanitiseLogData(item, depth + 1, seen),
      ]),
    );
  } catch {
    return '[unserialisable value]';
  } finally {
    seen.delete(value);
  }
}
