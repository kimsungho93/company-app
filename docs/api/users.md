# 사용자 · 관리자 API 명세

갱신일: 2026-08-18
상태: **구현 완료.**

프론트(`front/company-app`)와 백엔드(`backend/company-backend`)가 함께 참조한다. 계약이 바뀌면 이 문서를 먼저 고친다.
인증 자체(가입·로그인·재발급·로그아웃)는 [auth.md](auth.md) 에 있다.

## 1. 상태와 역할

가입하면 `PENDING` 이고 관리자가 승인해야 쓸 수 있다.

| | 값 |
|---|---|
| `status` | `PENDING` · `APPROVED` · `REJECTED` |
| `role` | `USER` · `ADMIN` |

**승인 전에는 로그인도 재발급도 막힌다** — 403 `APPROVAL_PENDING` 또는 `SIGNUP_REJECTED`. 자세한 것은 [auth.md](auth.md) 를 본다.

## 2. `GET /api/users/me`

| | |
|---|---|
| 인증 | 필요 (`Authorization: Bearer`) |
| 성공 | 200 |

```json
{ "id": 1, "email": "tiger@ibslab.com", "name": "김성호", "role": "ADMIN", "status": "APPROVED" }
```

**승인 게이트가 걸려 있지 않다.** `PENDING` · `REJECTED` 여도 403 이 아니라 200 에 그 상태가 담겨 온다. 여기서 403 을 내면 프론트가 "승인 대기 중" 화면을 그릴 근거를 잃고, 5장의 세션 중 거절도 감지하지 못한다.

**역할은 토큰이 아니라 이 엔드포인트로 안다.** access token 클레임에는 `sub` 와 `email` 뿐이다. 클레임에 담으면 강등해도 토큰 수명 동안 관리자로 남는다.

오류는 401 세 종류(`UNAUTHENTICATED` · `TOKEN_EXPIRED` · `INVALID_TOKEN`)뿐이고 기존 `JwtAuthenticationEntryPoint` 가 처리한다.

## 3. 관리자 API

전부 `ADMIN` 역할이 필요하다. 역할 확인은 매 요청 DB 조회다.

| 엔드포인트 | 성공 | 비고 |
|---|---|---|
| `GET /api/admin/users?status=` | 200 `[{id, email, name, status, createdAt}]` | `status` 는 **필수** |
| `POST /api/admin/users/{id}/approve` | 204 | |
| `POST /api/admin/users/{id}/reject` | 204 | 해당 사용자 refresh 토큰을 전부 폐기한다 |

| HTTP | `code` | 상황 |
|---|---|---|
| 403 | `FORBIDDEN` | 관리자가 아님 |
| 404 | `USER_NOT_FOUND` | |
| 400 | `CANNOT_REJECT_SELF` | 프론트가 버튼을 미리 비활성화하지만 서버가 계속 막아야 한다 |

**`createdAt` 은 `Instant` 를 직렬화한 값이다.** Jackson 기본값이면 UTC(`...Z`)로 나간다. 문자열을 잘라 쓰면 화면에 9시간 어긋난 값이 뜨므로, 프론트는 `formatJoinedAt` 에서 파싱한 뒤 KST 로 옮긴다.

**일괄 엔드포인트는 없다.** 프론트가 건별로 보내고 `Promise.allSettled` 로 묶는다. 사용자 수가 적어 지금은 이것으로 충분하다 — 관리자 경로에 요청 제한이 붙거나 "전부 아니면 전무"가 필요해지면 그때 다시 본다.

## 4. 거절은 되돌리기 어렵다

거절해도 `users` 행은 남는다. **그래서 그 사람은 같은 주소로 재가입할 수 없다** — 이메일 유니크 제약에 걸린다.

되돌리는 방법은 **거절됨 목록에서 다시 승인하는 것뿐이다.** `User.approve()` 가 상태만 바꾸므로 복구는 된다. 승인 관리 화면에 "거절됨" 탭이 반드시 있어야 하는 이유이고, 거절 확인창이 이 사실을 미리 알린다.

## 5. 거절과 세션

`reject` 는 해당 사용자의 refresh 토큰을 전부 폐기한다.

프론트는 여기에 더해 `me.status` 가 `REJECTED` 면 즉시 로그아웃시킨다(`useRejectedGuard`). 관리자가 거절한 결과가 당사자 화면에도 곧바로 반영되게 하는 장치다. **이 훅을 지우지 말 것.**

## 6. 첫 관리자

승인 API 를 쓰려면 관리자가 있어야 하는데 관리자를 만들 API 도 관리자를 요구해서 순환이다. 새 환경에서는 최초 1회만 SQL 로 끊는다.

```sql
UPDATE users SET status='APPROVED', role='ADMIN' WHERE email='...';
```

## 7. 프론트 연결 지점

| 파일 | 역할 |
|---|---|
| `features/auth/api/authApi.ts` | `me` 쿼리 |
| `features/auth/ui/RequireAdmin.tsx` | 관리자 라우트 가드 |
| `features/auth/model/useRejectedGuard.ts` | 세션 중 거절 감지 (5장) |
| `features/admin/api/adminUsersApi.ts` | 목록 · 승인 · 거절 |
| `features/admin/ui/UserApprovalList.tsx` | 승인 관리 화면 |
| `features/admin/model/formatJoinedAt.ts` | `createdAt` 을 KST 로 (3장) |
