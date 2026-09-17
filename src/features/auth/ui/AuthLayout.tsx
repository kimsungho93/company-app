import { Outlet } from 'react-router'
import { CampusBackdrop } from './campus/CampusBackdrop'
import styles from './AuthLayout.module.scss'

export const AuthLayout = () => {
  return (
    <main className={styles.page} data-theme="dark">
      <section className={styles.campusPane} aria-label="SK hynix 캠퍼스">
        <div className={styles.brand} aria-hidden="true">
          <svg viewBox="0 0 30 30" fill="none">
            <path d="M3 9 15 3l12 6-12 6L3 9Z" fill="currentColor" />
            <path d="m3 15 12 6 12-6M3 21l12 6 12-6" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          <span>
            IBS<span className={styles.wordmark}>WORKSPACE</span>
          </span>
        </div>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>WELCOME TO IBS</p>
          <p className={styles.headline}>
            우리의 하루가
            <br />
            시작되는 곳.
          </p>
        </div>
        <CampusBackdrop />
        <span className={styles.location} aria-hidden="true">
          <span />
          SKHNIX 2 CAMPUS
        </span>
      </section>
      <section className={styles.formPane}>
        <Outlet />
        <span className={styles.signature} aria-hidden="true">
          IBS · WORK & LIFE
        </span>
      </section>
    </main>
  )
}
