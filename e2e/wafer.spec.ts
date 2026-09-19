import { expect, fillLogin, test } from './fixtures/app.ts'
import type { Locator, Page } from '@playwright/test'

const readyWafer = async (page: Page) => {
  const canvas = page.locator('main canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const canvas = element as HTMLCanvasElement
        const context = canvas.getContext('2d')
        if (!context || !canvas.width || !canvas.height) return false
        return context
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((value, index) => index % 4 === 3 && value > 0)
      }),
    )
    .toBe(true)
  return canvas
}

test('웨이퍼를 그린 뒤 인트로 완료를 기억하고 다시 방문해도 로그인할 수 있다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/login')
  await readyWafer(page)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('ibs.intro.seen'))).toBe('1')
  await page.reload()
  await readyWafer(page)
  await expect(page.getByRole('heading', { name: /IBS 다시 만나서 반가워요/ })).toBeVisible()
  await fillLogin(page)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
  expect(errors).toEqual([])
})

test('동작 줄이기에서 정적 웨이퍼를 표시하고 회원가입과 캔버스를 공유한다', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  const canvas = await readyWafer(page)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('ibs.intro.seen'))).toBe('1')
  const before = await canvas.screenshot()
  await page.waitForTimeout(300)
  expect((await canvas.screenshot()).equals(before)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('wafer-desktop.png'), fullPage: true })
  await canvas.evaluate((element) => element.setAttribute('data-reuse-marker', 'original'))
  await page.getByRole('link', { name: '회원가입하기' }).click()
  await expect(page.getByRole('heading', { name: '계정 만들기' })).toBeVisible()
  await expect(page.locator('main canvas')).toHaveAttribute('data-reuse-marker', 'original')
  await expect(page.locator('main canvas')).toHaveCount(1)
})

test('Canvas 2D를 사용할 수 없어도 로그인 폼이 동작한다', async ({ page, mockApi }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown,
    ) {
      if (contextId === '2d') return null
      return Reflect.apply(original, this, [contextId, options])
    } as typeof original
  })
  await page.goto('/login')
  await fillLogin(page)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
  expect(mockApi.loginAttempts).toBe(1)
  expect(errors).toEqual([])
})

test.describe('모바일 웨이퍼 화면', () => {
  test.use({ viewport: { width: 390, height: 660 }, isMobile: true, hasTouch: true })

  test('웨이퍼와 폼이 넘치지 않고 키보드로 로그인과 회원가입을 탐색한다', async ({
    page,
  }, testInfo) => {
    const tabTo = async (target: Locator) => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (await target.evaluate((element) => document.activeElement === element)) break
        await page.keyboard.press('Tab')
      }
      await expect(target).toBeFocused()
      await expect(target).toBeInViewport({ ratio: 1 })
    }
    await page.goto('/login')
    await readyWafer(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const email = page.getByRole('textbox', { name: '이메일', exact: true })
    await tabTo(email)
    await page.keyboard.type('browser@example.invalid')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: '비밀번호 찾기' })).toBeFocused()
    await page.keyboard.press('Tab')
    const password = page.getByLabel('비밀번호', { exact: true })
    await expect(password).toBeFocused()
    await page.keyboard.type('browser-test-only')
    await expect(password).toBeInViewport()
    await expect(password).toHaveCSS('font-size', '16px')
    await expect(email).toHaveCSS('font-size', '16px')
    await tabTo(page.getByRole('button', { name: '로그인', exact: true }))
    await tabTo(page.getByRole('link', { name: '회원가입하기' }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/signup')
    await expect(page.getByRole('heading', { name: '계정 만들기' })).toBeVisible()
    await readyWafer(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
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
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/login')
    await readyWafer(page)
    await page.screenshot({ path: testInfo.outputPath('wafer-mobile.png'), fullPage: true })
  })
})
