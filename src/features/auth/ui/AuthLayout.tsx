import { useCallback, useState } from 'react'
import { Outlet } from 'react-router'
import { useFontReady } from '@/shared/lib/useFontReady'
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion'
import { WaferCanvas } from '@/shared/ui/WaferCanvas'
import styles from './AuthLayout.module.scss'

const WAFER_TEXT = 'IBS'

const FONT_SPEC = '500 100px "Wanted Sans Variable"'
const INTRO_SEEN_KEY = 'ibs.intro.seen'

const shouldSkipIntro = (): boolean => {

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

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      return
    }
  }, [])

  return (

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
