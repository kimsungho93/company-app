import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useMeQuery } from '@/features/auth'
import styles from './AppHeader.module.scss'

// 메뉴를 늘리면 항목이 하나 늘고, 그룹을 늘리면 패널에 열이 하나 늘어난다.
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
        items: [{ to: '/games/word-chain', label: '끝말잇기' }],
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

// 포인터가 트리거에서 패널로 내려가는 사이 잠깐 바깥을 지난다. 즉시 닫으면 깜빡인다.
const CLOSE_DELAY_MS = 120

// W3C APG 의 disclosure navigation 패턴이다. role="menu" 를 쓰지 않는 이유는
// 그러면 내부 항목이 menuitem 이 되어 링크가 아니게 되고, 새 탭으로 열기와
// 우클릭이 막히기 때문이다. 여기 있는 것은 전부 그냥 링크다.
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

  // 이동한 뒤에도 열려 있으면 패널이 새 화면을 가린다
  useEffect(() => {
    cancelClose()
    setOpenLabel(null)
  }, [pathname])

  useEffect(() => cancelClose, [])

  // 터치에는 호버가 없다. 여기서 열어버리면 첫 탭이 열기로 먹혀 링크가 한 번에 안 눌린다.
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
          // 열린 채로 옆 메뉴에 올리면 패널은 그대로 두고 내용만 바뀐다
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
            {/*
              열과 행을 CSS 변수로 넘겨 등장 시점을 어긋나게 한다. 한꺼번에 뜨면
              패널이 통째로 깜빡이는 느낌이고, 어긋나야 훑고 지나가는 결이 생긴다.
            */}
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
