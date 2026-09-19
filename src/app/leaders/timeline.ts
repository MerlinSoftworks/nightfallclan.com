import { getOrdinalSuffix } from "@/app/utils/date";
import { FIRST_YEAR_END, GROUP_OWNER, TERMS } from "./leaders";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Vertical scale (px per day) and the shortest a term block may be. */
const V_PX_PER_DAY = 0.2;
const V_MIN_HEIGHT = 24;

export type TimelineTerm = {
  index: number;
  name: string;
  profileUrl: string;
  /** "2nd term" for leaders who served more than once, else "". */
  ordinal: string;
  /** Alias or ordinal — shown in parentheses after the name. */
  aside: string;
  current: boolean;
  start: Date;
  end: Date;
  /** Rounded, for labels: "7 months". */
  duration: string;
  /** Exact, for the card: "7 months, 26 days". */
  exactDuration: string;
  longDates: string;
  shortDates: string;
  /** Horizontal position and width, as a percentage of the whole timeline. */
  left: number;
  width: number;
  /** Position and width within the enlarged first year, or null if outside it. */
  insetLeft: number | null;
  insetWidth: number | null;
  /** Vertical position and height in px. */
  top: number;
  height: number;
};

export type Tick = { year: number; left: number; top: number };

export type Timeline = {
  terms: TimelineTerm[];
  ticks: Tick[];
  firstYearWidth: number;
  owner: {
    name: string;
    profileUrl: string;
    since: string;
    start: Date;
    end: Date;
    longDates: string;
    exactDuration: string;
    left: number;
    top: number;
  };
  verticalHeight: number;
};

const parseDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

export const formatLongDate = (d: Date) =>
  `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

const formatShortDate = (d: Date) =>
  `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()} ’${String(d.getUTCFullYear()).slice(2)}`;

export const formatMonthYear = (d: Date) => `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

export const formatFullDate = (d: Date) =>
  `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

function calendarDiff(start: Date, end: Date) {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let rest = end.getUTCDate() - start.getUTCDate();
  if (rest < 0) {
    months -= 1;
    rest += new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days: rest };
}

export function formatDuration(start: Date, end: Date): string {
  const days = daysBetween(start, end);
  if (days < 45) return plural(days, "day");

  const { years, months, days: rest } = calendarDiff(start, end);
  if (years > 0) return months > 0 ? `${plural(years, "year")}, ${plural(months, "month")}` : plural(years, "year");
  if (months < 3 && rest > 0) return `${plural(months, "month")}, ${plural(rest, "day")}`;
  return plural(months, "month");
}

export function formatExactDuration(start: Date, end: Date): string {
  const days = daysBetween(start, end);
  if (days < 45) return plural(days, "day");

  const { years, months, days: rest } = calendarDiff(start, end);
  return [plural(years, "year"), plural(months, "month"), plural(rest, "day")]
    .filter((part) => !part.startsWith("0 "))
    .join(", ");
}

export function buildTimeline(nowIso: string): Timeline {
  const now = parseDate(nowIso);
  const origin = parseDate(TERMS[0].start);
  const firstYearEnd = parseDate(FIRST_YEAR_END);
  const totalDays = daysBetween(origin, now);
  const firstYearDays = daysBetween(origin, firstYearEnd);
  const pct = (d: Date) => (daysBetween(origin, d) / totalDays) * 100;

  let top = 0;
  const terms = TERMS.map((term, i): TimelineTerm => {
    const start = parseDate(term.start);
    const next = TERMS[i + 1];
    const end = next ? parseDate(next.start) : now;
    const days = daysBetween(start, end);
    const height = Math.max(V_MIN_HEIGHT, days * V_PX_PER_DAY);
    const inFirstYear = end <= firstYearEnd;
    const ordinal = term.termOf ? `${term.termOf}${getOrdinalSuffix(term.termOf)} term` : "";

    const built: TimelineTerm = {
      index: i + 1,
      name: term.name,
      profileUrl: `https://www.roblox.com/users/${term.userId}/profile`,
      ordinal,
      aside: term.alias ?? ordinal,
      current: !next,
      start,
      end,
      duration: formatDuration(start, end),
      exactDuration: formatExactDuration(start, end),
      longDates: `${formatLongDate(start)} – ${next ? formatLongDate(end) : "present"}`,
      shortDates: `${formatShortDate(start)} – ${next ? formatShortDate(end) : "present"}`,
      left: pct(start),
      width: (days / totalDays) * 100,
      insetLeft: inFirstYear ? (daysBetween(origin, start) / firstYearDays) * 100 : null,
      insetWidth: inFirstYear ? (days / firstYearDays) * 100 : null,
      top,
      height,
    };
    top += height;
    return built;
  });

  // Where a date falls on the vertical scale, which stretches short terms.
  const verticalTop = (d: Date) => {
    const term = terms.findLast((t) => t.start <= d) ?? terms[0];
    const span = Math.max(1, daysBetween(term.start, term.end));
    return term.top + (daysBetween(term.start, d) / span) * term.height;
  };

  const ticks: Tick[] = [];
  for (let year = origin.getUTCFullYear() + 1; year <= now.getUTCFullYear(); year++) {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    ticks.push({ year, left: pct(jan1), top: verticalTop(jan1) });
  }

  const ownerStart = parseDate(GROUP_OWNER.start);

  return {
    terms,
    ticks,
    firstYearWidth: (firstYearDays / totalDays) * 100,
    owner: {
      name: GROUP_OWNER.name,
      profileUrl: `https://www.roblox.com/users/${GROUP_OWNER.userId}/profile`,
      since: formatFullDate(ownerStart),
      start: ownerStart,
      end: now,
      longDates: `${formatLongDate(ownerStart)} – present`,
      exactDuration: formatExactDuration(ownerStart, now),
      left: pct(ownerStart),
      top: verticalTop(ownerStart),
    },
    verticalHeight: top,
  };
}
