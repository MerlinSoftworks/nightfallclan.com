"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, LeadersIcon, WallIcon, GraphIcon } from "@icons";
import styles from "./NavLinks.module.scss";

const navItems = [
  { href: "/", label: "History", icon: HistoryIcon, external: false },
  { href: "/leaders", label: "Leaders", icon: LeadersIcon, external: false },
  { href: "/wall", label: "Wall", icon: WallIcon, external: false },
  { href: "/wall/graph", label: "Graph", icon: GraphIcon, external: false },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className={styles.navLinks}>
      {navItems.map(({ href, label, icon: Icon, external }) => {
        const isCurrent = !external && pathname === href;

        if (isCurrent) {
          return (
            <div key={href} className={`${styles.navLink} ${styles["navLink--current"]}`}>
              <Icon className={styles.navIcon} />
              {label}
            </div>
          );
        }

        const Component = external ? "a" : Link;

        return (
          <Component key={href} className={styles.navLink} href={href}>
            <Icon className={styles.navIcon} />
            {label}
          </Component>
        );
      })}
    </div>
  );
}
