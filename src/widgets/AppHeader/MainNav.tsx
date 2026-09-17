import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useMeQuery } from '@/features/auth'
import styles from './AppHeader.module.scss'

const MENUS = [
  {
    label: '업무',
    groups: [
      {
        caption: '근무와 휴식을 관리하고',
        items: [{ to: '/leave', label: '휴가' }],
      },
    ],
  },
  {
    label: '게임',
    groups: [
      {
        caption: '잠깐 쉬어가며',
        items: [
          { to: '/games/word-chain', label: '끝말잇기' },
          { to: '/games/lottery', label: '사람 뽑기' },
        ],
      },
    ],
  },
]

const ADMIN_MENU = {
  label: '관리',
  groups: [
    {
      caption: '팀을 살피고',
      items: [{ to: '/admin/users', label: '승인 관리' }],
    },
  ],
}

const CLOSE_DELAY_MS = 120

export const MainNav = () => {
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { pathname } = useLocation()
  const { data: me } = useMeQuery()

  const menus = me?.role === 'ADMIN' ? [...MENUS, ADMIN_MENU] : MENUS

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }

  useEffect(() => {
    cancelClose()
    setOpenLabel(null)
  }, [pathname])

  useEffect(() => cancelClose, [])

  const isMouse = (pointerType: string) => pointerType === 'mouse'

  const open = menus.find((menu) => menu.label === openLabel)

  return (
    <nav
      className={styles.mainNav}
      aria-label="주 메뉴"
      onPointerLeave={(event) => {
        if (!isMouse(event.pointerType)) return
        cancelClose()
        closeTimerRef.current = setTimeout(() => setOpenLabel(null), CLOSE_DELAY_MS)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !openLabel) return
        cancelClose()
        triggerRefs.current.get(openLabel)?.focus()
        setOpenLabel(null)
      }}
    >
      {menus.map((menu) => (
        <button
          key={menu.label}
          ref={(el) => {
            if (el) triggerRefs.current.set(menu.label, el)
            else triggerRefs.current.delete(menu.label)
          }}
          type="button"
          className={
            menu.label === openLabel ? `${styles.navLink} ${styles.navLinkOpen}` : styles.navLink
          }
          aria-expanded={menu.label === openLabel}

          onPointerEnter={(event) => {
            if (!isMouse(event.pointerType)) return
            cancelClose()
            setOpenLabel(menu.label)
          }}
          onClick={() => setOpenLabel((prev) => (prev === menu.label ? null : menu.label))}
        >
          {menu.label}
        </button>
      ))}

      {open && (
        <div className={styles.megaPanel}>
          <div className={styles.megaInner}>
            {open.groups.map((group, col) => (
              <div
                key={group.caption}
                className={styles.megaGroup}
                style={{ '--col': col } as CSSProperties}
              >
                <p className={styles.megaCaption} style={{ '--row': 0 } as CSSProperties}>
                  {group.caption}
                </p>
                <ul className={styles.megaList}>
                  {group.items.map((item, row) => (
                    <li key={item.to} style={{ '--row': row + 1 } as CSSProperties}>
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
