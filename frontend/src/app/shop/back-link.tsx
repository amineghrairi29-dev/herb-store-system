import Link from "next/link";
import styles from "./back-link.module.css";

export default function BackLink({ href, children, className = "" }: {
  href: string;
  children: string;
  className?: string;
}) {
  return <Link href={href} className={`${styles.backLink} ${className}`}>
    <span className={styles.icon} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M19 12H5m6-6-6 6 6 6" />
      </svg>
    </span>
    <span>{children}</span>
  </Link>;
}
