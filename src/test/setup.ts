import '@testing-library/jest-dom/vitest'

// jsdom 29 는 <dialog> 의 showModal/close 를 구현하지 않는다.
// 모달의 실제 동작(포커스 트랩·Escape·top layer·::backdrop)은 브라우저가 하는 일이라
// 우리가 테스트할 대상이 아니다. open 상태만 맞춰주면 렌더 결과를 검증할 수 있다.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
