import '@testing-library/jest-dom/vitest'

let authLock: Promise<unknown> = Promise.resolve()
Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: {
    request: (_name: string, callback: () => Promise<unknown>) => {
      const next = authLock.then(callback)
      authLock = next.catch(() => undefined)
      return next
    },
  },
})

if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
