# 이름 추첨 API

로그인한 사내 사용자가 추첨방을 만들고 함께 결과를 관전한다. 추첨 대상 이름은 계정이나 관전자 목록과 독립적이며, 방장이 프런트에서 추가·삭제한다. 추첨과 당첨 순서는 서버가 결정한다.

## REST

모든 요청에 `Authorization: Bearer <accessToken>`이 필요하다. 기본 경로는 `/api/lottery/rooms`다.

| 메서드 | 경로 | 권한 | 응답 |
| --- | --- | --- | --- |
| GET | `/` | 로그인 | 방 요약 배열, 최근 생성순 |
| POST | `/` | 로그인 | 201, 생성된 방 스냅샷 |
| GET | `/{id}` | 방 멤버 | 200, 현재 스냅샷 |
| POST | `/{id}/join` | 로그인 | 200, 입장한 방 스냅샷 |
| PUT | `/{id}/settings` | 방장, READY | 200, 변경된 스냅샷 |
| POST | `/{id}/start` | 방장, READY | 200, DRAWING 스냅샷 |
| POST | `/{id}/reset` | 방장, FINISHED | 200, READY 스냅샷 |
| POST | `/{id}/leave` | 로그인 | 204 |

`id`는 UUID 문자열이다. join/start/reset/leave는 본문이 없다. 생성자는 자동으로 멤버이자 방장이 된다. 동일 계정의 중복 입장은 멤버 수를 늘리지 않는다. 추첨 중·종료 후에도 새 관전자가 입장할 수 있다.

생성 본문:

```json
{
  "title": "오늘의 추첨",
  "participants": ["선도우", "육이슬", "유영진", "이정규", "김성호", "허소영", "김예린", "김현진", "이다혜", "박찬진", "문형석", "나예린", "김민수"],
  "winnerCount": 3
}
```

설정 변경 본문은 `participants`, `winnerCount`만 보낸다. 서버는 이름 앞뒤 공백과 유니코드 NFC를 정규화한 뒤 중복을 검사한다. 이름은 1~30자, 1~50명이고 제어 문자를 허용하지 않는다. `winnerCount`는 1 이상, 추첨 대상 인원 이하다. 방 제목은 앞뒤 공백 제거 후 1~60자다.

방 요약:

```ts
type LotteryRoomSummary = {
  id: string
  title: string
  hostId: number
  hostName: string
  status: 'READY' | 'DRAWING' | 'FINISHED'
  memberCount: number
  participantCount: number
  winnerCount: number
}
```

REST·STOMP가 공유하는 스냅샷:

```ts
type LotterySnapshot = {
  id: string
  title: string
  hostId: number
  hostName: string
  participants: string[]
  winnerCount: number
  status: 'READY' | 'DRAWING' | 'FINISHED'
  winners: { name: string; drawnAt: string }[]
  members: { userId: number; name: string }[]
  version: number
  serverTime: string
  nextDrawAt: string | null
  drawId: number
}
```

시각은 UTC ISO 8601 문자열이다. `winners`는 공개된 당첨자만 추첨 순서대로 들어간다. 다음 당첨자나 내부 무작위 순서, 세션 ID는 보내지 않는다. `version`은 화면에 보이는 상태 변경마다 증가한다. 재연결이나 중복 입장으로 같은 버전이 다시 올 수 있으므로 낮은 버전을 무시하고, 최초 스냅샷은 받아들인다. `drawId`는 추첨 시작마다 증가하며 reset으로 되돌아가지 않는다.

## STOMP

기존 `/api/ws` WebSocket을 사용하고 CONNECT 헤더에 Bearer 토큰을 넣는다. 개발·운영 소켓 URL은 기존 `shared/ws/wsUrl.ts` 설정을 따른다.

1. REST로 방을 생성하거나 `/{id}/join`한다.
2. `/topic/lottery/rooms/{id}`와 `/user/queue/errors`를 구독한다.
3. `/app/lottery/rooms/{id}/enter`에 빈 메시지를 보낸다.
4. enter가 해당 세션을 멤버에게 연결하고 현재 스냅샷을 방송한다.
5. 이후 설정·멤버·추첨 변화가 같은 topic의 전체 스냅샷으로 도착한다.

연결 복구 때 다시 구독하고 enter를 보낸다. 재입장 REST는 멱등적이며, 새로고침한 멤버는 GET으로도 같은 결과를 조회할 수 있다. 방 목록은 REST로 갱신하며 별도 목록 topic은 제공하지 않는다.

네트워크 처리 순서 때문에 enter가 구독 등록보다 먼저 끝나도, 실제 구독 등록 직후 현재 스냅샷을 다시 전달한다. 중복 스냅샷은 `version`으로 무시할 수 있다.

프런트는 연결 중 5초마다, 그리고 탭으로 돌아올 때 GET으로 멤버 자격과 최신 스냅샷을 재검증한다. 자격 상실·방 삭제·인증 실패 또는 반복되는 조회 실패 시 연결을 종료하고 재연결 안내를 표시한다.

프런트의 '저장하고 추첨'은 설정 저장 성공을 확인한 뒤 시작 요청을 보낸다. 두 요청이 끝날 때까지 중복 조작을 막으며, 저장 실패나 연결 종료·화면 이탈이 발생하면 후속 시작 요청을 보내지 않는다. 시작 요청만 실패한 경우 이미 저장한 설정은 유지된다.

방에 입장하지 않은 계정은 구독할 수 없다. topic 와일드카드 구독과 `/app/` 밖의 클라이언트 SEND는 거절한다. `/enter`로 연결하지 않은 세션과 명시적으로 나간 멤버의 이전 구독에는 추첨 스냅샷을 전달하지 않는다. 따라서 새 클라이언트는 구독 후 enter 과정을 생략하면 안 된다.

인터셉터의 인증·구독 거절은 STOMP ERROR 프레임으로 전달되고 소켓이 닫힌다. enter의 업무 오류는 `/user/queue/errors`로 `{code, message}`를 보낸다.

## 추첨과 방 수명

- 시작 시 서버의 `SecureRandom`으로 전체 명단을 한 번 섞는다. 같은 추첨에서 한 이름이 두 번 당첨되지 않는다.
- 시작 4초 뒤 첫 당첨자를 공개하고 이후 4초마다 한 명씩 공개한다. 서버 지연이 생기면 실제 공개 시점부터 다음 4초를 계산해 한꺼번에 발표하지 않는다.
- 프런트는 `drawnAt`부터 입구 접근 1.1초, 배출관 이동 0.8초, 받침대 이동 0.6초와 정착 0.3초를 표현하고 2.8초 뒤 결과 카드를 표시한다. 마지막 공도 동일하게 배출·발표한 뒤 내부 회전을 0.7초에 걸쳐 마무리한다. 늦게 입장하면 현재 시점에 맞춰 이어 보이며, 공의 위치나 애니메이션은 서버의 당첨 결과를 바꾸지 않는다.
- 지정한 당첨 인원이 채워지면 FINISHED가 되고 `nextDrawAt`은 null이다. 다음 판은 방장이 reset 후 준비한다.
- 설정·중복 시작·예약 콜백은 방 단위 원자적 갱신으로 처리한다. 지난 추첨 또는 지난 공개 시점의 예약 콜백은 무시한다.
- 브라우저 종료·일시적 연결 해제는 멤버십을 바로 제거하지 않는다. 다른 탭이나 관전자의 연결이 남아 있으면 방과 추첨을 유지한다. 마지막 연결이 끊기면 30초 재접속 유예를 시작하고, 그 안에 STOMP enter로 연결을 복구하면 삭제를 취소한다.
- 명시적으로 leave하면 그 계정의 모든 탭이 방에서 나간다. 방장은 남아 있는 첫 멤버에게 이전한다. 마지막 멤버가 나가면 추첨 중이어도 즉시 방을 삭제하며, 이미 예약된 추첨 콜백은 삭제된 방에서 아무 작업도 하지 않는다.
- 한 서버에 최대 100개 방, 방마다 최대 200명의 멤버를 허용한다. 연결이 하나도 없는 상태가 30초 지속되면 추첨 상태와 관계없이 정리한다. 생성 후 한 번도 연결되지 않은 방도 동일하게 처리한다. 1초마다 검사하므로 실제 삭제는 연결 종료를 서버가 확인한 뒤 약 30~31초 사이에 이루어진다. 조회·결과 발표 등은 재접속 유예를 연장하지 않는다.
- 방·명단·당첨 결과는 현재 단일 서버 메모리에만 있다. 서버 재시작 시 사라지고 여러 서버 인스턴스 간 공유되지 않는다. 데이터베이스 스키마 변경은 없다.

## 오류

오류 응답은 `{ "code": "...", "message": "..." }`다.

| HTTP | code | 의미 |
| --- | --- | --- |
| 400 | INVALID_INPUT | 제목·명단·당첨 인원 오류 |
| 401 | 기존 인증 오류 코드 | 토큰 없음·만료·잘못된 토큰 |
| 403 | NOT_IN_LOTTERY_ROOM | 방 멤버가 아님 |
| 403 | NOT_LOTTERY_HOST | 방장이 아님 |
| 403 | STOMP_DESTINATION_FORBIDDEN | 브로커 직접 SEND 또는 와일드카드 구독 |
| 404 | LOTTERY_ROOM_NOT_FOUND | 없는 방 또는 정리된 방 |
| 409 | LOTTERY_NOT_READY | 설정 변경·시작이 가능한 상태가 아님 |
| 409 | LOTTERY_NOT_FINISHED | 완료되지 않은 추첨을 reset함 |
| 409 | LOTTERY_ROOM_FULL | 관전 인원 상한 |
| 409 | LOTTERY_ROOM_LIMIT | 서버 방 개수 상한 |

leave는 이미 나간 사용자나 제거된 방에 반복 호출해도 204다.
