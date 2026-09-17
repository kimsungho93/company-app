import { test as base, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const TEST_USER = {
  id: 101,
  email: 'browser@example.invalid',
  name: '브라우저 테스트 사용자',
  role: 'USER',
  status: 'APPROVED',
}
const TEST_PASSWORD = 'browser-test-only'

interface MockApi {
  loginAttempts: number
  reissueAttempts: number
  logoutAttempts: number
  failNextLogin: () => void
}

export const test = base.extend<{ mockApi: MockApi }>({
  mockApi: [
    async ({ context, baseURL }, use) => {
      let authenticated = false
      let accessToken = ''
      let failLogin = false
      const unexpectedRequests: string[] = []
      const api: MockApi = {
        loginAttempts: 0,
        reissueAttempts: 0,
        logoutAttempts: 0,
        failNextLogin: () => {
          failLogin = true
        },
      }

      const session = () => {
        const now = Date.now()
        return {
          sessionId: 'browser-test-session',
          serverTime: new Date(now).toISOString(),
          idleExpiresAt: new Date(now + 30 * 60_000).toISOString(),
          absoluteExpiresAt: new Date(now + 8 * 60 * 60_000).toISOString(),
        }
      }

      const rejectUnexpected = async (route: Route, reason: string) => {
        unexpectedRequests.push(reason)
        await route.abort('blockedbyclient')
        throw new Error(reason)
      }

      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const key = `${request.method()} ${url.pathname}`

        if (url.origin !== baseURL) {
          await rejectUnexpected(route, `예상하지 않은 외부 요청: ${key}`)
          return
        }

        if (!url.pathname.startsWith('/api/')) {
          if (request.method() !== 'GET' || ['fetch', 'xhr'].includes(request.resourceType())) {
            await rejectUnexpected(route, `예상하지 않은 요청: ${key}`)
            return
          }
          await route.continue()
          return
        }

        if (url.search) {
          await rejectUnexpected(route, `예상하지 않은 API 쿼리: ${key}`)
          return
        }

        if (key === 'POST /api/auth/reissue') {
          api.reissueAttempts += 1
          if (!authenticated) {
            await route.fulfill({
              status: 401,
              json: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' },
            })
            return
          }
          accessToken = `browser-test-reissue-${api.reissueAttempts}`
          await route.fulfill({ json: { ...session(), accessToken, expiresIn: 300 } })
          return
        }

        if (key === 'POST /api/auth/login') {
          api.loginAttempts += 1
          expect(request.postDataJSON()).toEqual({
            email: TEST_USER.email,
            password: TEST_PASSWORD,
          })
          if (failLogin) {
            failLogin = false
            await route.abort('connectionrefused')
            return
          }
          authenticated = true
          accessToken = 'browser-test-login'
          await route.fulfill({ json: { ...session(), accessToken, expiresIn: 300 } })
          return
        }

        if (key === 'POST /api/auth/logout') {
          api.logoutAttempts += 1
          authenticated = false
          accessToken = ''
          await route.fulfill({ status: 204 })
          return
        }

        const protectedEndpoints = [
          'GET /api/users/me',
          'GET /api/rooms',
          'GET /api/auth/session',
          'POST /api/auth/session/activity',
        ]
        if (!protectedEndpoints.includes(key)) {
          await rejectUnexpected(route, `예상하지 않은 API 요청: ${key}`)
          return
        }

        expect(authenticated, `${key}: 로그인 뒤에 요청해야 합니다.`).toBe(true)
        expect(request.headers().authorization, `${key}: 현재 발급한 토큰을 사용해야 합니다.`).toBe(
          `Bearer ${accessToken}`,
        )
        await route.fulfill({
          json: key === 'GET /api/users/me' ? TEST_USER : key === 'GET /api/rooms' ? [] : session(),
        })
      })

      await context.routeWebSocket('**/*', async (socket) => {
        const path = new URL(socket.url()).pathname
        const reason = `예상하지 않은 WebSocket 연결: ${path}`
        unexpectedRequests.push(reason)
        await socket.close()
        throw new Error(reason)
      })

      await use(api)
      expect(
        unexpectedRequests,
        '모든 API 요청은 테스트의 명시적 mock으로 처리해야 합니다.',
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export const fillLogin = async (page: Page) => {
  await page.getByRole('textbox', { name: '이메일', exact: true }).fill(TEST_USER.email)
  await page.getByLabel('비밀번호', { exact: true }).fill(TEST_PASSWORD)
}

export const login = async (page: Page) => {
  await page.goto('/login')
  await fillLogin(page)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
}
