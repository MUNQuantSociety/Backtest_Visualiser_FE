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
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

export type Env = typeof env;
