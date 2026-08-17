# 로그인 화면 설계

작성일: 2026-08-10
갱신일: 2026-08-11 (구현 완료 시점 기준으로 전면 개정)
대상: `front/company-app` (Vite + React 19 + TypeScript)

## 1. 배경과 목적

`company-app` 은 `backend/company-backend`(Spring Boot)와 짝을 이루는 프론트엔드다. 양쪽 모두 백지 상태에서 시작했고, 로그인 화면이 첫 화면이자 프로젝트 구조를 결정하는 기준점이다.

회사(IBS / ibslab.com)는 반도체·스마트팩토리 영역이다. 화면의 시각 언어를 여기서 끌어왔다.

## 2. 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 패키지 구조 | feature 기반 3레이어 (`app` / `features` / `shared`) | 지금 규모에 맞으면서 FSD로 무중단 확장 가능 |
| 인증 | JWT — access는 메모리, refresh는 httpOnly 쿠키 | localStorage 대비 XSS 노출 축소 |
| 스타일링 | SCSS + CSS Modules (`.module.scss`) | 슬라이스별 격리, 커스텀 연출에 제약 없음 |
| 컴포넌트 라이브러리 | 사용하지 않음 | 필요한 건 입력 2개·버튼 1개, 비주얼은 전량 커스텀 |
| 폰트 | Wanted Sans Variable (npm, split 서브셋) | 한글 가변 폰트, OFL. 필요한 유니코드 범위만 전송 |
| 테마 | 다크 — 딥 네이비 배경 + 시안 액센트 | 장비·계측 UI 의 결. 발광 표현이 어두운 배경에서만 산다 |
| 레이아웃 | 좌우 분할 — 왼쪽 웨이퍼, 오른쪽 카드 | 카드가 브랜드를 가리지 않는다 |
| 인트로 | 스테퍼 노광으로 IBS 를 웨이퍼에 새김 | 도트가 글자를 이루는 것이 공정 그 자체가 된다 |

### 폐기된 초기 결정

초기에는 밝은 톤 · 파스텔 레이어드 카드 · CI 주황(`#ED6D00`) 이었다. 세 가지 이유로 전부 폐기했다.

- 파스텔 겹침 카드는 배경 도트가 들어오자 서로 시선을 뺏었다.
- `#ED6D00` 위 흰 글씨는 명도 대비 **3.09:1** 로 WCAG AA(4.5:1) 미달이었다. 장시간 보는 로그인 버튼으로 부적합.
- 밝고 아기자기한 톤은 반도체·AI 라는 사업 영역과 맞지 않았다.

현재 시안 버튼은 **어두운 글씨**를 얹어 대비 **10.4:1** 이다. 밝은 면에 흰 글씨를 얹던 구조적 문제가 사라졌다.

## 3. 패키지 구조

```
src/
├── app/
│   ├── App.tsx
│   └── styles/global.scss          # reset + 토큰 적용
│
├── features/
│   └── auth/
│       ├── ui/
│       │   ├── LoginPage.tsx       + LoginPage.module.scss
│       │   └── LoginForm.tsx       + LoginForm.module.scss
│       ├── model/
│       │   ├── useLogin.ts         # 제출·로딩·에러 상태
│       │   └── validate.ts         # 순수 함수 검증 규칙
│       ├── api/
│       │   ├── login.ts            # 지금은 mock. USE_MOCK 플래그 하나로 전환
│       │   └── types.ts
│       └── index.ts                # public API
│
└── shared/
    ├── api/
    │   ├── client.ts               # fetch 래퍼 + 401 재시도
    │   ├── reissue.ts              # 재발급. 동시 요청은 하나로 합친다
    │   ├── tokenStore.ts           # access token 메모리 보관
    │   └── ApiError.ts
    ├── ui/
    │   ├── Button/
    │   ├── TextField/
    │   └── WaferCanvas/            # 노광 인트로 + 웨이퍼 배경
    ├── lib/
    │   ├── usePrefersReducedMotion.ts
    │   └── useFontReady.ts
    └── styles/
        ├── _tokens.scss  _mixins.scss  index.scss
```

### 의존성 규칙

- 방향은 `app → features → shared` **단방향**. `shared` 는 `features` 를 참조하지 않는다.
- feature끼리 직접 import 하지 않는다. 조립은 `app` 에서 한다.
- feature 외부에서는 `features/auth/index.ts` 가 export 한 것만 쓴다.
- import 는 `@/` alias 를 쓴다. **`vite.config.ts` 의 `resolve.alias` 와 `tsconfig.app.json` 의 `paths` 양쪽에 설정해야 한다.**

### 배치 판단 기준

**도메인 지식이 없으면 `shared`, 있으면 `features`.**

> **초기 설계에서 바뀐 점** — `tokenStore` 는 원래 `features/auth/model` 에 두려 했으나 `shared/api/client` 가 이를 필요로 한다. 그대로 두면 `shared → features` 역방향 의존이 생기므로 `shared/api` 로 옮겼다. 토큰 보관은 auth 도메인 지식이 아니라 HTTP 계층의 관심사다.

### 확장 경로

화면이 늘면 `pages`, `entities`, `widgets` 를 **추가만** 한다. 기존 파일 이동이나 개명은 없다.

## 4. 인증 흐름

### API 계약

```
POST /api/auth/login
  요청  { email: string, password: string }
  200   { accessToken: string, expiresIn: number }
        + Set-Cookie: refreshToken (HttpOnly, Secure, SameSite=Lax)
  401   { code: "INVALID_CREDENTIALS", message: string }

POST /api/auth/reissue
  요청  (본문 없음, refresh 쿠키만)
  200   { accessToken: string, expiresIn: number }
  401   재로그인 필요
```

`expiresIn` 은 **초 단위** 이며 access token 의 잔여 유효 시간이다.

### 동작

1. 모든 요청에 `credentials: 'include'` 를 붙인다.
2. accessToken 은 `tokenStore` 의 모듈 스코프 변수에만 둔다. **localStorage·sessionStorage 에 쓰지 않는다.** 새로고침 시 소실되며 `reissue` 로 복구한다.
3. 401 응답 시 재발급 후 원 요청을 **1회만** 재시도한다. 재시도도 401이면 그대로 던진다.
4. 로그인 요청 자체는 재시도 대상에서 제외한다(`skipAuthRetry`). 자격 증명이 틀린 것이지 토큰이 만료된 게 아니다.
5. 동시에 여러 요청이 401을 받아도 **재발급은 한 번만** 수행한다. 진행 중인 Promise 를 공유한다. 토큰 회전을 쓰는 서버에서 중복 요청이 나가면 뒤늦은 쪽이 폐기된 토큰을 들고 가 전부 실패한다.

### 개발 환경 CORS

`vite.config.ts` 의 `server.proxy` 가 `/api` 를 `http://localhost:8080` 으로 넘긴다. 브라우저에서 같은 오리진이 되므로 쿠키 `SameSite` 와 preflight 문제를 피한다. 포트는 `PORT` 환경변수로 덮어쓸 수 있다(옆 프로젝트와 5173 이 겹친다).

### 백엔드 미구현 대응

`features/auth/api/login.ts` 의 `USE_MOCK = true` 인 동안 800ms 지연 후 가짜 응답을 준다.

- `test@ibslab.com` / `password1234` → 200
- `error@ibslab.com` → 네트워크 오류 (실패 경로 수동 확인용)
- 그 외 → 401 `INVALID_CREDENTIALS`

**실제 연결은 `USE_MOCK` 을 false 로 바꾸는 것으로 끝난다.** 다른 계층은 손대지 않는다.

## 5. 화면 사양

### 레이아웃

가로 900px 초과에서 좌우 분할. **웨이퍼와 카드를 한 묶음으로 보고 그 묶음을 화면 중앙에 정렬한다.**

각자를 자기 칸 안에서 가운데 정렬하면 카드가 화면 오른쪽 끝에 붙는다. 특히 웨이퍼에 `flex-grow` 를 주면 남는 폭을 전부 먹어 묶음이 화면을 꽉 채우고, `justify-content: center` 가 아무 일도 하지 않는다. 그래서 웨이퍼 폭을 `min(40vw, 520px)` 로 **명시적으로 묶었다.** 카드 중심이 화면 폭의 약 72% 지점에 온다.

900px 이하에서는 세로로 쌓인다 — 웨이퍼가 위(`clamp(170px, 28svh, 280px)`), 카드가 아래. 가로로 누운 폰(높이 520px 이하)에서는 웨이퍼를 130px 로 더 줄인다.

`env(safe-area-inset-*)` 로 노치 영역을 피한다.

### 웨이퍼 — `shared/ui/WaferCanvas`

원형 웨이퍼 윤곽에 하단 노치, 그 안에 사각 다이 격자. 다이 사이에 스크라이브 레인 간격(셀의 26%)을 둔다.

**다이 격자는 셀 크기를 고정하지 않고 지름을 일정 개수로 나눈다.** 셀을 고정하면 화면이 커질수록 다이 수가 제곱으로 늘어 부하가 폭증한다.

기본은 지름당 70개다. 다만 모바일처럼 웨이퍼가 작을 때 70개를 그대로 쓰면 다이가 서브픽셀이 되어 뭉개지고 커버리지 샘플링도 같은 픽셀을 반복해 읽는다. **셀이 3.5px 아래로 내려가면 개수를 줄인다**(최소 40개).

실측 결과 데스크톱은 다이 3,648개 · 글자 21행, 모바일(375×812)은 2,226개 · 17행이다. 양쪽 모두 `S` 의 곡선이 끊기지 않는다.

### 글자 샘플링

오프스크린 캔버스에 `IBS` 를 그리고 픽셀을 읽어 다이 점등 여부를 정한다.

- **다이 중심 한 점이 아니라 3×3 지점의 면적 커버리지**를 계산해 35% 이상이면 켠다. 한 점만 보면 `S` 의 얇은 사선이 격자 사이로 빠져 글자가 끊긴다.
- 폰트 굵기는 **500**. 900은 격자에서 지나치게 두꺼워진다.
- **웹폰트 로딩을 반드시 기다린다.** `document.fonts` 는 폰트가 화면에 쓰이기 전까지 다운로드를 미루는데 캔버스 `fillText` 는 그 트리거가 아니다. 기다리지 않으면 폴백 폰트가 샘플링된다. → `useFontReady`
- **컨테이너 크기가 40px 미만이면 빌드를 건너뛴다.** 레이아웃 확정 전에 그리면 글자가 캔버스 밖으로 나가 점등되는 다이가 0개가 된다. `ResizeObserver` 가 제대로 된 크기로 다시 부른다.

### 인트로 — 스테퍼 노광 (총 2.4초)

| 구간 | 동작 |
|---|---|
| ALIGN (샷의 0~35%) | 점선 프레임만 놓인다 |
| EXPOSE (35~60%) | 섬광 + 슬릿이 샷 내부를 위→아래로 훑는다. 글자를 포함한 샷만 강하게 |
| STEP (60~100%) | 다음 위치로 이동 |
| DEVELOP | 래스터 완료 후 웨이브가 훑으며 글자 전체가 펄스 |

노광된 다이는 **백색으로 각인됐다가 시안으로 식는다**(`heat` 값 감쇠). 빛으로 새겨진 뒤 남는다는 인과를 색으로 보여준다. 미노광 영역은 거의 보이지 않아 진행이 드러난다.

샷은 전체 60~70회를 유지하도록 한 변의 다이 수를 격자에 맞춰 계산한다.

### 상시 인터랙션

- 커서 근처 다이가 밝아지고, 글자 다이끼리 **맨해튼 라우팅**(직각만)으로 이어지며 꺾이는 지점에 비아 점을 찍는다. 대각선을 쓰지 않는 것만으로 회로처럼 읽힌다.
- 커서를 따라 얼라인먼트 크로스헤어가 움직인다.
- 카드 테두리에 커서를 따라다니는 시안 하이라이트. `mask-composite` 로 1px 테두리에만 그라디언트를 남긴다.

### 성능 규칙

- 커서 좌표를 React state 에 두지 않는다. CSS 커스텀 프로퍼티(`--cx`, `--cy`)에 직접 써 리렌더를 없앤다.
- 캔버스는 순수 장식이므로 DOM 텍스트를 곁들이지 않는다. 초기에 다이 수·수율·노광 단계를 표시하는 HUD 를 뒀으나, 로그인 화면에 계측 정보가 붙을 이유가 없어 제거했다.
- **`shadowBlur` 를 다이마다 걸지 않는다.** 수천 개에 적용하면 프레임을 통째로 잡아먹는다. 큰 반투명 사각형을 뒤에 까는 2패스 방식으로 같은 인상을 낸다.
- 커서 근접도는 프레임당 한 번만 계산해 다이에 들고 있는다.

### 모션 축소 대응

`prefers-reduced-motion: reduce` 면 인트로 없이 완성 상태로 그리고, 버튼 이동·스피너 회전을 끈다.

인트로는 `sessionStorage` 로 **세션당 1회만** 재생한다. 두 가지 단서가 붙는다.

- **기록 시점은 마운트가 아니라 노광 완료 시점이다.** 마운트에서 찍으면 첫 로드가 이미 "봤음"이 되어 그 뒤로는 영영 재생되지 않는다.
- **개발 모드(`import.meta.env.DEV`)에서는 건너뛰지 않는다.** 새로고침마다 인트로를 봐야 작업이 된다.

### 터치 기기

`(pointer: coarse)` 에서는 커서 기반 효과를 아예 끈다. 크로스헤어와 배선은 손가락에 가려 보이지 않고, 탭한 자리에 그대로 눌어붙는다. 이벤트 리스너도 등록하지 않는다.

입력 폰트는 터치 기기에서 **16px** 로 키운다. iOS 는 16px 미만이면 포커스 시 화면을 확대한다. 입력 높이도 50px 로 키워 터치 타깃 권장치(44px)를 넘긴다.

### 카드

- 폭 400px(모바일에서는 전폭). 반투명 + `backdrop-filter` 블러로 배경 격자가 뒤로 비친다.
- 모서리 라운드 4px — 장비 UI 의 각진 느낌.
- 네 모서리에 ㄱ자 얼라인먼트 마크.
- 라벨은 모노스페이스 대문자(`EMAIL`, `PASSWORD`) — 계측기 느낌.
- **`formPane` 의 폭은 카드의 `max-width` 와 같아야 한다.** 어긋나면 카드가 칸 안에서 다시 가운데 정렬되면서 묶음 중앙 정렬이 틀어진다.

카드 상단에 있던 마크 + `IBS` 워드마크 + `SECURE ACCESS` 뱃지는 제거했다. 브랜드를 두 번 말할 필요가 없고(웨이퍼가 이미 IBS 를 그린다) 뱃지는 정보가 없는 장식이었다.

**대신 `<h1>` 안에 화면에 보이지 않는 `IBS` 텍스트를 남겼다.** 웨이퍼 캔버스가 `aria-hidden` 이라 워드마크를 지우면 스크린리더 사용자에게 브랜드를 알려줄 곳이 하나도 없어진다. 지금 접근성 트리에서 제목은 "IBS 다시 만나서 반가워요" 로 읽힌다.

## 6. 접근성

컴포넌트 라이브러리를 쓰지 않으므로 전부 직접 구현했다.

- 모든 입력에 `<label>` + `htmlFor`/`id` 연결. placeholder 로 라벨을 대체하지 않는다.
- `autoComplete="email"`, `autoComplete="current-password"`. 없으면 비밀번호 관리자가 동작하지 않는다.
- 오류는 `aria-invalid` + `aria-describedby` 로 입력과 연결.
- `:focus-visible` 포커스 링. 입력 상자는 `:focus-within` 으로 테두리를 그리고 내부 `input` 의 기본 outline 은 제거해 이중 링을 막는다.
- `<form onSubmit>` — Enter 제출이 따라온다.
- 제출 중 `disabled` + `aria-busy="true"`.
- 서버 오류는 `role="alert"`.
- 비밀번호 보기 토글은 `aria-pressed` 를 갖고 `tabIndex={-1}` 이다. 탭 순서를 이메일 → 비밀번호 → 로그인으로 유지한다.
- 웨이퍼 캔버스는 `aria-hidden`. 장식이며 브랜드명은 카드의 워드마크가 전달한다.

## 7. 에러 처리

| 상황 | 표시 |
|---|---|
| 이메일 형식 오류 | 필드 하단. **제출을 한 번 시도한 뒤부터** 타이핑 중에도 갱신 |
| 빈 값 / 8자 미만 | 필드 하단 |
| 401 | 폼 상단 `role="alert"` — "이메일 또는 비밀번호가 올바르지 않습니다" (계정 열거 방지로 어느 쪽이 틀렸는지 구분하지 않음) |
| 네트워크 · 5xx | 폼 상단 `role="alert"`, 해당 메시지 |

어떤 경우에도 입력값을 초기화하지 않는다. 비밀번호는 `trim` 하지 않는다 — 공백도 유효한 문자다.

## 7-1. 아이디 저장

`features/auth/model/rememberedEmail.ts` 가 `localStorage` 에 **이메일만** 보관한다.

**자동 로그인과는 다르다.** 세션을 유지하는 것이 아니라 다음 방문에 이메일 칸을 채워줄 뿐이다. 그래서 refresh 토큰 정책과 무관하게 지금 넣을 수 있다. 비밀번호나 토큰은 절대 여기 넣지 않는다 — access token 은 메모리, refresh 는 httpOnly 쿠키다.

| 규칙 | 이유 |
|---|---|
| **로그인에 성공했을 때만 저장한다** | 오타로 실패한 주소를 기억하면 다음 로그인에 그 오타가 그대로 채워진다 |
| 체크 해제 + 성공 시 저장값을 지운다 | 공용 PC 에서 해제가 즉시 반영되어야 한다 |
| 저장값이 있으면 초기 포커스를 비밀번호로 보낸다 | 이미 채워진 칸에 커서를 두는 것은 헛걸음이다 |
| 스토리지 접근이 던져도 삼킨다 | 사파리 프라이빗 모드 등에서 접근 자체가 예외다. 기억하지 못하는 것이 로그인을 막을 이유는 아니다 |

체크박스는 `shared/ui/Checkbox` 다. **네이티브 `<input type="checkbox">` 를 시각적으로만 감추고 스타일 박스를 얹었다.** div 로 흉내 내면 키보드 조작과 스크린리더 상태 전달을 전부 직접 구현해야 한다. 체크·포커스 상태는 `:checked` / `:focus-visible` 형제 선택자로 끌어온다.

## 8. 테스트

`vitest` + `@testing-library/react` + `jsdom`. 현재 16개 통과.

| 대상 | 케이스 |
|---|---|
| `validate.ts` | 이메일 형식·공백·빈 값, 비밀번호 길이·공백 처리 |
| `useLogin` | 성공, 401(메시지 마스킹 확인), 네트워크 실패, 오류 해제 |
| `reissue` | 성공 시 토큰 저장, **동시 호출 시 요청 1회만**, 실패 시 토큰 소거, 실패 후 재시도 가능 |

웨이퍼 캔버스는 시각 요소이므로 자동 테스트하지 않는다.

## 9. 의존성

런타임: `react`, `react-dom`, `wanted-sans`
개발: `sass`, `vitest`, `@testing-library/*`, `jsdom` (+ 기존 vite·oxlint·typescript)

## 10. 범위 밖

- 소셜 로그인 — 백엔드에 OAuth 설정이 없다
- 회원가입·비밀번호 찾기 **화면** — 링크 자리만 있다
- 라우터 — 두 번째 화면에서 `app/providers` 에 추가
- 상태관리 라이브러리 — `tokenStore` + `useState` 로 충분
- 라이트 테마 — 다크가 이 디자인의 전제다
- **자동 로그인(로그인 유지)** — refresh 쿠키 만료·회전 정책이 정해진 뒤 논의. 아래 "아이디 저장"과 혼동하지 말 것

## 11. 후속 작업

- `company-backend` 의 `/api/auth/login`, `/api/auth/reissue` 구현과 Spring Security 설정
- refresh 토큰 만료·회전 정책
- 로그인 성공 후 이동할 화면 (지금은 버튼 라벨만 "접속 중…"으로 바뀐다)
- `USE_MOCK` 제거와 `MOCK_CREDENTIALS` 안내 문구 제거
