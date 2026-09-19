import { useEffect, useState } from 'react'

export const useFontReady = (spec: string, text: string): boolean => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const done = () => {
      if (!cancelled) setReady(true)
    }

    if (typeof document === 'undefined' || !document.fonts) {
      done()
      return
    }

    document.fonts
      .load(spec, text)
      .then(() => document.fonts.ready)

      .then(done, done)

    return () => {
      cancelled = true
    }
  }, [spec, text])

  return ready
}
