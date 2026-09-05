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

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
}

export const env = {
  apiBaseUrl: parsed.data.VITE_API_BASE_URL,
  apiTimeout: parsed.data.VITE_API_TIMEOUT,
  useFixtures: parsed.data.VITE_USE_FIXTURES,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

export type Env = typeof env;
