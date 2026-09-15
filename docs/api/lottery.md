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
2. `/topic/lottery/rooms/{id}`, `/user/queue/errors`, `/topic/lottery/rooms/{id}/chat`, `/user/queue/lottery-chat`를 구독한다.
3. `/app/lottery/rooms/{id}/enter`에 빈 메시지를 보낸다.
4. enter가 해당 세션을 멤버에게 연결하고 현재 스냅샷을 방송한다.
5. 채팅의 두 구독이 브로커에 등록되고 enter가 완료되면 요청 소켓의 `/user/queue/lottery-chat`로 `{type:"READY", roomId}`가 도착한다. 프런트는 이 응답 뒤 연결 완료로 전환하고 최초 기록을 조회한다.
6. 이후 설정·멤버·추첨 변화가 방 topic의 전체 스냅샷으로 도착한다.

연결 복구 때 다시 구독하고 enter를 보낸다. 재입장 REST는 멱등적이며, 새로고침한 멤버는 GET으로도 같은 결과를 조회할 수 있다.

### 방 목록

로그인한 사용자는 방에 입장하지 않고 `/topic/lottery/lobby`를 구독할 수 있다. 이 구독은 방의 멤버나 접속 인원으로 취급하지 않으며 빈 방의 삭제를 지연시키지 않는다.

서버는 방 생성, 목록에 표시되는 정보 변경, 방 삭제 시 `{ "type": "ROOMS_CHANGED" }`를 보낸다. 명시적인 마지막 멤버 퇴장과 30초 재접속 유예 만료에 따른 삭제도 포함한다. 알림에는 명단·당첨 결과·세션 정보가 포함되지 않는다. 조회나 접속 상태만 바뀌는 경우, 목록 상태가 그대로인 중간 당첨자 발표에는 목록 알림을 보내지 않는다.

목록 화면은 처음 진입할 때 REST로 조회하고, 이후 이 알림을 받으면 다시 조회한다. 5초 주기 조회는 사용하지 않는다. 브로커의 실제 구독 등록 직후에도 목록 알림을 보내 최초 조회와 구독 사이의 변경을 놓치지 않게 한다. 이 초기 알림은 현재 로비 구독자 모두에게 전달될 수 있다.

프런트는 연결 복구와 탭 복귀 시에도 목록을 다시 조회한다. 조회 중 알림이 도착하면 완료 후 한 번 더 조회해 늦게 도착한 응답으로 최신 변경이 누락되지 않도록 한다. 연결 실패 시 재연결을 시도하고 안내를 표시하며, 수동 새로고침은 계속 사용할 수 있다. 새로고침 버튼의 로딩 표시는 직접 누른 요청에만 적용한다.

### 방 안의 상태 동기화

네트워크 처리 순서 때문에 enter가 구독 등록보다 먼저 끝나도, 실제 구독 등록 직후 현재 스냅샷을 다시 전달한다. 중복 스냅샷은 `version`으로 무시할 수 있다.

프런트는 연결 중 5초마다, 그리고 탭으로 돌아올 때 GET으로 멤버 자격과 최신 스냅샷을 재검증한다. 자격 상실·방 삭제·인증 실패 또는 반복되는 조회 실패 시 연결을 종료하고 재연결 안내를 표시한다.

프런트의 '저장하고 추첨'은 설정 저장 성공을 확인한 뒤 시작 요청을 보낸다. 두 요청이 끝날 때까지 중복 조작을 막으며, 저장 실패나 연결 종료·화면 이탈이 발생하면 후속 시작 요청을 보내지 않는다. 시작 요청만 실패한 경우 이미 저장한 설정은 유지된다.

개별 방 topic은 방에 입장한 계정만 구독할 수 있다. topic 와일드카드 구독과 `/app/` 밖의 클라이언트 SEND는 거절한다. `/enter`로 연결하지 않은 세션과 명시적으로 나간 멤버의 이전 구독에는 추첨 스냅샷을 전달하지 않는다. 따라서 개별 방 클라이언트는 구독 후 enter 과정을 생략하면 안 된다.

인터셉터의 인증·구독 거절은 STOMP ERROR 프레임으로 전달되고 소켓이 닫힌다. enter의 업무 오류는 `/user/queue/errors`로 `{code, message}`를 보낸다.

### 방 채팅

추첨방과 같은 WebSocket 연결에서 아래 경로를 사용한다. 채팅은 추첨 스냅샷의 `version`·`drawId`를 바꾸지 않으며 추첨 상태와 별도로 동기화한다.

| 용도 | 경로 |
| --- | --- |
| 방 채팅 이벤트 구독 | `/topic/lottery/rooms/{id}/chat` |
| 요청한 소켓만 받는 응답 구독 | `/user/queue/lottery-chat` |
| 기록·검색 요청 | `/app/lottery/rooms/{id}/chat/history` |
| 메시지 전송 | `/app/lottery/rooms/{id}/chat/send` |
| 읽음 반영 | `/app/lottery/rooms/{id}/chat/read` |
| 입력 상태 반영 | `/app/lottery/rooms/{id}/chat/typing` |

기존 방 topic과 채팅 topic·사용자 응답 queue를 구독하고 enter를 보낸다. 서버의 READY는 두 채팅 구독이 실제로 등록되고 해당 소켓의 입장이 완료된 뒤에만 도착한다. 이 응답을 받은 뒤 기록 조회와 채팅 명령을 보낸다. 연결 복구도 구독 → enter → READY → 최신 기록 조회 순서다. 준비가 15초 안에 끝나지 않으면 재연결 안내를 표시한다. 명령은 인증된 계정의 해당 소켓이 그 방에 연결되어 있어야 한다. 발신자의 ID와 이름은 서버가 계정에서 결정하며, 추첨 대상 이름과 무관하다.

```ts
type ChatPerson = { userId: number; name: string }
type ChatMessage = {
  id: string
  seq: number
  clientMessageId: string
  senderId: number
  senderName: string
  text: string
  sentAt: string
  readers: ChatPerson[]
}
```

`seq`는 방 안에서 증가한다. `sentAt`은 UTC ISO 8601이다. 클라이언트는 수신 순서 대신 `seq`로 정렬하며 중복 응답을 합친다.

- **기록·검색:** `{requestId, beforeSeq?, query?, senderId?}`를 보낸다. 서버가 보관 중인 전체 대화에서 검색어·발신자를 적용하고, `beforeSeq` 미만의 최근 100개를 오름차순으로 돌려준다. 처음에는 가장 최근 100개다. 응답은 `{type:"PAGE", roomId, requestId, messages, hasMore, oldestSeq, latestSeq, typing}`이다. `hasMore`는 필터 조건에 맞는 이전 기록의 존재 여부이고, `oldestSeq`·`latestSeq`는 전체 보관 범위다(빈 방은 0). `typing`은 현재 입력 중인 계정 배열이다. 검색·페이지를 바꾼 뒤 늦게 온 응답은 `requestId`로 구분한다.
- **전송:** `{clientMessageId, text}`를 보낸다. 서버는 `{type:"MESSAGE", roomId, message}`를 방에 방송하고 요청 소켓에는 `{type:"ACK", roomId, clientMessageId, message}`를 보낸다. 발신 계정과 `clientMessageId`가 같은 재시도는 보관 중인 기존 메시지를 돌려준다. 브로커 수신만으로 전송 성공을 판단하지 않고 ACK 또는 자신의 MESSAGE 수신으로 확정한다. 메시지는 공백 제거 후 1~300 유니코드 코드 포인트이며, 계정당 모든 탭·방을 합쳐 10초 동안 새 메시지 5개까지 허용한다.
- **읽음:** `{seqs:[...]}`에 실제 읽은 메시지 번호를 최대 100개 보낸다. 반영된 결과는 `{type:"READ", roomId, seqs, reader}`로 방송한다. 메시지 전송 당시 소켓이 연결된 다른 계정만 읽음 대상이며, 뒤늦게 입장한 계정과 발신자는 제외한다. 같은 계정의 여러 탭은 한 명으로 계산하고 이미 읽은 계정이 나가도 기록은 남는다. 미래 번호는 거절하고 이미 보관 범위에서 사라진 번호는 무시한다. 화면에서는 열린 채팅·활성 탭에서 실제 보이는 메시지만 처리하므로 검색으로 건너뛴 대화가 함께 읽음 처리되지 않는다.
- **입력 중:** `{typing:true|false}`를 보낸다. `{type:"TYPING", roomId, people}`는 현재 입력 중인 계정 전체 목록이다. 작성 내용은 전송하지 않는다. 클라이언트는 입력 시작 즉시, 계속 입력하면 약 2초 간격으로 갱신한다. 서버에서 5초 후 만료되고 전송·채팅 닫기·퇴장·소켓 종료 때 해제한다. 여러 탭의 상태는 계정 단위로 합친다.
- **업무 오류:** 요청 소켓에 `{type:"ERROR", roomId, requestId?, clientMessageId?, code, message}`로 응답한다. 채팅 안에서 오류·재시도를 표시하며 추첨 조작의 busy·오류 상태와 공유하지 않는다. 인증 또는 구독 권한 오류는 기존 STOMP 연결 종료 정책을 따른다.

방마다 최근 1,000개만 서버 메모리에 보관한다. 같은 방에서 새 추첨을 준비해도 대화는 유지하지만, 방이 삭제되거나 서버가 재시작하면 대화·읽음·입력 상태를 모두 잃는다. 마지막 연결 종료 후 기존 30초 재접속 유예 동안에는 유지한다. DB 저장과 스키마 변경은 없다. 자동 기록 조회·메시지 수신·읽음·입력 중 알림·heartbeat는 로그인 유휴 시간을 연장하지 않는다.

배포는 READY를 지원하는 백엔드를 먼저 반영한 뒤 프런트를 반영한다. 기존 프런트는 새 백엔드에서도 추첨 기능을 사용하지만, 새 프런트는 구형 백엔드에서 READY를 받지 못해 연결 준비 시간이 초과된다.

'언급하기'는 공개 대화 입력란에 `@이름`을 넣으며 개인 메시지는 아니다. 참가자 구 선택은 그 사람이 보낸 대화를 조회하는 필터다. 실제 추첨과 채팅의 3D 효과는 각각 독립적으로 동작한다.

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
