"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import HistoryHeader from "@ui/HistoryHeader";
import LeadersLogo from "@ui/LeadersLogo";
import LeadersTimeline from "@ui/LeadersTimeline";
import { LOGOS, logoOn } from "@/app/utils/logos";
import type { Portraits } from "./portraits";

/** The header's resting logo, shared with the history page (the favicon keeps the older one). */
const DEFAULT_LOGO = "/logo-silver.png";

/** The header and the timeline together: the header's logo follows whatever the timeline highlights. */
export default function LeadersView({
  now,
  title,
  meta,
  portraits,
}: {
  now: string;
  title: string;
  meta: ReactNode;
  portraits: Portraits;
}) {
  const [logo, setLogo] = useState(DEFAULT_LOGO);

  // On wide screens fetch every logo up front, so the first swap doesn't wait on a download.
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    for (const src of Object.values(LOGOS)) new Image().src = src;
  }, []);

  // The logo the group used when the highlighted term (or the owner's tenure) began.
  const onHighlight = useCallback((start: Date | null) => setLogo(start ? logoOn(start) : DEFAULT_LOGO), []);

  return (
    <>
      <div className="leaders-page-header">
        <HistoryHeader title={title} meta={meta} logo={<LeadersLogo src={logo} />} />
      </div>
      <LeadersTimeline now={now} portraits={portraits} onHighlight={onHighlight} />
    </>
  );
}
