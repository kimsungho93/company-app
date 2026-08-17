export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

export const THEME_STORAGE_KEY = 'ibs.theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

// 시크릿 모드나 저장소 차단 환경에서 localStorage 접근은 throw 한다.
// 테마 때문에 앱이 죽으면 안 되므로 전부 감싼다.
const readStored = (): ThemePreference => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

const writeStored = (next: ThemePreference): void => {
  try {
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // 저장에 실패해도 이번 세션에서는 동작한다
  }
}

const applyToDom = (next: ThemePreference): void => {
  const root = document.documentElement
  if (next === 'system') delete root.dataset.theme
  else root.dataset.theme = next
}

const systemPrefersDark = (): boolean => {
  try {
    return window.matchMedia(DARK_QUERY).matches
  } catch {
    return false
  }
}

let preference: ThemePreference = readStored()

export const themeStore = {
  get: (): ThemePreference => preference,

  getResolved: (): Theme =>
    preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference,

  set: (next: ThemePreference): void => {
    preference = next
    writeStored(next)
    applyToDom(next)
    listeners.forEach((listener) => listener())
  },

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

// system 을 고른 상태에서 OS 테마가 바뀌면 CSS 는 미디어 쿼리로 알아서 따라가지만
// 토글 아이콘은 그대로 남는다. 그 아이콘을 갱신하려고 구독한다.
try {
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (preference === 'system') listeners.forEach((listener) => listener())
  })
} catch {
  // matchMedia 가 없는 환경에서는 건너뛴다
}
