import { Outlet } from 'react-router'
import { CampusBackdrop } from './campus/CampusBackdrop'
import styles from './AuthLayout.module.scss'

export const AuthLayout = () => {
  return (
    <main className={styles.page} data-theme="dark">
      <section className={styles.campusPane} aria-label="SK hynix 캠퍼스">
        <div className={styles.brand} aria-hidden="true">
          <img src="/logo-mark.png" alt="" width={40} height={40} />
          <span>아이비에스</span>
        </div>
        <div className={styles.intro}>
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
