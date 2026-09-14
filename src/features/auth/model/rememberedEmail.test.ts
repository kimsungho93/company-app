import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearRememberedEmail,
  loadRememberedEmail,
  saveRememberedEmail,
} from './rememberedEmail'

describe('rememberedEmail', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('저장한 이메일을 그대로 돌려준다', () => {
    saveRememberedEmail('tiger@ibslab.com')
    expect(loadRememberedEmail()).toBe('tiger@ibslab.com')
  })

  it('저장된 값이 없으면 null 이다', () => {
    expect(loadRememberedEmail()).toBeNull()
  })

  it('지우면 null 로 돌아간다', () => {
    saveRememberedEmail('tiger@ibslab.com')
    clearRememberedEmail()
    expect(loadRememberedEmail()).toBeNull()
  })

  it('스토리지가 막혀 있어도 던지지 않는다', () => {
    const boom = () => {
      throw new Error('SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)

    expect(() => saveRememberedEmail('tiger@ibslab.com')).not.toThrow()
    expect(() => clearRememberedEmail()).not.toThrow()
    expect(loadRememberedEmail()).toBeNull()
  })
})
