import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { checkSession, reportActivity, sessionStore } from '@/shared/api'

const ACTIVITY_INTERVAL = 30_000
const STATUS_INTERVAL = 60_000
const WARNING_TIME = 60_000

export const useSessionLifecycle = () => {
  const snapshot = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  const [now, setNow] = useState(Date.now)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const session = snapshot.session
  const sessionId = session?.sessionId
  const serverNow = now + snapshot.clockOffset
  const remaining = session
    ? Math.min(Date.parse(session.idleExpiresAt), Date.parse(session.absoluteExpiresAt)) - serverNow
    : Infinity
  const absoluteFirst =
    !!session && Date.parse(session.absoluteExpiresAt) <= Date.parse(session.idleExpiresAt)
  const warning = !!session && remaining <= WARNING_TIME
  const expired = remaining <= 0

  const verify = useCallback(async () => {
    const result = await checkSession()
    setFailed(result === 'retryable')
    setNow(Date.now())
    return result
  }, [])

  const continueSession = useCallback(async () => {
    setBusy(true)
    const result = await reportActivity()
    setFailed(result === 'retryable')
    setNow(Date.now())
    setBusy(false)
  }, [])

  useEffect(() => {
    if (!sessionId) return
    let lastActivity = 0
    let lastCheck = 0
    let checking = false

    const check = () => {
      if (checking || Date.now() - lastCheck < 5_000) return
      checking = true
      lastCheck = Date.now()
      void verify().finally(() => {
        checking = false
      })
    }

    const activity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== 'visible') return
      const current = sessionStore.get()
      if (!current.session) return
      const currentTime = Date.now() + current.clockOffset
      const deadline = Math.min(
        Date.parse(current.session.idleExpiresAt),
        Date.parse(current.session.absoluteExpiresAt),
      )
      if (deadline - currentTime <= WARNING_TIME || Date.now() - lastActivity < ACTIVITY_INTERVAL)
        return
      lastActivity = Date.now()
      void reportActivity().then((result) => {
        if (result === 'retryable') lastActivity = 0
      })
    }

    const resume = () => {
      if (document.visibilityState === 'visible') check()
    }
    const tick = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      const current = sessionStore.get()
      if (!current.session || document.visibilityState !== 'visible') return
      const deadline = Math.min(
        Date.parse(current.session.idleExpiresAt),
        Date.parse(current.session.absoluteExpiresAt),
      )
      if (time + current.clockOffset >= deadline || time - lastCheck >= STATUS_INTERVAL) check()
    }, 1_000)
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }))
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)

    return () => {
      clearInterval(tick)
      events.forEach((event) => window.removeEventListener(event, activity))
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [sessionId, verify])

  return {
    warning,
    expired,
    absoluteFirst,
    secondsRemaining: Math.max(0, Math.ceil(remaining / 1_000)),
    busy,
    failed,
    continueSession,
    verify,
  }
}
