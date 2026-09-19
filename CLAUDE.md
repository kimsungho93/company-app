@AGENTS.md

# Claude Code 보충

공통 구조·설계·검증 규칙은 [AGENTS.md](AGENTS.md), 실행·계획 평가·리뷰·인수인계는 [README.md](README.md)를 따른다. 이 파일에는 Claude 전용 설정과 영역별 규칙의 연결을 둔다.

## 실제 훅 범위

[.claude/settings.json](.claude/settings.json)에 설정된 훅은 다음과 같다.

| 훅                            | 실행 조건과 범위                                                                                                                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PostToolUse`의 `Edit\|Write` | [lint-file.mjs](.claude/hooks/lint-file.mjs)가 도구 응답의 파일 경로를 읽는다. 저장소 안의 존재하는 `ts/tsx/js/jsx/mjs/cjs` 파일이면 해당 파일에 `yarn oxlint`를 실행한다. 다른 도구나 문서·SCSS 변경 전체를 검사하지 않는다.                                                                       |
| `Stop`                        | [verify-before-stop.mjs](.claude/hooks/verify-before-stop.mjs)가 `git status --porcelain -- '*.ts' '*.tsx'`로 변경을 확인한다. 변경이 있으면 `yarn tsc -b`와 `yarn vitest run --changed --passWithNoTests`를 실행하며 실패 시 종료를 차단한다. Git 조회 실패나 대상 변경이 없으면 검사 없이 끝난다. |

이 훅은 Codex에서 실행되지 않으며 포맷·전체 테스트·모듈 경계·프로덕션 빌드·브라우저 확인을 대신하지 않는다. 공통 명령인 `yarn verify`·`yarn verify:all`과 [조건별 검증 표](README.md#검증-선택)를 사용한다. 변경 테스트가 없어서 성공한 결과와 실제 테스트 실행을 구분한다. CI의 실제 실행 범위는 [.github/workflows/ci.yml](.github/workflows/ci.yml)에서 확인한다.

현재 권한 설정은 `npm install`·`npm ci`·`pnpm`을 거절하고 `yarn add/remove`에는 확인을 요청한다. 나머지 명령의 허용 여부는 설정과 현재 실행 환경의 권한을 따른다. 문서가 실행 권한을 추가하지 않는다.

## 영역별 규칙

`.claude/rules/`의 `paths`가 해당 영역에 연결된다. 상세 정책은 각 파일과 현재 코드·계약을 확인하며 공통 문서에 중복하지 않는다.

| 규칙                                             | 적용 영역                                         |
| ------------------------------------------------ | ------------------------------------------------- |
| [auth-session.md](.claude/rules/auth-session.md) | `shared/api`, 인증·관리 feature, `app`, `widgets` |
| [websocket.md](.claude/rules/websocket.md)       | `shared/ws`, 끝말잇기, 사람 뽑기                  |
| [word-chain.md](.claude/rules/word-chain.md)     | 끝말잇기 feature·page                             |
| [lottery.md](.claude/rules/lottery.md)           | 사람 뽑기 feature·page                            |
| [leave.md](.claude/rules/leave.md)               | 휴가 feature·page                                 |
| [wafer-canvas.md](.claude/rules/wafer-canvas.md) | `WaferCanvas`, `AuthLayout`, `AuthCard`           |
| [theme-styles.md](.claude/rules/theme-styles.md) | SCSS, `shared/theme`, `index.html`                |
