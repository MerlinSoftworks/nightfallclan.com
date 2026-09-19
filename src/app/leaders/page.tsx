import type { Metadata } from "next";
import { metaClassName } from "@ui/HistoryHeader";
import LeadersView from "./LeadersView";

export const metadata: Metadata = {
  title: "Leaders | Nightfall Clan",
};

// Re-render daily so the current leader's running tenure stays accurate.
export const revalidate = 86400;

export default function LeadersPage() {
  const now = new Date().toISOString().slice(0, 10);

  return (
    <div className="leaders-page-body">
      <LeadersView
        now={now}
        title="Leaders of Nightfall Clan"
        meta={
          <span className={metaClassName}>
            This page is a timeline of all twenty of NFC&apos;s leadership terms, as served by seventeen leaders
            across more than one and a half decades.
          </span>
        }
      />
    </div>
  );
}
