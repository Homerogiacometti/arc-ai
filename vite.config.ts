/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Fluxos de UI completos (digitação, várias telas) passam de 5 s com a suíte em paralelo.
    testTimeout: 15_000,
  },
});
