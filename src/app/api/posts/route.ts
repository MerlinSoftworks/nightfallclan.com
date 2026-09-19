import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";

type PostRow = {
  id: number;
  poster_user_id: number | null;
  poster_username: string | null;
  poster_display_name: string | null;
  body: string;
  created: string;
  created_ms: number;
};

function toApiPost(row: PostRow) {
  return {
    id: row.id,
    poster: row.poster_user_id
      ? {
          user: {
            userId: row.poster_user_id,
            username: row.poster_username!,
            displayName: row.poster_display_name!,
          },
        }
      : null,
    body: row.body,
    created: row.created,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const db = getDb();

  // Context mode: return a post and its surrounding posts from the unfiltered dataset
  const contextId = params.get("context");
  if (contextId) {
    const postId = Number(contextId);
    const window = Math.min(50, Math.max(1, Number(params.get("window") ?? 10)));

    // Find the row number of this post in the full ordered dataset
    const indexRow = db
      .prepare("SELECT COUNT(*) as idx FROM posts WHERE rowid <= (SELECT rowid FROM posts WHERE id = ?)")
      .get(postId) as { idx: number } | undefined;

    if (!indexRow) {
      return NextResponse.json({ posts: [], total: 0, offset: 0 });
    }

    const postIndex = indexRow.idx - 1; // 0-based
    const total = (db.prepare("SELECT COUNT(*) as count FROM posts").get() as { count: number }).count;
    const offset = Math.max(0, postIndex - window);
    const limit = window * 2 + 1;

    const rows = db
      .prepare("SELECT * FROM posts ORDER BY rowid LIMIT ? OFFSET ?")
      .all(limit, offset) as PostRow[];

    return NextResponse.json({
      posts: rows.map(toApiPost),
      total,
      offset,
      contextIndex: postIndex,
    });
  }

  // Standard query mode
  const from = params.get("from");
  const after = params.get("after");
  const before = params.get("before");
  const q = params.get("q");
  const offset = Math.max(0, Number(params.get("offset") ?? 0));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 20)));

  const conditions: string[] = [];
  const countConditions: string[] = [];
  const queryParams: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (from) {
    conditions.push("p.poster_username LIKE ? COLLATE NOCASE");
    countConditions.push("p.poster_username LIKE ? COLLATE NOCASE");
    queryParams.push(`%${from}%`);
    countParams.push(`%${from}%`);
  }

  if (after) {
    const afterMs = Number(after);
    if (!isNaN(afterMs)) {
      conditions.push("p.created_ms >= ?");
      countConditions.push("p.created_ms >= ?");
      queryParams.push(afterMs);
      countParams.push(afterMs);
    }
  }

  if (before) {
    const beforeMs = Number(before);
    if (!isNaN(beforeMs)) {
      conditions.push("p.created_ms < ?");
      countConditions.push("p.created_ms < ?");
      queryParams.push(beforeMs);
      countParams.push(beforeMs);
    }
  }

  if (q) {
    // Use FTS5 for text search - escape special FTS characters and use prefix matching
    const escaped = q.replace(/["""]/g, '""');
    conditions.push("p.id IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?)");
    countConditions.push("p.id IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?)");
    const ftsQuery = `"${escaped}"`;
    queryParams.push(ftsQuery);
    countParams.push(ftsQuery);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countWhereClause = countConditions.length > 0 ? `WHERE ${countConditions.join(" AND ")}` : "";

  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM posts p ${countWhereClause}`)
    .get(...countParams) as { count: number };

  queryParams.push(limit, offset);

  const rows = db
    .prepare(`SELECT p.* FROM posts p ${whereClause} ORDER BY p.rowid LIMIT ? OFFSET ?`)
    .all(...queryParams) as PostRow[];

  return NextResponse.json({
    posts: rows.map(toApiPost),
    total: countRow.count,
    offset,
  });
}
