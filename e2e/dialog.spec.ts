import { expect, login, test } from './fixtures/app.ts'

test('방 만들기 Dialog는 양방향 키보드 이동과 Escape 뒤 실행 버튼의 포커스 복귀를 지원한다', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('button', { name: '게임', exact: true }).press('Enter')
  await page.getByRole('link', { name: '끝말잇기', exact: true }).click()
  await expect(page.getByText('아직 만들어진 방이 없습니다.')).toBeVisible()
  const trigger = page.getByRole('button', { name: '방 만들기', exact: true })

  await trigger.press('Enter')

  const dialog = page.getByRole('dialog', { name: '방 만들기', exact: true })
  const name = dialog.getByRole('textbox', { name: '방 이름', exact: true })
  const password = dialog.getByLabel('비밀번호', { exact: true })
  const revealPassword = dialog.getByRole('button', { name: '비밀번호 표시', exact: true })
  const cancel = dialog.getByRole('button', { name: '취소', exact: true })
  const submit = dialog.getByRole('button', { name: '만들기', exact: true })
  await expect(dialog).toBeVisible()
  await expect(name).toBeFocused()

  for (const control of [password, revealPassword, cancel, submit]) {
    await page.keyboard.press('Tab')
    await expect(control).toBeFocused()
  }

  for (const control of [cancel, revealPassword, password, name]) {
    await page.keyboard.press('Shift+Tab')
    await expect(control).toBeFocused()
  }

  await page.keyboard.press('Shift+Tab')
  await expect
    .poll(
      () =>
        dialog.evaluate((element) => {
          const active = element.ownerDocument.activeElement
          return active === element.ownerDocument.body || element.contains(active)
        }),
      '열린 모달에서 배경 페이지의 요소로 포커스가 이동하지 않아야 합니다.',
    )
    .toBe(true)

  await name.click()
  await expect(name).toBeFocused()
  await name.fill('키보드 테스트 방')
  await page.keyboard.press('Escape')

  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()

  await page.keyboard.press('Enter')

  await expect(dialog).toBeVisible()
  await expect(name).toHaveValue('')
  await dialog.getByRole('button', { name: '취소', exact: true }).press('Enter')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})
