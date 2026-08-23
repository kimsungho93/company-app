# 끝말잇기 C — 게임 진행 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방장이 시작을 누르면 차례가 돌고, 답을 내면 말풍선이 뜨고, 최후 1인이 남을 때까지 진행된다.

**Architecture:** 대기실에서 만든 무대를 그대로 쓰고 **선택적 props 만 더한다.** 게임 상태는 서버가 통째로 브로드캐스트하는 `RoomState.game` 하나뿐이라 Redux 에 넣지 않는다. 카운트다운은 JS 로 매 프레임 세지 않고 **CSS 애니메이션 길이**로 준다. `RoomView` 는 계속 소켓을 모른다.

**Tech Stack:** React 19 · TypeScript 6 · SCSS Modules · vitest + @testing-library

**Spec:** [docs/superpowers/specs/2026-08-23-word-chain-game-design.md](../specs/2026-08-23-word-chain-game-design.md)

## Global Constraints

- 턴 시간은 **3 · 5 · 7초** 셋뿐이고 **기본 3초**
- 재시도는 **턴당 3번**. 소진하면 즉시 탈락
- **`players` 배열은 대기실 것에서 한 글자도 바꾸지 않는다.** 게임 상태는 `game` 에만
- **관전자를 필드로 두지 않는다.** `players` 에 있고 `turnOrder` 에 없으면 관전이다
- 좌석은 판이 끝날 때까지 **안 움직인다**
- 함수는 전부 화살표다 — `func-style: ["error", "expression"]` 로 린트가 막는다
- **주석을 달지 않는다.** 설명이 필요하면 이름을 고친다
- **커밋은 사용자가 요청할 때만 한다.** 각 작업은 검증까지 하고 멈춘다
- 타입 전용 import 는 `import type { X }` (`verbatimModuleSyntax`)
- 안 쓰는 변수는 빌드 실패다 (`noUnusedLocals`)
- 색은 `src/shared/styles/_tokens.scss` 의 CSS 커스텀 프로퍼티만. 하드코딩 금지
- `.module.scss` 는 `@use '@/shared/styles' as s;` 로 가져온다
- **카운트다운 바는 `reduced-motion` 에서도 끄지 않는다.** 장식이 아니라 정보다
- 패키지 매니저는 **yarn**
- 검증: `yarn lint` · `yarn tsc -b` · `yarn test` · `yarn build`

## 스펙보다 간단해진 것 — 시계 보정

스펙 6.1 은 `offset = serverNow - 내 시계` 를 구해 보정하라고 쓰여 있다. **그럴 필요가 없다.**

`turnEndsAt` 과 `serverNow` 는 **같은 메시지에 실려 온다.** 남은 시간은 `turnEndsAt - serverNow`
— **서버 값끼리의 뺄셈이라 클라이언트 시계가 식에 들어오지 않는다.** 스펙이 없애려던 오차가
애초에 생기지 않는다. 남는 것은 편도 지연뿐이고 그건 스펙도 받아들인 값이다.

그 값을 **CSS 애니메이션 길이**로 주면 JS 로 매 프레임 셀 필요도 없다. `requestAnimationFrame`
으로 돌리면 3초 턴마다 180번 리렌더가 나고, 그때마다 무대 전체가 재조정된다.

**턴이 바뀔 때만 다시 재야 한다.** 턴 중간에도 브로드캐스트가 온다(`PENDING` 말풍선). 그때
길이를 다시 계산하면 바가 처음으로 되돌아간다. `key={turnEndsAt}` 로 **턴이 바뀔 때만
리마운트**시키고 길이는 `useState` 초기화 함수에서 한 번만 잡는다.

## 파일 구조

```
src/features/word-chain/
├── api/types.ts              (수정) Bubble · GameState, RoomState 에 serverNow · game
├── model/
│   ├── playerPhase.ts        내 단계 판정 (순수). 연단과 하단 바가 같은 함수를 본다
│   ├── playerPhase.test.ts
│   └── useRoomSocket.ts      (수정) answer · options 전송 추가
├── ui/
│   ├── TurnBar.tsx           카운트다운 바. CSS 애니메이션 길이만 잡는다
│   ├── TurnBar.test.tsx
│   ├── SpeechBubble.tsx
│   ├── AnswerBar.tsx         입력 · 한글 조합 · 상태 문구
│   ├── AnswerBar.test.tsx
│   ├── GameOptions.tsx       대기실의 턴 시간 · 재사용 금지
│   ├── GameOptions.test.tsx
│   ├── WinnerBanner.tsx
│   ├── PlayerPodium.tsx      (수정) phase · bubble
│   ├── Stage.tsx             (수정) game
│   ├── Stage.test.tsx        (수정)
│   ├── RoomView.tsx          (수정) game 유무로 갈라 그린다
│   └── RoomView.test.tsx     (수정)
└── index.ts                  (수정)
```

`.module.scss` 는 위 `.tsx` 마다 짝으로 만든다.

---

## Task 1: 게임 타입과 단계 판정

**Files:**
- Modify: `src/features/word-chain/api/types.ts`
- Create: `src/features/word-chain/model/playerPhase.ts`
- Test: `src/features/word-chain/model/playerPhase.test.ts`

**Interfaces:**
- Consumes: 기존 `Player` · `RoomStatus`
- Produces:
  - `type BubbleState = 'PENDING' | 'PASS' | 'FAIL'`
  - `type FailReason = 'NOT_THREE_LETTERS' | 'NOT_CHAINED' | 'ALREADY_USED' | 'NOT_IN_DICTIONARY'`
  - `interface Bubble { userId: number; word: string; state: BubbleState; verified?: boolean; reason?: FailReason | null }`
  - `interface GameState { currentWord: string; turnUserId: number | null; turnEndsAt: number | null; triesLeft: number; usedWords: string[]; turnOrder: number[]; eliminated: number[]; bubbles: Bubble[]; winnerId: number | null }`
  - `interface GameOptionsValue { turnSeconds: number; noReuse: boolean }`
  - `RoomState` 에 `serverNow: number` · `turnSeconds: number` · `noReuse: boolean` · `game: GameState | null` 추가
  - `type PlayerPhase = 'TURN' | 'ALIVE' | 'ELIMINATED' | 'SPECTATOR' | 'WINNER'`
  - `playerPhase(game: GameState, userId: number): PlayerPhase`

- [ ] **Step 1: 타입을 더한다**

`src/features/word-chain/api/types.ts` **끝에** 붙인다. 기존 내용은 그대로 둔다.

```ts
export type BubbleState = 'PENDING' | 'PASS' | 'FAIL'

export type FailReason =
  | 'NOT_THREE_LETTERS'
  | 'NOT_CHAINED'
  | 'ALREADY_USED'
  | 'NOT_IN_DICTIONARY'

export interface Bubble {
  userId: number
  word: string
  state: BubbleState
  verified?: boolean
  reason?: FailReason | null
}

export interface GameState {
  currentWord: string
  turnUserId: number | null
  turnEndsAt: number | null
  triesLeft: number
  usedWords: string[]
  turnOrder: number[]
  eliminated: number[]
  bubbles: Bubble[]
  winnerId: number | null
}

export interface GameOptionsValue {
  turnSeconds: number
  noReuse: boolean
}
```

`GameOptionsValue` 가 `ui/` 가 아니라 여기 있는 이유 — `model/useRoomSocket` 이 이 모양을
전송에 쓴다. `ui/` 에 두면 model 이 ui 를 참조하게 되어 방향이 뒤집힌다.

- [ ] **Step 2: `RoomState` 에 두 필드를 더한다**

같은 파일의 기존 `RoomState` 를 찾아 **필드 두 개만 추가**한다. 다른 필드는 건드리지 않는다.

```ts
export interface RoomState {
  id: number
  name: string
  status: RoomStatus
  hostId: number
  capacity: number
  players: Player[]
  serverNow: number
  turnSeconds: number
  noReuse: boolean
  game: GameState | null
}
```

**`turnSeconds`·`noReuse` 는 `game` 이 아니라 방에 있다.** 한 판도 안 한 방은 `game` 이
`null` 이라 실을 자리가 없고, 화면이 완전 제어 컴포넌트라 방장이 고른 값이 **본인 화면에서도
되돌아간다.** 스펙 4.0 참고.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`src/features/word-chain/model/playerPhase.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { GameState } from '../api/types'
import { playerPhase } from './playerPhase'

const game = (over: Partial<GameState> = {}): GameState => ({
  currentWord: '사과',
  turnUserId: 1,
  turnEndsAt: 1000,
  triesLeft: 3,
  usedWords: ['사과'],
  turnOrder: [1, 2, 3],
  eliminated: [],
  bubbles: [],
  winnerId: null,
  ...over,
})

describe('playerPhase', () => {
  it('차례인 사람은 TURN 이다', () => {
    expect(playerPhase(game(), 1)).toBe('TURN')
  })

  it('살아있지만 남의 차례면 ALIVE 다', () => {
    expect(playerPhase(game(), 2)).toBe('ALIVE')
  })

  it('탈락한 사람은 ELIMINATED 다', () => {
    expect(playerPhase(game({ eliminated: [2] }), 2)).toBe('ELIMINATED')
  })

  it('turnOrder 에 없으면 SPECTATOR 다', () => {
    expect(playerPhase(game(), 9)).toBe('SPECTATOR')
  })

  it('판이 끝나면 승자는 WINNER 다', () => {
    expect(playerPhase(game({ winnerId: 1 }), 1)).toBe('WINNER')
  })

  it('판이 끝나면 승자가 아닌 참가자는 ELIMINATED 다', () => {
    expect(playerPhase(game({ winnerId: 1 }), 2)).toBe('ELIMINATED')
  })

  it('판이 끝나도 관전자는 SPECTATOR 로 남는다', () => {
    expect(playerPhase(game({ winnerId: 1 }), 9)).toBe('SPECTATOR')
  })

  it('탈락자가 차례로 잡히지 않는다', () => {
    expect(playerPhase(game({ turnUserId: 2, eliminated: [2] }), 2)).toBe('ELIMINATED')
  })
})
```

마지막 두 테스트가 **판정 순서를 못박는다.** 관전 검사가 승자 검사보다 앞이어야 하고,
탈락 검사가 차례 검사보다 앞이어야 한다.

- [ ] **Step 4: 실패를 확인한다**

Run: `yarn vitest run src/features/word-chain/model/playerPhase.test.ts`
Expected: FAIL — `playerPhase` 를 찾을 수 없다

- [ ] **Step 5: 구현한다**

`src/features/word-chain/model/playerPhase.ts`

```ts
import type { GameState } from '../api/types'

export type PlayerPhase = 'TURN' | 'ALIVE' | 'ELIMINATED' | 'SPECTATOR' | 'WINNER'

export const playerPhase = (game: GameState, userId: number): PlayerPhase => {
  if (!game.turnOrder.includes(userId)) return 'SPECTATOR'
  if (game.winnerId !== null) return game.winnerId === userId ? 'WINNER' : 'ELIMINATED'
  if (game.eliminated.includes(userId)) return 'ELIMINATED'
  return game.turnUserId === userId ? 'TURN' : 'ALIVE'
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `yarn vitest run src/features/word-chain/model/playerPhase.test.ts`
Expected: PASS (8개)

- [ ] **Step 7: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

`RoomState` 에 필수 필드를 두 개 더했으므로 **기존 테스트의 `room()` 픽스처가 타입 에러를
낸다.** `RoomView.test.tsx` 와 `useRoomSocket.test.ts` 의 픽스처에 `serverNow: 0` 과
`game: null` 을 더해 고친다. 다른 것은 바꾸지 않는다.

---

## Task 2: 카운트다운 바

**Files:**
- Create: `src/features/word-chain/ui/TurnBar.tsx` · `TurnBar.module.scss`
- Test: `src/features/word-chain/ui/TurnBar.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `<TurnBar turnEndsAt={number} serverNow={number} />`

**쓰는 쪽이 `key={turnEndsAt}` 를 반드시 붙인다.** 그게 이 컴포넌트의 계약이다 — 턴이 바뀔 때만
리마운트되어야 길이를 다시 잡는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/TurnBar.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TurnBar } from './TurnBar'

describe('TurnBar', () => {
  it('남은 시간을 애니메이션 길이로 잡는다', () => {
    render(<TurnBar turnEndsAt={5000} serverNow={2000} />)

    expect(screen.getByTestId('turn-bar')).toHaveStyle({ animationDuration: '3000ms' })
  })

  it('이미 지난 턴은 0 으로 잡는다', () => {
    render(<TurnBar turnEndsAt={1000} serverNow={4000} />)

    expect(screen.getByTestId('turn-bar')).toHaveStyle({ animationDuration: '0ms' })
  })

  it('턴 중간에 serverNow 만 바뀌어도 길이를 다시 잡지 않는다', () => {
    const { rerender } = render(<TurnBar turnEndsAt={5000} serverNow={2000} />)

    rerender(<TurnBar turnEndsAt={5000} serverNow={4000} />)

    expect(screen.getByTestId('turn-bar')).toHaveStyle({ animationDuration: '3000ms' })
  })
})
```

세 번째가 이 컴포넌트의 존재 이유다. **`PENDING` 말풍선 브로드캐스트가 오면 `serverNow` 만
바뀌는데, 그때 길이를 다시 잡으면 바가 처음으로 되돌아간다.**

- [ ] **Step 2: 실패를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/TurnBar.test.tsx`
Expected: FAIL — `TurnBar` 를 찾을 수 없다

- [ ] **Step 3: 구현한다**

`src/features/word-chain/ui/TurnBar.tsx`

```tsx
import { useState } from 'react'
import styles from './TurnBar.module.scss'

export interface TurnBarProps {
  turnEndsAt: number
  serverNow: number
}

export const TurnBar = ({ turnEndsAt, serverNow }: TurnBarProps) => {
  const [durationMs] = useState(() => Math.max(0, turnEndsAt - serverNow))

  return (
    <div className={styles.track}>
      <div
        className={styles.fill}
        data-testid="turn-bar"
        style={{ animationDuration: `${durationMs}ms` }}
      />
    </div>
  )
}
```

`useState` 의 **초기화 함수는 마운트 때 한 번만** 돈다. 그래서 `serverNow` 가 나중에 바뀌어도
길이가 안 변한다. 턴이 바뀌면 쓰는 쪽의 `key` 가 리마운트시켜 다시 잡는다.

- [ ] **Step 4: 스타일을 만든다**

`src/features/word-chain/ui/TurnBar.module.scss`

```scss
.track {
  height: 4px;
  border-radius: 999px;
  background: var(--bg-sunken);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transform-origin: left center;
  animation-name: drain;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes drain {
  from {
    scale: 1 1;
  }

  to {
    scale: 0 1;
  }
}
```

`reduced-motion` 으로 끄지 않는다. **남은 시간은 정보라 애니메이션이 곧 내용이다.**

- [ ] **Step 5: 통과를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/TurnBar.test.tsx`
Expected: PASS (3개)

- [ ] **Step 6: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

---

## Task 3: 말풍선과 무대 게임 모드

**Files:**
- Create: `src/features/word-chain/ui/SpeechBubble.tsx` · `SpeechBubble.module.scss`
- Modify: `src/features/word-chain/ui/PlayerPodium.tsx` · `PlayerPodium.module.scss`
- Modify: `src/features/word-chain/ui/Stage.tsx`
- Test: `src/features/word-chain/ui/Stage.test.tsx` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 1 의 `Bubble` · `GameState` · `playerPhase`
- Produces:
  - `<SpeechBubble bubble={Bubble} />`
  - `<PlayerPodium player isHost onSelect? phase? bubble? />` — `phase` 가 없으면 대기실 모드
  - `<Stage players hostId onSelectPlayer? game? />` — `game` 이 없으면 대기실 모드

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/Stage.test.tsx` **맨 끝의 `})` 앞에** 아래를 붙인다. 기존
테스트는 그대로 둔다. 파일 위쪽 import 에 `GameState` 타입을 더한다.

```tsx
  const game = (over: Partial<GameState> = {}): GameState => ({
    currentWord: '사과',
    turnUserId: 1,
    turnEndsAt: 1000,
    triesLeft: 3,
    usedWords: ['사과'],
    turnOrder: [1, 2],
    eliminated: [],
    bubbles: [],
    winnerId: null,
    ...over,
  })

  it('게임이 없으면 준비 표시를 그대로 그린다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={9} />)

    expect(within(screen.getByRole('listitem', { name: '사람1' })).getByText('준비')).toBeInTheDocument()
  })

  it('게임 중에는 준비 표시를 그리지 않는다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={9} game={game()} />)

    expect(within(screen.getByRole('listitem', { name: '사람1' })).queryByText('준비')).toBeNull()
  })

  it('탈락한 사람에게 탈락 표시가 붙는다', () => {
    render(
      <Stage players={[player(1), player(2)]} hostId={9} game={game({ eliminated: [2] })} />,
    )

    expect(within(screen.getByRole('listitem', { name: '사람2' })).getByText('탈락')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: '사람1' })).queryByText('탈락')).toBeNull()
  })

  it('turnOrder 에 없는 사람에게 관전 표시가 붙는다', () => {
    render(
      <Stage players={[player(1), player(9)]} hostId={1} game={game()} />,
    )

    expect(within(screen.getByRole('listitem', { name: '사람9' })).getByText('관전')).toBeInTheDocument()
  })

  it('승자에게 승리 표시가 붙는다', () => {
    render(<Stage players={[player(1), player(2)]} hostId={9} game={game({ winnerId: 2 })} />)

    expect(within(screen.getByRole('listitem', { name: '사람2' })).getByText('승리')).toBeInTheDocument()
  })

  it('말풍선은 낸 사람 자리에만 뜬다', () => {
    render(
      <Stage
        players={[player(1), player(2)]}
        hostId={9}
        game={game({ bubbles: [{ userId: 2, word: '과일', state: 'PASS' }] })}
      />,
    )

    expect(within(screen.getByRole('listitem', { name: '사람2' })).getByText('과일')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: '사람1' })).queryByText('과일')).toBeNull()
  })

  it('사전을 못 쓴 통과에는 미확인 표시가 붙는다', () => {
    render(
      <Stage
        players={[player(1)]}
        hostId={9}
        game={game({ bubbles: [{ userId: 1, word: '과일', state: 'PASS', verified: false }] })}
      />,
    )

    expect(screen.getByText('사전 확인 못 함')).toBeInTheDocument()
  })

  it('오답에는 틀린 이유가 붙는다', () => {
    render(
      <Stage
        players={[player(1)]}
        hostId={9}
        game={game({ bubbles: [{ userId: 1, word: '바나나', state: 'FAIL', reason: 'NOT_CHAINED' }] })}
      />,
    )

    expect(screen.getByText('앞 단어와 안 이어집니다')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 실패를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/Stage.test.tsx`
Expected: FAIL — `Stage` 가 `game` prop 을 모른다

- [ ] **Step 3: `SpeechBubble` 을 만든다**

`src/features/word-chain/ui/SpeechBubble.tsx`

```tsx
import type { Bubble, BubbleState, FailReason } from '../api/types'
import styles from './SpeechBubble.module.scss'

const STATE_LABEL: Record<BubbleState, string> = {
  PENDING: '확인 중',
  PASS: '통과',
  FAIL: '오답',
}

const FAIL_LABEL: Record<FailReason, string> = {
  NOT_THREE_LETTERS: '세 글자가 아닙니다',
  NOT_CHAINED: '앞 단어와 안 이어집니다',
  ALREADY_USED: '이미 나온 단어입니다',
  NOT_IN_DICTIONARY: '사전에 없는 명사입니다',
}

export interface SpeechBubbleProps {
  bubble: Bubble
}

export const SpeechBubble = ({ bubble }: SpeechBubbleProps) => {
  const note =
    bubble.state === 'FAIL' && bubble.reason
      ? FAIL_LABEL[bubble.reason]
      : bubble.state === 'PASS' && bubble.verified === false
        ? '사전 확인 못 함'
        : null

  return (
    <span className={`${styles.bubble} ${styles[bubble.state.toLowerCase()]}`}>
      <span className={styles.word}>{bubble.word}</span>
      <span className="visually-hidden">{STATE_LABEL[bubble.state]}</span>
      {bubble.state === 'PASS' && <span aria-hidden="true">✓</span>}
      {bubble.state === 'FAIL' && <span aria-hidden="true">✗</span>}
      {note && <span className={styles.note}>{note}</span>}
    </span>
  )
}
```

**모든 상태가 읽히는 이름을 갖는다.** 처음에는 오답 사유와 미확인 통과에만 문구를 달았는데,
그러면 **평범한 통과와 확인 중과 사유 없는 오답이 스크린리더에 똑같이 들린다** — 단어만 읽히고
✓ ✗ 는 `aria-hidden` 이라 아무것도 남지 않는다. `visually-hidden` 으로 상태 이름을 항상 붙인다.

색과 기호만으로 갈리면 안 된다는 스펙 7.5 를 이렇게 지킨다.

- [ ] **Step 4: `SpeechBubble.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.bubble {
  position: absolute;
  bottom: 0;
  left: 50%;
  translate: -50%;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: max-content;
  max-width: 190px;
  padding: 6px 11px;
  border: 1px solid var(--border);
  border-radius: 12px 12px 12px 3px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  font-size: 12px;
  animation: pop 0.12s ease-out;
}

.word {
  color: var(--text-strong);
  font-weight: 600;
  white-space: nowrap;
}

.note {
  color: var(--text-muted);
  font-size: 10.5px;
  line-height: 1.35;
}

.pending {
  opacity: 0.7;
}

.pass {
  border-color: var(--accent);
  color: var(--accent);
}

.fail {
  border-color: var(--danger);
  color: var(--danger);
}

@keyframes pop {
  from {
    opacity: 0;
    scale: 0.9;
  }
}

@include s.reduced-motion {
  .bubble {
    animation: none;
  }
}
```

- [ ] **Step 5: `PlayerPodium` 에 두 prop 을 더한다**

`src/features/word-chain/ui/PlayerPodium.tsx` 를 아래로 바꾼다.

```tsx
import type { Bubble, Player } from '../api/types'
import type { PlayerPhase } from '../model/playerPhase'
import { avatarOption } from '../model/avatars'
import { SpeechBubble } from './SpeechBubble'
import styles from './PlayerPodium.module.scss'

const PHASE_LABEL: Partial<Record<PlayerPhase, string>> = {
  ELIMINATED: '탈락',
  SPECTATOR: '관전',
  WINNER: '승리',
}

const PHASE_CLASS: Partial<Record<PlayerPhase, string>> = {
  TURN: styles.spotlight,
  ALIVE: styles.dimmed,
  ELIMINATED: styles.out,
  SPECTATOR: styles.out,
  WINNER: styles.spotlight,
}

export interface PlayerPodiumProps {
  player: Player
  isHost: boolean
  onSelect?: () => void
  phase?: PlayerPhase
  bubble?: Bubble
}

export const PlayerPodium = ({ player, isHost, onSelect, phase, bubble }: PlayerPodiumProps) => {
  const avatar = avatarOption(player.avatar)
  const phaseLabel = phase ? PHASE_LABEL[phase] : undefined

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
        {!phase && !isHost && player.ready && <span className={styles.ready}>준비</span>}
        {phaseLabel && <span className={styles.phase}>{phaseLabel}</span>}
      </span>
    </>
  )

  return (
    <li
      className={`${styles.seat} ${phase ? PHASE_CLASS[phase] : ''}`}
      aria-label={player.name}
    >
      {phase && (
        <span className={styles.bubbleSlot}>{bubble && <SpeechBubble bubble={bubble} />}</span>
      )}
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

**`phase` 가 있으면 준비 표시를 그리지 않는다.** 게임이 시작되면 준비 여부는 더 이상 뜻이 없다.

- [ ] **Step 6: `PlayerPodium.module.scss` 에 세 클래스를 더한다**

기존 내용은 그대로 두고 파일 **끝에** 붙인다.

`.seat` 는 기존 블록에 `transition` 을 **합쳐 넣는다.** 같은 선택자를 100줄 떨어뜨려 두 번
쓰면 나중에 고칠 때 엉뚱한 블록에 들어간다.

```scss
.bubbleSlot {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  min-height: 34px;
  margin-bottom: 4px;
}

.phase {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--bg-sunken);
  color: var(--text-muted);
  font-size: 10.5px;
  font-weight: 500;
}

.spotlight {
  opacity: 1;
}

.dimmed {
  opacity: 0.5;
}

.out {
  opacity: 0.4;
  filter: grayscale(1);
}

```

그리고 기존 `.seat` 블록에 아래 두 줄을 **합친다.**

```scss
  transition: opacity 0.2s ease, filter 0.2s ease;

  @include s.reduced-motion {
    transition: none;
  }
```

**`bubbleSlot` 은 말풍선이 없어도 자리를 차지한다.** 안 그러면 말풍선이 뜰 때마다 무대 높이가
바뀌어 3초마다 화면이 출렁인다.

**다만 게임 중일 때만이다.** `phase` 가 없는 대기실에서까지 그리면 이미 배포된 화면의 연단마다
빈 38px 이 생긴다. 텍스트 기반 테스트로는 안 잡히는 회귀다.

- [ ] **Step 7: `Stage` 에 `game` prop 을 더한다**

`src/features/word-chain/ui/Stage.tsx` 를 아래로 바꾼다.

```tsx
import { splitSeats } from '../model/seats'
import { playerPhase } from '../model/playerPhase'
import type { GameState, Player } from '../api/types'
import { PlayerPodium } from './PlayerPodium'
import styles from './Stage.module.scss'

export interface StageProps {
  players: Player[]
  hostId: number
  onSelectPlayer?: (userId: number) => void
  game?: GameState
}

export const Stage = ({ players, hostId, onSelectPlayer, game }: StageProps) => {
  const { back, front } = splitSeats(players)

  const row = (seats: Player[], className: string) => (
    <ul className={className}>
      {seats.map((player) => (
        <PlayerPodium
          key={player.userId}
          player={player}
          isHost={player.userId === hostId}
          phase={game ? playerPhase(game, player.userId) : undefined}
          bubble={game?.bubbles.find((bubble) => bubble.userId === player.userId)}
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

- [ ] **Step 8: 통과를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/Stage.test.tsx`
Expected: PASS (기존 10개 + 신규 8개 = 18개)

- [ ] **Step 9: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

---

## Task 4: 답 입력 바

**Files:**
- Create: `src/features/word-chain/ui/AnswerBar.tsx` · `AnswerBar.module.scss`
- Test: `src/features/word-chain/ui/AnswerBar.test.tsx`

**Interfaces:**
- Consumes: Task 1 의 `PlayerPhase`, Task 2 의 `TurnBar`
- Produces: `<AnswerBar phase currentWord turnPlayerName triesLeft turnEndsAt serverNow onSubmit />`

**이 작업의 핵심은 한글 조합이다.** 마지막 글자를 조합하는 중에 Enter 를 치면 조합만 확정되고
제출은 안 된다. 3초 턴에서는 한 번 더 칠 시간이 없어 기회를 통째로 잃는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/AnswerBar.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnswerBar } from './AnswerBar'

const setup = (over: Partial<Parameters<typeof AnswerBar>[0]> = {}) => {
  const props = {
    phase: 'TURN' as const,
    currentWord: '사과',
    turnPlayerName: '김성호',
    triesLeft: 3,
    awaitingJudgement: false,
    turnEndsAt: 4000,
    serverNow: 1000,
    onSubmit: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<AnswerBar {...props} />) }
}

describe('AnswerBar', () => {
  it('내 차례면 입력할 수 있다', () => {
    setup()

    expect(screen.getByRole('textbox')).toBeEnabled()
  })

  it('남의 차례면 누구 차례인지 알리고 입력을 막는다', () => {
    setup({ phase: 'ALIVE', turnPlayerName: '이영희' })

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByText('이영희 님 차례')).toBeInTheDocument()
  })

  it('탈락하면 알린다', () => {
    setup({ phase: 'ELIMINATED' })

    expect(screen.getByText('탈락했습니다')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('관전이면 알린다', () => {
    setup({ phase: 'SPECTATOR' })

    expect(screen.getByText('다음 판부터 참가합니다')).toBeInTheDocument()
  })

  it('남은 기회를 보여준다', () => {
    setup({ triesLeft: 2 })

    expect(screen.getByText('2번 남음')).toBeInTheDocument()
  })

  it('이어갈 글자를 안내 문구로 보여준다', () => {
    setup({ currentWord: '사과' })

    expect(screen.getByPlaceholderText('과로 시작하는 세 글자')).toBeInTheDocument()
  })

  it('버튼을 누르면 제출하고 칸을 비운다', async () => {
    const { user, props } = setup()
    const input = screen.getByRole('textbox')

    await user.type(input, '과일')
    await user.click(screen.getByRole('button', { name: '내기' }))

    expect(props.onSubmit).toHaveBeenCalledWith('과일')
    expect(input).toHaveValue('')
  })

  it('조합 중이 아니면 Enter 한 번에 제출된다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(props.onSubmit).toHaveBeenCalledWith('과일')
  })

  it('조합 중 Enter 는 조합이 끝난 뒤 제출된다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과이' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(props.onSubmit).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).toHaveBeenCalledWith('과일')
  })

  it('조합이 끝나도 Enter 를 안 눌렀으면 제출하지 않는다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('제출을 못 한 채 차례가 넘어가면 다음 조합에서 새어 나가지 않는다', () => {
    const { props, rerender } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과이' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

    rerender(<AnswerBar {...props} phase="ALIVE" />)
    rerender(<AnswerBar {...props} phase="TURN" />)

    fireEvent.change(input, { target: { value: '기차' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('새 조합이 시작되면 이전에 눌린 Enter 가 새어 나가지 않는다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과이' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('판정을 기다리는 동안은 못 낸다', () => {
    setup({ awaitingJudgement: true })

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: '내기' })).toBeDisabled()
    expect(screen.getByText('확인 중…')).toBeInTheDocument()
  })

  it('빈 칸은 제출하지 않는다', () => {
    const { props } = setup()

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
```

**마지막에서 두 번째가 중요하다.** `compositionend` 마다 제출하면 조합을 끝낼 때마다 답이
나간다 — 한 글자 칠 때마다 기회가 하나씩 사라진다.

- [ ] **Step 2: 실패를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/AnswerBar.test.tsx`
Expected: FAIL — `AnswerBar` 를 찾을 수 없다

- [ ] **Step 3: 구현한다**

`src/features/word-chain/ui/AnswerBar.tsx`

```tsx
import { useEffect, useRef, useState } from 'react'
import type { CompositionEvent, KeyboardEvent } from 'react'
import type { PlayerPhase } from '../model/playerPhase'
import { TurnBar } from './TurnBar'
import styles from './AnswerBar.module.scss'

export interface AnswerBarProps {
  phase: PlayerPhase
  currentWord: string
  turnPlayerName: string
  triesLeft: number
  awaitingJudgement: boolean
  turnEndsAt: number
  serverNow: number
  onSubmit: (word: string) => void
}

export const AnswerBar = ({
  phase,
  currentWord,
  turnPlayerName,
  triesLeft,
  awaitingJudgement,
  turnEndsAt,
  serverNow,
  onSubmit,
}: AnswerBarProps) => {
  const [word, setWord] = useState('')
  const pendingSubmit = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const myTurn = phase === 'TURN'
  const canType = myTurn && !awaitingJudgement

  useEffect(() => {
    pendingSubmit.current = false
    if (myTurn) inputRef.current?.focus()
  }, [myTurn])

  const submit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setWord('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    if (event.nativeEvent.isComposing) {
      pendingSubmit.current = true
      return
    }
    event.preventDefault()
    submit(word)
  }

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    if (!pendingSubmit.current) return
    pendingSubmit.current = false
    submit(event.currentTarget.value)
  }

  const status =
    phase === 'ELIMINATED'
      ? '탈락했습니다'
      : phase === 'SPECTATOR'
        ? '다음 판부터 참가합니다'
        : awaitingJudgement && myTurn
          ? '확인 중…'
          : myTurn
            ? `${triesLeft}번 남음`
            : `${turnPlayerName} 님 차례`

  return (
    <div className={styles.bar}>
      <TurnBar key={turnEndsAt} turnEndsAt={turnEndsAt} serverNow={serverNow} />

      <div className={styles.row}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={word}
          disabled={!canType}
          autoComplete="off"
          aria-label="답"
          placeholder={`${currentWord.slice(-1)}로 시작하는 세 글자`}
          onChange={(event) => setWord(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            pendingSubmit.current = false
          }}
          onCompositionEnd={handleCompositionEnd}
        />
        <button
          type="button"
          className={styles.submit}
          disabled={!canType}
          onClick={() => submit(word)}
        >
          내기
        </button>
        <span className={styles.status} role="status">
          {status}
        </span>
      </div>
    </div>
  )
}
```

**`compositionend` 에서는 state 가 아니라 `currentTarget.value` 를 읽는다.** 조합이 확정되는
`onChange` 와 `compositionend` 의 순서가 브라우저마다 달라, state 를 읽으면 마지막 글자가
빠질 수 있다.

**`pendingSubmit` 이 없으면 조합이 끝날 때마다 제출된다.** 한 글자 칠 때마다 기회가 하나씩
사라진다.

**그 깃발을 반드시 두 곳에서 내린다 — 안 그러면 다음 턴으로 새어 나간다.** Enter 를 조합 중에
눌렀는데 기다리던 `compositionend` 가 그 턴에 안 오면(시간 초과로 입력칸이 잠기는 등) 깃발이
`true` 로 남는다. 다음 턴에 사람이 평범하게 치다 조합이 끝나는 **첫 순간 반쯤 친 단어가
제출되고 기회가 하나 사라진다.**

- `myTurn` 이 바뀌면 내린다 — 턴을 넘나드는 누수를 막는다
- `compositionstart` 에서 내린다 — 조합을 도중에 버리고 새로 시작한 경우를 막는다

**`setWord('')` 만으로는 칸이 안 비워질 수 있다.** 크롬은 `compositionend` **뒤에** 마지막
`input` 이벤트를 흘려서 `onChange` 가 방금 지운 값을 되살린다. `inputRef.current.value = ''`
를 같이 둔다. jsdom 에는 이 순서가 없어 테스트가 증명하지 못하므로 **브라우저에서 확인한다**.

- [ ] **Step 4: `AnswerBar.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.bar {
  margin-top: 16px;
  padding: 12px 18px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--border-input);
  border-radius: 999px;
  background: var(--surface-input);
  color: var(--text-strong);
  font-family: inherit;
  font-size: 15px;

  &::placeholder {
    color: var(--text-placeholder);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  @include s.focus-ring;
}

.submit {
  flex-shrink: 0;
  padding: 10px 20px;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--accent-hi);
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

.status {
  flex-shrink: 0;
  min-width: 92px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}
```

`.status` 에 `min-width` 를 두는 이유 — 문구 길이가 바뀔 때마다 입력칸 폭이 흔들리면 3초마다
화면이 움직인다.

- [ ] **Step 5: 통과를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/AnswerBar.test.tsx`
Expected: PASS (13개)

- [ ] **Step 6: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

---

## Task 5: 대기실 옵션과 승자 배너

**Files:**
- Create: `src/features/word-chain/ui/GameOptions.tsx` · `GameOptions.module.scss`
- Create: `src/features/word-chain/ui/WinnerBanner.tsx` · `WinnerBanner.module.scss`
- Test: `src/features/word-chain/ui/GameOptions.test.tsx`

**Interfaces:**
- Consumes: Task 1 의 `GameOptionsValue`
- Produces:
  - `<GameOptions turnSeconds={number} noReuse={boolean} disabled={boolean} onChange={(options: GameOptionsValue) => void} />`
  - `<WinnerBanner name={string} />`

`TURN_SECONDS_CHOICES` 는 **export 하지 않는다.** 밖에서 쓰는 곳이 없고, 컴포넌트 파일이
컴포넌트 말고 다른 것을 내보내면 `react/only-export-components` 가 경고한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/GameOptions.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameOptions } from './GameOptions'

const setup = (over: Partial<Parameters<typeof GameOptions>[0]> = {}) => {
  const props = {
    turnSeconds: 3,
    noReuse: false,
    disabled: false,
    onChange: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<GameOptions {...props} />) }
}

describe('GameOptions', () => {
  it('3 · 5 · 7초만 고를 수 있다', () => {
    setup()

    expect(screen.getByRole('radio', { name: '3초' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '5초' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '7초' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('지금 값이 골라져 있다', () => {
    setup({ turnSeconds: 5 })

    expect(screen.getByRole('radio', { name: '5초' })).toBeChecked()
  })

  it('턴 시간을 바꾸면 재사용 금지를 그대로 실어 알린다', async () => {
    const { user, props } = setup({ noReuse: true })

    await user.click(screen.getByRole('radio', { name: '7초' }))

    expect(props.onChange).toHaveBeenCalledWith({ turnSeconds: 7, noReuse: true })
  })

  it('재사용 금지를 켜면 턴 시간을 그대로 실어 알린다', async () => {
    const { user, props } = setup({ turnSeconds: 5 })

    await user.click(screen.getByRole('checkbox', { name: '한 번 나온 단어 금지' }))

    expect(props.onChange).toHaveBeenCalledWith({ turnSeconds: 5, noReuse: true })
  })

  it('방장이 아니면 못 바꾼다', () => {
    setup({ disabled: true })

    expect(screen.getByRole('radio', { name: '3초' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: '한 번 나온 단어 금지' })).toBeDisabled()
  })
})
```

셋째·넷째가 **한쪽만 보내는 버그**를 막는다. 서버는 두 값을 함께 받으므로 하나만 실어 보내면
나머지가 기본값으로 덮인다.

- [ ] **Step 2: 실패를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/GameOptions.test.tsx`
Expected: FAIL — `GameOptions` 를 찾을 수 없다

- [ ] **Step 3: `GameOptions` 를 만든다**

`src/features/word-chain/ui/GameOptions.tsx`

```tsx
import type { GameOptionsValue } from '../api/types'
import styles from './GameOptions.module.scss'

const TURN_SECONDS_CHOICES = [3, 5, 7] as const

export interface GameOptionsProps extends GameOptionsValue {
  disabled: boolean
  onChange: (options: GameOptionsValue) => void
}

export const GameOptions = ({ turnSeconds, noReuse, disabled, onChange }: GameOptionsProps) => {
  return (
    <div className={styles.options}>
      <span className={styles.label}>턴 시간</span>
      <fieldset className={styles.group}>
        <legend className="visually-hidden">턴 시간</legend>
        {TURN_SECONDS_CHOICES.map((seconds) => (
          <label key={seconds} className={styles.choice}>
            <input
              type="radio"
              name="turnSeconds"
              value={seconds}
              checked={turnSeconds === seconds}
              disabled={disabled}
              aria-label={`${seconds}초`}
              onChange={() => onChange({ turnSeconds: seconds, noReuse })}
            />
            <span>{seconds}초</span>
          </label>
        ))}
      </fieldset>

      <label className={styles.reuse}>
        <input
          type="checkbox"
          checked={noReuse}
          disabled={disabled}
          onChange={(event) => onChange({ turnSeconds, noReuse: event.target.checked })}
        />
        <span>한 번 나온 단어 금지</span>
      </label>
    </div>
  )
}
```

- [ ] **Step 4: `GameOptions.module.scss` 를 만든다**

```scss
@use '@/shared/styles' as s;

.options {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.choice,
.reuse {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text);
  font-size: 12.5px;
  cursor: pointer;

  input:disabled ~ span {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input {
    @include s.focus-ring;
  }
}
```

- [ ] **Step 5: `WinnerBanner` 를 만든다**

`src/features/word-chain/ui/WinnerBanner.tsx`

```tsx
import styles from './WinnerBanner.module.scss'

export interface WinnerBannerProps {
  name: string
}

export const WinnerBanner = ({ name }: WinnerBannerProps) => {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>{name} 님 승리</span>
    </div>
  )
}
```

**배너에 `다시 시작` 을 두지 않는다.** 판이 끝나면 서버가 모두의 `ready` 를 `false` 로
되돌리므로, 다시 시작하려면 사람들이 준비를 눌러야 한다. 배너에도 버튼을 두면 준비가 안 된
동안 비활성으로 떠 있는 버튼이 둘이 되어 어느 것을 눌러야 할지 알 수 없다. **시작은 평소의
준비 바가 맡는다.**

- [ ] **Step 6: `WinnerBanner.module.scss` 를 만든다**

```scss
.banner {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
  padding: 16px 20px;
  border: 1px solid var(--accent);
  border-radius: 12px;
  background: var(--accent-soft);
}

.text {
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 700;
}

```

- [ ] **Step 7: 통과를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/GameOptions.test.tsx`
Expected: PASS (5개)

- [ ] **Step 8: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

---

## Task 6: 방 화면 조립

**Files:**
- Modify: `src/features/word-chain/ui/RoomView.tsx` · `RoomView.module.scss`
- Test: `src/features/word-chain/ui/RoomView.test.tsx` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 1~5 전부
- Produces: `<RoomView room myUserId onAvatarChange onReadyChange onTransfer onStart onLeave onAnswer onOptionsChange />` — 콜백은 전부 필수

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/ui/RoomView.test.tsx` 의 `setup` 에 콜백 둘을 더하고, 파일 **맨 끝의
`})` 앞에** 아래를 붙인다. 기존 테스트는 그대로 둔다.

```tsx
  const playing = (over: Partial<GameState> = {}): RoomState =>
    room({
      status: 'PLAYING',
      game: {
        currentWord: '사과',
        turnUserId: 1,
        turnEndsAt: 4000,
        triesLeft: 3,
        usedWords: ['사과'],
        turnOrder: [1, 2],
        eliminated: [],
        bubbles: [],
        winnerId: null,
        ...over,
      },
    })

  it('대기 중이면 준비 바를 그린다', () => {
    setup()

    expect(screen.getByRole('button', { name: '준비' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '답' })).not.toBeInTheDocument()
  })

  it('게임 중이면 답 입력칸을 그린다', () => {
    setup({ myUserId: 1, room: playing() })

    expect(screen.getByRole('textbox', { name: '답' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '준비' })).not.toBeInTheDocument()
  })

  it('이어갈 단어를 보여준다', () => {
    setup({ myUserId: 1, room: playing({ currentWord: '기차' }) })

    expect(screen.getByTestId('current-word')).toHaveTextContent('기차')
  })

  it('답을 내면 알린다', async () => {
    const { user, props } = setup({ myUserId: 1, room: playing() })

    await user.type(screen.getByRole('textbox', { name: '답' }), '과일')
    await user.click(screen.getByRole('button', { name: '내기' }))

    expect(props.onAnswer).toHaveBeenCalledWith('과일')
  })

  it('내 답을 판정하는 동안 입력칸이 잠긴다', () => {
    setup({
      myUserId: 1,
      room: playing({ bubbles: [{ userId: 1, word: '과일', state: 'PENDING' }] }),
    })

    expect(screen.getByRole('textbox', { name: '답' })).toBeDisabled()
  })

  it('남의 답을 판정하는 동안에는 내 입력칸이 안 잠긴다', () => {
    setup({
      myUserId: 1,
      room: playing({ bubbles: [{ userId: 2, word: '과일', state: 'PENDING' }] }),
    })

    expect(screen.getByRole('textbox', { name: '답' })).toBeEnabled()
  })

  it('재사용 금지가 켜졌으면 나온 단어를 보여준다', () => {
    setup({
      myUserId: 1,
      room: { ...playing({ usedWords: ['사과', '과일'] }), noReuse: true },
    })

    expect(screen.getByTestId('used-words')).toHaveTextContent('과일')
  })

  it('재사용 금지가 꺼졌으면 나온 단어를 보여주지 않는다', () => {
    setup({
      myUserId: 1,
      room: { ...playing({ usedWords: ['사과'] }), noReuse: false },
    })

    expect(screen.queryByTestId('used-words')).not.toBeInTheDocument()
  })

  it('결과 화면에서는 무대가 대기실로 돌아간다', () => {
    setup({
      myUserId: 2,
      room: room({
        status: 'WAITING',
        players: [player(1, { ready: false }), player(2, { ready: true })],
        game: { ...playing().game!, winnerId: 1, turnUserId: null, turnEndsAt: null },
      }),
    })

    const winner = screen.getByRole('listitem', { name: '사람1' })
    const other = screen.getByRole('listitem', { name: '사람2' })

    expect(within(winner).queryByText('탈락')).toBeNull()
    expect(within(other).queryByText('탈락')).toBeNull()
    expect(within(other).getByText('준비')).toBeInTheDocument()
  })

  it('판이 끝나면 승자를 알리고 게임 화면을 걷는다', () => {
    setup({
      myUserId: 2,
      room: room({ status: 'WAITING', game: { ...playing().game!, winnerId: 1 } }),
    })

    expect(screen.getByText('사람1 님 승리')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '답' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('current-word')).not.toBeInTheDocument()
    expect(screen.queryByTestId('used-words')).not.toBeInTheDocument()
  })

  it('결과 화면에도 준비 바가 그대로 있다', () => {
    setup({
      myUserId: 2,
      room: room({ status: 'WAITING', game: { ...playing().game!, winnerId: 1 } }),
    })

    expect(screen.getByRole('button', { name: '준비' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시작' })).not.toBeInTheDocument()
  })

  it('결과 화면에서 준비가 풀려 있으면 시작이 막힌다', () => {
    setup({
      myUserId: 1,
      room: room({
        status: 'WAITING',
        players: [player(1, { ready: false }), player(2, { ready: false })],
        game: { ...playing().game!, winnerId: 1 },
      }),
    })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('방이 들고 있는 턴 시간이 보인다', () => {
    setup({ myUserId: 1 })

    expect(screen.getByRole('radio', { name: '3초' })).toBeChecked()
  })

  it('방장이 턴 시간을 바꾸면 그 값을 알린다', async () => {
    const { user, props } = setup({ myUserId: 1 })

    await user.click(screen.getByRole('radio', { name: '7초' }))

    expect(props.onOptionsChange).toHaveBeenCalledWith({ turnSeconds: 7, noReuse: false })
  })

  it('방장이 아니면 옵션을 못 바꾼다', () => {
    setup({ myUserId: 2 })

    expect(screen.getByRole('radio', { name: '3초' })).toBeDisabled()
  })
```

`playing().game!` 은 방금 만든 객체라 `null` 이 아님이 확실하다.

**옵션은 `room` 에서 읽는다.** `game` 이 `null` 인 방에도 `turnSeconds`·`noReuse` 가 온다.
`game` 안에 두면 한 판도 안 한 방에서 방장이 고른 값을 실을 자리가 없어, 완전 제어 컴포넌트인
라디오가 **본인 화면에서도 되돌아간다.**

**결과 화면은 승자 배너 + 평소의 옵션·준비 바다.** 서버가 판이 끝날 때 모두의 `ready` 를
`false` 로 되돌리므로, 다시 시작하려면 사람들이 준비를 눌러야 한다. 배너에는 버튼이 없다.

- [ ] **Step 2: 실패를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/RoomView.test.tsx`
Expected: FAIL — `onAnswer` 를 모른다

- [ ] **Step 3: `RoomView` 를 바꾼다**

`src/features/word-chain/ui/RoomView.tsx`

```tsx
import { useState } from 'react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import type { Avatar, GameOptionsValue, Player, RoomState } from '../api/types'
import { playerPhase } from '../model/playerPhase'
import { AnswerBar } from './AnswerBar'
import { GameOptions } from './GameOptions'
import { ReadyBar } from './ReadyBar'
import { Stage } from './Stage'
import { WinnerBanner } from './WinnerBanner'
import styles from './RoomView.module.scss'

export interface RoomViewProps {
  room: RoomState
  myUserId: number
  onAvatarChange: (avatar: Avatar) => void
  onReadyChange: (ready: boolean) => void
  onTransfer: (userId: number) => void
  onStart: () => void
  onLeave: () => void
  onAnswer: (word: string) => void
  onOptionsChange: (options: GameOptionsValue) => void
}

export const RoomView = ({
  room,
  myUserId,
  onAvatarChange,
  onReadyChange,
  onTransfer,
  onStart,
  onLeave,
  onAnswer,
  onOptionsChange,
}: RoomViewProps) => {
  const [handingTo, setHandingTo] = useState<Player | null>(null)

  const me = room.players.find((player) => player.userId === myUserId)
  const isHost = room.hostId === myUserId
  const game = room.game
  const playing = room.status === 'PLAYING' && game !== null
  const finished = room.status === 'WAITING' && game !== null && game.winnerId !== null
  const allReady =
    room.players.length >= 2 &&
    room.players.every((player) => player.userId === room.hostId || player.ready)

  const winner = finished
    ? room.players.find((player) => player.userId === game.winnerId)
    : undefined
  const turnPlayer = playing
    ? room.players.find((player) => player.userId === game.turnUserId)
    : undefined

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

      {game && playing && (
        <p className={styles.currentWord} data-testid="current-word" role="status">
          {game.currentWord}
        </p>
      )}

      <Stage
        players={room.players}
        hostId={room.hostId}
        game={playing ? game : undefined}
        onSelectPlayer={
          isHost && !playing
            ? (userId) =>
                setHandingTo(room.players.find((player) => player.userId === userId) ?? null)
            : undefined
        }
      />

      {game && playing && room.noReuse && (
        <p className={styles.usedWords} data-testid="used-words">
          {game.usedWords.join(' · ')}
        </p>
      )}

      {finished && winner && <WinnerBanner name={winner.name} />}

      {game && playing && game.turnEndsAt !== null && (
        <AnswerBar
          phase={playerPhase(game, myUserId)}
          currentWord={game.currentWord}
          turnPlayerName={turnPlayer?.name ?? ''}
          triesLeft={game.triesLeft}
          awaitingJudgement={
            game.bubbles.find((bubble) => bubble.userId === myUserId)?.state === 'PENDING'
          }
          turnEndsAt={game.turnEndsAt}
          serverNow={room.serverNow}
          onSubmit={onAnswer}
        />
      )}

      {!playing && (
        <>
          <GameOptions
            turnSeconds={room.turnSeconds}
            noReuse={room.noReuse}
            disabled={!isHost}
            onChange={onOptionsChange}
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
        </>
      )}

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

**게임 중에는 방장 양도를 막는다.** 판 도중에 방장이 바뀌면 시작 버튼의 주인이 바뀌는데
그때 할 일이 없고, 확인창이 무대를 가려 3초 턴을 놓친다.

- [ ] **Step 4: `RoomView.module.scss` 에 두 클래스를 더한다**

기존 내용은 그대로 두고 파일 **끝에** 붙인다.

```scss
.currentWord {
  margin: 18px 0 6px;
  color: var(--text-strong);
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 6px;
  text-align: center;
}

.usedWords {
  margin: 10px 2px 0;
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.7;
  word-break: keep-all;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `yarn vitest run src/features/word-chain/ui/RoomView.test.tsx`
Expected: PASS (기존 10개 + 신규 12개 = 22개)

- [ ] **Step 6: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

---

## Task 7: 소켓 배선

**Files:**
- Modify: `src/features/word-chain/model/useRoomSocket.ts`
- Test: `src/features/word-chain/model/useRoomSocket.test.ts` (기존 파일에 추가)
- Modify: `src/features/word-chain/index.ts`
- Modify: `src/pages/WordChainRoomPage/WordChainRoomPage.tsx`

**Interfaces:**
- Consumes: Task 1 의 `GameOptionsValue`, Task 6 의 `RoomView`
- Produces: `RoomActions` 에 `answer: (word: string) => void` · `options: (value: GameOptionsValue) => void` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/word-chain/model/useRoomSocket.test.ts` 의 마지막 `})` 앞에 붙인다.

```ts
  it('답을 목적지로 보낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => result.current.send.answer('과일'))

    expect(publish).toHaveBeenCalledWith('/app/rooms/7/answer', { word: '과일' })
  })

  it('옵션을 두 값 함께 보낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => result.current.send.options({ turnSeconds: 7, noReuse: true }))

    expect(publish).toHaveBeenCalledWith('/app/rooms/7/options', {
      turnSeconds: 7,
      noReuse: true,
    })
  })
```

- [ ] **Step 2: 실패를 확인한다**

Run: `yarn vitest run src/features/word-chain/model/useRoomSocket.test.ts`
Expected: FAIL — `send.answer` 가 없다

- [ ] **Step 3: `RoomActions` 에 둘을 더한다**

`src/features/word-chain/model/useRoomSocket.ts` 에서 `RoomActions` 와 `send` 를 고친다.
다른 부분은 건드리지 않는다.

```ts
export interface RoomActions {
  avatar: (avatar: Avatar) => void
  ready: (ready: boolean) => void
  transfer: (userId: number) => void
  start: () => void
  leave: () => void
  answer: (word: string) => void
  options: (value: GameOptionsValue) => void
}
```

파일 위쪽 타입 import 에 `GameOptionsValue` 를 더한다.

```ts
import type { Avatar, GameOptionsValue, RoomState } from '../api/types'
```

`send` 객체에 두 줄을 더한다.

```ts
      answer: (word) => publish('answer', { word }),
      options: (value) => publish('options', value),
```

- [ ] **Step 4: 통과를 확인한다**

Run: `yarn vitest run src/features/word-chain/model/useRoomSocket.test.ts`
Expected: PASS (기존 7개 + 신규 2개 = 9개)

- [ ] **Step 5: 배럴에 더한다**

`src/features/word-chain/index.ts` **끝에** 한 줄을 더한다. 기존 줄은 건드리지 않는다.

```ts
export type { GameOptionsValue } from './api/types'
```

- [ ] **Step 6: 페이지를 잇는다**

`src/pages/WordChainRoomPage/WordChainRoomPage.tsx` 의 `<RoomView>` 에 두 prop 을 더한다.
다른 부분은 그대로 둔다.

```tsx
        <RoomView
          room={room}
          myUserId={me.id}
          onAvatarChange={send.avatar}
          onReadyChange={send.ready}
          onTransfer={send.transfer}
          onStart={send.start}
          onLeave={leave}
          onAnswer={send.answer}
          onOptionsChange={send.options}
        />
```

- [ ] **Step 7: 전체 검증**

Run: `yarn lint && yarn tsc -b && yarn test && yarn build`

- [ ] **Step 8: 브라우저에서 확인한다**

백엔드의 C 구현이 올라온 뒤에 한다. 그 전에는 대기실까지만 확인된다.

1. 방을 만들고 대기실에서 **7초**를 고른다 → 새로고침해도 7초가 유지되는가
2. 계정 둘로 들어가 준비 → 시작 → **차례가 도는가**
3. 답을 낸다 → 말풍선이 **`PENDING` 으로 먼저** 뜨고 곧 ✓ 로 바뀌는가
4. 틀린 답을 낸다 → 이유가 붙는가, 남은 기회가 줄어드는가
5. 시간을 흘려보낸다 → 탈락하고 연단이 회색이 되는가
6. 한 명만 남는다 → 승자 배너가 뜨고 **준비가 풀려** 준비 바가 다시 보이는가
7. **3초로 바꾸고 한글을 치다 Enter 를 한 번만** 누른다 → 조합 중이어도 제출되는가
8. 제출 직후 **입력칸이 실제로 비는가** — 크롬이 `compositionend` 뒤에 흘리는 마지막
   `input` 이벤트가 방금 지운 값을 되살릴 수 있다
9. 조합 중 Enter 를 눌렀는데 그 턴이 시간 초과로 끝난다 → **다음 턴 첫 글자에서 멋대로
   제출되지 않는가**

7~9가 이 계획에서 제일 잡기 어려운 버그다. **jsdom 에는 IME 가 없어 테스트가 상태 기계만
못박고 실제 동작을 증명하지 못한다.** 반드시 실제 브라우저에서 한글로 확인할 것.

---

## 남은 것 (이 계획 밖)

- **백엔드 C 구현** — 요청서를 따로 보낸다. 이 계획은 프론트만이다
- **사전 실연동** — D 단계. C 에서는 스텁으로 돌린다
- **재접속 복구** — 끊기면 방 목록으로 보내는 것이 B 의 결정이다
