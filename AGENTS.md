# 프런트 작업 지침

## 구조

- React / TypeScript / Vite 기반 사내 시스템이다. 의존성 버전은 `package.json`과 `yarn.lock`을 확인한다.
- `app`은 설정·라우팅, `pages/widgets`는 화면 조립, `features`는 기능, `shared`는 도메인 독립 요소를 담당한다.
- feature 외부에서는 공개 `index.ts`를 사용한다. 새로운 feature 간 의존은 필요성과 상위 계층에서 조립할 수 있는지 검토한다.
- `shared`에서 `features` 등 상위 계층을 참조하지 않는다.

## 컴포넌트 설계

- 도메인 독립 UI는 `shared/ui`, 업무 의미가 있는 부품은 해당 feature에 둔다. 사용자 정보 등 여러 기능의 연결은 pages/widgets에서 조립한다.
- 반복되는 UI·동작이나 독립적인 책임을 기준으로 분리한다. 파일 길이만으로 쪼개거나 사용처가 없는 범용 옵션을 미리 만들지 않는다.
- 사용자가 요청하지 않은 설명 주석·JSDoc·변경 이력 주석은 추가하지 않는다. 의도는 이름과 구조로 드러내고, 필요한 설명은 작업 답변에 적는다. 도구 동작에 필요한 지시문과 라이선스 표시는 예외로 둔다.
- 복잡한 조회·변경 흐름은 feature의 model hook에, 표시 부품은 필요한 데이터와 이벤트 props에 집중한다. 서버 데이터를 별도 상태로 복제하지 않는다.
- 대화상자는 `Dialog`, 인증 카드 틀은 `AuthCard`, 일반 동작 버튼은 `Button`을 우선 재사용한다. 폼 제출 버튼에는 `type="submit"`을 명시한다.
- 목록은 로딩·조회 실패·정상적인 빈 결과를 구분한다. 공통 대화상자 변경은 중첩·Escape·닫은 뒤 포커스 복귀도 확인한다.

## 실행·검증 명령

저장소 루트에서 Yarn을 사용한다. 저장소의 `.yarnrc.yml`과 Yarn 릴리스 파일을 유지하고 패키지 매니저를 혼용하지 않는다.

| 목적 | 명령 |
| --- | --- |
| 개발 서버 | `yarn dev` |
| 린트 | `yarn lint` |
| 전체 테스트 | `yarn test` |
| 관련 테스트 | `yarn vitest run <테스트 파일>` |
| 타입 검사·빌드 | `yarn build` |

## 상태·API·UI

- 서버 데이터는 기존 RTK Query `baseApi`에 연결한다. 화면별로 인증·오류 처리를 중복 구현하지 않는다.
- access token은 `shared/api/tokenStore`, 재발급은 `reissueOnce`를 사용한다. 토큰을 Redux나 영구 저장소에 복제하지 않는다.
- 테마는 기존 `shared/theme`, 게임 방 상태는 서버 스냅샷을 받는 기존 소켓 흐름을 따른다.
- API·소켓 연결 변경 시 `vite.config.ts`, `netlify.toml`, `shared/ws/wsUrl.ts`의 개발·운영 경로를 함께 확인한다.
- 기존 공통 UI와 SCSS Modules·디자인 토큰을 재사용한다. 새 스타일은 `shared/styles/_tokens.scss`의 역할별 토큰을 우선 사용한다.
- 중성 배경·카드와 블루 강조색을 기본으로 한다. 상태·주말·공휴일 색상은 역할을 분리하고, 버튼의 장식용 그라데이션·색 그림자는 추가하지 않는다.
- 변경한 UI는 해당 화면의 테마·반응형·키보드 조작과 로딩·오류·빈 상태를 확인한다.

## 관련 문서와 완료 기준

- API 작업은 [docs/api](docs/api), 기능·화면 작업은 [docs/superpowers/specs](docs/superpowers/specs)에서 해당 문서만 확인한다.
- REST 필드·오류 코드·권한·날짜 표현·STOMP 이벤트 변경 시 백엔드 사용처와 계약 문서를 함께 확인한다.
- 현재 백엔드는 `../../backend/company-backend`에 있다. 다른 체크아웃에서는 실제 위치를 확인한다.
- 코드 변경은 관련 테스트와 lint·build로 검증한다. 버그 수정은 가능한 경우 실패를 재현하는 회귀 테스트로 확인한다.
- API·소켓 mock 테스트 통과와 실제 백엔드 연동 성공을 구분한다.
- UI 동작·인증·연결 변경은 관련 브라우저 흐름도 확인한다. jsdom만으로 배치·포커스·쿠키·실제 WebSocket을 검증했다고 판단하지 않는다.
- 변경 내용, 실행한 검증 결과, 미검증 범위와 이유를 보고한다.
