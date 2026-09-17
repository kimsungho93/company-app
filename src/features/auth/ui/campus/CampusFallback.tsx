import logoUrl from './assets/sk-hynix-ci.jpg'

export const CampusFallback = () => (
  <svg viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="campus-sky" x2="0" y2="1">
        <stop stopColor="#90bfde" />
        <stop offset="1" stopColor="#e9f1f2" />
      </linearGradient>
      <linearGradient id="campus-facade" x2="1" y2="1">
        <stop stopColor="#f4f5f4" />
        <stop offset="1" stopColor="#aebac0" />
      </linearGradient>
    </defs>
    <path fill="url(#campus-sky)" d="M0 0h900v900H0z" />
    <path d="M-100 248 780 330v351H-100Z" fill="url(#campus-facade)" />
    <path d="m780 330 170-68v407l-170 12Z" fill="#80919b" />
    {[378, 481, 575].map((y) => (
      <g key={y}>
        <path d={`M-40 ${y} 762 ${y + 52}v26l-802-52Z`} fill="#486d83" />
        <path d={`M-40 ${y + 35} 762 ${y + 87}`} stroke="#919fa5" strokeWidth="2" />
      </g>
    ))}
    <path d="m-40 452 802 53v15l-802-53Z" fill="#ea002c" />
    <image href={logoUrl} x="330" y="294" width="158" height="89" />
    {Array.from({ length: 22 }, (_, i) => (
      <path key={i} d={`M${i * 40} ${259 + i * 3.7}v370`} stroke="#c2cbd0" strokeWidth="2" />
    ))}
    <path d="M0 670h900v110H0z" fill="#b7bcb9" />
    <path d="M0 737h900v163H0z" fill="#546069" />
    <path d="M0 819h900" stroke="#eee9dd" strokeWidth="4" strokeDasharray="70 45" />
    <path d="M447 678h66v58h-66z" fill="#e5e8e4" />
    <path d="M565 588h157v110H565z" fill="#7896a2" />
    <path d="M565 588h157v13H565zM562 687h163v13H562z" fill="#d2d8d8" />
    <path d="M190 580h552v17H190z" fill="#d4dcde" />
    {[200, 551, 730].map((x) => (
      <path key={x} d={`M${x} 597v103`} stroke="#8f9e9e" strokeWidth="8" />
    ))}
    {[68, 258, 822].map((x) => (
      <g key={x}>
        <path d={`M${x} 708v-148m0 61-27-39m27 19 31-48`} stroke="#665b48" strokeWidth="9" />
        <path
          d={`M${x - 55} 573q-24-56 22-63q-15-57 36-64q55 4 48 58q46 4 30 60q-51 56-136 9Z`}
          fill="#3c633e"
        />
        <path d={`M${x - 42} 542q-15-42 23-52q46-23 61 16q-26 45-84 36Z`} fill="#668250" />
      </g>
    ))}
  </svg>
)
