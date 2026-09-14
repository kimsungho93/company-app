

const KEY = 'ibs.auth.rememberedEmail'

export const loadRememberedEmail = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const saveRememberedEmail = (email: string): void => {
  try {
    localStorage.setItem(KEY, email)
  } catch {
    return
  }
}

export const clearRememberedEmail = (): void => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    return
  }
}
