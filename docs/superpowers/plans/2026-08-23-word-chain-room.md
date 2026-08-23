# 끝말잇기 B — 대기실 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방에 들어가면 참가자가 무대에 서고, 아바타를 고르고 준비하면 방장이 게임을 시작할 수 있게 한다.

**Architecture:** WebSocket(STOMP)이 이 프로젝트에 처음 들어온다. `shared/ws` 가 연결·구독·전송만 하는 얇은 층이고 도메인을 모른다. 방 상태는 서버가 통째로 브로드캐스트하므로 화면은 받은 스냅샷을 그대로 그린다 — Redux 에 넣지 않는다. 무대·연단·아바타 선택은 전부 props 로만 그리는 순수 컴포넌트라 소켓 없이 테스트한다.

**Tech Stack:** React 19 · TypeScript 6 · `@stomp/stompjs` (신규) · RTK Query · SCSS Modules · vitest + @testing-library

**Spec:** [docs/superpowers/specs/2026-08-23-word-chain-room-design.md](../specs/2026-08-23-word-chain-room-design.md)

## Global Constraints

- 정원 **10명**, 무대는 **2단 계단**(뒷줄 5 · 앞줄 5). 5명 이하면 앞줄만
- 아바타는 `MALE` · `FEMALE` 둘. 안 고른 사람은 `null` 이고 화면에는 `MALE` 로 그린다
- **`ready` 는 사실대로 온다.** 방장에게는 준비 버튼이 없어 대개 `false` 다. 시작 조건은 **"방장을 뺀 전원이 준비"** 로 센다
- `players` 배열 순서가 곧 무대 배치 순서다. **화면이 정렬하지 않는다**
- `ready` 는 토글이 아니라 **값을 보낸다** (`{ "ready": true }`)
- 함수는 전부 화살표다 — `func-style: ["error", "expression"]` 로 린트가 막는다
- **주석을 달지 않는다.** 설명이 필요하면 이름을 고치고, 그래도 남으면 커밋 메시지나 `CLAUDE.md` 에 쓴다
- **커밋은 사용자가 요청할 때만 한다.** 각 작업은 검증까지 하고 멈춘다
- 타입 전용 import 는 `import type { X }` (`verbatimModuleSyntax`)
- 안 쓰는 변수는 빌드 실패다 (`noUnusedLocals`)
- 색은 `_tokens.scss` 의 CSS 커스텀 프로퍼티만. 하드코딩 금지
- 애니메이션·트랜지션은 `reduced-motion` 믹스인에서 꺼야 한다
- 패키지 매니저는 **yarn**. `npm install` 을 쓰면 `package-lock.json` 이 생겨 `yarn.lock` 과 어긋난다
- 검증: `yarn lint` · `yarn tsc -b` · `yarn test` · `yarn build`

## 선행 조건 — 사람이 해야 하는 것

**아바타 이미지 2개가 `public/avatars/` 에 있어야 한다.**

```
public/avatars/male.png
public/avatars/female.png
```

3D 클레이 스타일 정사각 이미지다. **없어도 코드는 돌고 테스트도 통과한다**(jsdom 은 이미지를
불러오지 않는다). 화면에서 깨진 이미지로 보일 뿐이다.

**넣었다 (2026-08-23).** 사용자가 준 1254×1254 원본을 **256×256 으로 줄여** 넣었다 —
연단에서 80px 안팎으로 그려지므로 3배면 충분하고, 원본 그대로면 번들이 2.7MB 늘어난다.

## 파일 구조

```
src/shared/ws/
├── wsUrl.ts              연결 주소. 환경변수로 덮어쓸 수 있다
├── stompClient.ts        connectStomp — 연결·구독·전송. 도메인을 모른다
├── stompClient.test.ts
└── index.ts

src/features/word-chain/
├── api/types.ts          (수정) RoomState · Player · Avatar 추가
├── model/
│   ├── avatars.ts        아바타 경로·라벨. 화면 두 곳이 같은 표를 본다
│   ├── useRoomSocket.ts  방 하나의 구독과 전송을 엮는다
│   ├── useRoomSocket.test.ts
│   └── seats.ts          players 를 뒷줄·앞줄로 가른다 (순수)
│       seats.test.ts
├── ui/
│   ├── PlayerPodium.tsx      아바타 + 연단 + 이름 + 표시
│   ├── PlayerPodium.module.scss
│   ├── Stage.tsx             2단 계단
│   ├── Stage.module.scss
│   ├── Stage.test.tsx
│   ├── AvatarPicker.tsx      남 · 여
│   ├── AvatarPicker.module.scss
│   ├── ReadyBar.tsx          준비 또는 시작
│   ├── ReadyBar.module.scss
│   ├── ReadyBar.test.tsx
│   └── RoomView.tsx          위를 조립. 소켓을 모른다
│       RoomView.module.scss
│       RoomView.test.tsx
└── index.ts              (수정)

src/pages/WordChainRoomPage/  (수정) 소켓을 붙이고 RoomView 에 내려준다
```

**`RoomView` 가 소켓을 모르는 것이 이 구조의 핵심이다.** 상태와 콜백을 props 로만 받으므로
소켓 없이 전부 테스트된다. 소켓은 페이지가 붙인다.

---

## Task 1: 백엔드 B 요청서

**Files:**
- Create: `../../backend/company-backend/docs/requests/2026-08-23-room-socket.md`

**Interfaces:**
- Consumes: 없음
- Produces: 아래 STOMP 계약. Task 3·5 의 타입이 이것을 따른다

옆 저장소에 넘길 지시서다. 그쪽 `docs/requests/README.md` 규칙이 "파일 하나만 읽고 구현할 수
있어야 한다"이므로 프론트 문서를 참조하라고 쓰지 않는다.

- [ ] **Step 1: 요청서를 쓴다**

````markdown
# 방 소켓 — 대기실 (끝말잇기 2단계)

상태: **대기**
요청일: 2026-08-23

방에 들어간 뒤부터 게임이 시작되기 직전까지다. 게임 진행과 사전 판정은 다음 요청이다.

## 1. 참가자 상태

현재 `Room` 은 참가자를 `Set<Long> players` 로 들고 있다. 사람마다 상태가 붙는다.

```
Player
  userId     Long
  name       String     화면에 그릴 이름
  avatar     MALE | FEMALE | null
  ready      boolean
  sessionId  String     끊겼을 때 누구를 뺄지 찾는 데 쓴다
```

**`name` 이 반드시 있어야 한다.** 프론트에는 사용자 목록이 없어서 `userId` 만으로는 이름을
그릴 수 없다. 방 목록이 `hostName` 을 내려보내는 것과 같은 이유다.

**`enter` 시점에 이름을 박아두면** 이후 브로드캐스트마다 DB 를 다시 읽지 않아도 된다.
브로드캐스트는 입장·준비·아바타·퇴장마다 나가는데 그때마다 10명 이름을 읽으면 낭비다.

**입장 순서를 지켜야 한다.** 지금 `LinkedHashSet` 이 지키고 있고, 방장이 나갈 때 "가장 먼저
들어온 사람에게 양도"하는 규칙이 그 순서에 기댄다.

**`ready` 는 사실대로 내려보낸다.** 방장에게는 준비 버튼이 없으므로 대개 `false` 다.
시작 조건은 **"방장을 뺀 전원이 준비"** 로 판정한다. 값을 `true` 로 속이면 양도한 순간 그
사람의 진짜 준비 상태를 알 수 없게 된다.

## 2. 구독 — 서버가 보내는 것

| 목적지 | 내용 |
|---|---|
| `/topic/rooms` | 방 목록 요약. `GET /api/rooms` 와 같은 모양의 배열 |
| `/topic/rooms/{id}` | 방 상태 전체 |
| `/user/queue/errors` | 그 사람에게만 `{ code, message }` |

```json
{
  "id": 7,
  "name": "점심내기 한판",
  "status": "WAITING",
  "hostId": 2,
  "capacity": 10,
  "players": [
    { "userId": 2, "name": "김성호", "avatar": "MALE",   "ready": true },
    { "userId": 5, "name": "이영희", "avatar": "FEMALE", "ready": false },
    { "userId": 9, "name": "박철수", "avatar": null,     "ready": false }
  ]
}
```

**어떤 메시지를 처리하든 방 상태 전체를 브로드캐스트한다.** 조각내지 않는다 — 순서가
뒤집히면 화면이 어긋나고, 재접속한 사람에게 현재 상태를 만들어 줄 방법이 없어진다.

인원이 바뀌면 `/topic/rooms` 에도 갱신된 목록을 보낸다.

## 3. 전송 — 클라이언트가 보내는 것

| 목적지 | 본문 | 권한 |
|---|---|---|
| `/app/rooms/{id}/enter` | 없음 | 참가자 |
| `/app/rooms/{id}/avatar` | `{"avatar":"MALE"}` | 본인 |
| `/app/rooms/{id}/ready` | `{"ready":true}` | 본인 (방장 제외) |
| `/app/rooms/{id}/transfer` | `{"userId":5}` | 방장 |
| `/app/rooms/{id}/leave` | 없음 | 참가자 |
| `/app/rooms/{id}/start` | 없음 | 방장 |

**`ready` 는 토글이 아니라 값을 받는다.** 토글이면 메시지가 한 번 유실됐을 때 화면과 서버가
영원히 반대가 된다.

`start` 는 2명 이상이고 전원 준비일 때만 받는다. 아니면 `NOT_ALL_READY` · `NOT_ENOUGH_PLAYERS` 다. 지금은 `status` 를 `PLAYING`
으로 바꾸기만 하면 된다 — 턴·타이머는 다음 요청이다.

## 4. 좌석의 수명 — 여기가 제일 중요하다

```
① POST /api/rooms/{id}/join   (이미 구현됨) players 에 추가
② 클라이언트가 소켓 연결 + /topic/rooms/{id} 구독
③ /app/rooms/{id}/enter        이 세션이 이 방의 것임을 알린다
```

**③이 필요한 이유** — 세션이 끊겼을 때 누구를 어느 방에서 뺄지 알아야 한다. 구독만 보고
추측하지 말고 명시적으로 받는다.

세션↔방 매핑을 **별도 맵으로 두지 말고 `Player.sessionId` 에 두는 편**이 낫다. 맵을 따로
두면 `RoomRegistry` 와 갈라질 수 있다. 끊길 때 방들을 훑어 찾으면 되고,
`leaveOtherRooms` 가 이미 그렇게 훑는다.

**`enter` 도 `room.has(userId)` 를 확인해야 한다.** 안 보면 REST join 을 건너뛰고 바로
방에 들어앉을 수 있다.

**연결이 끊기면 퇴장으로 처리한다.** `SessionDisconnectEvent` 를 듣는다. 안 하면 브라우저를
닫은 사람이 방에 남아 유령 인원이 정원을 먹고, 10명짜리 방이 금세 못 쓰게 된다.

**①과 ③ 사이에 탭을 닫으면 좌석이 남는다.** ① 이후 **30초 안에 ③이 오지 않으면 좌석을
회수**한다.

이미 방에 있는 사람이 새로고침하면 ①이 다시 불린다. 지금 `Room.join` 이 이미 있으면 그대로
돌려주므로 중복 입장이 아니다 — 그대로 두면 된다.

## 5. 인증과 구독 권한

**CONNECT 프레임 헤더의 access token** 으로 한다. 쿠키를 쓰지 않는다 — 소켓이 Railway 에
직접 붙어야 할 수도 있는데, 그때 쿠키를 쓰면 서드파티 쿠키가 되어 Safari 가 막는다.

`ChannelInterceptor` 에서 CONNECT 를 가로채 토큰을 검증하고 `Principal` 을 세운다.
검증에 실패하면 연결을 거절한다.

한 번 맺은 연결은 토큰이 만료돼도 유지한다. 인증은 연결 시점에만 한다.

### 구독을 막지 않으면 방 비밀번호가 장식이 된다

**STOMP 는 SUBSCRIBE 를 자동으로 검사하지 않는다.** 소켓만 붙이면 누구나
`SUBSCRIBE /topic/rooms/7` 로 남의 비밀방 참가자 목록과 진행 상황을 계속 받아볼 수 있다.
`POST /join` 의 비밀번호 검사를 통째로 우회한다.

`ChannelInterceptor` 에서 **SUBSCRIBE 프레임의 목적지에서 방 id 를 뽑아 참가자인지 확인**한다.
아니면 거절한다. 이건 화면 정리가 아니라 접근 제어다.

### 사람이 빠지는 경로가 셋이다

| | |
|---|---|
| 다른 방에 들어감 | 이미 구현됨 (`leaveOtherRooms`) |
| 소켓 끊김 | `SessionDisconnectEvent` |
| 30초 안에 `enter` 가 없음 | 좌석 회수 |

셋 다 똑같이 네 가지를 해야 한다 — **참가자 제거 → 방장이었으면 양도 → 빈 방이면 삭제 →
브로드캐스트.** 하나라도 빠지면 클라이언트 화면이 서버와 어긋난다. **한 메서드로 모으고
트리거만 셋으로** 두는 편이 안전하다.

### 브로드캐스트는 원자 구간 밖에서

`computeIfPresent` 안에서 메시지를 보내면 그동안 맵 잠금을 쥐고 있게 된다. `compute` 가
돌려준 새 `Room` 을 받아서 그다음에 보낸다.

## 6. 오류

`/user/queue/errors` 로 **그 사람에게만** 보낸다. 형태는 REST 와 같은 `{ code, message }` 다.

| `code` | 상황 |
|---|---|
| `NOT_ROOM_HOST` | 방장이 아닌데 시작·양도 |
| `NOT_ALL_READY` | 전원 준비 전에 시작 |
| `NOT_ENOUGH_PLAYERS` | 방장 혼자 시작 |
| `NOT_IN_ROOM` | 그 방의 참가자가 아님 |
| `ROOM_NOT_FOUND` | |

## 7. 엔드포인트 경로

`2026-08-23-websocket-probe.md` 에서 연 `/api/ws` 를 그대로 쓴다. 이번에는 인증을 건다.

**SockJS 폴백은 켜지 않는다.** 켜면 WebSocket 이 막혀도 폴링으로 돌아가 문제가 가려진다.

## 8. 범위 밖

- 턴 · 타이머 · 답 판정 · 스포트라이트
- 사전 연동
- 관전자 (게임이 있어야 성립한다)
- 채팅
````

- [ ] **Step 2: 스펙과 어긋나지 않는지 대조**

`docs/superpowers/specs/2026-08-23-word-chain-room-design.md` 의 3·4·5장과 목적지 이름,
필드, 오류 코드가 같은지 본다. 다르면 **스펙을 먼저 고치고** 지시서를 맞춘다.

---

## Task 2: 소켓 주소와 STOMP 클라이언트

**Files:**
- Modify: `package.json` (의존성 추가)
- Modify: `vite.config.ts` (dev 프록시에 WebSocket 켜기)
- Create: `src/shared/ws/wsUrl.ts`
- Create: `src/shared/ws/stompClient.ts`
- Create: `src/shared/ws/index.ts`
- Test: `src/shared/ws/stompClient.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `WS_URL: string`
  - `interface StompConnection { subscribe: <T,>(destination: string, onMessage: (body: T) => void) => () => void; publish: (destination: string, body?: unknown) => void; close: () => void }`
  - `connectStomp(options: { url: string; token: string; onConnect: (c: StompConnection) => void; onError: () => void }): StompConnection`

- [ ] **Step 1: 의존성을 넣는다**

```bash
yarn add @stomp/stompjs
```

설치 로그에 **`YN0002` 경고가 있는지 반드시 본다.** yarn 은 peer dependency 를 자동 설치하지
않아서, 그 경고가 곧 런타임 실패다. 나오면 빠진 패키지를 직접 추가한다.

- [ ] **Step 2: 연결 주소를 만든다**

`src/shared/ws/wsUrl.ts`

```ts
const fromEnv = import.meta.env.VITE_WS_URL as string | undefined

const sameOrigin = (): string => {
  const origin = globalThis.location?.origin ?? ''
  return `${origin.replace(/^http/, 'ws')}/api/ws`
}

export const WS_URL = fromEnv ?? sameOrigin()
```

**운영에서는 `VITE_WS_URL` 을 반드시 준다.** Netlify 의 200 rewrite 가 `Upgrade`·`Connection`
헤더를 떨궈 WebSocket 이 성립하지 않는 것을 2026-08-23 에 실측으로 확인했다. 소켓만 Railway
주소에 직접 붙는다.

```
VITE_WS_URL=wss://company-backend-production-2da7.up.railway.app/api/ws
```

Netlify 의 환경변수에 넣는다. **REST 는 그대로 프록시를 거친다** — refresh 쿠키가 서드파티
쿠키가 되면 안 된다.

개발에서는 환경변수 없이 같은 오리진을 쓴다. dev 서버 포트가 `autoPort` 로 매번 달라져서
백엔드 허용 오리진에 고정할 수 없기 때문이다.

- [ ] **Step 2b: dev 프록시에서 WebSocket 을 켠다**

`vite.config.ts` 의 `proxy['/api']` 에 `ws: true` 를 더하고, WebSocket 업그레이드에도
`Origin` 을 지운다. `proxyReq` 는 HTTP 요청에만 걸려서 소켓은 그대로 지나간다.

```ts
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
          proxy.on('proxyReqWs', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
```

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`src/shared/ws/stompClient.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const activate = vi.fn()
const deactivate = vi.fn()
const publish = vi.fn()
const subscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
let captured: Record<string, unknown> = {}

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation((config: Record<string, unknown>) => {
    captured = config
    return { activate, deactivate, publish, subscribe, connected: true }
  }),
}))

const { connectStomp } = await import('./stompClient')

describe('connectStomp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('토큰을 CONNECT 헤더에 싣는다', () => {
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError: vi.fn() })

    expect(captured.connectHeaders).toEqual({ Authorization: 'Bearer abc' })
    expect(captured.brokerURL).toBe('ws://x/api/ws')
    expect(activate).toHaveBeenCalled()
  })

  it('스스로 재연결하지 않는다', () => {
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError: vi.fn() })

    expect(captured.reconnectDelay).toBe(0)
  })

  it('연결되면 onConnect 에 연결 객체를 넘긴다', () => {
    const onConnect = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect, onError: vi.fn() })
    ;(captured.onConnect as () => void)()

    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onConnect.mock.calls[0][0]).toHaveProperty('publish')
  })

  it('본문을 JSON 으로 보낸다', () => {
    const connection = connectStomp({
      url: 'ws://x/api/ws',
      token: 'abc',
      onConnect: vi.fn(),
      onError: vi.fn(),
    })

    connection.publish('/app/rooms/1/ready', { ready: true })

    expect(publish).toHaveBeenCalledWith({
      destination: '/app/rooms/1/ready',
      body: '{"ready":true}',
      headers: { 'content-type': 'application/json' },
    })
  })

  it('본문이 없으면 빈 문자열을 보낸다', () => {
    const connection = connectStomp({
      url: 'ws://x/api/ws',
      token: 'abc',
      onConnect: vi.fn(),
      onError: vi.fn(),
    })

    connection.publish('/app/rooms/1/enter')

    expect(publish).toHaveBeenCalledWith({ destination: '/app/rooms/1/enter', body: '' })
  })

  it('구독은 받은 JSON 을 풀어서 넘긴다', () => {
    const connection = connectStomp({
      url: 'ws://x/api/ws',
      token: 'abc',
      onConnect: vi.fn(),
      onError: vi.fn(),
    })
    const onMessage = vi.fn()
    connection.subscribe('/topic/rooms/1', onMessage)

    const handler = subscribe.mock.calls[0][1] as (m: { body: string }) => void
    handler({ body: '{"id":1}' })

    expect(onMessage).toHaveBeenCalledWith({ id: 1 })
  })

  it('STOMP 오류와 소켓 오류 모두 onError 를 부른다', () => {
    const onError = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError })
    ;(captured.onStompError as () => void)()
    ;(captured.onWebSocketError as () => void)()

    expect(onError).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 4: 실패하는지 확인**

Run: `yarn vitest run src/shared/ws/stompClient.test.ts`
Expected: FAIL — `Failed to resolve import "./stompClient"`

- [ ] **Step 5: 구현한다**

`src/shared/ws/stompClient.ts`

```ts
import { Client } from '@stomp/stompjs'

export interface StompConnection {
  subscribe: <T,>(destination: string, onMessage: (body: T) => void) => () => void
  publish: (destination: string, body?: unknown) => void
  close: () => void
}

export interface ConnectStompOptions {
  url: string
  token: string
  onConnect: (connection: StompConnection) => void
  onError: () => void
}

export const connectStomp = ({
  url,
  token,
  onConnect,
  onError,
}: ConnectStompOptions): StompConnection => {
  const client = new Client({
    brokerURL: url,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 0,
    onConnect: () => onConnect(connection),
    onStompError: onError,
    onWebSocketError: onError,
  })

  const connection: StompConnection = {
    subscribe: (destination, onMessage) => {
      const subscription = client.subscribe(destination, (message) =>
        onMessage(JSON.parse(message.body)),
      )
      return () => subscription.unsubscribe()
    },
    publish: (destination, body) =>
      client.publish(
        body === undefined
          ? { destination, body: '' }
          : {
              destination,
              body: JSON.stringify(body),
              headers: { 'content-type': 'application/json' },
            },
      ),
    close: () => void client.deactivate(),
  }

  client.activate()
  return connection
}
```

`reconnectDelay: 0` 은 라이브러리의 자동 재연결을 끄는 값이다. 재연결은 훅이 한 번만
직접 한다 — 라이브러리가 무한히 재시도하면 서버가 이미 좌석을 회수한 뒤에도 화면이
"연결 중"으로 남는다.

- [ ] **Step 6: 공개 창구를 만든다**

`src/shared/ws/index.ts`

```ts
export { connectStomp } from './stompClient'
export type { StompConnection } from './stompClient'
export { WS_URL } from './wsUrl'
```

- [ ] **Step 7: 통과하는지 확인**

Run: `yarn vitest run src/shared/ws/stompClient.test.ts`
Expected: PASS (7개)

- [ ] **Step 8: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

---

## Task 3: 방 상태 타입과 좌석 배치

**Files:**
- Modify: `src/features/word-chain/api/types.ts`
- Create: `src/features/word-chain/model/seats.ts`
- Test: `src/features/word-chain/model/seats.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type Avatar = 'MALE' | 'FEMALE'`
  - `interface Player { userId: number; name: string; avatar: Avatar | null; ready: boolean }`
  - `interface RoomState { id: number; name: string; status: RoomStatus; hostId: number; capacity: number; players: Player[] }`
  - `splitSeats(players: Player[]): { back: Player[]; front: Player[] }`

- [ ] **Step 1: 타입을 더한다**

`src/features/word-chain/api/types.ts` **끝에** 붙인다. 기존 내용은 그대로 둔다.

```ts
export type Avatar = 'MALE' | 'FEMALE'

export interface Player {
  userId: number
  name: string
  avatar: Avatar | null
  ready: boolean
}

export interface RoomState {
  id: number
  name: string
  status: RoomStatus
  hostId: number
  capacity: number
  players: Player[]
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/features/word-chain/model/seats.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { Player } from '../api/types'
import { splitSeats } from './seats'

const players = (count: number): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    userId: i + 1,
    name: `사람${i + 1}`,
    avatar: null,
    ready: false,
  }))

describe('splitSeats', () => {
  it('5명 이하면 앞줄만 쓴다', () => {
    const { back, front } = splitSeats(players(5))

    expect(back).toHaveLength(0)
    expect(front).toHaveLength(5)
  })

  it('아무도 없으면 둘 다 비어 있다', () => {
    expect(splitSeats([])).toEqual({ back: [], front: [] })
  })

  it('6명이면 반씩 나눈다', () => {
    const { back, front } = splitSeats(players(6))

    expect(back.map((p) => p.userId)).toEqual([1, 2, 3])
    expect(front.map((p) => p.userId)).toEqual([4, 5, 6])
  })

  it('7명이면 뒷줄이 하나 적다', () => {
    const { back, front } = splitSeats(players(7))

    expect(back).toHaveLength(3)
    expect(front).toHaveLength(4)
  })

  it('10명이면 5 · 5 다', () => {
    const { back, front } = splitSeats(players(10))

    expect(back.map((p) => p.userId)).toEqual([1, 2, 3, 4, 5])
    expect(front.map((p) => p.userId)).toEqual([6, 7, 8, 9, 10])
  })

  it('받은 순서를 바꾸지 않는다', () => {
    const { back, front } = splitSeats(players(8))

    expect([...back, ...front].map((p) => p.userId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
```

- [ ] **Step 3: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/model/seats.test.ts`
Expected: FAIL — `Failed to resolve import "./seats"`

- [ ] **Step 4: 구현한다**

`src/features/word-chain/model/seats.ts`

```ts
import type { Player } from '../api/types'

const FRONT_ONLY = 5

export interface Seats {
  back: Player[]
  front: Player[]
}

export const splitSeats = (players: Player[]): Seats => {
  if (players.length <= FRONT_ONLY) return { back: [], front: players.slice() }

  const backCount = Math.floor(players.length / 2)
  return { back: players.slice(0, backCount), front: players.slice(backCount) }
}
```

- [ ] **Step 5: 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/model/seats.test.ts`
Expected: PASS (6개)

---

## Task 4: 연단과 무대

**Files:**
- Create: `src/features/word-chain/model/avatars.ts`
- Create: `src/features/word-chain/ui/PlayerPodium.tsx` · `PlayerPodium.module.scss`
- Create: `src/features/word-chain/ui/Stage.tsx` · `Stage.module.scss`
- Test: `src/features/word-chain/ui/Stage.test.tsx`

**Interfaces:**
- Consumes: Task 3 의 `Player` · `splitSeats`
- Produces:
  - `<PlayerPodium player={Player} isHost={boolean} onSelect={(() => void) | undefined} />`
  - `<Stage players={Player[]} hostId={number} onSelectPlayer={((userId: number) => void) | undefined} />`

`onSelect` 가 `undefined` 면 연단은 버튼이 아니라 그냥 표시다. 방장만 남을 누를 수 있다.

- [ ] **Step 0: 아바타 표를 만든다**

`src/features/word-chain/model/avatars.ts`

```ts
import type { Avatar } from '../api/types'

export interface AvatarOption {
  value: Avatar
  label: string
  src: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { value: 'MALE', label: '남자 아바타', src: '/avatars/male.png' },
  { value: 'FEMALE', label: '여자 아바타', src: '/avatars/female.png' },
]

export const DEFAULT_AVATAR: Avatar = 'MALE'

export const avatarOption = (avatar: Avatar | null): AvatarOption =>
  AVATAR_OPTIONS.find((option) => option.value === (avatar ?? DEFAULT_AVATAR)) ?? AVATAR_OPTIONS[0]
```

경로와 라벨이 한 곳에만 있어야 한다. 연단(Task 4)과 아바타 선택(Task 5)이 같은 표를 보므로
따로 두면 아바타를 하나 더 넣거나 파일명을 바꿀 때 두 곳을 고쳐야 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/Stage.test.tsx`

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Player } from '../api/types'
import { Stage } from './Stage'

const player = (userId: number, over: Partial<Player> = {}): Player => ({
  userId,
  name: `사람${userId}`,
  avatar: null,
  ready: false,
  ...over,
})

describe('Stage', () => {
  it('참가자 이름을 연단에 적는다', () => {
    render(<Stage players={[player(1, { name: '김성호' })]} hostId={1} />)

    expect(screen.getByText('김성호')).toBeInTheDocument()
  })

  it('방장을 표시한다', () => {
    render(<Stage players={[player(1), player(2)]} hostId={2} />)

    const host = screen.getByRole('listitem', { name: '사람2' })
    expect(within(host).getByText('방장')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: '사람1' })).queryByText('방장')).toBeNull()
  })

  it('준비한 사람을 표시한다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={9} />)

    expect(within(screen.getByRole('listitem', { name: '사람1' })).getByText('준비')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: '사람2' })).queryByText('준비')).toBeNull()
  })

  it('방장이 준비여도 방장 표시만 붙는다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={1} />)

    const host = screen.getByRole('listitem', { name: '사람1' })

    expect(within(host).getByText('방장')).toBeInTheDocument()
    expect(within(host).queryByText('준비')).toBeNull()
  })

  it('아바타를 안 고른 사람은 남자로 그린다', () => {
    render(<Stage players={[player(1), player(2, { avatar: 'FEMALE' })]} hostId={9} />)

    const first = within(screen.getByRole('listitem', { name: '사람1' })).getByRole('img')
    const second = within(screen.getByRole('listitem', { name: '사람2' })).getByRole('img')

    expect(first).toHaveAttribute('src', '/avatars/male.png')
    expect(second).toHaveAttribute('src', '/avatars/female.png')
  })

  it('5명이면 한 줄이다', () => {
    render(<Stage players={[1, 2, 3, 4, 5].map((n) => player(n))} hostId={9} />)

    expect(screen.getAllByRole('list')).toHaveLength(1)
  })

  it('6명부터 두 줄이 된다', () => {
    render(<Stage players={[1, 2, 3, 4, 5, 6].map((n) => player(n))} hostId={9} />)

    const [back, front] = screen.getAllByRole('list')

    expect(within(back).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual(
      ['사람1', '사람2', '사람3'],
    )
    expect(
      within(front).getAllByRole('listitem').map((li) => li.getAttribute('aria-label')),
    ).toEqual(['사람4', '사람5', '사람6'])
  })

  it('onSelectPlayer 가 없으면 연단이 버튼이 아니다', () => {
    render(<Stage players={[player(1)]} hostId={9} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('연단을 누르면 그 사람의 userId 를 넘긴다', async () => {
    const user = userEvent.setup()
    const onSelectPlayer = vi.fn()
    render(<Stage players={[player(1), player(7)]} hostId={1} onSelectPlayer={onSelectPlayer} />)

    await user.click(screen.getByRole('button', { name: /사람7/ }))

    expect(onSelectPlayer).toHaveBeenCalledWith(7)
  })

  it('방장 자신의 연단은 누를 수 없다', () => {
    render(<Stage players={[player(1), player(7)]} hostId={1} onSelectPlayer={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /사람1/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/Stage.test.tsx`
Expected: FAIL — `Failed to resolve import "./Stage"`

- [ ] **Step 3: `PlayerPodium` 을 만든다**

`src/features/word-chain/ui/PlayerPodium.tsx`

```tsx
import type { Player } from '../api/types'
import { avatarOption } from '../model/avatars'
import styles from './PlayerPodium.module.scss'

export interface PlayerPodiumProps {
  player: Player
  isHost: boolean
  onSelect?: () => void
}

export const PlayerPodium = ({ player, isHost, onSelect }: PlayerPodiumProps) => {
  const avatar = avatarOption(player.avatar)

  const body = (
    <>
      <img
        className={styles.avatar}
        src={avatar.src}
        alt={avatar.label}
        width={72}
        height={72}
      />
      <span className={styles.podium}>
        <span className={styles.name}>{player.name}</span>
        {isHost && <span className={styles.host}>방장</span>}
        {!isHost && player.ready && <span className={styles.ready}>준비</span>}
      </span>
    </>
  )

  return (
    <li className={styles.seat} aria-label={player.name}>
      {onSelect ? (
        <button type="button" className={styles.hit} onClick={onSelect}>
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  )
}
```

`alt` 를 비우지 않는 이유는 테스트가 `getByRole('img')` 로 아바타를 찾기 때문이다. `alt=""` 는
`presentation` 이 되어 `img` 롤이 사라진다. 이름이 `<li>` 의 `aria-label` 과 겹치지만, 아바타가
남자인지 여자인지는 이름과 다른 정보라 중복이 아니다.

- [ ] **Step 4: `PlayerPodium.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.seat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  list-style: none;
}

.hit {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  transition: translate 0.15s ease;

  &:hover {
    translate: 0 -3px;
  }

  @include s.focus-ring;

  @include s.reduced-motion {
    transition: none;

    &:hover {
      translate: none;
    }
  }
}

.avatar {
  display: block;
  margin-bottom: -8px;
}

.podium {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 6px 6px 3px 3px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.name {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.host,
.ready {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 500;
}

.host {
  background: var(--bg-sunken);
  color: var(--text-muted);
}

.ready {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}
```

- [ ] **Step 5: `Stage` 를 만든다**

`src/features/word-chain/ui/Stage.tsx`

```tsx
import { splitSeats } from '../model/seats'
import type { Player } from '../api/types'
import { PlayerPodium } from './PlayerPodium'
import styles from './Stage.module.scss'

export interface StageProps {
  players: Player[]
  hostId: number
  onSelectPlayer?: (userId: number) => void
}

export const Stage = ({ players, hostId, onSelectPlayer }: StageProps) => {
  const { back, front } = splitSeats(players)

  const row = (seats: Player[], className: string) => (
    <ul className={className}>
      {seats.map((player) => (
        <PlayerPodium
          key={player.userId}
          player={player}
          isHost={player.userId === hostId}
          onSelect={
            onSelectPlayer && player.userId !== hostId
              ? () => onSelectPlayer(player.userId)
              : undefined
          }
        />
      ))}
    </ul>
  )

  return (
    <div className={styles.stage}>
      {back.length > 0 && row(back, `${styles.row} ${styles.back}`)}
      {row(front, styles.row)}
    </div>
  )
}
```

- [ ] **Step 6: `Stage.module.scss` 를 만든다**

```scss
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 28px 20px 24px;
  border-radius: 14px;
  background: var(--bg-sunken);
}

.row {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 18px;
  margin: 0;
  padding: 0;
}

.back {
  padding: 0 40px;
}
```

- [ ] **Step 7: 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/Stage.test.tsx`
Expected: PASS (9개)

---

## Task 5: 아바타 선택과 준비 바

**Files:**
- Create: `src/features/word-chain/ui/AvatarPicker.tsx` · `AvatarPicker.module.scss`
- Create: `src/features/word-chain/ui/ReadyBar.tsx` · `ReadyBar.module.scss`
- Test: `src/features/word-chain/ui/ReadyBar.test.tsx`

**Interfaces:**
- Consumes: Task 3 의 `Avatar`
- Produces:
  - `<AvatarPicker value={Avatar | null} onChange={(avatar: Avatar) => void} />`
  - `<ReadyBar avatar={Avatar | null} onAvatarChange={(a: Avatar) => void} isHost={boolean} ready={boolean} allReady={boolean} onReadyChange={(ready: boolean) => void} onStart={() => void} />`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/ReadyBar.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReadyBar } from './ReadyBar'

const setup = (over: Partial<Parameters<typeof ReadyBar>[0]> = {}) => {
  const props = {
    avatar: null,
    onAvatarChange: vi.fn(),
    isHost: false,
    ready: false,
    allReady: false,
    onReadyChange: vi.fn(),
    onStart: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<ReadyBar {...props} />) }
}

describe('ReadyBar', () => {
  it('아바타를 고르면 알린다', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('radio', { name: '여자 아바타' }))

    expect(props.onAvatarChange).toHaveBeenCalledWith('FEMALE')
  })

  it('고른 아바타가 눌린 상태다', () => {
    setup({ avatar: 'MALE' })

    expect(screen.getByRole('radio', { name: '남자 아바타' })).toBeChecked()
  })

  it('참가자에게는 준비 버튼이 있다', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: '준비' }))

    expect(props.onReadyChange).toHaveBeenCalledWith(true)
  })

  it('준비를 취소하면 false 를 보낸다', async () => {
    const { user, props } = setup({ ready: true })

    await user.click(screen.getByRole('button', { name: '준비 취소' }))

    expect(props.onReadyChange).toHaveBeenCalledWith(false)
  })

  it('방장에게는 준비 버튼이 없고 시작 버튼이 있다', () => {
    setup({ isHost: true, allReady: true })

    expect(screen.queryByRole('button', { name: /준비/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '시작' })).toBeEnabled()
  })

  it('전원 준비 전에는 시작이 막힌다', () => {
    setup({ isHost: true, allReady: false })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('시작을 누르면 알린다', async () => {
    const { user, props } = setup({ isHost: true, allReady: true })

    await user.click(screen.getByRole('button', { name: '시작' }))

    expect(props.onStart).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/ReadyBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./ReadyBar"`

- [ ] **Step 3: `AvatarPicker` 를 만든다**

`src/features/word-chain/ui/AvatarPicker.tsx`

```tsx
import type { Avatar } from '../api/types'
import { AVATAR_OPTIONS } from '../model/avatars'
import styles from './AvatarPicker.module.scss'

export interface AvatarPickerProps {
  value: Avatar | null
  onChange: (avatar: Avatar) => void
}

export const AvatarPicker = ({ value, onChange }: AvatarPickerProps) => {
  return (
    <fieldset className={styles.picker}>
      <legend className="visually-hidden">내 아바타</legend>
      {AVATAR_OPTIONS.map((option) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name="avatar"
            value={option.value}
            checked={value === option.value}
            aria-label={option.label}
            onChange={() => onChange(option.value)}
          />
          <img src={option.src} alt="" width={40} height={40} />
        </label>
      ))}
    </fieldset>
  )
}
```

- [ ] **Step 4: `AvatarPicker.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.picker {
  display: flex;
  gap: 14px;
  margin: 0;
  padding: 0;
  border: 0;
}

.option {
  cursor: pointer;

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  img {
    display: block;
    border-radius: 8px;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--border);
    opacity: 0.5;
    filter: grayscale(0.55);
    transition: box-shadow 0.15s ease, opacity 0.15s ease, filter 0.15s ease;
  }

  &:hover img {
    opacity: 0.8;
    filter: grayscale(0.2);
  }

  input:checked + img {
    box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);
    opacity: 1;
    filter: none;
  }

  input:focus-visible + img {
    outline: 2px solid var(--accent);
    outline-offset: 6px;
  }

  @include s.reduced-motion {
    img {
      transition: none;
    }
  }
}
```

- [ ] **Step 5: `ReadyBar` 를 만든다**

`src/features/word-chain/ui/ReadyBar.tsx`

```tsx
import type { Avatar } from '../api/types'
import { AvatarPicker } from './AvatarPicker'
import styles from './ReadyBar.module.scss'

export interface ReadyBarProps {
  avatar: Avatar | null
  onAvatarChange: (avatar: Avatar) => void
  isHost: boolean
  ready: boolean
  allReady: boolean
  onReadyChange: (ready: boolean) => void
  onStart: () => void
}

export const ReadyBar = ({
  avatar,
  onAvatarChange,
  isHost,
  ready,
  allReady,
  onReadyChange,
  onStart,
}: ReadyBarProps) => {
  return (
    <div className={styles.bar}>
      <span className={styles.label}>내 아바타</span>
      <AvatarPicker value={avatar} onChange={onAvatarChange} />

      {isHost ? (
        <button type="button" className={styles.start} disabled={!allReady} onClick={onStart}>
          시작
        </button>
      ) : (
        <button
          type="button"
          className={ready ? styles.cancel : styles.start}
          aria-pressed={ready}
          onClick={() => onReadyChange(!ready)}
        >
          {ready ? '준비 취소' : '준비'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: `ReadyBar.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.start,
.cancel {
  margin-left: auto;
  padding: 10px 22px;
  border: 0;
  border-radius: 999px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, scale 0.1s ease;

  &:active:not(:disabled) {
    scale: 0.98;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @include s.focus-ring;

  @include s.reduced-motion {
    transition: none;

    &:active:not(:disabled) {
      scale: none;
    }
  }
}

.start {
  background: var(--accent);
  color: var(--accent-ink);

  &:hover:not(:disabled) {
    background: var(--accent-hi);
  }
}

.cancel {
  background: var(--bg-sunken);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--border);

  &:hover:not(:disabled) {
    color: var(--text-strong);
  }
}
```

- [ ] **Step 7: 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/ReadyBar.test.tsx`
Expected: PASS (7개)

---

## Task 6: 방 화면 조립

**Files:**
- Create: `src/features/word-chain/ui/RoomView.tsx` · `RoomView.module.scss`
- Test: `src/features/word-chain/ui/RoomView.test.tsx`
- Modify: `src/features/word-chain/index.ts`

**Interfaces:**
- Consumes: Task 3~5 의 `RoomState` · `Stage` · `ReadyBar`
- Produces: `<RoomView room={RoomState} myUserId={number} onAvatarChange onReadyChange onTransfer onStart onLeave />` — 콜백은 전부 필수

**`RoomView` 는 소켓을 모른다.** 상태와 콜백만 받는다. 그래서 소켓 없이 전부 테스트된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/RoomView.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Player, RoomState } from '../api/types'
import { RoomView } from './RoomView'

const player = (userId: number, over: Partial<Player> = {}): Player => ({
  userId,
  name: `사람${userId}`,
  avatar: null,
  ready: false,
  ...over,
})

const room = (over: Partial<RoomState> = {}): RoomState => ({
  id: 7,
  name: '점심내기 한판',
  status: 'WAITING',
  hostId: 1,
  capacity: 10,
  players: [player(1), player(2)],
  ...over,
})

const setup = (over: Partial<Parameters<typeof RoomView>[0]> = {}) => {
  const props = {
    room: room(),
    myUserId: 2,
    onAvatarChange: vi.fn(),
    onReadyChange: vi.fn(),
    onTransfer: vi.fn(),
    onStart: vi.fn(),
    onLeave: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<RoomView {...props} />) }
}

describe('RoomView', () => {
  it('방 이름과 인원을 보여준다', () => {
    setup()

    expect(screen.getByRole('heading', { name: '점심내기 한판' })).toBeInTheDocument()
    expect(screen.getByText('2/10')).toBeInTheDocument()
  })

  it('나가기를 누르면 알린다', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: '나가기' }))

    expect(props.onLeave).toHaveBeenCalled()
  })

  it('내가 방장이 아니면 준비 버튼이 있다', () => {
    setup({ myUserId: 2 })

    expect(screen.getByRole('button', { name: '준비' })).toBeInTheDocument()
  })

  it('내가 방장이면 시작 버튼이 있다', () => {
    setup({ myUserId: 1 })

    expect(screen.getByRole('button', { name: '시작' })).toBeInTheDocument()
  })

  it('방장 말고 안 준비한 사람이 있으면 시작이 막힌다', () => {
    setup({ myUserId: 1, room: room({ players: [player(1), player(2)] }) })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('방장이 준비 아님이어도 나머지가 준비면 시작이 열린다', () => {
    setup({
      myUserId: 1,
      room: room({ players: [player(1, { ready: false }), player(2, { ready: true })] }),
    })

    expect(screen.getByRole('button', { name: '시작' })).toBeEnabled()
  })

  it('방장 혼자면 시작이 막힌다', () => {
    setup({ myUserId: 1, room: room({ players: [player(1)] }) })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('방장이 아니면 남의 연단을 누를 수 없다', () => {
    setup({ myUserId: 2 })

    expect(screen.queryByRole('button', { name: /사람1/ })).not.toBeInTheDocument()
  })

  it('방장이 남의 연단을 누르면 확인창이 뜨고, 확인하면 알린다', async () => {
    const { user, props } = setup({ myUserId: 1 })

    await user.click(screen.getByRole('button', { name: /사람2/ }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('사람2 님에게 방장을 넘기시겠습니까?')

    await user.click(screen.getByRole('button', { name: '넘기기' }))

    expect(props.onTransfer).toHaveBeenCalledWith(2)
  })

  it('양도를 취소하면 알리지 않는다', async () => {
    const { user, props } = setup({ myUserId: 1 })
    await user.click(screen.getByRole('button', { name: /사람2/ }))

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(props.onTransfer).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/RoomView.test.tsx`
Expected: FAIL — `Failed to resolve import "./RoomView"`

- [ ] **Step 3: 구현한다**

`src/features/word-chain/ui/RoomView.tsx`

```tsx
import { useState } from 'react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import type { Avatar, Player, RoomState } from '../api/types'
import { ReadyBar } from './ReadyBar'
import { Stage } from './Stage'
import styles from './RoomView.module.scss'

export interface RoomViewProps {
  room: RoomState
  myUserId: number
  onAvatarChange: (avatar: Avatar) => void
  onReadyChange: (ready: boolean) => void
  onTransfer: (userId: number) => void
  onStart: () => void
  onLeave: () => void
}

export const RoomView = ({
  room,
  myUserId,
  onAvatarChange,
  onReadyChange,
  onTransfer,
  onStart,
  onLeave,
}: RoomViewProps) => {
  const [handingTo, setHandingTo] = useState<Player | null>(null)

  const me = room.players.find((player) => player.userId === myUserId)
  const isHost = room.hostId === myUserId
  const allReady =
    room.players.length >= 2 &&
    room.players.every((player) => player.userId === room.hostId || player.ready)

  return (
    <>
      <header className={styles.head}>
        <h1 className={styles.title}>{room.name}</h1>
        <span className={styles.count}>
          {room.players.length}/{room.capacity}
        </span>
        <button type="button" className={styles.leave} onClick={onLeave}>
          나가기
        </button>
      </header>

      <Stage
        players={room.players}
        hostId={room.hostId}
        onSelectPlayer={
          isHost
            ? (userId) =>
                setHandingTo(room.players.find((player) => player.userId === userId) ?? null)
            : undefined
        }
      />

      <ReadyBar
        avatar={me?.avatar ?? null}
        onAvatarChange={onAvatarChange}
        isHost={isHost}
        ready={me?.ready ?? false}
        allReady={allReady}
        onReadyChange={onReadyChange}
        onStart={onStart}
      />

      <ConfirmDialog
        open={handingTo !== null}
        title={handingTo ? `${handingTo.name} 님에게 방장을 넘기시겠습니까?` : ''}
        description="넘기면 되돌릴 수 없습니다."
        confirmLabel="넘기기"
        onConfirm={() => {
          if (handingTo) onTransfer(handingTo.userId)
          setHandingTo(null)
        }}
        onCancel={() => setHandingTo(null)}
      />
    </>
  )
}
```

- [ ] **Step 4: `RoomView.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.title {
  margin: 0;
  color: var(--text-strong);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.count {
  color: var(--text-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.leave {
  margin-left: auto;
  padding: 8px 15px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: var(--text-strong);
    border-color: var(--text-muted);
  }

  @include s.focus-ring;

  @include s.reduced-motion {
    transition: none;
  }
}
```

- [ ] **Step 5: 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/RoomView.test.tsx`
Expected: PASS (9개)

- [ ] **Step 6: 공개 창구에 더한다**

`src/features/word-chain/index.ts` 에 한 줄 더한다.

```ts
export { RoomView } from './ui/RoomView'
```

---

## Task 7: 소켓 훅과 페이지 연결

**Files:**
- Create: `src/features/word-chain/model/useRoomSocket.ts`
- Test: `src/features/word-chain/model/useRoomSocket.test.ts`
- Modify: `src/features/word-chain/index.ts`
- Modify: `src/pages/WordChainRoomPage/WordChainRoomPage.tsx` · `.module.scss`

**Interfaces:**
- Consumes: Task 2 의 `connectStomp` · `WS_URL` · `StompConnection`, Task 3 의 `RoomState`
- Produces:
  - `useRoomSocket(roomId: number): { room: RoomState | null; error: string | null; disconnected: boolean; send: RoomActions }`
  - `interface RoomActions { avatar: (a: Avatar) => void; ready: (r: boolean) => void; transfer: (userId: number) => void; start: () => void; leave: () => void }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/model/useRoomSocket.test.ts`

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StompConnection } from '@/shared/ws'

const publish = vi.fn()
const close = vi.fn()
const handlers = new Map<string, (body: unknown) => void>()

const connection: StompConnection = {
  subscribe: (destination, onMessage) => {
    handlers.set(destination, onMessage as (body: unknown) => void)
    return () => handlers.delete(destination)
  },
  publish,
  close,
}

const connectStomp = vi.fn((options: { onConnect: (c: StompConnection) => void }) => {
  options.onConnect(connection)
  return connection
}) as ReturnType<typeof vi.fn>

vi.mock('@/shared/ws', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  connectStomp: (options: never) => connectStomp(options),
}))

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  tokenStore: { get: () => 'token', set: vi.fn(), clear: vi.fn() },
  reissueOnce: vi.fn().mockResolvedValue(undefined),
}))

const { useRoomSocket } = await import('./useRoomSocket')

const ROOM = {
  id: 7,
  name: '점심내기 한판',
  status: 'WAITING',
  hostId: 1,
  capacity: 10,
  players: [{ userId: 1, name: '김성호', avatar: null, ready: true }],
}

describe('useRoomSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
  })

  it('연결되면 방을 구독하고 enter 를 보낸다', async () => {
    renderHook(() => useRoomSocket(7))

    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/enter')
  })

  it('받은 방 상태를 그대로 돌려준다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => handlers.get('/topic/rooms/7')?.(ROOM))

    expect(result.current.room).toEqual(ROOM)
  })

  it('연결이 끊기면 disconnected 가 선다', async () => {
    connectStomp.mockImplementationOnce((options: { onError: () => void }) => {
      options.onError()
      return connection
    })
    const { result } = renderHook(() => useRoomSocket(7))

    await waitFor(() => expect(result.current.disconnected).toBe(true))
  })

  it('오류는 메시지로 꺼낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/user/queue/errors')).toBe(true))

    act(() =>
      handlers.get('/user/queue/errors')?.({ code: 'NOT_ALL_READY', message: '아직 준비 전입니다.' }),
    )

    expect(result.current.error).toBe('아직 준비 전입니다.')
  })

  it('ready 는 토글이 아니라 받은 값을 그대로 보낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => result.current.send.ready(true))
    act(() => result.current.send.ready(true))
    act(() => result.current.send.ready(false))

    expect(publish.mock.calls.filter(([dest]) => dest === '/app/rooms/7/ready')).toEqual([
      ['/app/rooms/7/ready', { ready: true }],
      ['/app/rooms/7/ready', { ready: true }],
      ['/app/rooms/7/ready', { ready: false }],
    ])
  })

  it('아바타·양도·시작·나가기를 각 목적지로 보낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => result.current.send.avatar('FEMALE'))
    act(() => result.current.send.transfer(5))
    act(() => result.current.send.start())
    act(() => result.current.send.leave())

    expect(publish).toHaveBeenCalledWith('/app/rooms/7/avatar', { avatar: 'FEMALE' })
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/transfer', { userId: 5 })
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/start', undefined)
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/leave', undefined)
  })

  it('언마운트되면 연결을 닫는다', async () => {
    const { unmount } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    unmount()

    expect(close).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/model/useRoomSocket.test.ts`
Expected: FAIL — `Failed to resolve import "./useRoomSocket"`

- [ ] **Step 3: 구현한다**

`src/features/word-chain/model/useRoomSocket.ts`

```ts
import { useEffect, useRef, useState } from 'react'
import { reissueOnce, tokenStore } from '@/shared/api'
import { WS_URL, connectStomp } from '@/shared/ws'
import type { StompConnection } from '@/shared/ws'
import type { Avatar, RoomState } from '../api/types'

export interface RoomActions {
  avatar: (avatar: Avatar) => void
  ready: (ready: boolean) => void
  transfer: (userId: number) => void
  start: () => void
  leave: () => void
}

export interface RoomSocket {
  room: RoomState | null
  error: string | null
  disconnected: boolean
  send: RoomActions
}

export const useRoomSocket = (roomId: number): RoomSocket => {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const connectionRef = useRef<StompConnection | null>(null)

  useEffect(() => {
    let closed = false

    const open = async () => {
      await reissueOnce()
      if (closed) return

      const connection = connectStomp({
        url: WS_URL,
        token: tokenStore.get() ?? '',
        onConnect: (ready) => {
          ready.subscribe<RoomState>(`/topic/rooms/${roomId}`, setRoom)
          ready.subscribe<{ message: string }>('/user/queue/errors', (body) =>
            setError(body.message),
          )
          ready.publish(`/app/rooms/${roomId}/enter`)
        },
        onError: () => setDisconnected(true),
      })

      connectionRef.current = connection
      if (closed) connection.close()
    }

    void open()

    return () => {
      closed = true
      connectionRef.current?.close()
      connectionRef.current = null
    }
  }, [roomId])

  const publish = (suffix: string, body?: unknown) =>
    connectionRef.current?.publish(`/app/rooms/${roomId}/${suffix}`, body)

  return {
    room,
    error,
    disconnected,
    send: {
      avatar: (avatar) => publish('avatar', { avatar }),
      ready: (ready) => publish('ready', { ready }),
      transfer: (userId) => publish('transfer', { userId }),
      start: () => publish('start'),
      leave: () => publish('leave'),
    },
  }
}
```

`reissueOnce()` 를 먼저 부르는 이유는 만료된 토큰으로 연결하면 실패하는데, 소켓에는 REST 처럼
401 을 받고 재발급하는 흐름이 없기 때문이다.

**재연결하지 않는다.** 서버가 연결 끊김을 퇴장으로 처리하므로 끊긴 순간 좌석이 이미 사라졌다.
소켓만 다시 열어도 그 방의 참가자가 아니다. `disconnected` 를 세우고 화면이 목록으로 옮긴다.

- [ ] **Step 4: 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/model/useRoomSocket.test.ts`
Expected: PASS (6개)

- [ ] **Step 5: 공개 창구에 더한다**

`src/features/word-chain/index.ts` 에 한 줄 더한다.

```ts
export { useRoomSocket } from './model/useRoomSocket'
```

- [ ] **Step 6: 페이지를 완성한다**

`src/pages/WordChainRoomPage/WordChainRoomPage.tsx`

```tsx
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMeQuery } from '@/features/auth'
import { RoomView, useRoomSocket } from '@/features/word-chain'
import styles from './WordChainRoomPage.module.scss'

export const WordChainRoomPage = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { data: me } = useMeQuery()
  const { room, error, disconnected, send } = useRoomSocket(Number(roomId))

  const leave = () => {
    send.leave()
    void navigate('/games/word-chain')
  }

  useEffect(() => {
    if (!disconnected) return
    void navigate('/games/word-chain', {
      replace: true,
      state: { notice: '연결이 끊어져 방에서 나왔습니다.' },
    })
  }, [disconnected, navigate])

  return (
    <>
      <title>끝말잇기 · IBS</title>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {room && me ? (
        <RoomView
          room={room}
          myUserId={me.id}
          onAvatarChange={send.avatar}
          onReadyChange={send.ready}
          onTransfer={send.transfer}
          onStart={send.start}
          onLeave={leave}
        />
      ) : (
        <p className={styles.loading}>방에 들어가는 중…</p>
      )}
    </>
  )
}
```

`src/pages/WordChainRoomPage/WordChainRoomPage.module.scss` 를 아래로 바꾼다.

```scss
.loading {
  margin: 40px 0;
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
}

.error {
  margin: 0 0 12px;
  color: var(--danger);
  font-size: 13px;
  text-align: center;
}
```

- [ ] **Step 7: 목록 화면이 돌아온 이유를 보여준다**

`src/pages/WordChainRoomsPage/WordChainRoomsPage.tsx` 에 두 곳을 더한다.

import 에 `useLocation` 을 넣고, 컴포넌트 안에서 읽는다.

```tsx
import { useLocation, useNavigate } from 'react-router'
```

```tsx
  const { state } = useLocation()
  const notice = (state as { notice?: string } | null)?.notice ?? null
```

`<header>` 바로 아래에 넣는다.

```tsx
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
```

`WordChainRoomsPage.module.scss` 에 더한다.

```scss
.notice {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-sunken);
  color: var(--text);
  font-size: 13px;
  text-align: center;
}
```

`role="status"` 인 이유는 이것이 오류가 아니라 알림이기 때문이다. `role="alert"` 은 스크린리더가
읽던 것을 끊고 끼어든다.

- [ ] **Step 8: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

- [ ] **Step 9: 브라우저로 확인**

백엔드가 Task 1 을 구현한 뒤에만 할 수 있다.

1. `preview_start` 로 개발 서버를 띄우고 로그인
2. `게임 → 끝말잇기` → 방 만들기
3. 무대에 내가 서 있고 연단에 `방장` 이 붙는지
4. 다른 브라우저(또는 시크릿 창)로 같은 방에 들어가 **양쪽 화면이 같이 갱신되는지**
5. 아바타를 바꾸면 상대 화면에서도 바뀌는지
6. 참가자가 준비하면 방장의 `시작` 이 열리는지
7. 참가자 탭을 닫으면 **인원이 줄어드는지** (연결 끊김 = 퇴장)
8. 방장이 나가면 남은 사람에게 `방장` 이 붙는지
9. 개발자 도구의 Network 에서 소켓을 끊으면 **방 목록으로 돌아가며 안내가 뜨는지**

---

## 남은 것 (이 계획 밖)

- **C — 게임**: 턴, 타이머, 스포트라이트, 말풍선, 답 판정
- **D — 사전**: 표준국어대사전 + Caffeine 캐시. 조사는 끝났다
- **방 목록 실시간 갱신**(`/topic/rooms`): 스펙 1장에 넣었지만 이 계획에서 뺐다. 목록 화면이
  소켓을 하나 더 여는 구조라 방 화면과 수명이 얽히고, C 를 앞두고 지금 넣을 값어치가 낮다.
  A 에서 미룬 상태 그대로 C 이후에 다시 본다
- **Netlify 환경변수 등록**: 배포 전에 `VITE_WS_URL` 을 Netlify 에 넣어야 한다. 코드가 아니라
  배포 설정이라 이 계획의 작업에 없다
- **백엔드의 임시 `/api/ws`(인증 없음) 제거**: 실측용으로 열어둔 것이라 누구나 붙어 커넥션을
  잡아둘 수 있다. Task 1 의 인증 붙은 엔드포인트로 대체되면 지운다
