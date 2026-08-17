# 앱 셸 설계 — 헤더 · 테마 · 승인 관리

작성일: 2026-08-17
대상: `front/company-app`
선행 문서: [2026-08-12-signup-screen-design.md](2026-08-12-signup-screen-design.md)
관련 계약: [docs/api/auth.md](../../api/auth.md)

## 1. 배경

인증이 붙고 홈 화면이 생겼지만, 홈은 `<h1>환영합니다</h1>` 와 로그아웃 버튼뿐이다. 인증된 화면을 감싸는 껍데기가 없어서 화면이 하나 더 늘어나는 순간 각 페이지가 헤더를 따로 들게 된다.

같은 시점에 백엔드에 **관리자 승인제**가 들어왔다(`a9b6ab3`). 가입하면 `PENDING` 이고 관리자가 승인해야 로그인할 수 있다. 그리고 프론트가 사용자 이름·역할을 알 방법이 없어 `GET /api/users/me` 를 요청했고 구현됐다(`b53296c`).

이 셋이 한 덩어리다 — 헤더에 이름과 관리자 메뉴를 띄우려면 `me` 가 필요하고, 관리자 메뉴가 있으려면 갈 화면이 있어야 한다.

## 2. 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 헤더 소유자 | `AppLayout` 이 소유. 페이지는 `<Outlet />` | 라우트 이동에 헤더가 재마운트되지 않는다 |
| 헤더 배치 | **`widgets/AppHeader`** (레이어 신설) | 여러 feature 를 조립하는 물건이라 `features/` 중 하나에 못 넣는다 |
| 데이터 조달 | 각 조각이 직접 `useMeQuery()` | props 사슬을 만들지 않는다. 캐시가 공유되어 요청은 한 번 |
| 내비게이션 메뉴 | **없음.** 자리만 잡아둔다 | 업무 화면이 아직 없다. 추측으로 만들지 않는다 |
| 테마 | 다크 · 라이트 + 시스템 따름(기본) | |
| 로그인 · 회원가입 | **항상 다크 고정** | 웨이퍼 노광은 어두운 배경 전제다. 5.4장 참고 |
| 테마 상태 | `useSyncExternalStore`. **Redux 아님** | 진실이 이미 DOM 속성에 있다. 5.3장 참고 |
| 승인 관리 | `/admin/users`, 상태 탭 3개 | `status` 가 필수 파라미터라 탭이 곧 요청이다 |
| 목록 갱신 | `invalidatesTags` 재조회. 낙관적 갱신 안 함 | 목록이 짧고 롤백 코드가 필요 없다 |

## 3. 라우트와 파일 배치

```
RedirectIfAuthenticated
└── AuthLayout                    WaferCanvas 소유 · 항상 다크
    ├── /login
    └── /signup

RequireAuth
└── AppLayout                     AppHeader 소유 · 테마 따름
    ├── /                         HomePage
    └── RequireAdmin
        └── /admin/users          AdminUsersPage
```

**가드가 바깥, 레이아웃이 안쪽이다.** 순서가 반대면 인증되지 않은 사용자에게 헤더가 한 번 그려졌다 사라진다.

`AppLayout` 이 `RequireAuth` 안에 있으므로 **`me` 를 부르는 시점에 access token 이 있는 것이 보장된다.**

```
src/
├── app/
│   ├── routes.tsx                     라우트 정의 (수정)
│   └── layouts/AppLayout.tsx          AppHeader + <main><Outlet /></main>
├── widgets/                           ← 신설
│   └── AppHeader/
│       ├── AppHeader.tsx
│       ├── AdminLink.tsx · UserMenu.tsx
│       ├── AppHeader.module.scss
│       └── index.ts
├── pages/
│   └── AdminUsersPage/                ← 신설
├── features/
│   ├── auth/
│   │   ├── api/authApi.ts             me 쿼리 추가
│   │   └── ui/RequireAdmin.tsx        신설
│   └── admin/                         ← 신설
│       ├── api/adminUsersApi.ts
│       └── ui/UserApprovalList.tsx
└── shared/
    ├── theme/                         ← 신설
    │   ├── themeStore.ts
    │   └── useTheme.ts
    └── ui/ThemeToggle/                ← 신설
```

### `widgets` 를 신설하는 이유

헤더가 담는 것의 성격이 섞여 있다.

| 요소 | 도메인 지식 |
|---|---|
| 로고 · 테마 토글 | 없음 |
| 사용자 이름 · 로그아웃 · 관리자 링크 | auth 를 안다 |
| 앞으로 붙을 업무 메뉴 | 그 도메인들을 안다 |

배치 기준이 "도메인 지식이 없으면 `shared`, 있으면 `features`" 인데 헤더는 둘 다 아니다. **여러 feature 를 한자리에 모으는 조립물**이고, 그것을 두는 자리가 `widgets` 다. CLAUDE.md 가 "필요해질 때 추가만 한다"고 예약해둔 지점이 여기다.

`features/auth/ui` 에 두면 업무 메뉴가 들어오는 순간 `auth` 가 설비·품질을 알아야 해서 "feature 끼리 직접 import 하지 않는다"는 규칙이 깨진다.

**의존 방향은 `app → pages → widgets → features → shared` 로 확장된다.**

### `features/admin` 을 새 feature 로 두는 이유

승인 관리는 `auth` 가 아니다. 관리자가 **다른 사람의** 상태를 바꾸는 일이고, 앞으로 사용자 목록·권한 관리가 붙는다면 그쪽으로 자란다. `auth` 는 "내가 로그인한다"에 머물러야 한다.

## 4. 헤더 — 리액트 설계

### 4.1 레이아웃 라우트가 소유한다

각 페이지가 `<AppHeader />` 를 렌더하면 라우트 이동마다 헤더가 언마운트·재마운트된다. 열어둔 드롭다운이 닫히고 포커스가 날아간다.

**`AuthLayout` 이 `WaferCanvas` 를 소유하는 것과 정확히 같은 이유이자 같은 해법이다.**

### 4.2 데이터는 각 조각이 직접 구독한다

`AppLayout` 이 `useMeQuery()` 를 불러 `<AppHeader me={me} />` 로 내리지 않는다. 화면을 배치할 뿐인 레이아웃이 사용자가 누군지 알게 되고, 중간 컴포넌트가 자기가 안 쓰는 값을 통과시키게 된다.

여러 곳에서 `useMeQuery()` 를 불러도 **RTK Query 가 같은 캐시 키를 공유하므로 네트워크 요청은 한 번이다.**

### 4.3 조각을 나누는 기준은 "무엇을 구독하는가"

| 조각 | 구독 | 다시 그려지는 때 |
|---|---|---|
| `AdminLink` | `me.role` | `me` 도착 시 |
| `ThemeToggle` | 테마 | 토글할 때 |
| `UserMenu` | `me.name` | `me` 도착 시 |

파일이 길어서 나누는 것이 아니다. 한 덩어리면 테마 토글 한 번에 헤더 전체가 다시 그려진다.

**로고와 내비게이션 자리는 컴포넌트로 만들지 않는다.** 로고는 `<Link>` 한 줄이고, 내비게이션은 넣을 메뉴가 없다. 지금 `MainNav` 를 만들면 `null` 을 반환하는 빈 컴포넌트가 된다 — 헤더 스타일에 `flex: 1` 여백만 두고, 메뉴가 생길 때 그 자리에 컴포넌트를 만든다.

### 4.4 `me` 도착 전

이름 자리가 비었다가 툭 나타나면 레이아웃이 밀린다. **`UserMenu` 는 `me` 가 없을 때도 같은 높이·최소 너비를 차지한다.** 텍스트만 비운다.

### 4.5 좁은 화면

요소가 적어 한 줄에 들어간다. 브레이크포인트 아래에서는 **사용자 이름을 숨기고** 아이콘만 남긴다. 햄버거 메뉴는 업무 메뉴가 생길 때 도입한다 — 지금 만들면 열어도 빈 서랍이다.

## 5. 테마

### 5.1 토큰 이름을 역할로 바꾼다

`--bg-deep`(깊은 어둠)은 라이트 모드에서 뜻이 없다. **"어떻게 보이나"가 아니라 "무슨 역할인가"로 바꾼다.**

| 지금 | 바꿀 이름 | 라이트 | 다크 (기존 값 유지) |
|---|---|---|---|
| `--bg-deep` | `--bg-sunken` | `#eef1f5` | `#070c13` |
| `--bg-base` | `--bg` | `#f4f6f9` | `#0a1119` |
| `--surface` | `--surface` | `#ffffff` | `rgba(12,22,34,.74)` **(유지)** |
| `--surface-input` | `--surface-input` | `#f8fafc` | `rgba(255,255,255,.035)` |
| `--border` | `--border` | `#e2e8f0` | `rgba(120,190,220,.16)` |
| `--text-hi` | `--text-strong` | `#0f1c2b` | `#eaf3f8` |
| `--text` | `--text` | `#334155` | `#8aa1b4` |
| `--text-dim` | `--text-muted` | `#64748b` | `#6e869b` |
| `--text-faint` | `--text-subtle` | `#94a3b8` | `#4e6376` |
| `--accent` | `--accent` | `#0e7490` | `#22d3ee` |
| `--accent-ink` | `--accent-ink` | `#ffffff` | `#04121b` |
| `--danger` | `--danger` | `#b91c1c` | `#fb7185` |

`--text-subtle` 은 양쪽 모두 대비 약 2.9:1 이다. **장식성 라벨 전용이며 본문에 쓰지 않는다.** 나머지는 전부 4.5:1 이상이다. 구현 시 실측으로 확인한다.

**`--accent-ink` 는 이름을 이미 잘 지어둔 덕을 본다.** "강조색 위에 얹는 글자색"이라는 역할 이름이라 값만 뒤집으면 되고 `Button` 은 한 글자도 바뀌지 않는다. 라이트에서는 어두운 청록 바탕에 흰 글자, 다크에서는 시안 바탕에 어두운 글자로 **관계가 뒤집힌다.**

**다크의 `--surface` 는 반투명을 유지한다.** `AuthCard` 가 이 반투명을 통해 뒤쪽 웨이퍼 글로우를 비치게 하고 있어서, 불투명하게 바꾸면 로그인 카드가 납작해진다. 라이트에서는 `#ffffff` 불투명이다.

### 5.2 웨이퍼 전용 값은 테마에서 뺀다

`--bg-glow` 는 웨이퍼 배경의 방사형 그라디언트에만 쓰이고 어두운 배경이 전제다. **`--wafer-glow` 로 옮겨 테마 블록 바깥에 한 번만 선언한다.** 로그인 화면이 항상 다크이므로 짝을 만들 필요가 없다.

`--shadow-card` 는 다르다. 홈·승인 관리 화면의 카드도 쓰게 되므로 **테마별 값을 갖는다** — 다크는 지금의 무거운 그림자, 라이트는 `0 1px 2px rgba(15,28,43,.06)` 수준의 얕은 것.

### 5.3 상태는 세 가지, 진실은 DOM 에 있다

```scss
@mixin dark-tokens { --bg: #0a1119; --text-strong: #eaf3f8; /* … */ }

:root { /* 라이트가 기본값 */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { @include dark-tokens; }
}
:root[data-theme='dark'] { @include dark-tokens; }
```

| 상태 | `localStorage['ibs.theme']` | `<html data-theme>` |
|---|---|---|
| 시스템 따름 (기본) | 없음 | 없음 |
| 명시적 라이트 | `light` | `light` |
| 명시적 다크 | `dark` | `dark` |

**Redux 에 넣지 않는다.** 테마는 이미 `data-theme` 속성으로 적용되어 있고, 아래 인라인 스크립트가 Redux 바깥에서 값을 쓴다. store 에 복사하면 진실이 두 곳이 된다. `useSyncExternalStore` 가 정확히 "리액트 밖 상태를 구독"하는 용도다.

### 5.4 첫 페인트 전에 적용해야 한다

`index.html` 의 `<head>` 에 인라인으로 둔다.

```html
<script>try{var t=localStorage.getItem('ibs.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
```

**이게 없으면 새로고침마다 반대 테마가 한 번 번쩍인다.** React 이펙트는 첫 페인트 뒤에 돌기 때문이다. 라우트 가드가 `status === 'unknown'` 일 때 아무것도 렌더하지 않는 것과 같은 종류의 문제다.

### 5.5 로그인 · 회원가입은 항상 다크

웨이퍼 노광 애니메이션은 **어두운 배경에 다이가 빛나는 것**이 개념의 전부다. 밝은 배경에서는 회색 격자가 되어 성립하지 않는다. 라이트용을 만들려면 "빛나는 다이"를 "찍히는 다이"로 개념부터 다시 설계해야 하고, 그것은 `WaferCanvas` 를 다시 쓰는 일이다.

해법은 CSS 한 줄이다.

```scss
.layout { @include dark-tokens; }   // AuthLayout.module.scss
```

커스텀 프로퍼티는 상속되므로 `data-theme` 이 무엇이든 **그 서브트리만 다크**가 된다. 자바스크립트가 필요 없다.

## 6. `me` 연결

```ts
// features/auth/api/authApi.ts
me: build.query<Me, void>({ query: () => '/users/me', providesTags: ['Me'] })
```

응답은 `{ id, email, name, role, status }` 다. `role` 은 `USER | ADMIN`, `status` 는 `PENDING | APPROVED | REJECTED`.

`PENDING` · `REJECTED` 여도 403 이 아니라 **200 에 그 상태가 담겨 온다.** 의도한 것이다 — 여기서 403 을 내면 8장의 "세션 중 거절" 을 감지할 수 없다.

로그아웃은 이미 `baseApi.util.resetApiState()` 를 부르므로 `me` 캐시도 함께 비워진다. **추가 작업이 없다.**

## 7. 승인 관리 화면

### 7.1 탭이 곧 요청이다

`GET /api/admin/users?status=` 가 `status` 를 **필수로** 받는다. 탭 하나가 쿼리 하나에 그대로 대응한다. 억지로 만든 UI 가 아니라 API 모양이 화면이 된 경우다.

```
[ 승인 대기 (3) ] [ 승인됨 ] [ 거절됨 ]
```

### 7.2 "거절됨" 탭은 필수다

거절해도 `users` 행은 남는다. **그래서 그 사람은 같은 주소로 재가입할 수 없다** — 이메일 유니크 제약에 걸린다.

실수로 거절했을 때 되돌릴 방법은 **거절됨 탭에서 찾아 다시 승인하는 것뿐이다.** `User.approve()` 가 상태만 바꾸므로 복구는 된다. 이 탭이 없으면 오조작이 영구적이 된다.

### 7.3 목록 항목과 동작

| | |
|---|---|
| 표시 | 이름 · 이메일 · 가입 시각 |
| 동작 | 승인 · 거절 (`PENDING` 탭에서만) |
| 자기 자신 | **거절 버튼 비활성.** 백엔드가 `CANNOT_REJECT_SELF` 로 400 을 준다 |

자기 자신 판정은 `me.id === user.id` 다. 눌러서 에러를 보는 것보다 못 누르게 하는 편이 낫다.

### 7.4 낙관적 갱신을 하지 않는다

승인·거절 후 `invalidatesTags: ['AdminUsers']` 로 재조회한다. 태그는 하나만 둔다 — 상태별로 캐시가 나뉘어도 전부 무효화되어 탭을 옮겼을 때 최신이 보장된다.

낙관적으로 하면 실패 시 롤백 코드가 필요한데, **목록이 짧고 사람이 하나씩 누르는 화면이라 재조회 한 번이 더 싸다.** 중복 클릭은 버튼 `disabled` 로 막는다.

### 7.5 관리자 가드

```
RequireAuth → AppLayout → RequireAdmin → AdminUsersPage
```

**`me` 가 로딩 중일 때가 함정이다.** `role` 을 모르는 상태에서 판단하면 관리자인데도 홈으로 튕긴다. `RequireAuth` 가 `status === 'unknown'` 일 때 아무것도 렌더하지 않는 것과 똑같이, `isLoading` 이면 아무것도 렌더하지 않는다.

**이 가드는 UX 용이다.** 실제 차단은 백엔드 `AdminUserService.verifyAdmin` 이 매 요청 DB 로 한다. 프론트가 아는 `role` 은 신뢰 경계가 아니다.

### 7.6 빈 상태

승인 대기가 0명일 때 빈 표를 보여주지 않는다. "승인 대기 중인 사람이 없습니다 / 새로 가입하면 여기에 나타납니다".

### 7.7 좁은 화면

표가 아니라 **카드 목록**으로 바뀐다. 이름·이메일·시각이 세로로 쌓이고 버튼이 아래에 가로로 붙는다.

## 8. 승인 상태에 따른 사용자 경험

관리자 쪽을 만들면 **당사자 쪽도 맞춰야 한다.** 승인·거절의 결과를 그 사람이 어떻게 겪는지가 지금은 어긋나 있다.

| 상황 | 지금 | 바꿀 것 |
|---|---|---|
| 가입 직후 | `/login` 으로 보내며 "로그인하세요" | **거짓말이다.** 승인 전에는 로그인이 안 된다. "관리자 승인 후 이용할 수 있습니다"로 |
| 승인 대기 중 로그인 | 403 `APPROVAL_PENDING` → 서버 메시지가 그대로 노출 | `useLogin` 에서 명시적으로 처리 |
| 거절된 사용자 로그인 | 403 `SIGNUP_REJECTED` → 같음 | 같음 |
| 세션 중에 거절당함 | 최대 30분간 그대로 사용 | `me.status === 'REJECTED'` 면 즉시 로그아웃 |

지금 403 이 그럴듯하게 보이는 것은 **우연이다.** `errorInfo.ts` 는 401 만 특별 취급하고 403 은 `kind: 'CLIENT'` 로 떨어뜨려 서버 메시지를 그대로 쓰는데, 마침 백엔드 문구가 적절할 뿐이다. 의도한 동작으로 만든다.

마지막 항목이 `me` 에 `status` 를 요청한 이유다. **완전한 차단은 아니다** — access token 은 서명만으로 검증되어 서버가 취소할 수 없고, 직접 요청을 만드는 클라이언트에는 통하지 않는다. 브라우저에서만 즉시 끊긴다. 근본 해법은 백엔드 몫으로 남겨뒀다.

## 9. 접근성

컴포넌트 라이브러리가 없으므로 직접 챙긴다.

- 헤더는 `<header>`, 내비게이션은 `<nav>`. 현재 위치는 `aria-current="page"`
- `UserMenu` 를 드롭다운으로 만들면 `aria-expanded` · `Escape` 로 닫기 · 포커스 트랩이 필요하다. **이번에는 드롭다운 없이 이름과 로그아웃 버튼을 나란히 둔다** — 항목이 둘뿐인데 드롭다운을 만들 이유가 없다
- `ThemeToggle` 은 `<button>` 에 `aria-label` 을 넣는다. 아이콘만으로는 무엇인지 알 수 없다. 현재 상태를 `aria-pressed` 가 아니라 라벨 문구로 알린다("다크 모드로 전환")
- 승인·거절 버튼은 제출 중 `disabled` + `aria-busy`
- 승인·거절 결과는 `role="status"` 로 알린다. 목록에서 행이 사라지는 것만으로는 스크린리더에 전달되지 않는다
- 테마 전환에 트랜지션을 넣는다면 `prefers-reduced-motion` 에서 끈다

## 10. 테스트

| 대상 | 케이스 |
|---|---|
| `AppLayout` | 라우트 이동 시 헤더가 **같은 DOM 노드**로 유지되는가 |
| `AdminLink` | `role === 'ADMIN'` 이면 보이고 `USER` 면 없다 |
| `RequireAdmin` | `me` 로딩 중에는 아무것도 렌더하지 않는다. 비관리자는 홈으로 |
| `themeStore` | 토글이 `data-theme` 과 `localStorage` 를 함께 바꾼다. 저장값이 없으면 속성도 없다 |
| `UserApprovalList` | 자기 자신 행의 거절 버튼이 비활성. 승인 후 목록이 갱신된다 |
| `useLogin` | 403 `APPROVAL_PENDING` · `SIGNUP_REJECTED` 문구 |

헤더의 시각적 배치와 테마 색상은 자동 테스트하지 않는다. 웨이퍼 캔버스와 같은 이유로 비용 대비 이득이 낮다.

## 11. 범위 밖

- **업무 메뉴** — 화면이 없다. 헤더에 여백만 두고 컴포넌트는 만들지 않는다 (4.3장)
- **햄버거 메뉴** — 열어도 빈 서랍이다. 업무 메뉴가 생길 때
- **사용자 드롭다운** — 항목이 둘뿐이다 (9장)
- **관리자 지정 화면** — 첫 관리자는 SQL 로 만든다. 승격 API 자체가 없다
- **승인 알림 메일** — 백엔드에 메일 발송 수단이 없다
- **승인 대기자 수 배지 실시간 갱신** — 폴링·SSE 를 붙일 근거가 아직 없다. 화면 진입 시 조회로 충분하다
- **거절 사유 입력** — 백엔드 API 가 사유를 받지 않는다

## 12. 구현 중 조정

설계와 다르게 간 곳과 그 이유. 코드가 진실이고 이 절이 차이를 설명한다.

**`AuthLayout` 다크 고정 방식이 바뀌었다.** 5.5장은 `.page { @include dark-tokens; }` 를 쓰라고 했는데, `_tokens.scss` 에 최상위 CSS(`:root` 블록)가 있어서 **모듈 파일에서 `@use` 하면 팔레트가 그 모듈 CSS 에 통째로 복제된다.** 대신 `:root` 접두사를 뗀 `[data-theme='dark']` 셀렉터 하나로 전역과 서브트리를 함께 처리하고, `AuthLayout` 은 `<main data-theme="dark">` 를 단다. 빌드 CSS 에서 팔레트가 3번(라이트·미디어쿼리·명시적 다크)만 나오는 것을 확인했다.

**`--surface` 의 반투명을 유지했다.** `AuthCard` 가 이걸 통해 뒤쪽 웨이퍼 글로우를 비치고 있어서, 불투명하게 바꾸면 로그인 카드가 납작해진다.

**`TextField` 의 `.help` 는 `--text-subtle` 이 아니라 `--text-muted` 다.** 기계적 치환이면 `--text-faint` → `--text-subtle` 인데, 그러면 대비 2.9:1 이라 5.1장이 정한 "본문 금지"를 스스로 어긴다.

### 설계 뒤에 추가된 것

사용자 요청으로 범위가 늘었다. 스펙에는 없던 것들이다.

| 추가 | 왜 |
|---|---|
| 확인 다이얼로그 (`shared/ui/ConfirmDialog`) | 승인·거절이 바로 실행되면 오조작을 되돌릴 수 없다. 네이티브 `<dialog>` 로 포커스 트랩·Escape·`::backdrop` 을 얻는다 |
| 체크박스와 일괄 승인·거절 | 한 명씩 누르는 것이 번거롭다. 백엔드에 일괄 엔드포인트가 없어 건별로 보내고 `allSettled` 로 묶는다 |
| 실패 사유·이름 안내 (`summarizeResults`) | "5명 중 2명 실패" 로는 누구를 다시 봐야 할지 모른다 |
| 가입 시각 표기 (`formatJoinedAt`) | `Instant` 가 UTC 로 직렬화되어 문자열을 자르면 9시간 어긋난다 |
| 폭 제한 — 카드 720px, `AppLayout` 1120px | 행이 넓어 버튼이 화면 끝까지 밀리고 흰 배경만 남았다 |
| 헤더 로고 · 파비콘 | 별도 요청. 1,739KB 원본을 96×96 으로 줄여 `public/logo-mark.png` 로 둔다 |

`Checkbox` 에 `labelHidden` 과 `indeterminate` 를 더했다. 행마다 "이영희 선택"이 보이면 안 되고, 전체 선택은 부분 선택 상태를 표시해야 한다.

**`jsdom 29` 가 `<dialog>` 의 `showModal` 을 구현하지 않아** `src/test/setup.ts` 에 shim 을 뒀다. 모달의 실제 동작은 브라우저 몫이므로 **테스트 통과가 모달 동작을 보장하지 않는다.**

## 13. 후속 작업

- 백엔드: 거절된 사용자의 access token 이 최대 30분 유효한 문제 (8장). 판단은 백엔드 몫으로 넘겨뒀다
- 백엔드: `GET /api/admin/users` 의 `status` 를 선택 파라미터로 — 전체 목록을 세 번 부르지 않아도 된다
- 구현 후 [docs/api/users.md](../../api/users.md) 를 계약 문서로 작성 (요청서는 백엔드에서 처리 후 삭제됐다)
- CLAUDE.md 갱신 — `widgets` 레이어 추가, 테마 규칙, 토큰 이름 변경
