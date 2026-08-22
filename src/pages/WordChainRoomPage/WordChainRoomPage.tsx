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
