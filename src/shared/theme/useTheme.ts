import { useSyncExternalStore } from 'react'
import { themeStore } from './themeStore'
import type { Theme, ThemePreference } from './themeStore'

export interface UseThemeResult {
  preference: ThemePreference
  resolved: Theme
  setPreference: (next: ThemePreference) => void
}

// 테마는 리액트 밖(DOM 속성 + localStorage)에 산다.
// useSyncExternalStore 가 정확히 그런 상태를 구독하기 위한 훅이다.
export const useTheme = (): UseThemeResult => {
  const preference = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.get)
  const resolved = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getResolved,
    themeStore.getResolved,
  )

  return { preference, resolved, setPreference: themeStore.set }
}
