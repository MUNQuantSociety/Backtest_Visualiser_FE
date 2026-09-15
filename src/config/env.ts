import { z } from 'zod';

/**
 * Validate environment variables once, at module load, instead of scattering
 * `import.meta.env.VITE_...` (typed `string | undefined`) across the codebase.
 * A missing or malformed var fails loudly at startup rather than as a confusing
 * runtime error three screens deep.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api'),
  VITE_API_TIMEOUT: z.coerce.number().int().positive().default(30_000),
  VITE_AUTH_AUTHORITY: z.string().optional(),
  VITE_AUTH_CLIENT_ID: z.string().optional(),
  VITE_AUTH_DOMAIN: z.string().optional(),
  VITE_AUTH_REDIRECT_URI: z.string().optional(),
  VITE_AUTH_LOGOUT_REDIRECT_URI: z.string().optional(),
  VITE_DEV_USER_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.uuid().optional(),
  ),

  /**
   * Start with demo-data panels hidden in local development.
   *
   * Demo panels are a dev aid: visible in dev by default, always hidden in
   * production builds. This flag only additionally seeds the first dev visit
   * with them hidden — the header toggle can still un-hide them. Ignored by
   * production builds. Defer to `VITE_USE_FIXTURES`'s strict bool contract for
   * the same reason: `z.coerce.boolean()` would treat any non-empty string as
   * true.
   */
  VITE_DEV_HIDE_DEMO_PANELS: z
    .preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['true', 'false']).default('false'),
    )
    .transform((value) => value === 'true'),

  /**
   * Serve fixture data instead of calling the API.
   *
   * A stopgap so the MQS Master views are demoable before the backend exists.
   * `z.coerce.boolean()` is deliberately not used — it treats every non-empty
   * string as true, so `VITE_USE_FIXTURES=false` would silently mean *true*.
   * The proper answer is a Prism mock served from the OpenAPI spec; delete this
   * flag once that is running.
   */
  VITE_USE_FIXTURES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse({
  ...import.meta.env,
  // Temporary local ownership is never enabled by a production build.
  VITE_DEV_USER_ID: import.meta.env.DEV ? import.meta.env.VITE_DEV_USER_ID : undefined,
  // Same gate for the demo-panels default: a prod build must not inherit it.
  VITE_DEV_HIDE_DEMO_PANELS: import.meta.env.DEV
    ? (import.meta.env.VITE_DEV_HIDE_DEMO_PANELS as string | undefined)
    : undefined,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
}

export const env = {
  apiBaseUrl: parsed.data.VITE_API_BASE_URL,
  apiTimeout: parsed.data.VITE_API_TIMEOUT,
  devUserId: parsed.data.VITE_DEV_USER_ID,
  devHideDemoPanels: parsed.data.VITE_DEV_HIDE_DEMO_PANELS,
  useFixtures: parsed.data.VITE_USE_FIXTURES,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  auth: {
    authority: parsed.data.VITE_AUTH_AUTHORITY || '',
    clientId: parsed.data.VITE_AUTH_CLIENT_ID || '',
    domain: parsed.data.VITE_AUTH_DOMAIN || '',
    redirectUri: parsed.data.VITE_AUTH_REDIRECT_URI || '',
    logoutRedirectUri: parsed.data.VITE_AUTH_LOGOUT_REDIRECT_URI || '',
  },
} as const;

export type Env = typeof env;
