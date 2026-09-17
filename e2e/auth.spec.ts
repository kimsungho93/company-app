import { expect, fillLogin, login, test } from './fixtures/app.ts'

test('로그인한 사용자는 새로고침 뒤 mock 재발급으로 홈을 계속 이용한다', async ({
  page,
  mockApi,
}) => {
  await login(page)
  await expect(page.getByText('브라우저 테스트 사용자', { exact: true })).toBeVisible()
  const reissuesBeforeReload = mockApi.reissueAttempts

  await page.reload()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
  await expect(page.getByText('브라우저 테스트 사용자', { exact: true })).toBeVisible()
  expect(mockApi.reissueAttempts).toBe(reissuesBeforeReload + 1)
  expect(mockApi.loginAttempts).toBe(1)
})

test('로그인 네트워크 실패 뒤 같은 폼에서 다시 제출할 수 있다', async ({ page, mockApi }) => {
  mockApi.failNextLogin()
  await page.goto('/login')
  await fillLogin(page)
  const submit = page.getByRole('button', { name: '로그인', exact: true })

  await submit.click()

  await expect(page.getByRole('alert')).toHaveText('네트워크에 연결할 수 없습니다.')
  await expect(page).toHaveURL('/login')
  await expect(submit).toBeEnabled()
  await expect(page.getByRole('textbox', { name: '이메일', exact: true })).toHaveValue(
    'browser@example.invalid',
  )

  await submit.click()

  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(mockApi.loginAttempts).toBe(2)
})
