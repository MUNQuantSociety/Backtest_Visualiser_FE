import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { env } from '@/config/env';
import { createLogger } from '@/lib/logger';

import './app/styles.css';

const log = createLogger('boot');

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing from index.html');
}

// The resolved config, once, at startup — so a run that behaves oddly can be
// tied to what it was pointed at without guessing which .env file won.
log.info('starting app', {
  mode: import.meta.env.MODE,
  apiBaseUrl: env.apiBaseUrl,
  apiTimeout: env.apiTimeout,
  useFixtures: env.useFixtures,
});

// Anything that escapes a React error boundary — an async throw, a listener,
// a rejected promise nobody awaited — would otherwise only reach the console.
window.addEventListener('error', (event) => {
  log.error('uncaught error', { message: event.message, source: event.filename });
});

window.addEventListener('unhandledrejection', (event) => {
  // `event.reason` is `any` and may be anything at all — a string, an object,
  // an Error. Widen first so it is serialised rather than spread.
  const reason: unknown = event.reason;
  log.error('unhandled promise rejection', { reason });
});

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
