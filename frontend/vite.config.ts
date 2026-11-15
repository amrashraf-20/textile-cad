import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const apiTarget =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.API_PROXY_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/healthz': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/healthz': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
})
