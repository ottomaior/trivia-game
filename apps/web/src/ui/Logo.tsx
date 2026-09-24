import styles from './Logo.module.css';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`${styles.logo} ${small ? styles.small : ''}`}>
      <span className={styles.line1}>Otto's</span>
      <span className={styles.line2}>Quiz Show</span>
    </h1>
  );
}
