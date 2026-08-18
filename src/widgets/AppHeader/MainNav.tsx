import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import styles from './AppHeader.module.scss'

// 그룹을 늘리면 열이 하나 늘고, 항목을 늘리면 그 열이 길어진다.
const WORK_MENU = [
  {
    caption: '근무와 휴식을 관리하고',
    items: [{ to: '/leave', label: '휴가' }],
  },
]

// 포인터가 트리거에서 패널로 내려가는 사이 잠깐 바깥을 지난다. 즉시 닫으면 깜빡인다.
const CLOSE_DELAY_MS = 120

// W3C APG 의 disclosure navigation 패턴이다. role="menu" 를 쓰지 않는 이유는
// 그러면 내부 항목이 menuitem 이 되어 링크가 아니게 되고, 새 탭으로 열기와
// 우클릭이 막히기 때문이다. 여기 있는 것은 전부 그냥 링크다.
export const MainNav = () => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { pathname } = useLocation()

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }

  // 이동한 뒤에도 열려 있으면 패널이 새 화면을 가린다
  useEffect(() => {
    cancelClose()
    setOpen(false)
  }, [pathname])

  useEffect(() => cancelClose, [])

  const closeAndRefocus = () => {
    cancelClose()
    setOpen(false)
    triggerRef.current?.focus()
  }

  // 터치에는 호버가 없다. 여기서 열어버리면 첫 탭이 열기로 먹혀 링크가 한 번에 안 눌린다.
  const isMouse = (pointerType: string) => pointerType === 'mouse'

  return (
    <nav
      className={styles.mainNav}
      aria-label="업무"
      onPointerEnter={(event) => {
        if (!isMouse(event.pointerType)) return
        cancelClose()
        setOpen(true)
      }}
      onPointerLeave={(event) => {
        if (!isMouse(event.pointerType)) return
        cancelClose()
        closeTimerRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) closeAndRefocus()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={open ? `${styles.navLink} ${styles.navLinkOpen}` : styles.navLink}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        업무
      </button>

      {open && (
        <div className={styles.megaPanel}>
          <div className={styles.megaInner}>
            {WORK_MENU.map((group) => (
              <div key={group.caption} className={styles.megaGroup}>
                <p className={styles.megaCaption}>{group.caption}</p>
                <ul className={styles.megaList}>
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          isActive ? `${styles.megaItem} ${styles.megaItemActive}` : styles.megaItem
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
