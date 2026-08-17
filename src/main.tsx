import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// split 빌드는 unicode-range 로 실제 쓰는 글자 범위만 내려받는다. 통짜는 1.29MB다.
import 'wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css'
import './app/styles/global.scss'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
