/**
 * The group's logo over time: each entry is the day a new logo went up, in force until the next.
 * Shared by the history page's group bio and the Leaders page header.
 */
export const LOGOS: Record<string, string> = {
  "2010-03-10": "/logos/2010.png",
  "2011-03-16": "/logos/2011a.png",
  "2011-07-16": "/logos/2011b.png",
  "2011-08-26": "/logos/2011c.png",
  "2012-11-16": "/logos/2011tg.png",
  "2012-11-24": "/logos/2011c.png",
  "2013-05-03": "/logos/2013.png",
  "2015-01-01": "/logos/2015.png",
  "2018-09-17": "/logos/2018.png",
};

const entries = Object.entries(LOGOS)
  .map(([date, src]) => ({ time: Date.parse(date), src }))
  .sort((a, b) => a.time - b.time);

/** The logo in use on a given day: the latest entry on or before it, or the earliest for days before any. */
export function logoOn(date: Date | number): string {
  const time = typeof date === "number" ? date : date.getTime();
  let src = entries[0].src;
  for (const entry of entries) {
    if (entry.time > time) break;
    src = entry.src;
  }
  return src;
}
