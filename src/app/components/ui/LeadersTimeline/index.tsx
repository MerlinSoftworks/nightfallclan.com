"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { useSearch } from "@context/SearchContext";
import { CloseIcon, KeyIcon } from "@icons";
import { CALLOUT_TERMS } from "@/app/leaders/leaders";
import type { Portraits } from "@/app/leaders/portraits";
import { buildTimeline, type TimelineTerm } from "@/app/leaders/timeline";
import styles from "./LeadersTimeline.module.scss";

/** Segments narrower than this (as % of the bar) don't show their term number. */
const MIN_NUMBERED_WIDTH = 2.3;
/** Enlarged first-year segments narrower than this (as % of the inset) get a label below instead. */
const MIN_INSET_LABEL_WIDTH = 15;
/** Vertical blocks at least this tall (px) get a two-line label. */
const MIN_TALL_HEIGHT = 40;
/** Width of the column holding each label beneath the enlarged first year, as % of the bar. */
const INSET_LABEL_STEP = 13.2;
const TOOLTIP_WIDTH = 268;
/** The pointer must meet the card's straight edge, clear of its rounded corners. */
const TOOLTIP_CORNER = 12;
/** Card tops (px from the bar's top) when opened from the bar and from the group-owner lane. */
const CARD_BELOW_BAR = 70;
const CARD_BELOW_LANE = 94;
/** Grace period (ms) for the pointer to cross from a segment onto its card. */
const HIDE_DELAY = 150;
/** At most this many callouts fit above the bar. */
const MAX_CALLOUTS = 7;
/** Leader line offset from a callout's left edge, as % of the bar (7px at full width). */
const CALLOUT_LINE_OFFSET = 0.7;
/** Where the funnel's top edge sits in the link-line SVG (px from the bar's bottom). */
const FUNNEL_TOP = 65;
/** Height of the link-line SVG: from the bar's bottom down to the enlarged first year. */
const FUNNEL_HEIGHT = 187;
/** Straight run (px) a leader line makes before leaving a segment, shared by every callout line. */
const POINTER_LENGTH = 12;
/** On the vertical timeline, a card lets go once the tapped item's bottom edge gets this close to the card's top. */
const CARD_HANDOFF = POINTER_LENGTH + 8;
/** Corner radius for every bend in a leader or link line; matches the card's corners. */
const CORNER_RADIUS = 8;

/**
 * A path through `points` with each bend rounded to `r` (less where a leg is too short).
 * Coordinates are in a 1000-unit-wide viewBox stretched to the bar, so x ≈ px at full width.
 */
function roundedPath(points: [number, number][], r: number): string {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const ri = Math.min(r, inLen / 2, outLen / 2);
    const ax = cx + ((px - cx) / inLen) * ri;
    const ay = cy + ((py - cy) / inLen) * ri;
    const bx = cx + ((nx - cx) / outLen) * ri;
    const by = cy + ((ny - cy) / outLen) * ri;
    d += ` L ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}

/**
 * Terms labelled above the bar: every term too narrow to carry its number (a callout is its only
 * label), then the design's picks in order of preference, as many as fit.
 */
const calloutTerms = (terms: TimelineTerm[]) => {
  const unnumbered = terms.filter((t) => t.insetWidth === null && t.width < MIN_NUMBERED_WIDTH);
  const picks = CALLOUT_TERMS.map((i) => terms[i - 1]).filter((t) => t && !unnumbered.includes(t));
  return [...unnumbered, ...picks].slice(0, MAX_CALLOUTS).sort((a, b) => a.index - b.index);
};

const ariaLabel = (t: TimelineTerm) => `Term ${t.index}, ${t.name}, ${t.duration}`;

// A variable-weight cousin of the site's Helvetica stack, so callout names can ease from
// regular to bold when pinned instead of snapping.
const labelFont = Inter({ subsets: ["latin"], variable: "--font-label" });

/** A ring centred on a segment; thin segments still get a ring at least as wide as its borders. */
const ringStyle = (left: number, width: number): CSSProperties => ({
  left: `calc(${left + width / 2}% - max(${width}%, 4px) / 2)`,
  width: `max(${width}%, 4px)`,
});

/**
 * Which term is highlighted on the horizontal timeline and what did it: a callout rather than a
 * segment (its leader line lights up), and the enlarged first year rather than the main bar
 * (the card moves above the bar).
 */
type Selection = { index: number; viaCallout: boolean; viaInset: boolean } | null;
type Via = Pick<NonNullable<Selection>, "viaCallout" | "viaInset">;
const SEGMENT: Via = { viaCallout: false, viaInset: false };
const CALLOUT: Via = { viaCallout: true, viaInset: false };
const INSET_SEGMENT: Via = { viaCallout: false, viaInset: true };
const INSET_CALLOUT: Via = { viaCallout: true, viaInset: true };
/** Identifies a pinnable element (term + how it was reached), stored on it as `data-pin`. */
const pinKey = (index: number, via: Via) => `${index}:${via.viaCallout ? 1 : 0}${via.viaInset ? 1 : 0}`;
/** Anything that can be selected: a term, or the group owner (index 0). */
type Indexed = { index: number };
/** Where a card's left edge goes: centred on `center`, kept inside the timeline, but always
 *  overlapping the pointer by at least a corner's width so the pointer lands on a straight edge. */
const cardLeft = (center: string) =>
  `clamp(min(0px, ${center} - ${TOOLTIP_CORNER}px), ${center} - ${TOOLTIP_WIDTH / 2}px, max(100% - ${TOOLTIP_WIDTH}px, ${center} + ${TOOLTIP_CORNER - TOOLTIP_WIDTH}px))`;

/** What a card needs to show; every term qualifies, and so does the group owner. */
type CardEntry = Pick<
  TimelineTerm,
  "name" | "profileUrl" | "aside" | "longDates" | "exactDuration" | "index" | "start" | "end"
>;

function Tooltip({
  term,
  total,
  style,
  pinned = false,
  className = "",
  label,
  portrait,
  onUnpin,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onBlur,
}: {
  term: CardEntry;
  total: number;
  style: CSSProperties;
  pinned?: boolean;
  className?: string;
  /** Footer text; defaults to the term's place in the sequence. */
  label?: string;
  /** The leader's Roblox avatar bust; without one the card shows a silhouette. */
  portrait?: string;
  onUnpin?: () => void;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onBlur?: (e: FocusEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`${styles.tooltip} ${pinned ? styles.tooltipPinned : ""} ${className}`}
      style={style}
      // Focusable so a click inside the card moves focus here rather than off the pinned element.
      tabIndex={-1}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onBlur={onBlur}
      aria-live="polite"
    >
      {/* A ghosted portrait filling the card's right side, behind all of the card's text. */}
      <div
        className={styles.portrait}
        style={portrait ? { backgroundImage: `url("${portrait}")` } : undefined}
        aria-hidden="true"
      >
        {!portrait && (
          <svg className={styles.silhouette} viewBox="0 0 100 100">
            <circle cx="54" cy="34" r="19" />
            <path d="M16 104 C 18 76, 34 62, 54 62 S 90 76, 92 104 Z" />
          </svg>
        )}
      </div>
      {pinned && (
        <button
          type="button"
          className={styles.unpinBtn}
          aria-label="Unpin"
          title="Unpin"
          onClick={(e) => {
            e.stopPropagation();
            onUnpin?.();
          }}
        >
          <CloseIcon />
        </button>
      )}
      <div className={styles.tooltipName}>
        <a href={term.profileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {term.name}
        </a>
        {term.aside && <span className={styles.tooltipAside}> ({term.aside})</span>}
      </div>
      <div className={styles.tooltipDates}>{term.longDates}</div>
      <div className={styles.tooltipDuration}>
        {term.exactDuration}
      </div>
      <div className={styles.tooltipFooter}>
        <span className={styles.tooltipTerm}>
          {label ?? `Term ${term.index} of ${total}`}
        </span>
        <ViewWallButton term={term} />
      </div>
    </div>
  );
}

/** Opens the wall filtered to this term's dates, like the graph's "View these posts". */
function ViewWallButton({ term }: { term: CardEntry }) {
  const router = useRouter();
  const { setInputValue } = useSearch();
  const [navigating, setNavigating] = useState(false);

  const viewWall = (e: MouseEvent) => {
    e.stopPropagation();
    setNavigating(true);
    setInputValue(`after:${term.start.toISOString()} before:${term.end.toISOString()}`);
    router.push("/wall");
  };

  return (
    <button type="button" className={styles.viewWallBtn} onClick={viewWall} disabled={navigating}>
      {navigating ? (
        <>
          <span className={styles.viewWallBtn__spinner} aria-hidden="true" />
          Loading…
        </>
      ) : (
        "View wall"
      )}
    </button>
  );
}

export default function LeadersTimeline({
  now,
  portraits,
  onHighlight,
}: {
  now: string;
  /** Roblox user id → avatar-bust URL, fetched on the server. */
  portraits: Portraits;
  /** Called with the start date of the highlighted term (or the owner's tenure), or null when nothing is. */
  onHighlight?: (start: Date | null) => void;
}) {
  // The page is prerendered with the build's date; switch to the visitor's own date once mounted.
  const [today, setToday] = useState(now);
  useEffect(() => {
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (local !== now) setToday(local);
  }, [now]);
  const { terms, ticks, firstYearWidth, owner, verticalHeight } = useMemo(() => buildTimeline(today), [today]);
  const [horizontalSelected, setHorizontalSelected] = useState<Selection>(null);
  // A clicked segment or callout keeps its card open until it loses focus.
  const [pinned, setPinned] = useState<Selection>(null);
  const [verticalSelected, setVerticalSelected] = useState<number | "owner" | null>(null);

  const hSel = horizontalSelected && horizontalSelected.index > 0 ? terms[horizontalSelected.index - 1] : null;
  const hCenter = hSel ? `${hSel.left + hSel.width / 2}%` : "0%";
  // The group owner's lane is selectable on the horizontal timeline too, as index 0; its card and
  // pointer sit at the midpoint of the lane's fill, which runs from the owner's start to today.
  const hOwner = horizontalSelected?.index === 0;
  const ownerCenter = `${(owner.left + 100) / 2}%`;
  const vSel = typeof verticalSelected === "number" ? terms[verticalSelected - 1] : null;
  const vOwner = verticalSelected === "owner";
  const ownerCard: CardEntry = { ...owner, aside: "", index: 0 };
  const toggleOwner = () => setVerticalSelected(vOwner ? null : "owner");
  // Whichever layout is showing, tell the page what's highlighted (its start date, by value).
  const highlightedTime =
    (hSel?.start ?? (hOwner ? owner.start : null) ?? vSel?.start ?? (vOwner ? owner.start : null))?.getTime() ?? null;
  useEffect(() => {
    onHighlight?.(highlightedTime === null ? null : new Date(highlightedTime));
  }, [highlightedTime, onHighlight]);
  // The mobile card's track runs past what was tapped by the card's height less a hand-off
  // margin, so the card keeps sticking until the block's bottom edge comes within that margin
  // of the pointer, then scrolls away with it — whatever the block's height.
  const vCardRef = useRef<HTMLDivElement>(null);
  const [vCardHeight, setVCardHeight] = useState(160);
  useLayoutEffect(() => {
    if (vCardRef.current) setVCardHeight(vCardRef.current.offsetHeight);
  }, [verticalSelected, today]);
  const firstYear = terms.filter((t) => t.insetWidth !== null);
  const tiny = firstYear.filter((t) => t.insetWidth! < MIN_INSET_LABEL_WIDTH);
  const callouts = useMemo(() => calloutTerms(terms), [terms]);
  // Keep the card open while the pointer is on it, so its text can be selected.
  const tooltipHovered = useRef(false);
  const pinnedRef = useRef<Selection>(null);
  pinnedRef.current = pinned;
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // While something is pinned, hovering other segments or callouts doesn't take over.
  const select = (t: Indexed, via: Via, force = false) => () => {
    clearTimeout(hideTimer.current);
    if (pinnedRef.current && !force) return;
    setHorizontalSelected({ index: t.index, ...via });
  };
  const deselect = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!tooltipHovered.current) setHorizontalSelected(pinnedRef.current);
    }, HIDE_DELAY);
  };
  const releasePin = () => {
    pinnedRef.current = null;
    setPinned(null);
  };
  // Clicking pins; clicking the pinned thing again releases it (the card stays while hovered).
  const pin = (t: Indexed, via: Via) => (e: MouseEvent<Element>) => {
    const current = pinnedRef.current;
    if (current?.index === t.index && current.viaCallout === via.viaCallout && current.viaInset === via.viaInset) {
      releasePin();
      return;
    }
    const next = { index: t.index, ...via };
    pinnedRef.current = next;
    setPinned(next);
    (e.currentTarget as HTMLElement).focus();
    select(t, via, true)();
  };
  const inTooltip = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.(`.${styles.tooltip}`);
  // Focus moving into the card (e.g. onto "View wall" or the unpin button) keeps the pin and the card.
  const unpin = (t: Indexed) => (e: FocusEvent<Element>) => {
    if (inTooltip(e.relatedTarget)) return;
    if (pinnedRef.current?.index === t.index) releasePin();
    deselect();
  };
  // Focus leaving the card (not back into it) ends the pin too — unless it's going to the pinned
  // element itself, whose click then toggles the pin off.
  const leaveTooltipFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (inTooltip(e.relatedTarget)) return;
    const current = pinnedRef.current;
    if (current && (e.relatedTarget as HTMLElement | null)?.dataset?.pin === pinKey(current.index, current)) return;
    releasePin();
    deselect();
  };
  const unpinFromCard = () => {
    releasePin();
    tooltipHovered.current = false;
    clearTimeout(hideTimer.current);
    setHorizontalSelected(null);
  };
  const enterTooltip = () => {
    tooltipHovered.current = true;
    clearTimeout(hideTimer.current);
  };
  const leaveTooltip = () => {
    tooltipHovered.current = false;
    deselect();
  };
  const portraitOf = (t: CardEntry) => portraits[Number(t.profileUrl.match(/\/users\/(\d+)/)?.[1])];
  const tone = (t: TimelineTerm) => (t.index % 2 ? styles.toneA : styles.toneB);
  const isPinned = (t: Indexed) => pinned?.index === t.index;
  const pinnedVia = (t: TimelineTerm, viaInset: boolean) =>
    pinned?.viaCallout && pinned.viaInset === viaInset && pinned.index === t.index;
  // A callout lights up when it (not its segment) is what's highlighting the term.
  const calloutActive = (t: TimelineTerm, viaInset: boolean) =>
    (horizontalSelected?.viaCallout && horizontalSelected.viaInset === viaInset && horizontalSelected.index === t.index) ||
    pinnedVia(t, viaInset);
  // Terms activated from the enlarged view also get a line up to their main-bar segment.
  const insetLinked = [horizontalSelected, pinned]
    .filter((sel, i, all) => sel?.viaInset && all.findIndex((o) => o?.index === sel.index) === i)
    .map((sel) => terms[sel!.index - 1]);
  // The funnel's top-right corner, and the point one corner radius down its sloping side.
  const funnel = useMemo(() => {
    const x = firstYearWidth * 10;
    const len = Math.hypot(1000 - x, FUNNEL_HEIGHT - FUNNEL_TOP);
    return { x, bx: x + ((1000 - x) / len) * CORNER_RADIUS, by: FUNNEL_TOP + ((FUNNEL_HEIGHT - FUNNEL_TOP) / len) * CORNER_RADIUS };
  }, [firstYearWidth]);
  // The funnel's fill and edges fade downwards; the gradients are shared by both of its SVGs.
  const funnelId = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const funnelFill = `url(#${funnelId}-fill)`;
  const funnelLine = `url(#${funnelId}-line)`;
  // Everything blue drawn for a pinned term is heavier, so the pin reads at a glance.
  const bold = (t: Indexed) => (isPinned(t) ? styles.bold : "");

  return (
    <div className={`${styles.timeline} ${labelFont.variable}`}>
      {/* Horizontal layout (768px and up) */}
      <div
        className={styles.horizontal}
        onKeyDown={(e) => e.key === "Escape" && (document.activeElement as HTMLElement | null)?.blur()}
      >
        <div className={styles.callouts}>
          {callouts.map((t, i) => (
            <div
              key={t.index}
              tabIndex={-1}
              className={`${styles.callout} ${calloutActive(t, false) ? styles.calloutActive : ""} ${pinnedVia(t, false) ? styles.calloutPinned : ""}`}
              style={{ left: `${(i * 100) / callouts.length}%`, width: `${100 / callouts.length}%` }}
              data-pin={pinKey(t.index, CALLOUT)}
              onMouseEnter={select(t, CALLOUT)}
              onMouseLeave={deselect}
              onClick={pin(t, CALLOUT)}
              onBlur={unpin(t)}
            >
              <div className={styles.calloutName}>
                {t.index} · {t.name}
              </div>
              <div className={styles.calloutMeta}>
                {t.ordinal ? `${t.ordinal} · ` : ""}{t.duration}
              </div>
            </div>
          ))}
          <svg className={styles.calloutLeaders} viewBox="0 0 1000 42" preserveAspectRatio="none" aria-hidden="true">
            {callouts.map((t, i) => {
              const labelX = ((i * 100) / callouts.length + CALLOUT_LINE_OFFSET) * 10;
              const center = (t.left + t.width / 2) * 10;
              const d = roundedPath([[labelX, 0], [labelX, POINTER_LENGTH], [center, 42 - POINTER_LENGTH], [center, 42]], CORNER_RADIUS);
              return (
                <g key={t.index}>
                  <path
                    className={calloutActive(t, false) ? `${styles.calloutLeaderActive} ${bold(t)}` : ""}
                    vectorEffect="non-scaling-stroke"
                    d={d}
                  />
                  {/* The line is a second way to reach its callout: same hover, same click-to-pin. */}
                  <path
                    className={styles.leaderHit}
                    vectorEffect="non-scaling-stroke"
                    d={d}
                    tabIndex={-1}
                    data-pin={pinKey(t.index, CALLOUT)}
                    onMouseEnter={select(t, CALLOUT)}
                    onMouseLeave={deselect}
                    onClick={pin(t, CALLOUT)}
                    onBlur={unpin(t)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className={styles.chart}>
          <div className={styles.bar}>
            {terms.map((t) => (
              <button
                key={t.index}
                type="button"
                aria-label={ariaLabel(t)}
                className={`${styles.segment} ${tone(t)} ${hSel?.index === t.index || isPinned(t) ? styles.segmentLit : ""}`}
                style={{ left: `${t.left}%`, width: `${t.width}%` }}
                data-pin={pinKey(t.index, SEGMENT)}
                onMouseEnter={select(t, SEGMENT)}
                onMouseLeave={deselect}
                onFocus={select(t, SEGMENT)}
                onClick={pin(t, SEGMENT)}
                onBlur={unpin(t)}
              >
                {t.width >= MIN_NUMBERED_WIDTH && <span className={styles.segmentNumber}>{t.index}</span>}
              </button>
            ))}
          </div>

          {/* The main-bar segment shows its state by filling blue, so it gets no ring; only the pointer. */}
          {hSel && (
            <>
              <div
                className={`${styles.pointer} ${horizontalSelected?.viaInset ? styles.pointerAbove : ""} ${bold(hSel)}`}
                style={{ left: `calc(${hSel.left + hSel.width / 2}% - ${isPinned(hSel) ? 1 : 0.5}px)` }}
              />
            </>
          )}

          {/* The group-owner lane behaves like a segment: hover for the card, click to pin it. */}
          <div className={styles.lane}>
            <button
              type="button"
              aria-label={`${owner.name}, group owner since ${owner.since}`}
              className={`${styles.laneFill} ${hOwner ? styles.laneFillLit : ""}`}
              style={{ left: `${owner.left}%` }}
              data-pin={pinKey(0, SEGMENT)}
              onMouseEnter={select(ownerCard, SEGMENT)}
              onMouseLeave={deselect}
              onFocus={select(ownerCard, SEGMENT)}
              onClick={pin(ownerCard, SEGMENT)}
              onBlur={unpin(ownerCard)}
            >
              <span className={styles.laneLabel}>
                {owner.name}, group owner since {owner.since}
              </span>
            </button>
          </div>
          {hOwner && (
            <div
              className={`${styles.pointer} ${styles.pointerOwner} ${bold(ownerCard)}`}
              style={{ left: `calc(${ownerCenter} - ${isPinned(ownerCard) ? 1 : 0.5}px)` }}
            />
          )}

          <div className={styles.years} aria-hidden="true">
            <div className={styles.yearLabel} style={{ left: 0 }}>
              {terms[0].start.getUTCFullYear()}
            </div>
            {ticks.map((tick) => (
              <div key={tick.year}>
                <div className={styles.yearTick} style={{ left: `${tick.left}%` }} />
                <div className={styles.yearLabel} style={{ left: `calc(${tick.left}% - 1px)` }}>
                  {tick.year}
                </div>
              </div>
            ))}
          </div>

          <svg className={styles.connectorFill} viewBox={`0 0 1000 ${FUNNEL_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`${funnelId}-fill`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={FUNNEL_HEIGHT}>
                <stop className={styles.funnelStop} offset="0" stopOpacity="0.075" />
                <stop className={styles.funnelStop} offset="1" stopOpacity="0.008" />
              </linearGradient>
              <linearGradient id={`${funnelId}-line`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={FUNNEL_HEIGHT}>
                <stop className={styles.funnelStop} offset="0" stopOpacity="0.3" />
                <stop className={styles.funnelStop} offset="1" stopOpacity="0.07" />
              </linearGradient>
            </defs>
            <path
              fill={funnelFill}
              d={`M 0 ${FUNNEL_TOP} L ${funnel.x - 2} ${FUNNEL_TOP} Q ${funnel.x} ${FUNNEL_TOP} ${funnel.bx} ${funnel.by} L 1000 ${FUNNEL_HEIGHT} L 0 ${FUNNEL_HEIGHT} Z`}
            />
          </svg>
          <svg className={styles.connector} viewBox={`0 0 1000 ${FUNNEL_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" stroke={funnelLine}>
            <line x1="0.5" y1="0" x2="0.5" y2={FUNNEL_TOP} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            <line x1={funnel.x} y1="0" x2={funnel.x} y2={FUNNEL_TOP - CORNER_RADIUS} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            <line x1="0.5" y1={FUNNEL_TOP} x2="0.5" y2={FUNNEL_HEIGHT} vectorEffect="non-scaling-stroke" />
            {/* The dashed edge rounds into the funnel's sloping side, like every other bend. */}
            <path
              d={`M ${funnel.x} ${FUNNEL_TOP - CORNER_RADIUS} Q ${funnel.x} ${FUNNEL_TOP} ${funnel.bx} ${funnel.by} L 1000 ${FUNNEL_HEIGHT}`}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <svg className={styles.insetLinks} viewBox={`0 0 1000 ${FUNNEL_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            {insetLinked.map((t) => {
              const mainX = (t.left + t.width / 2) * 10;
              const insetX = (t.insetLeft! + t.insetWidth! / 2) * 10;
              // Up from the enlarged segment, then follow the funnel's own mapping to the same
              // date on its top edge, then vertical into the main-bar segment.
              return (
                <path
                  key={t.index}
                  className={bold(t)}
                  vectorEffect="non-scaling-stroke"
                  d={roundedPath([[insetX, FUNNEL_HEIGHT], [insetX, FUNNEL_HEIGHT - POINTER_LENGTH], [mainX, FUNNEL_TOP], [mainX, 0]], CORNER_RADIUS)}
                />
              );
            })}
          </svg>

          <div className={styles.insetBar}>
            {firstYear.map((t) => (
              <button
                key={t.index}
                type="button"
                aria-label={ariaLabel(t)}
                className={`${styles.insetSegment} ${tone(t)}`}
                style={{ left: `${t.insetLeft}%`, width: `${t.insetWidth}%` }}
                data-pin={pinKey(t.index, INSET_SEGMENT)}
                onMouseEnter={select(t, INSET_SEGMENT)}
                onMouseLeave={deselect}
                onFocus={select(t, INSET_SEGMENT)}
                onClick={pin(t, INSET_SEGMENT)}
                onBlur={unpin(t)}
              >
                {t.insetWidth! >= MIN_INSET_LABEL_WIDTH && (
                  <span className={styles.insetLabel}>
                    <span className={styles.insetName}>
                      {t.name}
                      {t.ordinal && ` · ${t.ordinal}`}
                    </span>
                    <span className={styles.insetDuration}>{t.duration}</span>
                  </span>
                )}
              </button>
            ))}
          </div>

          {insetLinked.map((t) => (
            <div
              key={t.index}
              className={`${styles.ring} ${styles.ringInset} ${isPinned(t) ? styles.ringPinned : ""}`}
              style={ringStyle(t.insetLeft!, t.insetWidth!)}
            />
          ))}

          <svg className={styles.insetLeaders} viewBox="0 0 1000 42" preserveAspectRatio="none" aria-hidden="true">
            {tiny.map((t, i) => {
              const center = (t.insetLeft! + t.insetWidth! / 2) * 10;
              const labelX = (i * INSET_LABEL_STEP + CALLOUT_LINE_OFFSET) * 10;
              const d = roundedPath([[center, 0], [center, POINTER_LENGTH], [labelX, 42 - POINTER_LENGTH], [labelX, 42]], CORNER_RADIUS);
              return (
                <g key={t.index}>
                  <path
                    className={calloutActive(t, true) ? `${styles.calloutLeaderActive} ${bold(t)}` : ""}
                    vectorEffect="non-scaling-stroke"
                    d={d}
                  />
                  <path
                    className={styles.leaderHit}
                    vectorEffect="non-scaling-stroke"
                    d={d}
                    tabIndex={-1}
                    data-pin={pinKey(t.index, INSET_CALLOUT)}
                    onMouseEnter={select(t, INSET_CALLOUT)}
                    onMouseLeave={deselect}
                    onClick={pin(t, INSET_CALLOUT)}
                    onBlur={unpin(t)}
                  />
                </g>
              );
            })}
          </svg>
          <div className={styles.insetLabels}>
            {tiny.map((t, i) => (
              <div
                key={t.index}
                tabIndex={-1}
                className={`${styles.insetLabelColumn} ${calloutActive(t, true) ? styles.calloutActive : ""} ${pinnedVia(t, true) ? styles.calloutPinned : ""}`}
                style={{ left: `${i * INSET_LABEL_STEP}%` }}
                data-pin={pinKey(t.index, INSET_CALLOUT)}
                onMouseEnter={select(t, INSET_CALLOUT)}
                onMouseLeave={deselect}
                onClick={pin(t, INSET_CALLOUT)}
                onBlur={unpin(t)}
              >
                <div className={styles.insetLabelName}>
                  {t.index} · {t.name}
                </div>
                <div className={styles.insetLabelMeta}>
                  {t.ordinal ? `${t.ordinal} · ` : ""}{t.duration}
                </div>
              </div>
            ))}
          </div>

          <p className={styles.caption}>
            Enlarged view of NFC&apos;s first year, since eight of the twenty-two terms are crammed into this comparatively brief window of time.
          </p>

          {hSel && (
            <Tooltip
              term={hSel}
              portrait={portraitOf(hSel)}
              total={terms.length}
              pinned={isPinned(hSel)}
              onUnpin={unpinFromCard}
              onMouseEnter={enterTooltip}
              onMouseLeave={leaveTooltip}
              onBlur={leaveTooltipFocus}
              style={{
                left: cardLeft(hCenter),
                // From the enlarged view, the card sits above the bar instead of over the years.
                ...(horizontalSelected?.viaInset ? { bottom: "calc(100% + 10px)" } : { top: CARD_BELOW_BAR }),
              }}
            />
          )}
          {hOwner && (
            <Tooltip
              term={ownerCard}
              portrait={portraitOf(ownerCard)}
              total={terms.length}
              label="Group owner"
              pinned={isPinned(ownerCard)}
              className={styles.tooltipOwner}
              onUnpin={unpinFromCard}
              onMouseEnter={enterTooltip}
              onMouseLeave={leaveTooltip}
              onBlur={leaveTooltipFocus}
              style={{ left: cardLeft(ownerCenter), top: CARD_BELOW_LANE }}
            />
          )}
        </div>
      </div>

      {/* Vertical layout (below 768px) */}
      <div
        className={styles.vertical}
        style={{ height: verticalHeight }}
        onKeyDown={(e) => e.key === "Escape" && setVerticalSelected(null)}
      >
        {/* The group-owner lane: tappable, with a crown marker where it begins, so it explains itself. */}
        <button
          type="button"
          aria-label={`${owner.name}, group owner since ${owner.since}`}
          aria-expanded={vOwner}
          className={`${styles.vLane} ${vOwner ? styles.vLaneActive : ""}`}
          style={{ top: owner.top, height: verticalHeight - owner.top }}
          onClick={toggleOwner}
        />
        <button
          type="button"
          aria-label={`${owner.name}, group owner since ${owner.since}`}
          aria-expanded={vOwner}
          className={`${styles.vLaneDot} ${vOwner ? styles.vLaneDotActive : ""}`}
          style={{ top: owner.top - 9 }}
          onClick={toggleOwner}
        >
          <KeyIcon />
        </button>

        {terms.map((t) => {
          const tall = t.height >= MIN_TALL_HEIGHT;
          return (
            <div key={t.index}>
              <button
                type="button"
                aria-label={ariaLabel(t)}
                aria-expanded={verticalSelected === t.index}
                className={`${styles.block} ${tone(t)} ${verticalSelected === t.index ? styles.blockLit : ""}`}
                style={{ top: t.top, height: t.height }}
                onClick={() => setVerticalSelected(verticalSelected === t.index ? null : t.index)}
              >
                <span className={styles.blockNumber}>{t.index}</span>
              </button>
              {/* The label is a second tap target for the row; the block button is the accessible one. */}
              <div
                className={`${styles.blockLabel} ${verticalSelected === t.index ? styles.blockLabelActive : ""}`}
                style={{ top: t.top, height: t.height }}
                aria-hidden="true"
                onClick={() => setVerticalSelected(verticalSelected === t.index ? null : t.index)}
              >
                {tall ? (
                  <>
                    <div className={styles.blockName}>{t.name}</div>
                    <div className={styles.blockMeta}>
                      {t.shortDates} · {t.duration}
                    </div>
                  </>
                ) : (
                  <div className={styles.blockNameShort}>
                    {t.name} <span className={styles.muted}>· {t.duration}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className={styles.vYearLabel} style={{ top: 0 }} aria-hidden="true">
          {terms[0].start.getUTCFullYear()}
        </div>
        {ticks.map((tick) => (
          <div key={tick.year} className={styles.vYearLabel} style={{ top: tick.top - 6 }} aria-hidden="true">
            {tick.year}
          </div>
        ))}

        {/*
          Each card rides in a track the height of what was tapped, and sticks to the top of the
          viewport while that track is on screen, so a tall term's card stays readable as you scroll
          and drops away once you're past it. The pointer travels with the card, so it always meets
          the ring (or the lane) beside it.
        */}
        {vOwner && (
          <div
            className={styles.vCardTrack}
            style={{ top: owner.top - 12, height: verticalHeight - owner.top + 12 + vCardHeight - CARD_HANDOFF }}
          >
            <div className={styles.vCardSticky} ref={vCardRef}>
              <div className={`${styles.vPointer} ${styles.vPointerOwner}`} />
              <Tooltip
                term={ownerCard}
                portrait={portraitOf(ownerCard)}
                total={terms.length}
                label="Group owner"
                pinned
                className={`${styles.tooltipMobile} ${styles.tooltipOwner}`}
                style={{}}
                onUnpin={() => setVerticalSelected(null)}
              />
            </div>
          </div>
        )}
        {vSel && (
          <>
            {/* A tap is a pin on touch screens: the card keeps the pinned look and closes from its pin button. */}
            <div className={styles.vCardTrack} style={{ top: vSel.top, height: vSel.height + vCardHeight - CARD_HANDOFF }}>
              <div className={styles.vCardSticky} ref={vCardRef}>
                <div className={styles.vPointer} />
                <Tooltip
                  term={vSel}
                  portrait={portraitOf(vSel)}
                  total={terms.length}
                  pinned
                  className={styles.tooltipMobile}
                  style={{}}
                  onUnpin={() => setVerticalSelected(null)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
