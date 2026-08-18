import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import styles from './AppHeader.module.scss'

// 항목이 늘면 여기 한 줄만 추가한다.
const WORK_MENU = [{ to: '/leave', label: '휴가' }]

// W3C APG 의 disclosure navigation 패턴이다. role="menu" 를 쓰지 않는 이유는
// 그러면 내부 항목이 menuitem 이 되어 링크가 아니게 되고, 새 탭으로 열기와
// 우클릭이 막히기 때문이다. 여기 있는 것은 전부 그냥 링크다.
export const MainNav = () => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()

  // 이동한 뒤에도 열려 있으면 메뉴가 새 화면을 가린다
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <nav className={styles.mainNav} aria-label="업무">
      <div ref={containerRef} className={styles.menu}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.navLink}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          // 닫기만 하고 포커스를 두면 키보드 사용자가 어디 있는지 잃는다
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !open) return
            setOpen(false)
            triggerRef.current?.focus()
          }}
        >
          업무
          <span
            className={open ? `${styles.caret} ${styles.caretOpen}` : styles.caret}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ul
            className={styles.menuList}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              setOpen(false)
              triggerRef.current?.focus()
            }}
          >
            {WORK_MENU.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? `${styles.menuItem} ${styles.menuItemActive}` : styles.menuItem
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  )
}
