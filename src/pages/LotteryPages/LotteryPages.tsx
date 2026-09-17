import { useParams } from 'react-router'
import { useMeQuery } from '@/features/auth'
import { LotteryLobby, LotteryRoom } from '@/features/lottery'
import { Button } from '@/shared/ui/Button'

export const LotteryLobbyPage = () => (
  <>
    <title>사람 뽑기 · IBS</title>
    <LotteryLobby />
  </>
)

export const LotteryRoomPage = () => {
  const { roomId = '' } = useParams()
  const { data: me, isLoading, isFetching, isError, refetch } = useMeQuery()

  if (!me)
    return (
      <>
        <title>사람 뽑기 · IBS</title>
        <h1>사람 뽑기</h1>
        {isLoading || isFetching ? (
          <p role="status">내 정보를 확인하는 중…</p>
        ) : (
          <>
            <p role="alert">
              {isError ? '내 정보를 불러오지 못했습니다.' : '내 정보를 확인할 수 없습니다.'} 다시
              조회해 주세요.
            </p>
            <Button onClick={() => void refetch()}>내 정보 다시 조회</Button>
          </>
        )}
      </>
    )

  return (
    <>
      <title>사람 뽑기 · IBS</title>
      <LotteryRoom key={roomId} roomId={roomId} myUserId={me.id} />
    </>
  )
}
