import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";

/** Near-misses within the window before the hint shows. */
const MISS_THRESHOLD = 2;
/** Misses older than this (ms) no longer count. */
const MISS_WINDOW = 20_000;
/** A pointer that got at least this much closer (px) to the card during the grace period was heading for it. */
const MISS_APPROACH = 20;
/** A pointer that ended within this distance (px) of the card only just missed it. */
const MISS_NEAR = 24;
/** How long (ms) the hint stays up before fading on its own. */
const PIN_TIP_DURATION = 10_000;
/** The hint's fade-out (ms); matches the stylesheet's transition. */
const PIN_TIP_FADE = 200;
/** Once the hint has shown, or anything has been pinned, it stays away for this long. */
const PIN_TIP_COOLDOWN = 30 * 24 * 60 * 60 * 1000;
const PIN_TIP_KEY = "nfc:leaders:pin-tip";
/** Half the hint's height plus a little air: how far its centre sits from the edge it hangs off. */
const PIN_TIP_CLEARANCE = 17;

type Point = { x: number; y: number };
/** Where the pointer left the hovered element, and the element itself. */
type Leave = Point & { el: Element };

/** Where the hint sits in the chart: centre x as a % of its width, y in px from its top. */
export type PinTip = { x: string; y: number; leaving: boolean };

/** Distance from a point to the nearest edge of a rect; 0 inside it. */
const distance = (p: Point, r: DOMRect) =>
  Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom));

// Storage can be missing or refused (private windows, blocked site data); then the hint is simply
// once per page load.
const readSeen = () => {
  try {
    const at = Number(localStorage.getItem(PIN_TIP_KEY));
    return at > 0 && Date.now() - at < PIN_TIP_COOLDOWN;
  } catch {
    return false;
  }
};
const writeSeen = () => {
  try {
    localStorage.setItem(PIN_TIP_KEY, String(Date.now()));
  } catch {
    // Nothing to do: the hint just won't be remembered.
  }
};

/**
 * The "click a term to pin its card" hint for the horizontal timeline. A card that hides while the
 * pointer was on its way to it counts as a miss; a few misses in a row bring up the hint, once per
 * cooldown, and the first pin sends it away for as long.
 */
export function usePinTip(cardRef: RefObject<HTMLDivElement | null>, chartRef: RefObject<HTMLDivElement | null>) {
  const pointer = useRef<Point | null>(null);
  // The pointer's exit from the hovered element, or null when the hide didn't start from the pointer.
  const leftAt = useRef<Leave | null>(null);
  const misses = useRef<number[]>([]);
  const seen = useRef<boolean | null>(null);
  const [tip, setTip] = useState<PinTip | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(dismissTimer.current);
      clearTimeout(fadeTimer.current);
    },
    [],
  );

  const isSeen = () => (seen.current ??= readSeen());
  const markSeen = () => {
    seen.current = true;
    writeSeen();
  };
  const dismiss = () => {
    clearTimeout(dismissTimer.current);
    clearTimeout(fadeTimer.current);
    setTip((t) => (t ? { ...t, leaving: true } : t));
    fadeTimer.current = setTimeout(() => setTip(null), PIN_TIP_FADE);
  };
  const show = (x: string, y: number) => {
    markSeen();
    clearTimeout(fadeTimer.current);
    clearTimeout(dismissTimer.current);
    setTip({ x, y, leaving: false });
    dismissTimer.current = setTimeout(dismiss, PIN_TIP_DURATION);
  };

  return {
    tip,
    /** Goes on the horizontal layout: remembers where the pointer last was. */
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    },
    /** Every hide reports how it started: from the pointer leaving (with its event) or otherwise. */
    leave: (e?: MouseEvent<Element>) => {
      leftAt.current = e ? { x: e.clientX, y: e.clientY, el: e.currentTarget } : null;
    },
    /**
     * An unpinned card is about to go, and is still in the DOM: was the pointer heading for it?
     * It goes either because the grace period ran out ("hidden") or because the pointer crossed
     * onto another term on the way, say the bar beneath a callout ("switched"). Only the first
     * also counts a pointer that merely stopped short of the card.
     */
    lost: (how: "hidden" | "switched") => {
      const from = leftAt.current;
      leftAt.current = null;
      const card = cardRef.current;
      const chart = chartRef.current;
      const at = pointer.current;
      if (!from || !card || !chart || !at || isSeen()) return;
      const rect = card.getBoundingClientRect();
      const after = distance(at, rect);
      const near = how === "hidden" && after <= MISS_NEAR;
      if (!near && distance(from, rect) - after < MISS_APPROACH) return;
      const now = Date.now();
      misses.current = [...misses.current.filter((t) => now - t < MISS_WINDOW), now];
      if (misses.current.length < MISS_THRESHOLD) return;
      // The hint hangs just below the term the pointer left, or just above it when the card would
      // come back over it there (a bar segment's card sits right beneath the bar).
      const box = chart.getBoundingClientRect();
      const el = from.el.getBoundingClientRect();
      const below = el.bottom + 2 * PIN_TIP_CLEARANCE <= rect.top;
      const y = below ? el.bottom + PIN_TIP_CLEARANCE : el.top - PIN_TIP_CLEARANCE;
      show(`${((el.left + el.width / 2 - box.left) / box.width) * 100}%`, y - box.top);
    },
    /** Something got pinned: the visitor knows the trick, so the hint goes and stays away. */
    pinned: () => {
      if (!isSeen()) markSeen();
      dismiss();
    },
  };
}
