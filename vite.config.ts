import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {

    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {

    port: Number(process.env.PORT) || 5173,

    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {

          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
          proxy.on('proxyReqWs', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
