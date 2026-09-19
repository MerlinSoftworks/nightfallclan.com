import type { ReactNode } from "react";
import styles from "./HistoryHeader.module.scss";

const historyMeta = (
  <>
    <span className={styles.meta}>
      Written by{" "}
      <a target="_blank" rel="noopener noreferrer" href="https://www.roblox.com/users/6070434/profile">
        MertesX
      </a>
      , edited by{" "}
      <a target="_blank" rel="noopener noreferrer" href="https://www.roblox.com/users/2983178/profile">
        Thelegender
      </a>
    </span>
    <span className={styles.meta}>Last updated May 4, 2025</span>
  </>
);

export default function HistoryHeader({
  title = "A Brief History of Nightfall Clan",
  meta = historyMeta,
  logo,
}: {
  title?: string;
  /** One or more lines rendered under the title; wrap each in `metaClassName`. */
  meta?: ReactNode;
  /** Replaces the plain logo image, e.g. with one that follows the page's state. */
  logo?: ReactNode;
}) {
  return (
    <div className={styles.header}>
      <span className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        {meta}
      </span>
      <span className={styles.right}>
        <a
          target="_blank"
          rel="noopener noreferrer"
          title="NFC on Roblox"
          href="https://www.roblox.com/communities/85654/Nightfall-Clan"
        >
          {logo ?? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.logo} src="/logo-silver.png" alt="Nightfall Clan logo" />
          )}
        </a>
      </span>
    </div>
  );
}

export const metaClassName = styles.meta;
