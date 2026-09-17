---
paths:
  - "src/shared/api/**"
  - "src/features/auth/**"
  - "src/features/admin/**"
  - "src/app/**"
  - "src/widgets/**"
---

# 인증 · 세션

계약은 `docs/api/auth.md` 와 `docs/api/users.md` 에 있고 백엔드와 공유하므로 계약이 바뀌면 거기를 먼저 고친다.
백엔드는 백엔드 저장소에서 `docker compose up -d --wait` → `./gradlew bootRun` 으로 띄운다.

## 세션 정책은 서버가 정한다

- 로그인부터 8시간, 마지막 활동부터 30분. 먼저 오는 쪽에 끝나고 기한과 같은 시각도 만료다. access token 은 10분.
- **활동은 사용자의 실제 입력만이다** — `pointerdown`·`keydown`·`wheel`·`touchstart` 중 `isTrusted` 인 것. 자동 조회, 방 목록 갱신, 소켓 메시지, heartbeat, 재발급, 탭·온라인 복귀는 활동이 아니다. `useSessionLifecycle` 이 30초에 한 번만 `POST /auth/session/activity` 를 부른다.
- 기한이 지난 것처럼 보여도 로컬 타이머로 끝내지 않는다. `GET /auth/session` 으로 다시 확인하고 서버 답을 따른다. 다른 탭이 연장했을 수 있다. 확인 중 네트워크 장애면 화면을 잠그고 다시 확인할 수 있게 한다.
- 만료 1분 전 `SessionExpiryDialog` 가 뜬다. 이 창이 떠 있는 동안에는 활동 이벤트로 연장하지 않고 `계속 사용` 버튼만 연장한다. 절대 만료가 먼저면 재로그인 안내다.

## 상태가 사는 곳

- access token: `tokenStore` 모듈 변수. `generation()` 이 세대 번호다. 로그인 시작·로그아웃·세션 종료 때 세대가 오르고, **늦게 도착한 응답은 세대가 다르면 버린다** (`baseQuery` 의 `authChanged`, `reissue` 의 `cancelled`).
- 세션 시각·종료 사유: `sessionStore` 모듈 상태. `useSyncExternalStore` 로 구독한다. `clockOffset` 이 서버 시각과의 차이라 만료 계산에 클라이언트 시계를 그대로 쓰지 않는다.
- Redux `authSlice` 에는 `unknown | authenticated | anonymous | unavailable` 만 둔다. `unavailable` 은 복구 요청이 네트워크 실패나 Web Locks 미지원으로 끝난 상태고, `AuthBootstrap` 이 "다시 시도" 화면을 그린다. 네트워크 장애를 인증 만료로 처리하지 않는다.
- localStorage 에 쓰는 것은 셋뿐이고 토큰은 없다: `ibs.auth.rememberedEmail`(아이디 저장), `company.auth.logout-pending`(로그아웃 대기 마커), `company.auth.session-event`(BroadcastChannel 미지원 시 탭 간 전달용, 쓰자마자 지운다).

## 재발급 (`shared/api/reissue.ts`)

- 탭 안에서는 `inflight` Promise 를 공유한다. 탭 사이에서는 `withAuthLock` 이 Web Locks `company.auth.cookie` 로 직렬화한다. 로그인·로그아웃 요청도 같은 잠금을 거친다 — 늦게 온 쿠키 응답이 새 쿠키를 덮지 않게 하려는 것이다.
- **Web Locks 가 없으면 잠금 없이 재발급하지 않고 실패시킨다.** 보안 컨텍스트가 아닌 곳(LAN IP 로 접속한 폰)이 여기 걸린다. `crypto.randomUUID` 도 같은 조건이다.
- 결과는 `success | terminal | retryable | cancelled` 넷이다. `retryable`(네트워크·5xx) 은 로그아웃시키지 않고 `unavailable` 로 간다.
- 재발급 전에 로그아웃 대기 마커가 있으면 **재발급보다 로그아웃 재시도를 먼저** 한다. 오프라인에서 로그아웃한 뒤 새로고침해도 세션이 살아나지 않게 하려는 것이다.
- `useAuthBootstrap` 이 앱 시작 시 한 번 재발급해 세션을 복구한다. access token 은 메모리라 새로고침하면 사라지지만 refresh 쿠키는 남기 때문이다. 이 훅을 지우면 새로고침이 곧 로그아웃이다.

## 탭 동기화 (`shared/api/sessionStore.ts`)

- BroadcastChannel `company.auth.session`, 미지원이면 `storage` 이벤트. 메시지는 `session`(시작·연장) 과 `ended` 둘이다.
- 다른 탭이 로그인하면(`started`) 이 탭은 토큰을 비우고 `authenticated` 로 다시 마운트한다. `AuthBootstrap` 이 `key={sessionId}` 로 트리를 통째로 갈아 끼운다.
- `sessionStore.onEvent` 는 `ended` 와 `started` **둘 다** 쏜다. 구독자는 종류를 확인해야 한다. `stompClient` 는 지금 종류를 가리지 않고 소켓을 닫아 다른 탭 로그인에도 끝말잇기 방이 조용히 죽는다 — 알려진 문제이고 고치면 이 줄을 지운다.

## 로그인 · 로그아웃

- `login` 의 `onQueryStarted` 가 먼저 `beginLogin()` 으로 세대를 올린다. 응답이 왔을 때 세대가 다르면 토큰을 저장하지 않는다.
- **로그아웃은 요청 전에 로컬을 정리한다.** `sessionStore.end('LOGOUT')` 이 토큰을 지우고 이벤트를 쏜 뒤에 요청이 나간다. 서버 요청이 실패해도 사용자는 이미 로그아웃 상태다. `finally` 는 RTK Query 캐시만 비운다.
- `useLogin` 은 403 코드(`APPROVAL_PENDING`·`SIGNUP_REJECTED`)를 먼저 보고, 그다음 401 을 고정 문구로 덮는다.
- `useRejectedGuard` 는 `me.status === 'REJECTED'` 면 즉시 로그아웃시킨다. 관리자의 거절이 당사자 화면에 바로 반영되게 하려는 것이다. `AppLayout` 이 부르고, 지우지 않는다.
- 아이디 저장(`rememberedEmail.ts`)은 이메일만 넣고 **로그인 성공 시에만** 쓴다. 제출 시점에 쓰면 오타 난 주소가 기억되어 다음 로그인에 그대로 채워진다. 비밀번호나 토큰을 여기 추가하지 않는다.

## 가드와 역할

- `RequireAuth`·`RedirectIfAuthenticated` 는 `status` 가 `unknown` 이면 아무것도 렌더하지 않는다. `RequireAdmin` 은 `me` 로딩 중에도 마찬가지다.
- 역할을 토큰이나 로그인 응답에 담지 않는 것은 백엔드 의도다. 담으면 강등해도 토큰 수명 동안 관리자로 남는다.

## 승인 관리 (`features/admin`)

`auth` 는 "내가 로그인한다" 에 머물고, "관리자가 남의 상태를 바꾼다" 는 `admin` 이다. 둘 다 백엔드의 같은 `UserStatus` enum 을 쓰지만 admin 이 `api/types.ts` 에 따로 정의한다 — 린트가 feature 간 import 를 막고, 세 값짜리 유니온을 위해 레이어를 늘리지 않았다. 세 번째 사용처가 생기면 그때 `entities/user` 로 올린다.

## 백엔드 응답에서 주의할 것

- 검증 오류는 전부 `INVALID_INPUT` 하나로 오고 첫 필드 메시지만 있다. 어느 필드인지 모르므로 폼 상단에 띄운다. 필드로 보낼 수 있는 코드는 `EMAIL_ALREADY_EXISTS` 뿐이다.
- 201 처럼 본문 없는 성공이 있다. `fetchBaseQuery` 는 알아서 처리하지만 직접 파싱할 때는 상태 코드가 아니라 본문이 비었는지로 판단한다. `res.json()` 은 빈 본문에서 던진다.

## 프록시

- `vite.config.ts` 의 proxy 가 `/api` 를 `localhost:8080` 으로 넘기며 **`Origin` 헤더를 지운다.** `changeOrigin: true` 는 `Host` 만 바꾸고, 백엔드 CORS 허용 목록이 5173 고정이라 autoPort 로 다른 포트가 잡히면 모든 요청이 403 이 된다(실제로 겪었다). 브라우저 입장에선 같은 오리진이므로 헤더를 지워 CORS 판정 자체를 없앤다.
- `netlify.toml` 의 `/api` 200 rewrite 는 SPA 폴백보다 위에 있어야 한다. Netlify 는 처음 맞는 규칙 하나만 적용한다. 폴백이 없으면 `/login`·`/signup` 이 404 다(실측). `netlify.app` 과 `up.railway.app` 은 둘 다 Public Suffix List 에 있어 무슨 수를 써도 같은 사이트가 되지 않는다.
