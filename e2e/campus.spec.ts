import type { Locator, Page } from '@playwright/test'
import { expect, fillLogin, test } from './fixtures/app.ts'

const collectBrowserErrors = (page: Page, allowContextCreationFailure = false) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (
      message.location().url.endsWith('/api/auth/reissue') &&
      text === 'Failed to load resource: the server responded with a status of 401 (Unauthorized)'
    ) {
      return
    }
    if (
      allowContextCreationFailure &&
      /^THREE\.WebGLRenderer: (?:THREE\.WebGLRenderer: )?Error creating WebGL context\.$/.test(text)
    ) {
      return
    }
    errors.push(text)
  })
  return errors
}

const readyCanvas = async (page: Page) => {
  const scene = page.locator('[data-campus-state]')
  await expect(scene).toHaveAttribute('data-campus-state', 'ready')
  const canvas = scene.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(canvas.locator('..')).toHaveCSS('opacity', '1')
  await page.evaluate(() => document.fonts.ready)
  expect(
    await canvas.evaluate((element) => {
      const context = (element as HTMLCanvasElement).getContext('webgl2')
      return !!context && !context.isContextLost() && context.drawingBufferWidth > 0
    }),
    '실제 WebGL 컨텍스트와 그리기 버퍼가 있어야 합니다.',
  ).toBe(true)
  return canvas
}

const captureCanvas = (canvas: Locator) =>
  canvas.screenshot({ animations: 'disabled', caret: 'hide' })

const expectVisiblePixels = async (canvas: Locator) => {
  const visible = await captureCanvas(canvas)
  const hidden = await canvas.screenshot({
    animations: 'disabled',
    caret: 'hide',
    style: '[data-campus-state] canvas { opacity: 0 !important; }',
  })
  expect(visible.equals(hidden), '캔버스를 숨기면 실제 화면 픽셀이 달라져야 합니다.').toBe(false)
}

const expectStaticCanvas = async (page: Page, canvas: Locator) => {
  const before = await captureCanvas(canvas)
  await page.waitForTimeout(400)
  expect((await captureCanvas(canvas)).equals(before), '정지한 장면은 변하지 않아야 합니다.').toBe(
    true,
  )
}

const expectFallback = async (page: Page) => {
  const scene = page.locator('[data-campus-state]')
  await expect(scene).toHaveAttribute('data-campus-state', 'unavailable')
  await expect(scene.locator('svg')).toBeVisible()
  await expect(page.getByRole('button', { name: /배경 애니메이션/ })).toHaveCount(0)
}

const submitLogin = async (page: Page) => {
  await fillLogin(page)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
}

test('실제 캠퍼스 캔버스가 움직이고 일시정지와 재생을 따른다', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/login')
  const canvas = await readyCanvas(page)
  await expectVisiblePixels(canvas)
  const moving = await captureCanvas(canvas)
  await expect.poll(async () => (await captureCanvas(canvas)).equals(moving)).toBe(false)

  await page.getByRole('button', { name: '배경 애니메이션 일시정지' }).click()
  const play = page.getByRole('button', { name: '배경 애니메이션 재생' })
  await expect(play).toBeVisible()
  await expectStaticCanvas(page, canvas)
  const paused = await captureCanvas(canvas)

  await play.click()
  await expect(page.getByRole('button', { name: '배경 애니메이션 일시정지' })).toBeVisible()
  await expect.poll(async () => (await captureCanvas(canvas)).equals(paused)).toBe(false)
  expect(errors).toEqual([])
})

test('동작 줄이기 설정에서는 실제 장면을 정적으로 표시한다', async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  const canvas = await readyCanvas(page)
  await expectVisiblePixels(canvas)
  await expectStaticCanvas(page, canvas)
  await expect(page.getByRole('button', { name: /배경 애니메이션/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('WebGL 생성 실패 시 정적 배경과 로그인 폼을 유지한다', async ({ page, mockApi }) => {
  const errors = collectBrowserErrors(page, true)
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown,
    ) {
      if (contextId.startsWith('webgl') || contextId === 'experimental-webgl') return null
      return Reflect.apply(getContext, this, [contextId, options])
    } as typeof getContext
  })
  await page.goto('/login')
  await expectFallback(page)
  await submitLogin(page)
  expect(mockApi.loginAttempts).toBe(1)
  expect(errors).toEqual([])
})

test('렌더링 중 WebGL 컨텍스트를 잃어도 입력 내용과 로그인 동작을 유지한다', async ({
  page,
  mockApi,
}) => {
  const errors = collectBrowserErrors(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/login')
  const canvas = await readyCanvas(page)
  await fillLogin(page)
  expect(
    await canvas.evaluate((element) => {
      const context = (element as HTMLCanvasElement).getContext('webgl2')
      const extension = context?.getExtension('WEBGL_lose_context')
      extension?.loseContext()
      return !!extension
    }),
    'Chromium의 실제 WebGL 컨텍스트 손실을 주입해야 합니다.',
  ).toBe(true)

  await expectFallback(page)
  await expect(page.getByRole('textbox', { name: '이메일', exact: true })).toHaveValue(
    'browser@example.invalid',
  )
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('browser-test-only')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
  expect(mockApi.loginAttempts).toBe(1)
  expect(errors).toEqual([])
})

test.describe('모바일 캠퍼스 화면', () => {
  test.use({ viewport: { width: 390, height: 660 }, isMobile: true, hasTouch: true })

  test('로그인과 회원가입을 키보드로 탐색하고 화면 밖 배경의 렌더링을 멈춘다', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.addInitScript(() => {
      let clears = 0
      const clear = WebGL2RenderingContext.prototype.clear
      WebGL2RenderingContext.prototype.clear = function (mask) {
        if (
          this.canvas instanceof HTMLCanvasElement &&
          this.canvas.closest('[data-campus-state]')
        ) {
          clears += 1
        }
        clear.call(this, mask)
      }
      Object.defineProperty(window, '__campusClearCount', { get: () => clears })
    })
    const clearCount = () =>
      page.evaluate(() => Reflect.get(window, '__campusClearCount') as number)
    const tabTo = async (target: Locator) => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (await target.evaluate((element) => document.activeElement === element)) break
        await page.keyboard.press('Tab')
      }
      await expect(target).toBeFocused()
      await expect(target).toBeInViewport({ ratio: 1 })
    }
    const expectNoOverflow = async () => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        '390px 화면에 가로 스크롤이 없어야 합니다.',
      ).toBe(true)
    }

    await page.goto('/login')
    await readyCanvas(page)
    await expectNoOverflow()
    const email = page.getByRole('textbox', { name: '이메일', exact: true })
    await tabTo(email)
    await page.keyboard.type('browser@example.invalid')
    const password = page.getByLabel('비밀번호', { exact: true })
    await tabTo(password)
    await page.keyboard.type('browser-test-only')
    await expect(email).toHaveCSS('font-size', '16px')
    await expect(password).toHaveCSS('font-size', '16px')
    await tabTo(page.getByRole('button', { name: '로그인', exact: true }))
    await tabTo(page.getByRole('link', { name: '회원가입하기' }))
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL('/signup')
    await expect(page.getByRole('heading', { name: '계정 만들기' })).toBeVisible()
    await expectNoOverflow()
    for (const [label, value] of [
      ['이메일', 'browser@example.invalid'],
      ['이름', 'Browser User'],
      ['비밀번호', 'browser-test-only'],
      ['비밀번호 확인', 'browser-test-only'],
    ]) {
      const field = page.getByLabel(label, { exact: true })
      await tabTo(field)
      await expect(field).toHaveCSS('font-size', '16px')
      await page.keyboard.type(value)
    }
    await tabTo(page.getByRole('button', { name: '가입하기', exact: true }))
    await tabTo(page.getByRole('link', { name: '로그인하기' }))
    await expect(page.locator('[data-campus-state] canvas')).not.toBeInViewport()
    await page.waitForTimeout(100)
    const offscreen = await clearCount()
    await page.waitForTimeout(400)
    expect(await clearCount(), '화면 밖 캠퍼스는 연속 렌더링을 멈춰야 합니다.').toBe(offscreen)

    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(clearCount).toBeGreaterThan(offscreen)
    await expectNoOverflow()
    expect(errors).toEqual([])
  })
})
