import { fileURLToPath, URL } from 'node:url'
// vitest 의 defineConfig 는 vite 것을 확장한다. `test` 키를 쓰려면 이쪽이어야 한다.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // tsconfig.app.json 의 paths 와 반드시 같이 유지할 것.
    // 여기는 번들러용, 저쪽은 타입 검사·에디터용이라 한쪽만 고치면 어긋난다.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 옆 프로젝트들이 5173 을 쓰고 있을 수 있어 PORT 로 넘겨받을 수 있게 열어둔다.
    port: Number(process.env.PORT) || 5173,
    // 같은 오리진으로 만들어 쿠키 SameSite 와 CORS preflight 문제를 없앤다.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          // changeOrigin 은 Host 만 바꾸고 Origin 은 그대로 넘긴다. 그러면 백엔드가
          // CORS 검사를 하는데, 허용 목록이 5173 고정이라 다른 포트에서 403 이 난다.
          // 브라우저 입장에서는 이미 같은 오리진이므로 헤더를 지워 CORS 판정을 없앤다.
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
