"use client";

import { useSwapTransition } from "@hooks/useSwapTransition";
import styles from "./LeadersLogo.module.scss";

/** The Leaders page header's logo: crossfades to whichever logo `src` names. */
export default function LeadersLogo({ src }: { src: string }) {
  const swap = useSwapTransition(src, 300);

  return (
    <span className={styles.swap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`in-${swap.transitionKey}`}
        className={`${styles.layer} ${swap.isTransitioning ? styles.incoming : ""}`}
        src={swap.displayedValue}
        alt="Nightfall Clan logo"
      />
      {swap.outgoingValue && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`out-${swap.transitionKey}`}
          className={`${styles.layer} ${styles.outgoing}`}
          src={swap.outgoingValue}
          alt=""
          aria-hidden="true"
        />
      )}
    </span>
  );
}
