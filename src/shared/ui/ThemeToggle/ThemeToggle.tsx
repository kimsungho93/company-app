import { useTheme } from '@/shared/theme'
import styles from './ThemeToggle.module.scss'

// 3상태(light·dark·system)를 한 버튼으로 순환시키면 무엇이 선택됐는지 알기 어렵다.
// system 은 아무것도 고르지 않은 초기값으로만 두고, 누르면 명시적으로 정한다.
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
      {/* alt 를 비운다. 버튼에 aria-label 이 있어 채우면 스크린리더가 두 번 읽는다 */}
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
