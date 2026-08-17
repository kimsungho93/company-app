# company-app

사내 시스템 프론트엔드. 백엔드(`company-backend`, Spring Boot)와 짝을 이룬다.

현재 구현된 화면은 **로그인 · 회원가입 · 홈** 세 개이고, 인증은 JWT 로 실제 백엔드와 붙어 동작한다.

## 실행

```bash
yarn install
yarn dev
```

백엔드가 필요하면 `company-backend` 에서 `docker compose up -d --wait` → `./gradlew bootRun` 을 먼저 띄운다. 개발 서버의 프록시가 `/api` 를 `localhost:8080` 으로 넘긴다.

| 명령어 | 하는 일 |
|---|---|
| `yarn dev` | 개발 서버 (HMR) |
| `yarn build` | 타입 검사 후 프로덕션 빌드 |
| `yarn lint` | oxlint |
| `yarn test` | 테스트 |
| `yarn preview` | 빌드 결과물 서빙 |

**패키지 매니저는 yarn 이다.** `npm install` 을 실행하면 `package-lock.json` 이 생겨 `yarn.lock` 과 어긋난다.

## 스택

React 19 · TypeScript · Vite · Redux Toolkit(RTK Query) · react-router · SCSS Modules · Vitest · oxlint

컴포넌트 라이브러리는 쓰지 않는다. 필요한 입력 요소가 적고 화면의 시각 언어가 커스텀이라, 접근성은 직접 챙긴다.

## 구조

```
src/
├── app/         조립 계층 + 라우팅 + store
├── pages/       라우트 단위 화면
├── features/    도메인 단위 (auth)
└── shared/      도메인을 모르는 것들
```

의존성은 `app → pages → features → shared` 단방향이다. 배치 기준은 하나 — **도메인 지식이 없으면 `shared`, 있으면 `features`.**

## 화면

로그인 배경은 웨이퍼 노광 애니메이션이다. 회사가 반도체 영역이라 시각 언어를 거기서 끌어왔다. 캔버스에 `IBS` 를 그려 픽셀을 샘플링하고, 그 좌표의 다이를 스테퍼가 한 샷씩 노광하듯 점등시킨다.

## 문서

| 문서 | 내용 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | 코드베이스 규칙과 함정. 작업 전에 읽을 것 |
| [docs/api/auth.md](docs/api/auth.md) | 인증 API 계약. 백엔드와 공유한다 |
| [docs/superpowers/specs/](docs/superpowers/specs/) | 화면 설계와 폐기된 대안 |
