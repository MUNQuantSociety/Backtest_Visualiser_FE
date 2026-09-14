/// <reference types="vite/client" />

/**
 * Typed `import.meta.env`. Keep in sync with `.env.example` and the Zod schema
 * in `src/config/env.ts` — the schema does the runtime check, this gives editor
 * autocomplete.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_DEV_USER_ID?: string;
  readonly VITE_AUTH_AUTHORITY?: string;
  readonly VITE_AUTH_CLIENT_ID?: string;
  readonly VITE_AUTH_DOMAIN?: string;
  readonly VITE_AUTH_REDIRECT_URI?: string;
  readonly VITE_AUTH_LOGOUT_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
