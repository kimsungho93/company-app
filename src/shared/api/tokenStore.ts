// localStorage·sessionStorage 에 쓰지 않는다. XSS 로 스크립트가 주입되면 통째로 유출된다.
// 새로고침하면 사라지고, 그때는 refresh 쿠키로 재발급받아 복구한다.
let accessToken: string | null = null

export const tokenStore = {
  get(): string | null {
    return accessToken
  },
  set(token: string | null): void {
    accessToken = token
  },
  clear(): void {
    accessToken = null
  },
}
