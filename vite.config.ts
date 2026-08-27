import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Only VITE_-prefixed vars are exposed to the client; loadEnv here is used
    // for build-time config (like the dev proxy target) that must not be inlined.
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [react(), tailwindcss()],

        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
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
                        if (!id.includes('node_modules')) return undefined;
                        if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
                            return 'vendor-react';
                        }
                        // Kept apart from Recharts: lightweight-charts is ~50 kB while
                        // Recharts drags in the d3 family, so a page needing only price
                        // series should not download both.
                        if (/[\\/]lightweight-charts[\\/]/.test(id))
                            return 'vendor-charts-financial';
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
