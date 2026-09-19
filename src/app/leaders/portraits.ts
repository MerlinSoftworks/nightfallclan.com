import { GROUP_OWNER, TERMS } from "./leaders";

/** Roblox user id → portrait image URL. Users whose fetch failed or who have no avatar are absent. */
export type Portraits = Record<number, string>;

// Busts, not portraits: Roblox frames them more consistently, so every face lands where the card expects it.
const ENDPOINT = "https://thumbnails.roblox.com/v1/users/avatar-bust";
/** Portraits only ever come from Roblox's image CDN; anything else is dropped. */
const CDN_URL = /^https:\/\/[a-z0-9-]+\.rbxcdn\.com\//i;

/**
 * Fetches every leader's portrait in one request, server-side. Next caches the response for a day,
 * so it refreshes with the page; a failed fetch just leaves the cards on their silhouette.
 */
export async function getPortraits(): Promise<Portraits> {
  const ids = [...new Set([...TERMS.map((t) => t.userId), GROUP_OWNER.userId])];
  try {
    const res = await fetch(`${ENDPOINT}?userIds=${ids.join(",")}&size=150x150&format=Png&isCircular=false`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return {};
    const payload = (await res.json()) as {
      data?: { targetId?: number; state?: string; imageUrl?: string }[];
    };
    const portraits: Portraits = {};
    for (const item of payload.data ?? []) {
      if (
        typeof item.targetId === "number" &&
        item.state === "Completed" &&
        typeof item.imageUrl === "string" &&
        CDN_URL.test(item.imageUrl)
      ) {
        portraits[item.targetId] = item.imageUrl;
      }
    }
    return portraits;
  } catch {
    return {};
  }
}
