import { useTheme } from '@/shared/theme'
import styles from './ThemeToggle.module.scss'

export const ThemeToggle = () => {
  const { resolved, setPreference } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={next === 'dark' ? '다크 모드로 전환' : '라이트 모드로 전환'}
      onClick={() => setPreference(next)}
    >
      <img
        src={resolved === 'dark' ? '/theme-moon.png' : '/theme-sun.png'}
        alt=""
        width={20}
        height={20}
        className={styles.icon}
      />
    </button>
  )
}
