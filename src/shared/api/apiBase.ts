// 브라우저와 달리 node·jsdom 의 Request 는 기준 URL 이 없어 상대 경로를 해석하지 못한다.
// 오리진을 붙여 절대 경로로 만든다 — 브라우저에서의 동작은 같다.
export const API_BASE = `${globalThis.location?.origin ?? ''}/api`
