import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import 'wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css'
import './app/styles/global.scss'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
