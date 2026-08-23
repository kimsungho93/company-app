import styles from './WinnerBanner.module.scss'

export interface WinnerBannerProps {
  name: string
}

export const WinnerBanner = ({ name }: WinnerBannerProps) => {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>{name} 님 승리</span>
    </div>
  )
}
