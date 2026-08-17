// 유니코드 ☀ ☾ 는 OS 마다 다른 글리프로 그려지고 윈도우에서는 이모지 폰트로
// 대체되기도 한다. 모양을 고정하려면 직접 그리는 수밖에 없다.
//
// 그라디언트 stop 에 currentColor 를 쓰면 면에 명암이 생기면서도
// 테마를 그대로 따라간다. 고정 색을 쓰면 라이트 모드에서 보이지 않는다.

export const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="tt-sun" x1="7" y1="6" x2="17" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="currentColor" />
        <stop offset="1" stopColor="currentColor" stopOpacity=".62" />
      </linearGradient>
    </defs>

    {/* 글로우 — 웨이퍼 다이가 점등하는 시각 언어와 맞춘다 */}
    <circle cx="12" cy="12" r="7.6" fill="currentColor" opacity=".13" />

    <circle cx="12" cy="12" r="4.7" fill="url(#tt-sun)" />

    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".9">
      <path d="M12 1.6v2.3M12 20.1v2.3M22.4 12h-2.3M3.9 12H1.6" />
      <path d="M19.35 4.65l-1.63 1.63M6.28 17.72l-1.63 1.63M19.35 19.35l-1.63-1.63M6.28 6.28L4.65 4.65" />
    </g>
  </svg>
)

export const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="tt-moon" x1="6" y1="5" x2="18" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="currentColor" />
        <stop offset="1" stopColor="currentColor" stopOpacity=".58" />
      </linearGradient>
    </defs>

    <circle cx="12" cy="12" r="9.4" fill="currentColor" opacity=".13" />

    {/* 큰 원에서 어긋난 원을 깎아낸 초승달. 두 호를 이어 한 path 로 그린다 */}
    <path
      d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6 8.6 8.6 0 1 0 20.4 14.6Z"
      fill="url(#tt-moon)"
    />
  </svg>
)
