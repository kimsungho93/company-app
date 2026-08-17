import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY, themeStore } from './themeStore'

const setSystemDark = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    setSystemDark(false)
    themeStore.set('system')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('아무것도 고르지 않으면 system 이고 data-theme 속성이 없다', () => {
    expect(themeStore.get()).toBe('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('dark 를 고르면 속성과 localStorage 를 함께 바꾼다', () => {
    themeStore.set('dark')

    expect(themeStore.get()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  // 속성만 지우고 localStorage 를 안 지우면 다음 방문에 되살아난다
  it('system 으로 되돌리면 속성과 저장값이 모두 사라진다', () => {
    themeStore.set('dark')
    themeStore.set('system')

    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('system 일 때 getResolved 는 OS 설정을 따른다', () => {
    setSystemDark(true)
    themeStore.set('system')
    expect(themeStore.getResolved()).toBe('dark')

    setSystemDark(false)
    themeStore.set('system')
    expect(themeStore.getResolved()).toBe('light')
  })

  it('명시적으로 고르면 getResolved 가 OS 설정을 무시한다', () => {
    setSystemDark(true)
    themeStore.set('light')
    expect(themeStore.getResolved()).toBe('light')
  })

  it('구독자에게 변경을 알리고 해제할 수 있다', () => {
    const listener = vi.fn()
    const unsubscribe = themeStore.subscribe(listener)

    themeStore.set('dark')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    themeStore.set('light')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
