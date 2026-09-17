---
paths:
  - "src/shared/ws/**"
  - "src/features/word-chain/**"
  - "src/features/lottery/**"
---

# WebSocket · STOMP

`shared/ws/stompClient.ts` 의 `connectStomp` 가 유일한 진입점이다. 끝말잇기와 사람 뽑기가 같이 쓴다.

## 운영에서 소켓만 프록시를 우회한다 (실측)

`netlify.toml` 의 200 rewrite 는 `Upgrade`·`Connection` 헤더를 떨군다. 요청은 Railway 까지 가지만 업그레이드가 성립하지 않아 Tomcat 이 400 으로 거절한다. 재시도로 풀릴 문제가 아니다.

| 경로 | 결과 |
|---|---|
| `wss://ibs-app.netlify.app/api/ws` | 실패 |
| `wss://<railway>/api/ws` | 101 Switching Protocols |

그래서 **운영에서는 Netlify 환경변수 `VITE_WS_URL` 이 Railway 주소를 직접 가리킨다.** 없으면 `wsUrl.ts` 가 same-origin 으로 떨어져 배포 사이트에서 소켓이 안 붙는다. 코드가 아니라 환경변수라 저장소를 봐서는 알 수 없다. REST 는 그대로 프록시를 거친다 — refresh 쿠키 때문이며 바뀌면 안 된다.

## 인증

- 핸드셰이크 `/api/ws` 는 백엔드에서 `permitAll` 이다. `new WebSocket(url)` 은 헤더를 붙일 수 없어 업그레이드 요청에 토큰을 실을 방법이 없다. 구멍이 아니다 — 인증은 CONNECT 프레임의 `Authorization` 헤더, 구독 권한은 SUBSCRIBE 프레임 검사에서 한다. **토큰을 쿼리 스트링에 넣지 않는다.** 접속 로그에 남는다.
- 연결 전에 토큰이 없으면 `reissueOnce()` 를 거친다. 소켓에는 REST 처럼 401 을 받고 재발급하는 흐름이 없다.
- 본문이 있는 publish 에는 `content-type: application/json` 이 있어야 서버가 역직렬화한다. `connectStomp` 의 `publish` 가 붙여 주므로 `client.publish` 를 직접 부르지 않는다.

## 끊김

- **서버가 정상 종료하면 `onWebSocketError` 가 아니라 `onWebSocketClose` 만 뜬다.** close 를 안 들으면 재배포 때마다 붙어 있던 클라이언트가 죽은 화면이 된다(실제로 겪었다).
- 내가 `close()` 로 나가는 것은 `leaving` 플래그로 가른다. 안 그러면 방을 나갈 때마다 끊김 안내가 뜬다.
- close code `4001` + reason `SESSION_*` 은 세션 종료다. `sessionStore.end` 로 넘기고 끊김으로 다루지 않는다. `1011` 은 서버 쪽 일시 장애다.
- `connectStomp` 는 `sessionStore.onEvent` 에서 소켓을 닫는다. 이벤트 종류를 가리지 않아 다른 탭 로그인(`started`)에도 조용히 닫히고, 이때 `leaving` 이라 화면이 끊김을 모른다 — 알려진 문제이고 고치면 이 줄을 지운다.

## 끊긴 뒤 무엇을 할지는 서버의 퇴장 처리에 달렸다

| | 끝말잇기 | 사람 뽑기 |
|---|---|---|
| 서버 | 끊김 = 즉시 퇴장 | 마지막 연결 끊김 후 30초 유예 |
| 화면 | 방 목록으로 보낸다 | 방에 남아 재연결 안내 |

끝말잇기에서 재연결만 하면 좌석이 이미 없어 화면이 거짓말을 한다 — 사람들이 그대로 서 있고 버튼도 눌리는데 아무 일도 안 일어난다. 사람 뽑기에서 목록으로 보내면 멀쩡한 멤버십을 버린다. 한쪽 규칙을 다른 쪽에 옮기지 않는다.

## 방 상태는 Redux 에 넣지 않는다

서버가 스냅샷을 통째로 방송하므로 훅이 받은 것을 그대로 그린다. 조각내 받으면 순서가 뒤집혔을 때 화면이 어긋난다.

소켓을 여는 블록(토큰 확보 → `connectStomp` → 늦은 `onConnect` 는 `close()` → 언마운트 시 `close()`)이 `useRoomSocket`·`useLotteryRoom`·`useLotteryLobby` 세 곳에 거의 같게 있다. 네 번째를 만들지 말고 `shared/ws` 로 올린다.
