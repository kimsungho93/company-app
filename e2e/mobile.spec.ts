import { expect, login, test } from './fixtures/app.ts'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('모바일 폭에서 테마 전환, 메뉴 이동, Dialog와 로그아웃을 조작할 수 있다', async ({
  page,
  mockApi,
}) => {
  await login(page)
  await page.getByRole('button', { name: '다크 모드로 전환' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: '라이트 모드로 전환' })).toBeInViewport({
    ratio: 1,
  })

  await page.getByRole('button', { name: '게임', exact: true }).tap()
  const roomsLink = page.getByRole('link', { name: '끝말잇기', exact: true })
  await expect(roomsLink).toBeInViewport({ ratio: 1 })
  await roomsLink.tap()
  await expect(page.getByRole('heading', { name: '끝말잇기', exact: true })).toBeVisible()
  const create = page.getByRole('button', { name: '방 만들기', exact: true })
  await expect(create).toBeInViewport({ ratio: 1 })
  await create.tap()

  const createDialog = page.getByRole('dialog', { name: '방 만들기', exact: true })
  await expect(createDialog.getByRole('textbox', { name: '방 이름', exact: true })).toBeInViewport({
    ratio: 1,
  })
  await createDialog.getByRole('button', { name: '취소', exact: true }).tap()
  await expect(createDialog).not.toBeVisible()
  await page.getByRole('button', { name: '라이트 모드로 전환' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  const logout = page.getByRole('button', { name: '로그아웃', exact: true })
  await expect(logout).toBeInViewport({ ratio: 1 })
  await logout.tap()
  await page
    .getByRole('dialog', { name: '로그아웃하시겠습니까?' })
    .getByRole('button', { name: '로그아웃', exact: true })
    .tap()

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible()
  await expect.poll(() => mockApi.logoutAttempts).toBe(1)
})
