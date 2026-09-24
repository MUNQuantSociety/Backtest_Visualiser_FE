import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./mock-data', import.meta.url)),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Above src/test/setup.ts's 5 s `findBy*` budget, which alone equals
    // Vitest's 5 s default: a run-form test chains several such waits, and
    // under a parallel run it hit the test timeout at the `it(` line with no
    // clue which step was slow. A missing element still fails, after 5 s.
    testTimeout: 15_000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/**/index.ts',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
    },
  },
});
