"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSearch } from "@context/SearchContext";
import { useSearchParser } from "@hooks/useSearchParser";
import { prefetchAvatars } from "@hooks/useAvatarCache";
import { useScrollDirection } from "@hooks/useScrollDirection";
import { useInfiniteScroll } from "@hooks/useInfiniteScroll";
import PostCard from "@ui/PostCard";
import postStyles from "@ui/PostCard/PostCard.module.scss";
import { sanitizePosts, type Post } from "@/app/utils/sanitize";
import styles from "./WallView.module.scss";

const POSTS_PER_LOAD = 20;
const POSTS_PER_SKIP_SMALL = 100;
const POSTS_PER_SKIP_LARGE = 1000;
const SKELETON_COUNT = 15;
const MAX_POSTS = 40;

type WallViewProps = {
  onLatestDateShownChange?: (timestamp: number) => void;
};

type ApiResponse = {
  posts: Post[];
  total: number;
  offset: number;
  contextIndex?: number;
};

function isSameCalendarDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function formatDaySeparatorDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function SkipArrowIcon({
  direction,
  hasSecondChevron,
}: {
  direction: "up" | "down";
  hasSecondChevron: boolean;
}) {
  const isUp = direction === "up";
  const stemPath = hasSecondChevron
    ? isUp
      ? "M10 17V9"
      : "M10 3V11"
    : isUp
      ? "M10 15V8"
      : "M10 5V12";
  const firstChevronPath = hasSecondChevron
    ? isUp
      ? "M6 11L10 7L14 11"
      : "M6 9L10 13L14 9"
    : isUp
      ? "M6 9L10 5L14 9"
      : "M6 11L10 15L14 11";

  return (
    <svg
      className={styles.jumpIcon}
      width="18"
      height="18"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={stemPath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={firstChevronPath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {hasSecondChevron && (
        <path
          d={isUp ? "M6 7L10 3L14 7" : "M6 13L10 17L14 13"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

function buildFetchUrl(params: {
  query: string;
  queryUser: string;
  dateFilter: { start?: number; end?: number } | null;
  offset: number;
  limit: number;
}): string {
  const url = new URL("/api/posts", window.location.origin);
  if (params.queryUser) url.searchParams.set("from", params.queryUser);
  if (params.dateFilter?.start != null) url.searchParams.set("after", String(params.dateFilter.start));
  if (params.dateFilter?.end != null) url.searchParams.set("before", String(params.dateFilter.end));
  if (params.query) url.searchParams.set("q", params.query);
  url.searchParams.set("offset", String(params.offset));
  url.searchParams.set("limit", String(params.limit));
  return url.toString();
}

export default function WallView({ onLatestDateShownChange }: WallViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { inputValue, setInputValue, loading, setLoading } = useSearch();
  const mainRef = useRef<HTMLElement | null>(null);
  const [jumpButtonGroupLeft, setJumpButtonGroupLeft] = useState<number | null>(null);

  // API-driven state
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [highlightedPostId, setHighlightedPostId] = useState(0);
  const latestDateShownRef = useRef<number | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const initialLoadDoneRef = useRef(false);

  const { scrollDirection } = useScrollDirection();
  const { query, queryUser, dateFilter } = useSearchParser(inputValue);

  // Track previous search state for detecting changes
  const prevSearchRef = useRef({ query: "", queryUser: "", dateFilter: null as typeof dateFilter });
  const skipPaginationResetRef = useRef(false);

  // Core fetch function
  const fetchPosts = useCallback(
    async (fetchOffset: number, fetchLimit: number, append?: "top" | "bottom") => {
      fetchControllerRef.current?.abort();
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      const url = buildFetchUrl({
        query,
        queryUser,
        dateFilter,
        offset: fetchOffset,
        limit: fetchLimit,
      });

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data: ApiResponse = await res.json();

        void prefetchAvatars(
          data.posts
            .map((post) => post.poster?.user?.userId)
            .filter((userId): userId is number => typeof userId === "number")
        );

        if (append === "top") {
          const combined = [...data.posts, ...postsRef.current];
          const trimmed = combined.length > MAX_POSTS ? combined.slice(0, MAX_POSTS) : combined;
          setPosts(trimmed);
          setOffset(fetchOffset);
        } else if (append === "bottom") {
          const combined = [...postsRef.current, ...data.posts];
          const trimCount = Math.max(0, combined.length - MAX_POSTS);
          setPosts(trimCount > 0 ? combined.slice(trimCount) : combined);
          if (trimCount > 0) setOffset((o) => o + trimCount);
        } else {
          setPosts(data.posts);
          setOffset(fetchOffset);
        }
        setTotal(data.total);
        setLoading(false);
        initialLoadDoneRef.current = true;
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoading(false);
      }
    },
    [query, queryUser, dateFilter, setLoading]
  );

  // Initial fetch and re-fetch when search changes
  useEffect(() => {
    const prev = prevSearchRef.current;
    const searchChanged =
      prev.query !== query ||
      prev.queryUser !== queryUser ||
      JSON.stringify(prev.dateFilter) !== JSON.stringify(dateFilter);

    prevSearchRef.current = { query, queryUser, dateFilter };

    if (!initialLoadDoneRef.current || searchChanged) {
      if (skipPaginationResetRef.current) {
        skipPaginationResetRef.current = false;
        return;
      }

      setOffset(0);
      setPosts([]);
      setLoading(true);

      if (searchChanged && (query || queryUser || dateFilter)) {
        window.scrollTo(0, 0);
      }

      fetchPosts(0, POSTS_PER_LOAD);
    }
  }, [query, queryUser, dateFilter, fetchPosts, setLoading]);

  // Sync URL with search
  useEffect(() => {
    const currentSearch = searchParams.get("search") ?? "";
    if (inputValue !== currentSearch) {
      const url = inputValue ? `/wall?search=${encodeURIComponent(inputValue)}` : "/wall";
      router.replace(url, { scroll: false });
    }
  }, [inputValue, router, searchParams]);

  const currentPagePosts = useMemo(
    () => sanitizePosts(posts),
    [posts]
  );

  const showJumpToOldest = offset > 0;
  const showJumpToNewest = offset + posts.length < total;
  const hasFilter = !!(queryUser || query || dateFilter);

  // Anchor-based scroll preservation for top prepend.
  // Records the first visible post's offsetTop before the prepend so we can compute the
  // exact shift after the DOM update - independent of how much was trimmed at the bottom.
  const scrollAnchorRef = useRef<{ id: number; offsetTopBefore: number; scrollTopBefore: number } | null>(null);

  // Deferred scroll direction after navigation fetches complete
  // "top-absolute" / "bottom-absolute" = window.scrollTo (used by jump, no sentinel at those positions)
  // "top" / "bottom" = scrollIntoView on first/last post (used by skip, keeps 1px sentinel off-screen)
  const pendingScrollRef = useRef<"top" | "bottom" | "top-absolute" | "bottom-absolute" | null>(null);

  // Stable refs so handleLoadTop/Bottom never need offset/posts/total as useCallback deps,
  // preventing the observer from reconnecting (and re-firing) whenever those values change.
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const totalRef = useRef(total);
  totalRef.current = total;

  const handleLoadTop = useCallback(() => {
    if (offsetRef.current <= 0) return;
    const anchorId = postsRef.current[0]?.id;
    if (anchorId !== undefined) {
      const el = document.getElementById(`post-${anchorId}`);
      scrollAnchorRef.current = {
        id: anchorId,
        offsetTopBefore: el?.offsetTop ?? 0,
        scrollTopBefore: document.documentElement.scrollTop,
      };
    }
    const newOffset = Math.max(0, offsetRef.current - POSTS_PER_LOAD);
    const fetchCount = offsetRef.current - newOffset;
    setOffset(newOffset);
    fetchPosts(newOffset, fetchCount, "top");
  }, [fetchPosts]);

  // Preserve scroll position after prepending using the anchor post's shift.
  // scrollTop += (anchorPost.offsetTop_after - anchorPost.offsetTop_before)
  // This is correct even when bottom posts are trimmed, because we only measure
  // the movement of content above the viewport, not the net page height change.
  useLayoutEffect(() => {
    if (scrollAnchorRef.current === null) return;
    const { id, offsetTopBefore, scrollTopBefore } = scrollAnchorRef.current;
    scrollAnchorRef.current = null;
    const el = document.getElementById(`post-${id}`);
    if (!el) return;
    window.scrollTo(0, scrollTopBefore + (el.offsetTop - offsetTopBefore));
  }, [posts]);

  // Execute deferred navigation scroll after posts are rendered
  useLayoutEffect(() => {
    if (pendingScrollRef.current === null || loading || posts.length === 0) return;
    const dir = pendingScrollRef.current;
    pendingScrollRef.current = null;

    if (dir === "top-absolute") {
      window.scrollTo({ top: 0 });
    } else if (dir === "bottom-absolute") {
      window.scrollTo({ top: document.documentElement.scrollHeight });
    } else if (dir === "top") {
      // At the very beginning there's no top sentinel - scroll to the page edge.
      // Otherwise use scrollIntoView so the 1px sentinel stays just off-screen.
      if (offset <= 0) {
        window.scrollTo({ top: 0 });
      } else {
        const firstPost = document.getElementById(`post-${posts[0].id}`);
        if (firstPost) {
          firstPost.scrollIntoView({ block: "start" });
        } else {
          window.scrollTo({ top: 0 });
        }
      }
    } else {
      // At the very end there's no bottom sentinel - scroll to the page edge.
      // Otherwise use scrollIntoView so the 1px sentinel stays just off-screen.
      if (offset + posts.length >= total) {
        window.scrollTo({ top: document.documentElement.scrollHeight });
      } else {
        const lastPost = document.getElementById(`post-${posts[posts.length - 1].id}`);
        if (lastPost) {
          lastPost.scrollIntoView({ block: "end" });
        } else {
          window.scrollTo({ top: document.documentElement.scrollHeight });
        }
      }
    }
  }, [posts, loading]);

  const handleLoadBottom = useCallback(() => {
    const currentOffset = offsetRef.current;
    const currentLength = postsRef.current.length;
    if (currentOffset + currentLength >= totalRef.current) return;
    fetchPosts(currentOffset + currentLength, POSTS_PER_LOAD, "bottom");
  }, [fetchPosts]);

  const topSentinelRef = useInfiniteScroll(
    "top",
    !loading && offset > 0,
    handleLoadTop
  );
  const bottomSentinelRef = useInfiniteScroll(
    "bottom",
    !loading && offset + posts.length < total,
    handleLoadBottom
  );

  useEffect(() => {
    if (!onLatestDateShownChange || loading || currentPagePosts.length === 0) return;

    let rafId: number | null = null;

    const updateLatestDateShown = () => {
      const viewportBottom = window.innerHeight;
      let selectedCreated: string | null = null;
      let topMostAtOrAboveBottom = -Infinity;
      let firstBelowBottom: { top: number; created: string } | null = null;

      for (const post of currentPagePosts) {
        const element = document.getElementById(`post-${post.id}`);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const intersectsViewportBottom =
          rect.top <= viewportBottom && rect.bottom >= viewportBottom;

        if (intersectsViewportBottom) {
          selectedCreated = post.created;
          break;
        }

        if (rect.top <= viewportBottom && rect.top > topMostAtOrAboveBottom) {
          topMostAtOrAboveBottom = rect.top;
          selectedCreated = post.created;
        } else if (
          rect.top > viewportBottom &&
          (!firstBelowBottom || rect.top < firstBelowBottom.top)
        ) {
          firstBelowBottom = { top: rect.top, created: post.created };
        }
      }

      if (!selectedCreated && firstBelowBottom) {
        selectedCreated = firstBelowBottom.created;
      }

      if (!selectedCreated) return;

      const timestamp = Date.parse(selectedCreated);
      if (Number.isNaN(timestamp) || latestDateShownRef.current === timestamp) return;

      latestDateShownRef.current = timestamp;
      onLatestDateShownChange(timestamp);
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateLatestDateShown();
      });
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [currentPagePosts, loading, onLatestDateShownChange]);

  useLayoutEffect(() => {
    const mainElement = mainRef.current;
    if (!mainElement) return;

    const updateJumpButtonGroupLeft = () => {
      const rect = mainElement.getBoundingClientRect();
      const nextLeft = rect.left + rect.width / 2;
      setJumpButtonGroupLeft((current) => {
        if (current !== null && Math.abs(current - nextLeft) < 0.5) {
          return current;
        }
        return nextLeft;
      });
    };

    updateJumpButtonGroupLeft();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateJumpButtonGroupLeft);
      resizeObserver.observe(mainElement);
    }

    window.addEventListener("resize", updateJumpButtonGroupLeft);
    return () => {
      window.removeEventListener("resize", updateJumpButtonGroupLeft);
      resizeObserver?.disconnect();
    };
  }, []);

  function jumpToOldest() {
    setLoading(true);
    pendingScrollRef.current = "top-absolute";
    fetchPosts(0, POSTS_PER_LOAD);
  }

  function jumpToNewest() {
    setLoading(true);
    pendingScrollRef.current = "bottom-absolute";
    fetchPosts(Math.max(0, total - POSTS_PER_LOAD), POSTS_PER_LOAD);
  }

  function skipPosts(skipAmount: number) {
    if (skipAmount === 0 || total === 0) return;

    const currentWindowSize = Math.max(POSTS_PER_LOAD, posts.length);

    if (skipAmount < 0) {
      if (offset <= 0) return;
      const newOffset = Math.max(0, offset + skipAmount);
      setLoading(true);
      pendingScrollRef.current = "top";
      fetchPosts(newOffset, Math.min(currentWindowSize, total - newOffset));
      return;
    }

    if (offset + posts.length >= total) return;
    const maxOffset = Math.max(0, total - currentWindowSize);
    const newOffset = Math.min(maxOffset, offset + skipAmount);
    const reachedEnd = newOffset >= maxOffset;
    setLoading(true);
    pendingScrollRef.current = reachedEnd ? "bottom" : "top";
    fetchPosts(newOffset, Math.min(currentWindowSize, total - newOffset));
  }

  function searchUser(username: string) {
    setOffset(0);
    setPosts([]);
    setLoading(true);

    const fromUserRegex = /\s*from:\s*(\S+)\s*/i;
    const fromUserString = `from:${username}`;

    if (inputValue.match(fromUserRegex)) {
      setInputValue(
        inputValue.replace(fromUserRegex, ` ${fromUserString} `).trim()
      );
    } else {
      setInputValue(`${inputValue} ${fromUserString}`.trim());
    }

    window.scrollTo(0, 0);
  }

  function gotoContext(id: number) {
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    skipPaginationResetRef.current = true;
    setInputValue("");
    setLoading(true);

    fetch(`/api/posts?context=${id}&window=10`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        void prefetchAvatars(
          data.posts
            .map((post) => post.poster?.user?.userId)
            .filter((userId): userId is number => typeof userId === "number")
        );
        setPosts(data.posts);
        setTotal(data.total);
        setOffset(data.offset);
        setLoading(false);
        setHighlightedPostId(id);

        setTimeout(() => {
          const maxAttempts = 20;
          let attempt = 0;
          const interval = setInterval(() => {
            const element = document.getElementById(`post-${id}`);
            if (element) {
              clearInterval(interval);
              element.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => {
                setHighlightedPostId((current) => (current === id ? 0 : current));
              }, 2000);
            } else if (++attempt >= maxAttempts) {
              clearInterval(interval);
            }
          }, 100);
        }, 50);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoading(false);
      });
  }

  return (
    <div>
      <main ref={mainRef} className={styles.main}>
        {showJumpToOldest && !loading && (
          <div
            className={`${styles.jumpButtonGroup} ${styles["jumpButtonGroup--top"]} ${scrollDirection === "down" ? styles.hidden : ""}`}
            style={jumpButtonGroupLeft === null ? undefined : { left: jumpButtonGroupLeft }}
          >
            <button
              className={`${styles.jumpButton} ${styles["jumpButton--icon"]}`}
              onClick={() => skipPosts(-POSTS_PER_SKIP_LARGE)}
              aria-label="Skip back 1000 posts"
              title="Skip back 1000 posts"
            >
              <SkipArrowIcon direction="up" hasSecondChevron />
            </button>
            <button
              className={`${styles.jumpButton} ${styles["jumpButton--icon"]}`}
              onClick={() => skipPosts(-POSTS_PER_SKIP_SMALL)}
              aria-label="Skip back 100 posts"
              title="Skip back 100 posts"
            >
              <SkipArrowIcon direction="up" hasSecondChevron={false} />
            </button>
            <button className={styles.jumpButton} onClick={jumpToOldest}>
              Jump To Oldest
            </button>
          </div>
        )}

        <div className={styles.postCount}>
          {loading || !initialLoadDoneRef.current ? (
            <p>Loading</p>
          ) : total === 0 ? (
            <p>No posts found</p>
          ) : total === 1 ? (
            <p>Showing one single lonely post</p>
          ) : (
            <p>Showing {total.toLocaleString()} posts</p>
          )}
        </div>

        {!loading && offset > 0 && (
          <div ref={topSentinelRef} className={styles.sentinel} />
        )}

        {loading || !initialLoadDoneRef.current
          ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <div key={i} className={`${postStyles.post} ${postStyles["post--skeleton"]}`}>
                <div
                  className={`${postStyles.post__avatar} ${postStyles["post__avatar--loading"]}`}
                />
                <div className={postStyles.post__content}>
                  <div className={postStyles["post__user-date-container"]}>
                    <div
                      className={`${postStyles.skeleton} ${postStyles["skeleton-user"]}`}
                    />
                    <div
                      className={`${postStyles.skeleton} ${postStyles["skeleton-date"]}`}
                    />
                  </div>
                  <div
                    className={`${postStyles.skeleton} ${postStyles["skeleton-body"]}`}
                  />
                </div>
              </div>
            ))
          : currentPagePosts.map((post, index) => {
              const currentPostDate = new Date(post.created);
              const previousPost = index > 0 ? currentPagePosts[index - 1] : null;
              const shouldShowSeparator =
                previousPost !== null &&
                !isSameCalendarDay(currentPostDate, new Date(previousPost.created));

              return (
                <div key={post.id}>
                  {shouldShowSeparator && (
                    <div className={styles.daySeparator} role="separator" aria-label={formatDaySeparatorDate(currentPostDate)}>
                      <span>{formatDaySeparatorDate(currentPostDate)}</span>
                    </div>
                  )}
                  <PostCard
                    post={post}
                    highlighted={post.id === highlightedPostId}
                    hasFilter={hasFilter}
                    onSearchUser={searchUser}
                    onGotoContext={gotoContext}
                  />
                </div>
              );
            })}

        {!loading && offset + posts.length < total && (
          <div ref={bottomSentinelRef} className={styles.sentinel} />
        )}

        {showJumpToNewest && !loading && (
          <div
            className={`${styles.jumpButtonGroup} ${styles["jumpButtonGroup--bottom"]} ${scrollDirection === "up" ? styles.hidden : ""}`}
            style={jumpButtonGroupLeft === null ? undefined : { left: jumpButtonGroupLeft }}
          >
            <button className={styles.jumpButton} onClick={jumpToNewest}>
              Jump To Newest
            </button>
            <button
              className={`${styles.jumpButton} ${styles["jumpButton--icon"]}`}
              onClick={() => skipPosts(POSTS_PER_SKIP_SMALL)}
              aria-label="Skip ahead 100 posts"
              title="Skip ahead 100 posts"
            >
              <SkipArrowIcon direction="down" hasSecondChevron={false} />
            </button>
            <button
              className={`${styles.jumpButton} ${styles["jumpButton--icon"]}`}
              onClick={() => skipPosts(POSTS_PER_SKIP_LARGE)}
              aria-label="Skip ahead 1000 posts"
              title="Skip ahead 1000 posts"
            >
              <SkipArrowIcon direction="down" hasSecondChevron />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
