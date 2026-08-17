import { useEffect, useState } from 'react'

/**
 * 캔버스에 웹폰트로 글자를 그리기 전에 반드시 호출한다.
 *
 * `document.fonts` 는 폰트가 실제로 화면에 쓰이기 전까지 다운로드를 미루는데,
 * 캔버스의 fillText 는 그 트리거가 아니다. 기다리지 않으면 폴백 폰트가 샘플링된다.
 *
 * @param spec `document.fonts.load` 가 받는 CSS font 축약형
 * @param text 실제로 그릴 문자. 서브셋 폰트에서 필요한 조각만 받게 해준다.
 */
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
      // 폰트를 못 받아도 폴백으로 그리는 게 아무것도 안 그리는 것보다 낫다
      .then(done, done)

    return () => {
      cancelled = true
    }
  }, [spec, text])

  return ready
}
