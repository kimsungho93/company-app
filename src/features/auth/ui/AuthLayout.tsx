import { useCallback, useState } from 'react'
import { Outlet } from 'react-router'
import { useFontReady } from '@/shared/lib/useFontReady'
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion'
import { WaferCanvas } from '@/shared/ui/WaferCanvas'
import styles from './AuthLayout.module.scss'

const WAFER_TEXT = 'IBS'
// WaferCanvas 의 폰트 굵기와 맞춰야 한다
const FONT_SPEC = '500 100px "Wanted Sans Variable"'
const INTRO_SEEN_KEY = 'ibs.intro.seen'

const shouldSkipIntro = (): boolean => {
  // 개발 중에는 새로고침마다 인트로를 봐야 작업이 된다
  if (import.meta.env.DEV) return false
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export const AuthLayout = () => {
  const reducedMotion = usePrefersReducedMotion()
  const fontReady = useFontReady(FONT_SPEC, WAFER_TEXT)
  const [skipIntro] = useState(shouldSkipIntro)

  // 마운트가 아니라 노광이 끝난 뒤에 기록한다.
  // 마운트 시점에 찍으면 첫 로드가 이미 "봤음"이 되어 다시는 재생되지 않는다.
  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      return
    }
  }, [])

  return (
    // 웨이퍼 노광은 어두운 배경에 다이가 빛나는 것이 개념의 전부라
    // 라이트 테마에서 성립하지 않는다. 이 서브트리만 다크로 고정한다.
    <main className={styles.page} data-theme="dark">
      <section className={styles.waferPane} aria-hidden="true">
        <WaferCanvas
          text={WAFER_TEXT}
          fontReady={fontReady}
          reducedMotion={reducedMotion}
          skipIntro={skipIntro}
          onComplete={handleComplete}
        />
      </section>

      <section className={styles.formPane}>
        <Outlet />
      </section>
    </main>
  )
}
