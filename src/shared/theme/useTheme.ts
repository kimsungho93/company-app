import { useSyncExternalStore } from 'react'
import { themeStore } from './themeStore'
import type { Theme, ThemePreference } from './themeStore'

export interface UseThemeResult {
  preference: ThemePreference
  resolved: Theme
  setPreference: (next: ThemePreference) => void
}

export const useTheme = (): UseThemeResult => {
  const preference = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.get)
  const resolved = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getResolved,
    themeStore.getResolved,
  )

  return { preference, resolved, setPreference: themeStore.set }
}
