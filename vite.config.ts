import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { clientLoggerPlugin } from './tools/client-logger-plugin';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Only VITE_-prefixed vars are exposed to the client; loadEnv here is used
  // for build-time config (like the dev proxy target) that must not be inlined.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), clientLoggerPlugin()],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Demo dataset at the repo root. Aliased so the import reads as a
        // data source rather than a relative crawl out of src/.
        '@data': fileURLToPath(new URL('./mock-data', import.meta.url)),
      },
    },

    server: {
      // Honour a PORT assigned by the launcher (tooling that picks a free port
      // sets it), falling back to Vite's default. Read from process.env rather
      // than loadEnv so an injected port always beats a stale .env value.
      port: Number(process.env.PORT) || 5173,
      strictPort: false,
      // Proxy API calls in dev so the browser sees a same-origin URL and you
      // avoid CORS entirely. In production the app talks to VITE_API_BASE_URL.
      proxy: {
        '/api': {
          target: env.DEV_API_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    preview: {
      port: Number(process.env.PORT) || 4173,
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Charting libraries are heavy — split them out so the app shell and
      // the vendor chart code cache independently.
      rollupOptions: {
        output: {
          manualChunks(id) {
            // The demo dataset is ~570 KB of JSON behind a dynamic import. Left
            // to default chunking it gets folded into the backtests feature
            // chunk, which the dashboard loads on first paint — so every user
            // would download it even though only the offline fallback and
            // VITE_USE_FIXTURES ever read it. Its own chunk means it is fetched
            // only when something actually asks for it.
            if (id.includes('mock-data')) return 'mock-data';
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            // Kept apart from Recharts: lightweight-charts is ~50 kB while
            // Recharts drags in the d3 family, so a page needing only price
            // series should not download both.
            if (/[\\/]lightweight-charts[\\/]/.test(id)) return 'vendor-charts-financial';
            if (/[\\/](recharts|d3-[^\\/]+|victory-[^\\/]+)[\\/]/.test(id)) {
              return 'vendor-charts-statistical';
            }
            if (/[\\/](@tanstack|axios)[\\/]/.test(id)) return 'vendor-query';
            return undefined;
          },
        },
      },
    },
  };
});
