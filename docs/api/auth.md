# 인증 API 명세

갱신일: 2026-08-13
상태: **구현 완료.** 회원가입·로그인·재발급·로그아웃이 모두 동작한다.

프론트(`front/company-app`)와 백엔드(`backend/company-backend`)가 함께 참조한다. 계약이 바뀌면 이 문서를 먼저 고친다.

## 1. 엔드포인트

네 경로 모두 인증이 필요 없다(`SecurityConfig` 에서 `permitAll`). 나머지 경로는 JWT 필터가 막는다.

| 엔드포인트 | 성공 | 쿠키 |
|---|---|---|
| `POST /api/auth/signup` | 201, 본문 없음 | — |
| `POST /api/auth/login` | 200 `{accessToken, expiresIn}` | `Set-Cookie: refreshToken` |
| `POST /api/auth/reissue` | 200 `{accessToken, expiresIn}` | **새 값으로 교체** |
| `POST /api/auth/logout` | 204 | `Max-Age=0` 으로 삭제 |

`expiresIn` 은 **초 단위** access token 유효 시간이다(현재 1800).

## 2. 회원가입

```json
{ "email": "tiger@ibslab.com", "name": "김성호", "password": "password1234" }
```

| 필드 | 제약 | 위반 시 |
|---|---|---|
| `email` | 이메일 형식 · 도메인이 `@ibslab.com` · **대문자 불가** | 400 |
| `name` | **2~10자** · 앞뒤 공백 불가 | 400 |
| `password` | **8~20자**. 공백도 유효한 문자 | 400 |

**서버는 정규화하지 않고 거부한다.** 이메일 소문자 변환·이름 trim 을 하지 않고 `@Pattern` 으로 막는다. 프론트가 이메일을 소문자로 넣고 이름을 trim 해서 보내므로 실제로는 걸리지 않는다.

**길이는 Java `String.length()` — UTF-16 코드유닛 기준이다.** 프론트는 코드포인트로 센다. 이모지처럼 서로게이트 페어를 쓰면 프론트는 10자로 통과시키고 백엔드는 20으로 세어 거부한다. 이름에 이모지를 쓸 일은 없어 그대로 두지만, 엄밀히는 백엔드가 `codePointCount` 를 써야 일치한다.

**비밀번호 복잡도 조합을 요구하지 않는다.** NIST SP 800-63B 권고 — 복합 문자 규칙은 `Ibslab2026!` 같은 예측 가능한 패턴만 유도한다.

## 3. refresh 쿠키

```
refreshToken=<값>; Path=/api/auth; Max-Age=1209600; HttpOnly; SameSite=Lax
```

**`Path` 가 `/api/auth` 로 좁혀져 있어** 다른 API 요청에는 실리지 않는다. 재발급과 로그아웃에서만 필요하다.

`HttpOnly` 라 프론트 JS 는 읽지도 쓰지도 못한다. 요청에 `credentials: 'include'` 만 붙이면 브라우저가 알아서 싣는다.

## 4. 토큰 회전과 재사용 탐지 — 프론트 필수 요구사항

**재발급할 때마다 refresh 토큰이 새 값으로 회전한다.** 그리고 **폐기된 토큰이 한 번이라도 제시되면 재사용으로 보아 그 사용자의 유효한 토큰까지 전부 무효화한다.**

실측 결과:

```
1회차 재발급(구 토큰) → 200, 새 토큰 발급
같은 구 토큰으로 2회차 → 401 INVALID_TOKEN
그 직후 정상 새 토큰으로 시도 → 401 INVALID_TOKEN   ← 같이 폐기됨
```

보안상 옳은 설계지만 프론트에 직접적인 제약을 만든다.

> **access token 만료 상태에서 요청 두 개가 동시에 401 을 받으면, 둘 다 재발급을 호출하고 두 번째가 이미 폐기된 토큰을 제시해 사용자가 강제 로그아웃된다.**

따라서 **재발급 직렬화는 최적화가 아니라 필수**다. `shared/api/reissue.ts` 의 `reissueOnce()` 가 진행 중인 Promise 를 공유해 어떤 경우에도 한 번만 나가게 한다.

## 5. 오류

모든 오류는 `{ code, message }` 형태다. `message` 는 사용자에게 그대로 보여줄 수 있는 문구다.

| HTTP | `code` | 상황 |
|---|---|---|
| 400 | `INVALID_INPUT` | **모든 필드 검증 실패.** `message` 는 첫 위반 필드의 문구 |
| 400 | `INVALID_REQUEST` | 본문 파싱 실패 등 |
| 401 | `INVALID_CREDENTIALS` | 로그인 — 이메일 또는 비밀번호 불일치 |
| 401 | `UNAUTHENTICATED` | 재발급 — refresh 쿠키 없음 |
| 401 | `INVALID_TOKEN` | 재발급 — 폐기·위조 토큰 |
| 401 | `TOKEN_EXPIRED` | 재발급 — 만료 |
| 409 | `EMAIL_ALREADY_EXISTS` | 이미 가입된 이메일 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

**검증 실패는 규칙과 무관하게 `INVALID_INPUT` 하나로 온다.** `GlobalExceptionHandler` 가 Bean Validation 실패를 뭉쳐 첫 필드 메시지만 내려준다. 어느 필드인지 알 수 없으므로 프론트는 폼 상단에 띄운다. 필드로 보낼 수 있는 코드는 `EMAIL_ALREADY_EXISTS` 뿐이다.

필드별 안내가 필요해지면 백엔드가 응답에 `field` 를 추가하는 편이 코드를 쪼개는 것보다 낫다.

## 6. 계정 열거에 대한 합의

로그인 401 은 어느 쪽이 틀렸는지 알려주지 않지만(계정 열거 방지), **회원가입 409 는 "이미 가입된 이메일"이라고 알려준다.** 의도한 결정이다 — 도메인이 사내로 제한되어 열거 대상이 좁고, 안내가 없으면 사용자가 가입이 안 되는 이유를 알 수 없다.

전제 조건인 **rate limiting 은 아직 없다.** 외부 공개 서비스가 되면 이 결정을 다시 봐야 한다.

## 7. 프론트 연결 지점

| 파일 | 역할 |
|---|---|
| `shared/api/baseQuery.ts` | 토큰 주입, 401 → 재발급 → **1회** 재시도 |
| `shared/api/reissue.ts` | 재발급 직렬화 (4장) |
| `shared/api/tokenStore.ts` | access token — **메모리에만** |
| `features/auth/api/authApi.ts` | `login` · `signup` · `logout` 엔드포인트 |
| `features/auth/model/useAuthBootstrap.ts` | 앱 시작 시 세션 복구 |

`login`·`signup`·`reissue`·`logout` 의 401 은 재발급 대상에서 제외한다. 이 경로의 401 은 만료가 아니라 그 자체의 결과이며, 재발급으로 받아치면 로그인 실패가 조용히 삼켜지거나 무한 재귀가 된다.

### 개발 환경

`vite.config.ts` 의 proxy 가 `/api` 를 `http://localhost:8080` 으로 넘긴다. **프록시에서 `Origin` 헤더를 제거한다** — `changeOrigin: true` 는 `Host` 만 바꾸고 `Origin` 은 그대로 넘겨서, 백엔드 CORS 허용 목록(`localhost:5173` 고정)과 dev 포트가 다르면 403 이 난다. 브라우저 입장에서는 이미 같은 오리진이므로 헤더를 지워 CORS 판정 자체를 없앤다.

### 확인용 요청

```bash
curl -i -X POST http://localhost:8080/api/auth/signup -H "Content-Type: application/json" -d '{"email":"tiger@ibslab.com","name":"Tiger","password":"password1234"}'
```

## 8. 남은 것

| 항목 | 메모 |
|---|---|
| rate limiting | 6장의 전제 조건 |
| `AuthService.login` 이메일 정규화 | 대문자 로그인이 되는 건 MySQL 기본 collation 덕이지 코드 덕이 아니다. `_bin`·`_cs` 로 바뀌면 조용히 깨진다 |
| 동시 가입 409 변환 | `existsByEmail` → `save` 경쟁을 DB UNIQUE 제약이 막지만, `DataIntegrityViolationException` 을 409 로 바꾸는 처리가 없어 500 이 나간다 |
| 만료 선제 갱신 | `expiresIn` 을 활용해 401 을 기다리지 않고 미리 갱신 |
| 탭 간 동기화 | 한 탭에서 로그아웃하면 다른 탭도 반영 |
| 이메일 인증 메일 | 붙이면 201 의 의미가 "가입 완료"에서 "인증 대기"로 바뀐다 |
