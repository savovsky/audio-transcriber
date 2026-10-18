import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const API_PORT = 3001;

export default defineConfig({
  base: '/',
  // server - local dev only config
  server: {
    port: 3000,
    open: true,
    host: true,
    proxy: {
      // Fastify binds 127.0.0.1 explicitly — target it directly so Node never
      // wastes an attempt on IPv6 ::1 (localhost resolves to ::1 first on Windows).
      '/api': `http://127.0.0.1:${API_PORT}`,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(currentDir, './src'),
      shared: resolve(currentDir, '../shared/src/index.ts'),
    },
  },
});
