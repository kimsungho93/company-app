import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion'
import type { CampusRenderer } from './campusRenderer'
import { CampusFallback } from './CampusFallback'
import styles from './CampusBackdrop.module.scss'

export const CampusBackdrop = () => {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<CampusRenderer | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const playing = !paused && !reducedMotion
  const playingRef = useRef(playing)

  useEffect(() => {
    playingRef.current = playing
    rendererRef.current?.setPlaying(playing)
  }, [playing])

  useEffect(() => {
    let disposed = false
    void import('./campusRenderer')
      .then(({ createCampusRenderer }) => {
        if (disposed || !hostRef.current) return
        const renderer = createCampusRenderer(hostRef.current, () => {
          if (!disposed) setStatus('unavailable')
        })
        rendererRef.current = renderer
        renderer.setPlaying(playingRef.current)
        setStatus('ready')
      })
      .catch(() => {
        if (!disposed) setStatus('unavailable')
      })
    return () => {
      disposed = true
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  return (
    <>
      <div className={styles.scene} data-campus-state={status} aria-hidden="true">
        <div className={styles.fallback}>
          <CampusFallback />
        </div>
        <div ref={hostRef} className={styles.viewport} />
      </div>
      {status === 'ready' && !reducedMotion && (
        <button
          type="button"
          className={styles.motionButton}
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? '배경 애니메이션 재생' : '배경 애니메이션 일시정지'}
          title={paused ? '배경 애니메이션 재생' : '배경 애니메이션 일시정지'}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {paused ? <path d="m7 4 9 6-9 6V4Z" /> : <path d="M6 5h3v10H6zM12 5h3v10h-3z" />}
          </svg>
        </button>
      )}
    </>
  )
}
