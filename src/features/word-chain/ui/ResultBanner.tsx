import styles from './ResultBanner.module.scss'

export interface ResultBannerProps {
  name: string
}

export const ResultBanner = ({ name }: ResultBannerProps) => {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>{name} 님 탈락</span>
    </div>
  )
}
