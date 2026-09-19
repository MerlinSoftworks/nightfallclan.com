import type { Metadata } from "next";
import { metaClassName } from "@ui/HistoryHeader";
import { getPortraits } from "./portraits";
import LeadersView from "./LeadersView";

export const metadata: Metadata = {
  title: "Leaders | Nightfall Clan",
};

// Re-render daily so the current leader's running tenure stays accurate.
export const revalidate = 86400;

export default async function LeadersPage() {
  const now = new Date().toISOString().slice(0, 10);
  const portraits = await getPortraits();

  return (
    <div className="leaders-page-body">
      <LeadersView
        now={now}
        portraits={portraits}
        title="Leaders of Nightfall Clan"
        meta={
          <span className={metaClassName}>
            This page is a timeline of all twenty-two of NFC&apos;s leadership terms, as served by seventeen leaders
            across more than one and a half decades.
          </span>
        }
      />
    </div>
  );
}
