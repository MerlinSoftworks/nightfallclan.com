import type { Metadata } from "next";
import HistoryHeader, { metaClassName } from "@ui/HistoryHeader";
import LeadersTimeline from "@ui/LeadersTimeline";

export const metadata: Metadata = {
  title: "Leaders | Nightfall Clan",
};

// Re-render daily so the current leader's running tenure stays accurate.
export const revalidate = 86400;

export default function LeadersPage() {
  const now = new Date().toISOString().slice(0, 10);

  return (
    <div className="leaders-page-body">
      <div className="leaders-page-header">
        <HistoryHeader
          title="Leaders of Nightfall Clan"
          meta={
            <span className={metaClassName}>
              This page is a timeline of all twenty of NFC&apos;s leadership terms, as served by seventeen leaders
              across more than one and a half decades.
            </span>
          }
        />
      </div>
      <LeadersTimeline now={now} />
    </div>
  );
}
