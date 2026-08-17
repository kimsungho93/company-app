# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

**패키지 매니저는 yarn 이다.** `npm install` 을 실행하면 `package-lock.json` 이 생겨 `yarn.lock` 과 어긋난다.

```bash
yarn dev          # Vite 개발 서버 (HMR)
yarn build        # tsc -b && vite build — 타입 에러가 나면 빌드가 중단된다
yarn lint         # oxlint (ESLint 아님)
yarn test         # vitest run
yarn test:watch
yarn preview      # dist/ 를 로컬 서버로 서빙
```

단일 테스트: `yarn vitest run src/features/auth/model/validate.test.ts`
타입만 검사: `yarn tsc -b` (증분 캐시가 `node_modules/.tmp` 에 남으므로 결과가 이상하면 `yarn tsc -b --force`)
파일 단위 린트: `yarn oxlint src/app/App.tsx`

**개발 서버 포트** — 기본 5173이지만 옆 프로젝트들과 겹치는 경우가 잦다. `PORT` 환경변수로 덮어쓸 수 있게 해뒀다.

## 이 프로젝트가 무엇인가

`backend/company-backend`(Spring Boot)와 짝을 이루는 프론트엔드. 회사(IBS)는 반도체·스마트팩토리 영역이고, 화면의 시각 언어를 여기서 끌어왔다.

현재 구현된 것은 **로그인 화면 하나**다. 설계 근거와 폐기된 대안까지 [docs/superpowers/specs/2026-08-10-login-screen-design.md](docs/superpowers/specs/2026-08-10-login-screen-design.md) 에 있다. 화면을 손대기 전에 읽을 것.

## 구조 — feature 기반 3레이어

```
src/
├── app/         조립 계층 + 라우팅 + store. 여기만 아래를 다 안다
├── pages/       라우트 단위 화면 (Home · Login · Signup)
├── features/    도메인 단위. 지금은 auth 하나
└── shared/      도메인을 모르는 것들
```

**의존성은 `app → pages → features → shared` 단방향이다.**

- `shared` 는 `features` 를 절대 참조하지 않는다
- feature끼리 직접 import 하지 않는다. 조립은 상위 레이어에서 한다
- feature 외부에서는 `features/auth/index.ts` 가 export 한 것만 쓴다. 내부 경로를 직접 import 하지 않는다

**배치 기준은 하나다 — 도메인 지식이 없으면 `shared`, 있으면 `features`.**
`tokenStore` 가 `features/auth/model` 이 아니라 `shared/api` 에 있는 이유가 이것이다. `shared/api/baseQuery` 가 토큰을 필요로 하는데 그대로 두면 역방향 의존이 생긴다.

`pages` 는 얇다. 화면 제목(`<title>`)과 feature 컴포넌트 조립만 한다. 폼 같은 실제 구현은 `features/auth/ui` 에 있다.

`entities`, `widgets` 는 아직 없다. 필요해질 때 **추가만** 한다.

### 라우팅

```
/         RequireAuth              → HomePage
/login    RedirectIfAuthenticated  → AuthLayout → LoginPage
/signup   RedirectIfAuthenticated  → AuthLayout → SignupPage
```

**`AuthLayout` 이 `WaferCanvas` 를 소유하고 각 페이지는 `<Outlet />` 자리에 들어간다.** 각 페이지가 캔버스를 따로 들면 화면을 오갈 때마다 재마운트되어 다이 3,600개 재계산과 폰트 샘플링이 다시 일어난다. 지금 구조에서는 `/login` ↔ `/signup` 이동 시 캔버스가 **같은 DOM 노드로 유지된다**(확인함).

페이지 제목은 React 19 가 `<title>` 을 자동으로 head 로 올려주므로 각 Page 컴포넌트에서 직접 렌더한다.

**가드는 `status === 'unknown'` 이면 아무것도 렌더하지 않는다.** 세션 복구가 끝나기 전에 판단하면 보호 화면에서 새로고침할 때 로그인 화면이 한 번 번쩍인다.

## 툴체인에서 걸리는 지점들

### 패키지 매니저 — Yarn 4

`corepack` 은 이 환경에서 관리자 권한이 없어 쓸 수 없다(`C:\Program Files\nodejs` 에 shim 을 만들려다 EPERM). 대신 **릴리스 파일을 프로젝트에 두고 실행한다** — `.yarnrc.yml` 의 `yarnPath` 가 `.yarn/releases/yarn-4.18.0.cjs` 를 가리킨다. 이 두 파일은 **반드시 커밋해야** 다른 사람도 같은 버전을 쓴다.

`nodeLinker: node-modules` 를 명시했다. Yarn 4 기본값인 PnP 는 Vite 플러그인·vitest 와 마찰이 생기는 경우가 있다.

**npm 과 가장 크게 다른 점 — peer dependency 를 자동 설치하지 않는다.** npm 은 v7부터 자동으로 넣어주는데 yarn 은 넣지 않는다. 그래서 실제로 `@testing-library/dom` 이 빠져 빌드와 테스트가 전부 깨졌다(`waitFor` 를 못 찾음). 설치 로그의 `YN0002` 경고를 무시하지 말 것 — 그게 곧 런타임 실패다.

### `@/` alias 는 두 곳에 있다

`vite.config.ts` 의 `resolve.alias`(번들러용)와 `tsconfig.app.json` 의 `paths`(타입 검사·에디터용). **한쪽만 고치면 빌드는 되는데 타입이 깨지거나 그 반대가 된다.**

### TypeScript — 프로젝트 참조 구조

- `tsconfig.app.json` → `include: ["src"]`, DOM lib, `react-jsx`
- `tsconfig.node.json` → `include: ["vite.config.ts"]` **한 파일만**, node types

루트에 새 툴링 파일을 만들면 **어느 쪽에도 포함되지 않아 타입 체크가 통째로 건너뛰어진다.** `tsconfig.node.json` 의 `include` 에 직접 추가해야 한다.

### 빌드를 깨뜨리는 컴파일러 옵션

- `verbatimModuleSyntax` — 타입 전용 import 는 반드시 `import type { X }`
- `erasableSyntaxOnly` — `enum`, 생성자 파라미터 프로퍼티, 런타임 `namespace` 사용 불가
- `noUnusedLocals` / `noUnusedParameters` — 안 쓰는 변수는 **빌드 실패**다
- `allowImportingTsExtensions` — 로컬 import 에 확장자를 붙인다 (`'./App.tsx'`)
- **TS 6부터 `baseUrl` 은 폐기됐다.** `paths` 는 tsconfig 파일 위치 기준으로 해석된다

`package.json` 에 `"type": "module"` 이 있어 전부 ESM 이다.

### 린트 — oxlint

설정은 `.oxlintrc.json`. `react/rules-of-hooks`: error, `react/only-export-components`: warn.
타입 인식 규칙은 꺼져 있다. 켜려면 `oxlint-tsgolint` 설치 후 `"options": { "typeAware": true }`.

**`oxlint --rules` 는 이 버전(1.78)에서 아무것도 출력하지 않는다.** 규칙 지원 여부를 확인하려면 목록을 뒤지지 말고 `yarn oxlint --deny <규칙명> <파일>` 로 직접 걸어볼 것. ESLint 규칙 상당수가 목록에 안 보여도 실제로는 동작한다.

## 코드 스타일 — 함수는 화살표로

`func-style: ["error", "expression"]` 로 **강제된다.** 컴포넌트·훅·유틸 전부 `const x = () => {}` 형태다.

```ts
export const validateEmail = (value: string): string | null => { ... }   // O
export function validateEmail(value: string) { ... }                     // X — 빌드 전 린트에서 막힌다
```

제네릭이 붙는 경우 `.tsx` 파서가 JSX 로 오해하므로 **쉼표를 붙인다.**

```ts
export const request = async <T,>(path: string): Promise<T> => { ... }
```

기술적으로 `function` 선언이 열등해서가 아니라 **한 코드베이스 안에서 섞이지 않게 하려는 것**이다. 문서에만 적어두면 반드시 어긋나므로 규칙으로 묶었다.

### 스타일 — SCSS + CSS Modules

- 슬라이스별 스타일은 `.module.scss` 로 colocate
- 전역은 `src/app/styles/global.scss` 와 `src/shared/styles/` 뿐
- `src/shared/styles/_tokens.scss` 가 **모든 색·형태를 CSS 커스텀 프로퍼티로** 정의한다. 색을 하드코딩하지 말고 토큰을 추가하거나 재사용할 것
- `_mixins.scss` 는 컴파일 타임 상수(브레이크포인트)와 믹스인. 슬라이스에서는 `@use '@/shared/styles' as s;` 로 가져온다
- **`@import` 는 폐기 예정이라 쓰지 않는다.** `@use` / `@forward` 만

### 폰트 — Wanted Sans Variable

npm 패키지의 **split 서브셋** 버전을 `main.tsx` 에서 import 한다. `unicode-range` 로 실제 쓰는 글자 범위만 내려받는다. 통짜(complete) 파일은 1.29MB 라 쓰지 않는다.

**캔버스에 이 폰트로 글자를 그릴 때는 `useFontReady` 로 로딩을 반드시 기다려야 한다.** `document.fonts` 는 폰트가 화면에 쓰이기 전까지 다운로드를 미루는데 캔버스 `fillText` 는 그 트리거가 아니다. 기다리지 않으면 폴백 폰트가 샘플링돼 글자 모양이 달라진다.

## `shared/ui/WaferCanvas` 를 건드릴 때

로그인 배경의 웨이퍼 노광 애니메이션. 이 파일에는 눈에 안 보이는 제약이 여럿 있다.

- **다이 격자는 셀 크기를 고정하지 않는다.** 웨이퍼 지름을 항상 70개로 나눈다(`DIES_ACROSS`). 셀을 고정하면 화면이 커질 때 다이 수가 제곱으로 늘어 부하가 폭증하고, 작은 화면에서는 글자가 깨진다
- **글자 판정은 다이 중심 한 점이 아니라 3×3 면적 커버리지**다. 한 점만 보면 `S` 의 얇은 사선이 격자 사이로 빠져 글자가 끊긴다
- 폰트 굵기는 **500**. 올리면 격자에서 뭉개진다
- **컨테이너가 40px 미만이면 빌드를 건너뛴다.** 레이아웃 확정 전에 그리면 글자가 캔버스 밖으로 나가 점등 다이가 0개가 된다. `ResizeObserver` 가 다시 부른다
- **`shadowBlur` 를 다이마다 걸지 말 것.** 수천 개에 적용하면 프레임을 통째로 잡아먹는다. 반투명 사각형을 뒤에 까는 2패스 방식을 쓰고 있다
- 커서 좌표는 **React state 를 거치지 않는다.** CSS 변수로 DOM 에 직접 쓴다. state 에 두면 `pointermove` 마다 트리가 재조정된다
- `(pointer: coarse)` 에서는 커서 효과를 끄고 리스너도 등록하지 않는다. 터치에서는 탭한 자리에 크로스헤어가 눌어붙는다

### 인트로가 재생되지 않는다면

`sessionStorage` 의 `ibs.intro.seen` 때문이다. **기록은 마운트가 아니라 노광 완료 시점에** 해야 한다 — 마운트에서 찍으면 첫 로드가 이미 "봤음"이 되어 영영 재생되지 않는다(실제로 한 번 겪은 버그다). 개발 모드에서는 아예 건너뛰지 않도록 해뒀다.

### 레이아웃 — 카드가 오른쪽에 붙는다면

웨이퍼 패널에 `flex-grow` 를 주면 남는 폭을 전부 먹어 묶음이 화면을 꽉 채우고, `justify-content: center` 가 아무 일도 하지 않는다. 웨이퍼 폭을 `min(40vw, 520px)` 처럼 **명시적으로 묶어야** 좌우 여백이 생겨 묶음이 실제로 가운데로 온다.

카드 폭을 바꿀 때는 **`AuthLayout.module.scss` 의 `.formPane` 폭과 `AuthCard.module.scss` 의 `.card` `max-width` 를 같이** 고쳐야 한다. 어긋나면 카드가 칸 안에서 다시 가운데 정렬되며 묶음 중앙 정렬이 틀어진다.

### 카드 안에 브랜드 표시가 없는 이유

웨이퍼가 이미 IBS 를 그리므로 워드마크를 중복해 두지 않는다. 다만 **웨이퍼 캔버스는 `aria-hidden` 이라 스크린리더에는 아무것도 전달되지 않는다.** 그래서 `<h1>` 안에 `.srOnly` 로 `IBS` 를 남겨 두었다. 이걸 지우면 보조기기 사용자는 어느 서비스에 로그인하는지 알 수 없다.

## 인증

JWT. 가입·로그인·재발급·로그아웃이 **실제 백엔드와 붙어 동작한다.** 계약은 [docs/api/auth.md](docs/api/auth.md) 에 있고, 백엔드와 공유하는 문서이므로 계약이 바뀌면 거기를 먼저 고친다.

백엔드 띄우는 순서는 `docker compose up -d --wait` → `./gradlew bootRun` (백엔드 저장소에서).

### 토큰을 어디에 두는가

access token 은 `shared/api/tokenStore` 의 **모듈 스코프 변수에만** 둔다. refresh 는 httpOnly 쿠키라 프론트가 만지지 않는다.

**access token 을 Redux store 에 넣지 말 것.** DevTools 에 그대로 노출되고 `redux-persist` 를 붙이면 localStorage 로 샌다. store 에는 `authSlice` 의 `unknown | authenticated | anonymous` 만 둔다.

### 재발급 직렬화는 필수다

**백엔드가 토큰 회전과 재사용 탐지를 한다.** 폐기된 refresh 토큰이 한 번이라도 제시되면 그 사용자의 유효한 토큰까지 전부 무효화된다(실측 확인).

그래서 access token 이 만료된 상태에서 요청 두 개가 동시에 401 을 받으면, 둘 다 재발급을 호출하고 두 번째가 구 토큰을 들고 가 **사용자가 강제 로그아웃된다.** `reissue.ts` 의 `reissueOnce()` 가 진행 중인 Promise 를 공유해 막는다. 이건 최적화가 아니라 없으면 버그다.

**`login`·`signup`·`reissue`·`logout` 의 401 은 재발급 대상에서 제외한다**(`baseQuery.ts` 의 `NO_REISSUE`). 이 경로의 401 은 만료가 아니라 그 자체의 결과다. 재발급으로 받아치면 로그인 실패가 조용히 삼켜지거나 무한 재귀가 된다.

### 새로고침해도 로그인이 유지되는 이유

access token 은 메모리라 새로고침하면 사라지지만 refresh 쿠키는 남는다. `useAuthBootstrap` 이 앱 시작 시 한 번 재발급해 세션을 복구한다. **이 훅을 지우면 새로고침이 곧 로그아웃이다.**

복구가 끝나기 전 상태가 `unknown` 이고, 라우트 가드는 이때 아무것도 렌더하지 않는다. 없으면 보호 화면에서 로그인 화면이 한 번 번쩍인다.

### 로그아웃

서버 요청이 실패해도 **로컬 상태는 반드시 정리한다**(`authApi` 의 `finally`). 안 그러면 사용자는 로그아웃한 줄 아는데 세션이 살아 있다. RTK Query 캐시도 함께 비운다.

### 개발 환경 프록시 — Origin 을 제거한다

`vite.config.ts` 의 proxy 가 `/api` 를 `localhost:8080` 으로 넘긴다. **여기서 `Origin` 헤더를 지운다.**

`changeOrigin: true` 는 `Host` 만 바꾸고 `Origin` 은 그대로 넘긴다. 백엔드 CORS 허용 목록이 `localhost:5173` 고정이라, autoPort 로 다른 포트가 잡히면 **모든 요청이 403** 이 된다(실제로 겪었다). 브라우저 입장에서는 이미 같은 오리진이므로 헤더를 지워 CORS 판정 자체를 없앤다.

### 운영 프록시 — `netlify.toml` (dev proxy 와 한 쌍이다)

`apiBase.ts` 는 `${location.origin}/api` 를 쓴다. 배포된 사이트에서 이게 실제 백엔드에 닿는 것은 `netlify.toml` 이 `/api/*` 를 Railway 로 200 rewrite 하기 때문이다. **dev 의 vite proxy 와 정확히 같은 역할**이라, 한쪽만 알고 있으면 반드시 헷갈린다.

프록시를 없애고 Railway 주소를 직접 부르면 안 된다. refresh 쿠키가 **서드파티 쿠키**가 되어 Safari 가 차단하고, 백엔드의 토큰 회전·재사용 탐지가 통째로 무력해진다. `netlify.app` 과 `up.railway.app` 은 둘 다 Public Suffix List 에 있어 무슨 수를 써도 같은 사이트가 되지 않는다.

**`/api` 규칙이 SPA 폴백보다 위에 있어야 한다.** Netlify 는 위에서부터 처음 맞는 규칙 하나만 적용하므로, 순서가 바뀌면 API 요청이 `index.html` 로 삼켜진다. 그 SPA 폴백도 없으면 안 된다 — 없이 배포했을 때 `/login` 과 `/signup` 이 **404** 였다(실측).

### 백엔드 응답에서 주의할 것

**검증 오류는 전부 `INVALID_INPUT` 하나로 온다.** `GlobalExceptionHandler` 가 Bean Validation 실패를 뭉쳐 첫 필드 메시지만 내려주므로 어느 필드인지 알 수 없다. 그래서 폼 상단에 띄운다. 필드로 보낼 수 있는 코드는 `EMAIL_ALREADY_EXISTS` 뿐이다.

**201 처럼 본문 없이 성공하는 응답이 있다.** `fetchBaseQuery` 가 알아서 처리하지만, 직접 파싱하는 코드를 쓸 때는 상태 코드가 아니라 본문이 실제로 비었는지로 판단할 것 — `res.json()` 은 빈 본문에서 `SyntaxError` 를 던진다.

## 접근성 — 라이브러리가 없으므로 직접 챙긴다

컴포넌트 라이브러리를 쓰지 않기로 했다. 새 입력 요소를 만들 때 아래를 빠뜨리기 쉽다.

- `<label>` + `htmlFor`/`id` 연결. placeholder 로 라벨을 대체하지 않는다
- `autoComplete` 지정. 없으면 비밀번호 관리자가 동작하지 않는다
- 오류는 `aria-invalid` + `aria-describedby` 로 입력과 연결
- 제출 중 `disabled` + `aria-busy`
- 서버 오류는 `role="alert"`
- 상자에 `:focus-within` 으로 테두리를 그렸으면 내부 `input` 의 기본 outline 은 제거해 이중 링을 막는다
- 장식성 애니메이션은 `prefers-reduced-motion` 에서 반드시 끈다 (`_mixins.scss` 의 `reduced-motion` 믹스인)

## 아이디 저장 — 자동 로그인과 구분할 것

`features/auth/model/rememberedEmail.ts` 는 `localStorage` 에 **이메일만** 넣는다. 세션을 유지하는 게 아니라 다음 방문에 칸을 채워줄 뿐이다. **비밀번호나 토큰을 여기 추가하지 말 것** — access token 은 메모리, refresh 는 httpOnly 쿠키다.

**저장은 로그인 성공 시에만 한다.** 제출 시점에 저장하면 오타로 실패한 주소가 기억돼 다음 로그인에 그대로 채워진다.

## 보안상 지켜야 할 것

401 응답 메시지는 **어느 쪽이 틀렸는지 알려주지 않는다.** 계정 열거를 막기 위한 것이므로 서버가 준 구체적 문구를 그대로 노출하지 말 것. `useLogin` 이 `UNAUTHORIZED` 를 고정 문구로 덮어쓰고 있다.
