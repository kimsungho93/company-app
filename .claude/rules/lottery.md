---
paths:
  - "src/features/lottery/**"
  - "src/pages/LotteryPages/**"
---

# 사람 뽑기 (추첨방)

계약은 `docs/api/lottery.md` 하나다. 설계 스펙 문서는 없다. 백엔드와 공유하므로 계약이 바뀌면 거기를 먼저 고친다. 소켓 공통 규칙은 `websocket.md` 에 있다.

## 무엇인가

방장이 이름 명단을 넣고 시작하면 **서버가** 섞어서 4초마다 한 명씩 당첨자를 공개한다. 나머지는 관전자다. 화면은 three.js 추첨 기계, 당첨자 트레이, 결과 PNG 저장, 방 채팅(기록·검색·발신자 필터·읽음·입력 중)과 멤버를 도는 WebGL 궤도다.

조립: `api/`(RTK Query + STOMP 이벤트 타입) → `model/`(`useLotteryLobby` 목록, `useLotteryRoom` 방 연결, `lotteryChatTransport` 채팅 게이트, `useLotteryChat` 낙관적 전송) → `ui/`(`LotteryRoom` 이 `LotteryMachine`·`WinnerTray`·`LotterySettingsPanel`·`chat/LotteryChatPanel` 을 조립). 페이지는 `me` 를 받은 뒤에야 방을 마운트한다 — `myUserId` 없이는 방장 판정을 못 한다.

## 연결 순서는 REST → 구독 → enter → READY 다

1. `POST /lottery/rooms/{id}/join` (멱등). 끝말잇기와 마찬가지로 **참가자가 아니면 구독이 거절된다.**
2. `/topic/lottery/rooms/{id}` · `/user/queue/errors` · `/topic/lottery/rooms/{id}/chat` · `/user/queue/lottery-chat` 구독.
3. `/app/lottery/rooms/{id}/enter` 에 빈 메시지. 구독 뒤 enter 를 생략하면 스냅샷이 오지 않는다.
4. `/user/queue/lottery-chat` 로 `{type:'READY'}` 가 오면 그때 연결 완료다. **READY 전에는 채팅 명령을 보내지 않는다.** 15초 안에 안 오면 재연결 안내.

구형 백엔드는 READY 를 보내지 않는다. **백엔드를 먼저 배포**하고 프론트를 올린다.

## 스냅샷

- 서버가 `LotterySnapshot` 을 통째로 방송한다. `version` 이 낮거나 같으면 버린다 — 재연결·중복 입장으로 같은 버전이 다시 온다. 첫 스냅샷은 받아들인다.
- `drawId` 는 추첨 시작마다 증가하고 reset 으로 되돌아가지 않는다. 판을 구분하는 키는 이것이다.
- 옵션(`participants`·`winnerCount`)은 방에 있고 방장만 `PUT /settings` 로 바꾼다. '저장하고 추첨' 은 저장 성공을 확인한 뒤에 `start` 를 보낸다. 저장 실패·연결 종료·화면 이탈이면 start 를 보내지 않는다.

## 끊김 — 방에 남는다

서버는 마지막 연결이 끊긴 뒤 **30초 유예**를 주고 그 안에 enter 로 돌아오면 삭제를 취소한다. 그래서 끊겨도 목록으로 보내지 않고 방에 남아 "다시 연결" 을 띄운다. 끝말잇기 규칙을 여기 적용하면 멀쩡한 멤버십을 버리게 된다.

연결 중에는 **5초마다, 그리고 탭으로 돌아올 때 `GET /lottery/rooms/{id}` 로 재검증**한다. 401·403·404 나 연속 두 번 실패면 연결을 끊고 재연결을 안내한다. 소켓만 믿으면 방이 지워진 뒤에도 화면이 살아 있다.

명시적 `leave` 는 그 계정의 모든 탭을 내보낸다. 마지막 멤버가 나가면 추첨 중이어도 방이 즉시 사라진다.

## 목록은 이벤트로 갱신한다

`/topic/lottery/lobby` 의 `{type:'ROOMS_CHANGED'}` 를 받으면 다시 조회한다. 주기 폴링은 쓰지 않는다. 조회 중에 알림이 오면 끝난 뒤 한 번 더 조회한다 — 늦게 온 응답이 최신 변경을 덮지 않게 하려는 것이다. 연결 복구와 탭 복귀 때도 다시 조회한다. 이 구독은 방 멤버로 치지 않는다.

## 애니메이션은 서버 시각으로만 계산한다

공이 나오는 시점은 `drawnAt + serverOffsetMs` 로 정한다. 클라이언트 시계는 식에 들어오지 않는다. 늦게 들어온 사람은 현재 시점에 맞춰 이어서 본다. 단계별 길이는 `model/drawTiming.ts` 한 곳에 있고 결과 카드는 `WINNER_EXIT_MS`(2.8초) 뒤에 뜬다. 공의 위치나 애니메이션이 당첨 결과를 바꾸지 않는다.

`LotteryMachine` 은 `lazy()` 로, 궤도 씬은 `import('./orbitScene')` 로 분리되어 있다. three.js 가 메인 번들에 들어오지 않게 하려는 것이므로 정적 import 로 바꾸지 않는다.

## 채팅

- 정렬은 수신 순서가 아니라 `seq` 다. 중복은 합친다.
- 전송 성공은 브로커 수신이 아니라 **ACK 또는 내 MESSAGE 수신**으로 확정한다. 재시도는 같은 `clientMessageId` 를 보내면 서버가 기존 메시지를 돌려준다.
- 기록·검색 응답은 `requestId` 로 구분한다. 검색을 바꾼 뒤 늦게 온 응답을 버리기 위해서다.
- 읽음은 **열린 채팅·활성 탭에서 실제 보이는 메시지만** 보낸다. 검색으로 건너뛴 대화가 읽음 처리되면 안 된다.
- 한글 조합 중 Enter 는 전송하지 않는다. 끝말잇기 `AnswerBar` 와 같은 규칙이다.
- 계정당 10초에 5개다. `CHAT_RATE_LIMIT` 는 채팅 안에서 표시하고 추첨 조작의 busy·오류 상태와 섞지 않는다.
- 훅이 돌려주는 `messages` 는 매 렌더 새 배열이다. 이것을 이펙트 deps 에 넣으면 키 입력마다 이펙트가 돈다 — 지금 `LotteryChatPanel` 이 그렇다. 알려진 문제이고 고치면 이 줄을 지운다.

## 기본 참가자 명단

`model/participants.ts` 의 `DEFAULT_PARTICIPANTS` 는 실명이고 공개 번들에 그대로 실린다. 명단을 바꾸거나 빼려면 여기 한 곳이다.
