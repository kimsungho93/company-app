---
paths:
  - "**/*.scss"
  - "src/shared/theme/**"
  - "index.html"
  - "src/main.tsx"
---

# 테마 · 스타일 · 폰트

- 슬라이스별 스타일은 `.module.scss` 로 colocate 한다. 전역은 `src/app/styles/global.scss` 와 `src/shared/styles/` 뿐이다.
- `shared/styles/_tokens.scss` 가 모든 색·형태를 CSS 커스텀 프로퍼티로 정의한다. 색을 하드코딩하지 말고 토큰을 추가하거나 재사용한다. 지금 추첨 기계·다이얼로그 backdrop·휴가 종류 팔레트에 토큰 밖 색이 남아 있다 — 손대는 김에 토큰으로 올린다.
- `_mixins.scss` 는 컴파일 타임 상수와 믹스인이다. 슬라이스에서는 `@use '@/shared/styles' as s;` 로 가져온다. 브레이크포인트는 `s.below(s.$bp-tablet)`(900px)·`s.below(s.$bp-mobile)`(560px) 이고 원시 `@media (max-width: …)` 를 쓰지 않는다. 장식 애니메이션은 `s.reduced-motion` 으로 끈다.
- **토큰 믹스인을 `.module.scss` 에서 `@use` 하지 않는다.** `_tokens.scss` 에 최상위 `:root` 블록이 있어 팔레트가 그 모듈 CSS 에 통째로 복제된다.
- `.srOnly` 가 `Lottery.module.scss`·`LotteryChat.module.scss`·`AuthCard.module.scss` 세 곳에 같은 정의로 있다. 네 번째를 만들지 말고 `_mixins.scss` 로 올린다.

## 테마 — 상태는 셋이다

명시적 라이트, 명시적 다크, **아무것도 안 고름(시스템 따름, 기본값)**. `_tokens.scss` 가 라이트를 `:root` 기본값으로 두고 `@mixin dark-tokens` 를 `prefers-color-scheme` 미디어 쿼리와 `[data-theme='dark']` 두 곳에 건다.

- 진실은 `<html data-theme>` 속성이다. `shared/theme` 의 `themeStore` 가 이 속성과 `localStorage` 의 `ibs.theme` 을 함께 관리하고 `useTheme` 이 `useSyncExternalStore` 로 구독한다. **Redux 에 복사하지 않는다** — `index.html` 의 인라인 스크립트와 진실이 두 곳으로 갈린다.
- **`index.html` 의 인라인 스크립트를 지우지 않는다.** 첫 페인트 전에 `data-theme` 을 박지 않으면 새로고침마다 반대 테마가 한 번 번쩍인다. React 이펙트는 첫 페인트 뒤에 돈다.
- 셀렉터에 `:root` 를 붙이지 않은 이유는 하위 요소에 붙여도 동작해야 해서다. `AuthLayout` 이 `<main data-theme="dark">` 로 로그인·회원가입을 항상 다크로 고정한다. 폼은 다크 토큰을 유지하고 3D 캠퍼스의 밝은 장면 팔레트는 배경 패널 안에 한정한다.
- **토큰 이름은 톤이 아니라 역할이다.** `--bg-deep` 이 아니라 `--bg-sunken`, `--text-hi` 가 아니라 `--text-strong`. 톤 기반 이름은 반대 테마에서 뜻을 잃는다.
- `--text-subtle` 은 양쪽 다 대비 2.9:1 이라 **장식성 라벨 전용**이고 본문에 쓰지 않는다.
- **`--accent` 는 테마마다 관계가 뒤집힌다.** 다크는 시안 바탕에 어두운 글자, 라이트는 어두운 청록 바탕에 흰 글자다. 시안(`#22d3ee`)은 흰 배경에서 대비 1.6:1 이라 그대로 쓸 수 없다. `--accent-ink` 가 "강조색 위에 얹는 글자색" 이라는 역할 이름이라 값만 뒤집으면 `Button` 은 안 바뀐다.

## 폰트 — Wanted Sans Variable

npm 패키지의 **split 서브셋**을 `main.tsx` 에서 import 한다. `unicode-range` 로 실제 쓰는 글자 범위만 내려받는다. 통짜(complete) 파일은 1.29MB 라 쓰지 않는다. 캠퍼스 간판 텍스처는 시스템 글꼴을 사용하며 한국어 브랜드·안내 문구는 DOM으로 표시한다.
