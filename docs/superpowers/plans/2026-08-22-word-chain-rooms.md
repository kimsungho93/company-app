# 끝말잇기 A — 방 목록 · 생성 · 입장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 끝말잇기 방을 만들고, 목록에서 인원을 보고, 비밀번호를 넣어 들어갈 수 있게 한다.

**Architecture:** 방 목록·생성·입장은 전부 REST 다. 실시간(STOMP)은 방 안에 들어간 뒤의 이야기라 이 계획에 없다. 프론트는 RTK Query 로 `baseApi` 에 엔드포인트를 주입하고, 입장에 성공하면 `/games/word-chain/:roomId` 로 옮긴다. 그 화면은 이번에 자리만 잡는다(B 에서 채운다).

**스펙 7.3 의 `/topic/rooms` 구독은 B 로 미룬다.** 소켓 클라이언트 자체가 B 에서 들어오는데 목록 하나 때문에 먼저 끌어오면 A 가 두 배로 커진다. 그때까지 목록은 화면에 들어올 때와 `invalidatesTags` 로만 갱신된다 — 옆 사람이 방을 만들면 새로고침해야 보인다. **A 를 실제로 쓰기 전에 B 가 붙는다는 전제다.**

**Tech Stack:** React 19 · TypeScript 6 · RTK Query · SCSS Modules · vitest + @testing-library

**Spec:** [docs/superpowers/specs/2026-08-22-word-chain-design.md](../specs/2026-08-22-word-chain-design.md)

## Global Constraints

- 방 정원 **10명**, 방 이름 **1~29자**(30자 미만)
- 함수는 전부 화살표다 — `func-style: ["error", "expression"]` 로 린트가 막는다
- **주석을 달지 않는다.** 설명이 필요하면 이름을 고치고, 그래도 남으면 커밋 메시지나 `CLAUDE.md` 에 쓴다
- **커밋은 사용자가 요청할 때만 한다.** 각 작업은 검증까지 하고 멈춘다
- 타입 전용 import 는 `import type { X }` (`verbatimModuleSyntax`)
- 안 쓰는 변수는 빌드 실패다 (`noUnusedLocals`)
- 색은 `_tokens.scss` 의 CSS 커스텀 프로퍼티만 쓴다. 하드코딩 금지
- 검증 명령: `yarn lint` · `yarn tsc -b` · `yarn test` · `yarn build`

## 파일 구조

```
src/features/word-chain/
├── api/
│   ├── types.ts              RoomSummary · RoomStatus · 요청 타입
│   └── roomApi.ts            RTK Query 엔드포인트 3개
├── model/
│   ├── validateRoomName.ts   순수 검증
│   └── validateRoomName.test.ts
├── ui/
│   ├── RoomCard.tsx              방 한 칸
│   ├── RoomCard.module.scss
│   ├── RoomList.tsx              목록 + 로딩·빈·오류
│   ├── RoomList.module.scss
│   ├── RoomList.test.tsx
│   ├── CreateRoomDialog.tsx      방 만들기
│   ├── CreateRoomDialog.module.scss
│   ├── CreateRoomDialog.test.tsx
│   ├── JoinRoomDialog.tsx        비밀번호 입력
│   ├── JoinRoomDialog.module.scss
│   └── JoinRoomDialog.test.tsx
└── index.ts

src/pages/WordChainRoomsPage/     WordChainPage 를 대체
src/pages/WordChainRoomPage/      자리만. B 에서 채운다

수정: src/shared/api/baseApi.ts   tagTypes 에 'Rooms'
수정: src/app/routes.tsx          라우트 둘
삭제: src/pages/WordChainPage/
```

`RoomCard` 를 `RoomList` 와 나눈 이유는 한 칸의 표시 규칙(자물쇠·`3/10`·상태 배지)이 목록의 로딩·빈·오류 처리와 섞이면 둘 다 읽기 어려워지기 때문이다.

---

## Task 1: 백엔드 작업 지시서

**Files:**
- Create: `../../backend/company-backend/docs/requests/2026-08-22-game-rooms.md`

**Interfaces:**
- Consumes: 없음
- Produces: 아래 계약. Task 2 의 타입이 이것을 그대로 따른다

**이 저장소의 코드가 아니라 옆 저장소에 넘길 지시서다.** 그쪽 `docs/requests/README.md` 규칙은 "파일 하나만 읽고 구현할 수 있어야 한다"이므로 프론트 문서를 참조하라고 쓰지 않는다.

- [ ] **Step 1: 요청서를 쓴다**

아래 내용을 담는다.

````markdown
# 게임방 API (끝말잇기 A)

상태: **대기**
요청일: 2026-08-22

끝말잇기 방을 만들고 목록에서 보고 들어가는 데까지다. 게임 진행과 실시간(WebSocket)은
다음 요청에서 다룬다.

## 엔드포인트

| 메서드 | 경로 | 요청 | 성공 |
|---|---|---|---|
| GET | `/api/rooms` | | 200 `RoomSummary[]` |
| POST | `/api/rooms` | `{name, password?}` | 201 `RoomSummary` |
| POST | `/api/rooms/{id}/join` | `{password?}` | 200 `RoomSummary` |

```json
{ "id": 7, "name": "점심내기 한판", "hostName": "김성호",
  "playerCount": 3, "capacity": 10, "locked": true, "status": "WAITING" }
```

`status` 는 `WAITING` · `PLAYING`. `locked` 는 비밀번호가 걸렸는지다.
**세 응답이 모두 같은 모양이다.**

## 규칙

- 정원 10명 고정 (`capacity` 로 내려준다)
- 이름 1~29자
- 비밀번호는 선택. **BCrypt 로 해시**한다 — 평문이면 DB 를 보는 사람이 다 안다
- 방을 만든 사람이 방장이고 자동으로 입장한다
- 마지막 사람이 나가면 방을 지운다
- **게임 중인 방에도 입장은 200 이다.** 관전자로 붙는다

## 오류

| HTTP | `code` |
|---|---|
| 400 | `INVALID_INPUT` — 이름이 비었거나 29자 초과 |
| 403 | `WRONG_ROOM_PASSWORD` |
| 404 | `ROOM_NOT_FOUND` |
| 409 | `ROOM_FULL` |

기존과 같은 `{ code, message }` 형태이고 `message` 는 화면에 그대로 띄운다.

## 저장

**방은 DB 에 영속하지 않아도 된다.** 마지막 사람이 나가면 사라지는 휘발성 자원이라
인메모리로 충분하다. 게임 기록을 남기게 되면 그때 테이블을 만든다.

## 범위 밖

- WebSocket · 게임 진행 · 준비 · 방장 양도
- 사전 판정
````

- [ ] **Step 2: 계약이 스펙과 어긋나지 않는지 대조**

`docs/superpowers/specs/2026-08-22-word-chain-design.md` 의 7.2 와 필드·오류 코드가 같은지 본다.
다르면 **스펙을 먼저 고치고** 지시서를 맞춘다.

---

## Task 2: 타입과 API 슬라이스

**Files:**
- Create: `src/features/word-chain/api/types.ts`
- Create: `src/features/word-chain/api/roomApi.ts`
- Modify: `src/shared/api/baseApi.ts`

**Interfaces:**
- Consumes: Task 1 의 계약
- Produces:
  - `RoomSummary { id: number; name: string; hostName: string; playerCount: number; capacity: number; locked: boolean; status: RoomStatus }`
  - `RoomStatus = 'WAITING' | 'PLAYING'`
  - `CreateRoomDraft { name: string; password?: string }`
  - `JoinRoomDraft { id: number; password?: string }`
  - `useRoomsQuery()` · `useCreateRoomMutation()` · `useJoinRoomMutation()`

- [ ] **Step 1: 타입을 쓴다**

`src/features/word-chain/api/types.ts`

```ts
export type RoomStatus = 'WAITING' | 'PLAYING'

export interface RoomSummary {
  id: number
  name: string
  hostName: string
  playerCount: number
  capacity: number
  locked: boolean
  status: RoomStatus
}

export interface CreateRoomDraft {
  name: string
  password?: string
}

export interface JoinRoomDraft {
  id: number
  password?: string
}
```

- [ ] **Step 2: `baseApi` 에 태그를 더한다**

`src/shared/api/baseApi.ts` 의 `tagTypes` 를 고친다.

```ts
tagTypes: ['Me', 'AdminUsers', 'Leaves', 'Holidays', 'Rooms'],
```

- [ ] **Step 3: API 슬라이스를 쓴다**

`src/features/word-chain/api/roomApi.ts`

```ts
import { baseApi } from '@/shared/api'
import type { CreateRoomDraft, JoinRoomDraft, RoomSummary } from './types'

export const roomApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    rooms: build.query<RoomSummary[], void>({
      query: () => '/rooms',
      providesTags: ['Rooms'],
    }),

    createRoom: build.mutation<RoomSummary, CreateRoomDraft>({
      query: (body) => ({ url: '/rooms', method: 'POST', body }),
      invalidatesTags: ['Rooms'],
    }),

    joinRoom: build.mutation<RoomSummary, JoinRoomDraft>({
      query: ({ id, password }) => ({
        url: `/rooms/${id}/join`,
        method: 'POST',
        body: { password },
      }),
      invalidatesTags: ['Rooms'],
    }),
  }),
})

export const { useRoomsQuery, useCreateRoomMutation, useJoinRoomMutation } = roomApi
```

- [ ] **Step 4: 타입과 린트를 통과하는지 본다**

Run: `yarn tsc -b && yarn lint`
Expected: 출력 없음 (통과)

---

## Task 3: 방 이름 검증

**Files:**
- Create: `src/features/word-chain/model/validateRoomName.ts`
- Test: `src/features/word-chain/model/validateRoomName.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `validateRoomName(value: string): string | null` — 통과하면 `null`, 아니면 화면에 띄울 문구

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/model/validateRoomName.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { validateRoomName } from './validateRoomName'

describe('validateRoomName', () => {
  it('보통 이름은 통과한다', () => {
    expect(validateRoomName('점심내기 한판')).toBeNull()
  })

  it('비어 있으면 막는다', () => {
    expect(validateRoomName('')).toBe('방 이름을 입력해 주세요.')
  })

  it('공백만 있으면 막는다', () => {
    expect(validateRoomName('   ')).toBe('방 이름을 입력해 주세요.')
  })

  it('29자까지 통과한다', () => {
    expect(validateRoomName('가'.repeat(29))).toBeNull()
  })

  it('30자부터 막는다', () => {
    expect(validateRoomName('가'.repeat(30))).toBe('방 이름은 29자까지 입력할 수 있습니다.')
  })

  it('길이는 앞뒤 공백을 뺀 뒤에 센다', () => {
    expect(validateRoomName(`  ${'가'.repeat(29)}  `)).toBeNull()
  })
})
```

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/model/validateRoomName.test.ts`
Expected: FAIL — `Failed to resolve import "./validateRoomName"`

- [ ] **Step 3: 구현한다**

`src/features/word-chain/model/validateRoomName.ts`

```ts
const MAX_LENGTH = 29

export const validateRoomName = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return '방 이름을 입력해 주세요.'
  if (trimmed.length > MAX_LENGTH) return `방 이름은 ${MAX_LENGTH}자까지 입력할 수 있습니다.`
  return null
}
```

- [ ] **Step 4: 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/model/validateRoomName.test.ts`
Expected: PASS (6개)

---

## Task 4: 방 목록 화면

**Files:**
- Create: `src/features/word-chain/ui/RoomCard.tsx` · `RoomCard.module.scss`
- Create: `src/features/word-chain/ui/RoomList.tsx` · `RoomList.module.scss`
- Test: `src/features/word-chain/ui/RoomList.test.tsx`
- Create: `src/features/word-chain/index.ts`
- Create: `src/pages/WordChainRoomsPage/WordChainRoomsPage.tsx` · `.module.scss` · `index.ts`
- Create: `src/pages/WordChainRoomPage/WordChainRoomPage.tsx` · `.module.scss` · `index.ts`
- Modify: `src/app/routes.tsx`
- Delete: `src/pages/WordChainPage/`

**Interfaces:**
- Consumes: Task 2 의 `useRoomsQuery` · `RoomSummary`
- Produces:
  - `<RoomList onJoin={(room: RoomSummary) => void} />`
  - `<RoomCard room={RoomSummary} onJoin={() => void} />`
  - `features/word-chain/index.ts` 가 `RoomList` 를 export 한다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/RoomList.test.tsx`

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import type { RoomSummary } from '../api/types'
import { RoomList } from './RoomList'

const ROOMS: RoomSummary[] = [
  {
    id: 1,
    name: '점심내기 한판',
    hostName: '김성호',
    playerCount: 3,
    capacity: 10,
    locked: true,
    status: 'WAITING',
  },
  {
    id: 2,
    name: '개발팀 모여라',
    hostName: '박철수',
    playerCount: 7,
    capacity: 10,
    locked: false,
    status: 'PLAYING',
  },
]

const setup = (onJoin = vi.fn()) => {
  const { wrapper } = createTestWrapper()
  return { user: userEvent.setup(), onJoin, ...render(<RoomList onJoin={onJoin} />, { wrapper }) }
}

describe('RoomList', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('방 이름과 인원을 보여준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    setup()

    const card = await screen.findByRole('listitem', { name: /점심내기 한판/ })
    expect(within(card).getByText('3/10')).toBeInTheDocument()
  })

  it('비밀번호가 걸린 방을 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    setup()

    const locked = await screen.findByRole('listitem', { name: /점심내기 한판/ })
    const open = screen.getByRole('listitem', { name: /개발팀 모여라/ })

    expect(within(locked).getByText('비밀번호')).toBeInTheDocument()
    expect(within(open).queryByText('비밀번호')).not.toBeInTheDocument()
  })

  it('게임 중인 방을 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    setup()

    const playing = await screen.findByRole('listitem', { name: /개발팀 모여라/ })
    expect(within(playing).getByText('게임중')).toBeInTheDocument()
  })

  it('방이 없으면 안내를 띄운다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))
    setup()

    expect(await screen.findByText('아직 만들어진 방이 없습니다.')).toBeInTheDocument()
  })

  it('조회가 실패하면 알린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'INTERNAL_ERROR', message: '서버에 문제가 발생했습니다.' }, 500),
      ),
    )
    setup()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('서버에 문제가 발생했습니다.'),
    )
  })

  it('방을 누르면 onJoin 을 부른다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    const { user, onJoin } = setup()

    await user.click(await screen.findByRole('button', { name: /점심내기 한판/ }))

    expect(onJoin).toHaveBeenCalledWith(ROOMS[0])
  })
})
```

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/RoomList.test.tsx`
Expected: FAIL — `Failed to resolve import "./RoomList"`

- [ ] **Step 3: `RoomCard` 를 만든다**

`src/features/word-chain/ui/RoomCard.tsx`

```tsx
import type { RoomSummary } from '../api/types'
import styles from './RoomCard.module.scss'

export interface RoomCardProps {
  room: RoomSummary
  onJoin: () => void
}

export const RoomCard = ({ room, onJoin }: RoomCardProps) => {
  const full = room.playerCount >= room.capacity

  return (
    <li className={styles.card} aria-label={room.name}>
      <button type="button" className={styles.hit} disabled={full} onClick={onJoin}>
        <span className={styles.name}>{room.name}</span>
        <span className={styles.meta}>
          {room.locked && <span className={styles.badge}>비밀번호</span>}
          <span className={room.status === 'PLAYING' ? styles.playing : styles.waiting}>
            {room.status === 'PLAYING' ? '게임중' : '대기중'}
          </span>
          <span className={styles.count}>
            {room.playerCount}/{room.capacity}
          </span>
        </span>
      </button>
    </li>
  )
}
```

`aria-label` 을 `<li>` 에 두면 `getByRole('listitem', { name })` 으로 한 칸을 집을 수 있다.
버튼의 접근 이름은 안쪽 글자가 이어져 `점심내기 한판 비밀번호 대기중 3/10` 이 되므로 정규식으로 찾는다.

- [ ] **Step 4: `RoomCard.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.card {
  list-style: none;
}

.hit {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, translate 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--accent);
    translate: 0 -1px;
    box-shadow: 0 6px 16px -8px color-mix(in srgb, var(--accent) 60%, transparent);
  }

  &:active:not(:disabled) {
    translate: 0 0;
    scale: 0.995;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  @include s.focus-ring;

  @include s.reduced-motion {
    transition: none;

    &:hover:not(:disabled),
    &:active:not(:disabled) {
      translate: none;
      scale: none;
    }
  }
}

.name {
  flex: 1;
  min-width: 0;
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-sunken);
  color: var(--text-muted);
  font-weight: 500;
}

.waiting {
  color: var(--accent);
  font-weight: 500;
}

.playing {
  color: var(--text-muted);
  font-weight: 500;
}

.count {
  min-width: 3.2em;
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

- [ ] **Step 5: `RoomList` 를 만든다**

`src/features/word-chain/ui/RoomList.tsx`

```tsx
import { toErrorInfo } from '@/shared/api'
import { useRoomsQuery } from '../api/roomApi'
import type { RoomSummary } from '../api/types'
import { RoomCard } from './RoomCard'
import styles from './RoomList.module.scss'

export interface RoomListProps {
  onJoin: (room: RoomSummary) => void
}

export const RoomList = ({ onJoin }: RoomListProps) => {
  const { data: rooms = [], isLoading, error } = useRoomsQuery()

  if (error) {
    return (
      <p className={styles.error} role="alert">
        {toErrorInfo(error).message}
      </p>
    )
  }

  if (isLoading) {
    return <p className={styles.empty}>불러오는 중…</p>
  }

  if (rooms.length === 0) {
    return <p className={styles.empty}>아직 만들어진 방이 없습니다.</p>
  }

  return (
    <ul className={styles.list}>
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} onJoin={() => onJoin(room)} />
      ))}
    </ul>
  )
}
```

- [ ] **Step 6: `RoomList.module.scss` 를 만든다**

```scss
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
}

.empty,
.error {
  margin: 32px 0;
  font-size: 14px;
  text-align: center;
}

.empty {
  color: var(--text-muted);
}

.error {
  color: var(--danger);
}
```

- [ ] **Step 7: 테스트가 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/RoomList.test.tsx`
Expected: PASS (6개)

- [ ] **Step 8: feature 의 공개 창구를 만든다**

`src/features/word-chain/index.ts`

```ts
export { RoomList } from './ui/RoomList'
export type { RoomSummary, RoomStatus } from './api/types'
```

- [ ] **Step 9: 페이지 둘을 만든다**

`src/pages/WordChainRoomsPage/WordChainRoomsPage.tsx`

```tsx
import { useNavigate } from 'react-router'
import { RoomList } from '@/features/word-chain'
import styles from './WordChainRoomsPage.module.scss'

export const WordChainRoomsPage = () => {
  const navigate = useNavigate()

  return (
    <>
      <title>끝말잇기 · IBS</title>
      <header className={styles.head}>
        <h1 className={styles.title}>끝말잇기</h1>
      </header>
      <RoomList onJoin={(room) => void navigate(`/games/word-chain/${room.id}`)} />
    </>
  )
}
```

방 만들기 버튼과 비밀번호 확인은 Task 5·6 에서 붙인다. 지금은 누르면 바로 옮겨간다.

`src/pages/WordChainRoomsPage/WordChainRoomsPage.module.scss`

```scss
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 20px;
}

.title {
  margin: 0;
  color: var(--text-strong);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
```

`src/pages/WordChainRoomsPage/index.ts`

```ts
export { WordChainRoomsPage } from './WordChainRoomsPage'
```

`src/pages/WordChainRoomPage/WordChainRoomPage.tsx`

```tsx
import { useParams } from 'react-router'
import styles from './WordChainRoomPage.module.scss'

export const WordChainRoomPage = () => {
  const { roomId } = useParams()

  return (
    <>
      <title>끝말잇기 · IBS</title>
      <h1 className={styles.title}>{roomId}번 방</h1>
      <p className={styles.placeholder}>대기실은 준비 중입니다.</p>
    </>
  )
}
```

`src/pages/WordChainRoomPage/WordChainRoomPage.module.scss`

```scss
.title {
  margin: 0 0 16px;
  color: var(--text-strong);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.placeholder {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}
```

`src/pages/WordChainRoomPage/index.ts`

```ts
export { WordChainRoomPage } from './WordChainRoomPage'
```

- [ ] **Step 10: 라우트를 바꾸고 옛 페이지를 지운다**

`src/app/routes.tsx` — `WordChainPage` import 를 지우고 둘을 넣는다.

```tsx
import { WordChainRoomPage } from '@/pages/WordChainRoomPage'
import { WordChainRoomsPage } from '@/pages/WordChainRoomsPage'
```

`children` 안의 `{ path: 'games/word-chain', element: <WordChainPage /> }` 를 아래로 바꾼다.

```tsx
{ path: 'games/word-chain', element: <WordChainRoomsPage /> },
{ path: 'games/word-chain/:roomId', element: <WordChainRoomPage /> },
```

그리고 옛 페이지 폴더를 지운다.

```bash
rm -r src/pages/WordChainPage
```

- [ ] **Step 11: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`
Expected: 전부 통과. `MainNav` 의 `끝말잇기` 링크가 `/games/word-chain` 이라 그대로 동작한다

---

## Task 5: 방 만들기

**Files:**
- Create: `src/features/word-chain/ui/CreateRoomDialog.tsx` · `CreateRoomDialog.module.scss`
- Test: `src/features/word-chain/ui/CreateRoomDialog.test.tsx`
- Modify: `src/features/word-chain/index.ts`
- Modify: `src/pages/WordChainRoomsPage/WordChainRoomsPage.tsx`

**Interfaces:**
- Consumes: Task 2 의 `useCreateRoomMutation`, Task 3 의 `validateRoomName`
- Produces: `<CreateRoomDialog open onClose={() => void} onCreated={(room: RoomSummary) => void} />`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/CreateRoomDialog.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { CreateRoomDialog } from './CreateRoomDialog'

const CREATED = {
  id: 9,
  name: '점심내기 한판',
  hostName: '김성호',
  playerCount: 1,
  capacity: 10,
  locked: false,
  status: 'WAITING',
}

const setup = () => {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const { wrapper } = createTestWrapper()
  return {
    user: userEvent.setup(),
    onClose,
    onCreated,
    ...render(<CreateRoomDialog open onClose={onClose} onCreated={onCreated} />, { wrapper }),
  }
}

describe('CreateRoomDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('이름이 비면 만들지 못한다', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(screen.getByText('방 이름을 입력해 주세요.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('30자부터 막는다', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { user } = setup()

    await user.type(screen.getByLabelText('방 이름'), '가'.repeat(30))
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(screen.getByText('방 이름은 29자까지 입력할 수 있습니다.')).toBeInTheDocument()
  })

  it('비밀번호 없이 만들면 name 만 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED, 201))
    vi.stubGlobal('fetch', fetchMock)
    const { user, onCreated } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED))
    const body = JSON.parse(await (fetchMock.mock.calls[0][0] as Request).text())
    expect(body).toEqual({ name: '점심내기 한판' })
  })

  it('비밀번호를 넣으면 함께 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED, 201))
    vi.stubGlobal('fetch', fetchMock)
    const { user } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    await user.type(screen.getByLabelText('비밀번호'), '1234')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(await (fetchMock.mock.calls[0][0] as Request).text())
    expect(body).toEqual({ name: '점심내기 한판', password: '1234' })
  })

  it('서버가 거절하면 그 문구를 띄운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ code: 'INVALID_INPUT', message: '방 이름을 확인해 주세요.' }, 400),
        ),
    )
    const { user, onCreated } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('방 이름을 확인해 주세요.'),
    )
    expect(onCreated).not.toHaveBeenCalled()
  })
})
```

**`fetchBaseQuery` 는 `Request` 객체로 부른다.** 본문은 두 번째 인자가 아니라 `Request` 에 있어서 `await request.text()` 로 읽는다.

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/CreateRoomDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "./CreateRoomDialog"`

- [ ] **Step 3: 구현한다**

`src/features/word-chain/ui/CreateRoomDialog.tsx`

```tsx
import { useEffect, useRef, useState } from 'react'
import { toErrorInfo } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { useCreateRoomMutation } from '../api/roomApi'
import type { RoomSummary } from '../api/types'
import { validateRoomName } from '../model/validateRoomName'
import styles from './CreateRoomDialog.module.scss'

export interface CreateRoomDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (room: RoomSummary) => void
}

export const CreateRoomDialog = ({ open, onClose, onCreated }: CreateRoomDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [createRoom, { isLoading, error, reset }] = useCreateRoomMutation()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  const close = () => {
    setName('')
    setPassword('')
    setNameError(null)
    reset()
    onClose()
  }

  const submit = async () => {
    const invalid = validateRoomName(name)
    setNameError(invalid)
    if (invalid) return

    const trimmedPassword = password.trim()
    const result = await createRoom({
      name: name.trim(),
      ...(trimmedPassword ? { password: trimmedPassword } : {}),
    })
    if ('error' in result) return

    onCreated(result.data)
    close()
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault()
        if (!isLoading) close()
      }}
      onClick={(event) => {
        if (event.target === ref.current && !isLoading) close()
      }}
    >
      <form
        className={styles.body}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h2 className={styles.title}>방 만들기</h2>

        <TextField
          label="방 이름"
          value={name}
          maxLength={40}
          autoComplete="off"
          error={nameError}
          help="29자까지 쓸 수 있습니다."
          onChange={(event) => {
            setName(event.target.value)
            setNameError(null)
          }}
        />

        <TextField
          label="비밀번호"
          type="password"
          value={password}
          autoComplete="new-password"
          help="비워두면 누구나 들어올 수 있습니다."
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p className={styles.error} role="alert">
            {toErrorInfo(error).message}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} disabled={isLoading} onClick={close}>
            취소
          </button>
          <Button loading={isLoading}>만들기</Button>
        </div>
      </form>
    </dialog>
  )
}
```

`maxLength` 를 40 으로 둔 이유는 29자에서 잘라버리면 왜 안 써지는지 알 수 없기 때문이다. 넘겨 쓰면 오류 문구로 알려준다.

- [ ] **Step 4: `CreateRoomDialog.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.dialog {
  width: min(400px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-card);

  &::backdrop {
    background: rgb(4 10 16 / 62%);
    backdrop-filter: blur(2px);
  }
}

.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px 18px;
}

.title {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.4px;
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.cancel {
  padding: 9px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--text-strong);
    border-color: var(--text-muted);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @include s.focus-ring;

  @include s.reduced-motion {
    transition: none;
  }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/CreateRoomDialog.test.tsx`
Expected: PASS (5개)

- [ ] **Step 6: 목록 화면에 버튼을 붙인다**

`src/features/word-chain/index.ts` 에 한 줄 더한다.

```ts
export { CreateRoomDialog } from './ui/CreateRoomDialog'
```

`src/pages/WordChainRoomsPage/WordChainRoomsPage.tsx` 를 아래로 바꾼다.

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CreateRoomDialog, RoomList } from '@/features/word-chain'
import styles from './WordChainRoomsPage.module.scss'

export const WordChainRoomsPage = () => {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const enter = (roomId: number) => void navigate(`/games/word-chain/${roomId}`)

  return (
    <>
      <title>끝말잇기 · IBS</title>
      <header className={styles.head}>
        <h1 className={styles.title}>끝말잇기</h1>
        <button type="button" className={styles.create} onClick={() => setCreating(true)}>
          방 만들기
        </button>
      </header>

      <RoomList onJoin={(room) => enter(room.id)} />

      <CreateRoomDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(room) => enter(room.id)}
      />
    </>
  )
}
```

`WordChainRoomsPage.module.scss` 에 `.create` 를 더한다.

```scss
.create {
  padding: 9px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 3px 10px -4px color-mix(in srgb, var(--accent) 60%, transparent);
  transition: background 0.15s ease, translate 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    background: var(--accent-hi);
    translate: 0 -1px;
    box-shadow: 0 8px 18px -6px color-mix(in srgb, var(--accent) 75%, transparent);
  }

  &:active {
    translate: 0 0;
    scale: 0.98;
  }

  @include s.focus-ring;

  @include s.reduced-motion {
    transition: none;

    &:hover,
    &:active {
      translate: none;
      scale: none;
    }
  }
}
```

파일 첫 줄에 `@use '@/shared/styles' as s;` 가 없으면 더한다.

- [ ] **Step 7: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`
Expected: 전부 통과

---

## Task 6: 방 입장

**Files:**
- Create: `src/features/word-chain/ui/JoinRoomDialog.tsx` · `JoinRoomDialog.module.scss`
- Test: `src/features/word-chain/ui/JoinRoomDialog.test.tsx`
- Modify: `src/features/word-chain/index.ts`
- Modify: `src/pages/WordChainRoomsPage/WordChainRoomsPage.tsx`

**Interfaces:**
- Consumes: Task 2 의 `useJoinRoomMutation` · `RoomSummary`
- Produces: `<JoinRoomDialog room={RoomSummary | null} onClose={() => void} onJoined={(room: RoomSummary) => void} />`

`room` 이 `null` 이면 닫힌 상태다. 잠기지 않은 방은 이 창을 거치지 않고 목록에서 바로 들어간다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/JoinRoomDialog.test.tsx`

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import type { RoomSummary } from '../api/types'
import { JoinRoomDialog } from './JoinRoomDialog'

const ROOM: RoomSummary = {
  id: 1,
  name: '점심내기 한판',
  hostName: '김성호',
  playerCount: 3,
  capacity: 10,
  locked: true,
  status: 'WAITING',
}

const setup = () => {
  const onClose = vi.fn()
  const onJoined = vi.fn()
  const { wrapper } = createTestWrapper()
  return {
    user: userEvent.setup(),
    onClose,
    onJoined,
    ...render(<JoinRoomDialog room={ROOM} onClose={onClose} onJoined={onJoined} />, { wrapper }),
  }
}

describe('JoinRoomDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('어느 방에 들어가는지 보여준다', () => {
    vi.stubGlobal('fetch', vi.fn())
    setup()

    expect(screen.getByRole('heading', { name: '점심내기 한판' })).toBeInTheDocument()
  })

  it('비밀번호를 담아 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ROOM))
    vi.stubGlobal('fetch', fetchMock)
    const { user, onJoined } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '1234')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(ROOM))
    const request = fetchMock.mock.calls[0][0] as Request
    expect(request.url).toContain('/rooms/1/join')
    expect(JSON.parse(await request.text())).toEqual({ password: '1234' })
  })

  it('비밀번호가 틀리면 서버 문구를 띄우고 창이 남는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'WRONG_ROOM_PASSWORD', message: '비밀번호가 올바르지 않습니다.' }, 403),
      ),
    )
    const { user, onJoined } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '9999')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('비밀번호가 올바르지 않습니다.'),
    )
    expect(onJoined).not.toHaveBeenCalled()
  })

  it('정원이 찼으면 서버 문구를 띄운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ code: 'ROOM_FULL', message: '방이 가득 찼습니다.' }, 409)),
    )
    const { user } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '1234')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('방이 가득 찼습니다.'))
  })
})
```

- [ ] **Step 2: 실패하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/JoinRoomDialog.test.tsx`
Expected: FAIL — `Failed to resolve import "./JoinRoomDialog"`

- [ ] **Step 3: 구현한다**

`src/features/word-chain/ui/JoinRoomDialog.tsx`

```tsx
import { useEffect, useRef, useState } from 'react'
import { toErrorInfo } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { useJoinRoomMutation } from '../api/roomApi'
import type { RoomSummary } from '../api/types'
import styles from './JoinRoomDialog.module.scss'

export interface JoinRoomDialogProps {
  room: RoomSummary | null
  onClose: () => void
  onJoined: (room: RoomSummary) => void
}

export const JoinRoomDialog = ({ room, onClose, onJoined }: JoinRoomDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const [password, setPassword] = useState('')
  const [joinRoom, { isLoading, error, reset }] = useJoinRoomMutation()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (room && !el.open) el.showModal()
    else if (!room && el.open) el.close()
  }, [room])

  useEffect(() => {
    setPassword('')
    reset()
  }, [room?.id, reset])

  const close = () => {
    if (isLoading) return
    onClose()
  }

  const submit = async () => {
    if (!room) return

    const result = await joinRoom({ id: room.id, password })
    if ('error' in result) return

    onJoined(result.data)
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === ref.current) close()
      }}
    >
      {room && (
        <form
          className={styles.body}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <h2 className={styles.title}>{room.name}</h2>
          <p className={styles.sub}>
            {room.playerCount}/{room.capacity} · 방장 {room.hostName}
          </p>

          <TextField
            label="비밀번호"
            type="password"
            value={password}
            autoComplete="off"
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && (
            <p className={styles.error} role="alert">
              {toErrorInfo(error).message}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} disabled={isLoading} onClick={close}>
              취소
            </button>
            <Button loading={isLoading}>들어가기</Button>
          </div>
        </form>
      )}
    </dialog>
  )
}
```

- [ ] **Step 4: `JoinRoomDialog.module.scss` 를 만든다**

`CreateRoomDialog.module.scss` 와 같은 내용에 `.sub` 만 더한다.

```scss
@use '@/shared/styles' as s;

.dialog {
  width: min(360px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-card);

  &::backdrop {
    background: rgb(4 10 16 / 62%);
    backdrop-filter: blur(2px);
  }
}

.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px 18px;
}

.title {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.4px;
}

.sub {
  margin: -8px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.cancel {
  padding: 9px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--text-strong);
    border-color: var(--text-muted);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @include s.focus-ring;

  @include s.reduced-motion {
    transition: none;
  }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `yarn vitest run src/features/word-chain/ui/JoinRoomDialog.test.tsx`
Expected: PASS (4개)

- [ ] **Step 6: 목록에서 잠긴 방만 이 창을 거치게 한다**

`src/features/word-chain/index.ts` 에 한 줄 더한다.

```ts
export { JoinRoomDialog } from './ui/JoinRoomDialog'
```

`src/pages/WordChainRoomsPage/WordChainRoomsPage.tsx` 를 아래로 바꾼다.

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CreateRoomDialog, JoinRoomDialog, RoomList } from '@/features/word-chain'
import type { RoomSummary } from '@/features/word-chain'
import styles from './WordChainRoomsPage.module.scss'

export const WordChainRoomsPage = () => {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState<RoomSummary | null>(null)

  const enter = (roomId: number) => void navigate(`/games/word-chain/${roomId}`)

  return (
    <>
      <title>끝말잇기 · IBS</title>
      <header className={styles.head}>
        <h1 className={styles.title}>끝말잇기</h1>
        <button type="button" className={styles.create} onClick={() => setCreating(true)}>
          방 만들기
        </button>
      </header>

      <RoomList onJoin={(room) => (room.locked ? setJoining(room) : enter(room.id))} />

      <CreateRoomDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(room) => enter(room.id)}
      />

      <JoinRoomDialog
        room={joining}
        onClose={() => setJoining(null)}
        onJoined={(room) => enter(room.id)}
      />
    </>
  )
}
```

**잠기지 않은 방도 `POST /join` 을 거쳐야 정원과 상태가 서버에서 확인된다.** 지금은 바로 옮겨가는데, 방 화면(B)이 구독하면서 입장을 확정하므로 A 에서는 이대로 둔다. B 에서 방 화면이 생기면 그 안에서 `join` 을 부르도록 옮긴다.

- [ ] **Step 7: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`
Expected: 전부 통과

- [ ] **Step 8: 브라우저로 확인**

백엔드가 Task 1 을 구현한 뒤에만 할 수 있다.

1. `preview_start` 로 개발 서버를 띄우고 로그인
2. 헤더 `게임 → 끝말잇기`
3. `방 만들기` → 이름만 넣고 만들기 → 방 화면으로 옮겨가는지
4. 목록으로 돌아와 `1/10` 이 보이는지
5. 비밀번호 있는 방을 만들고, 목록에서 자물쇠 배지와 입장 창이 뜨는지
6. 틀린 비밀번호로 서버 문구가 뜨는지

---

## 남은 것 (이 계획 밖)

- **B — 대기실**: 아바타 선택, 준비, 방장 양도, STOMP 구독
- **C — 게임**: 턴, 타이머, 무대 연출
- **D — 사전**: 표준국어대사전 + Caffeine 캐시
- **소켓이 Netlify rewrite 를 통과하는지 실측** — B 시작 전에 반드시 확인한다. 통과하지 못하면 소켓만 Railway 에 직접 붙는다
