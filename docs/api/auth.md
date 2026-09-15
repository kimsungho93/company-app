# 인증 API 명세

갱신일: 2026-09-15

## 로그인 세션

서버가 로그인 시각부터 최대 8시간, 마지막 사용자 활동부터 30분을 검사한다. 두 기한 중 먼저 도달한 시각에 세션이 종료된다. 기한과 같은 시각도 만료다. 사용자가 계속 활동해도 8시간은 연장되지 않는다.

Access token은 최대 10분이며 세션의 절대 만료 시각을 넘지 않는다. 토큰 재발급은 기존 세션을 이어받고 활동 시각을 바꾸지 않는다. REST 인증과 이미 연결된 WebSocket 모두 서버의 세션 상태를 확인한다.

## 엔드포인트

| 엔드포인트 | 인증 | 성공 |
| --- | --- | --- |
| `POST /api/auth/signup` | 불필요 | 201, 본문 없음 |
| `POST /api/auth/login` | 불필요 | 200, 토큰과 세션 정보; refresh 쿠키 발급 |
| `POST /api/auth/reissue` | refresh 쿠키 | 200, 토큰과 세션 정보; refresh 쿠키 회전 |
| `POST /api/auth/logout` | refresh 쿠키 | 204, 현재 세션 폐기·쿠키 삭제 |
| `GET /api/auth/session` | Bearer | 200, 세션 정보; 활동 시각 변경 없음 |
| `POST /api/auth/session/activity` | Bearer | 200, 서버 시각으로 활동 갱신 후 세션 정보 |

로그인 요청은 `{ "email": "example@ibslab.com", "password": "password1234" }`다.

로그인·재발급 응답:

```json
{
  "accessToken": "<JWT>",
  "expiresIn": 600,
  "sessionId": "d9efebf8-c2ea-4d7b-93cc-cab79a4e29cd",
  "serverTime": "2026-09-15T00:00:00Z",
  "idleExpiresAt": "2026-09-15T00:30:00Z",
  "absoluteExpiresAt": "2026-09-15T08:00:00Z"
}
```

세션 조회·활동 응답은 위에서 `accessToken`, `expiresIn`을 제외한 네 필드다. 시각은 ISO 8601이고 `expiresIn`은 초 단위다. 클라이언트는 서버 시각과의 차이를 보정해서 안내하고, 종료 결정은 서버 응답을 따른다. 요청 본문으로 활동 시각이나 만료 시각을 지정할 수 없다.

## 사용자 활동과 화면

키 입력·클릭·터치·휠 조작을 실제 활동으로 보고 최대 30초에 한 번 활동 API를 호출한다. 자동 API 호출, 방 목록 갱신, WebSocket 메시지·heartbeat, 토큰 재발급, 탭 복귀·온라인 복귀는 활동으로 세지 않는다.

미사용 만료 1분 전에 대화상자를 표시하고 `계속 사용`으로 활동을 명시적으로 갱신한다. 절대 만료가 먼저면 재로그인이 필요하다고 안내한다. 기한이 지난 것으로 보이더라도 로컬 타이머만으로 세션을 폐기하지 않고 조회 API로 다시 확인한다. 다른 탭이 기한을 연장한 경우 그 서버 응답을 반영한다. 확인 중 네트워크 장애가 있으면 화면을 잠그고 다시 확인할 수 있게 한다.

로그인 상태는 보이는 탭에서 1분 간격 및 탭·네트워크 복귀 시 조회한다. 조회는 세션을 연장하지 않는다.

## 쿠키와 여러 탭

Refresh 쿠키는 `HttpOnly; SameSite=Lax; Path=/api/auth`이며 운영에서는 `Secure`다. Max-Age는 남은 절대 세션 기한을 넘지 않는다. JS는 refresh 쿠키를 읽거나 저장하지 않는다. Access token은 `shared/api/tokenStore` 메모리에만 둔다.

재발급 요청은 탭 안에서 Promise를 공유하고, 같은 오리진의 탭 사이에서는 Web Locks로 직렬화한다. 로그인·로그아웃도 같은 잠금을 사용해 늦은 쿠키 응답의 순서를 보장한다. Web Locks를 지원하는 보안 컨텍스트(운영 HTTPS, 로컬 localhost)가 필요하다. 미지원 환경에서는 잠금 없이 재발급하지 않고 로그인 요청을 중단한다. 세션 기한·로그인·로그아웃은 BroadcastChannel로 동기화하고 미지원 시 storage 이벤트를 사용한다. 영구 저장소에 토큰을 기록하지 않는다.

로그아웃이나 세션 종료 뒤 도착한 토큰·보호 API 응답은 세대 번호로 무시한다. 세션 종료 시 전역 인증 상태와 RTK Query 캐시를 비우고 모든 소켓을 닫는다. 명시적 로그아웃은 토큰을 포함하지 않는 대기 표시를 localStorage에 남기고 서버 성공 시 지운다. 요청이 실패한 상태에서 새로고침하면 재발급보다 로그아웃 재시도를 먼저 수행하므로 세션이 자동으로 살아나지 않는다. 서버에 이미 전달된 요청의 취소를 보장하지는 않는다.

## 토큰 회전

재발급마다 refresh token이 회전한다. 이미 사용된 토큰을 다시 보내면 서버가 재사용으로 판단하고 해당 인증 세션을 폐기한다. 원래 로그인 시각이나 세션 식별자가 없는 배포 전 토큰은 복원하지 않으므로 배포 후 한 번 다시 로그인해야 한다.

## 오류

오류 본문은 `{ "code": "...", "message": "..." }`다.

| HTTP | code | 처리 |
| --- | --- | --- |
| 400 | `INVALID_INPUT`, `INVALID_REQUEST` | 입력 안내 |
| 401 | `INVALID_CREDENTIALS` | 로그인 정보 확인 |
| 401 | `TOKEN_EXPIRED` | 보호 API에서 access 만료 시 재발급 후 한 번 재시도 |
| 401 | `UNAUTHENTICATED`, `INVALID_TOKEN` | 재발급 응답이면 다시 로그인 |
| 401 | `SESSION_IDLE_EXPIRED` | 미사용으로 종료, 다시 로그인 |
| 401 | `SESSION_ABSOLUTE_EXPIRED` | 최대 이용 시간 도달, 다시 로그인 |
| 401 | `SESSION_REVOKED` | 로그아웃·보안 폐기로 종료, 다시 로그인 |
| 403 | `APPROVAL_PENDING`, `SIGNUP_REJECTED` | 계정 승인 상태 안내 |
| 409 | `EMAIL_ALREADY_EXISTS` | 가입 이메일 중복 안내 |
| 5xx 또는 네트워크 오류 | — | 로그인 정보를 지우지 않고 재시도 안내 |

로그인·회원가입·재발급·로그아웃 자체의 401은 자동 재발급 대상에서 제외한다. `SESSION_*` 종료는 재발급으로 복구하지 않는다.

WebSocket의 STOMP ERROR는 같은 오류 코드를 JSON으로 전한다. 서버가 세션 때문에 연결을 닫으면 close code `4001`, reason은 `SESSION_IDLE_EXPIRED`, `SESSION_ABSOLUTE_EXPIRED`, `SESSION_REVOKED` 중 하나다. 인증 저장소 장애 등 일시적 실패는 close code `1011`로 구분한다.

## 회원가입 제약

`email`은 소문자 `@ibslab.com` 주소, `name`은 앞뒤 공백 없는 2~10자, `password`는 8~20자다. 서버는 입력을 정규화하지 않는다. 문자열 길이는 Java UTF-16 코드 단위 기준이다.

## 연결 지점

| 파일 | 역할 |
| --- | --- |
| `shared/api/baseQuery.ts` | Bearer 주입, 공통 인증 오류, 한 번 재시도 |
| `shared/api/reissue.ts` | 재발급·일시적 실패 분리 |
| `shared/api/sessionStore.ts` | 세션 시각, 탭 동기화, 인증 종료 이벤트 |
| `shared/api/sessionApi.ts` | 조회·사용자 활동 API |
| `features/auth/model/useSessionLifecycle.ts` | 실제 활동과 만료 안내 |
| `features/auth/ui/AuthBootstrap.tsx` | 세션 복원·복원 실패 재시도 |
| `shared/ws/stompClient.ts` | 인증 종료 소켓 정리 |

개발 proxy(`vite.config.ts`)와 운영 proxy(`netlify.toml`)는 기존 `/api` 경로를 그대로 사용한다. WebSocket은 `shared/ws/wsUrl.ts`의 같은 오리진 `/api/ws` 경로를 유지한다.
