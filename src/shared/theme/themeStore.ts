export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

export const THEME_STORAGE_KEY = 'ibs.theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

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
  } catch {}
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

try {
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (preference === 'system') listeners.forEach((listener) => listener())
  })
} catch {}
