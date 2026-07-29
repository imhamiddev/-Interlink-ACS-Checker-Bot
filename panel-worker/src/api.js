import { validateInitData } from "./auth.js";
import { isOwner } from "./config.js";
import {
  getLeaderboardPage,
  countUsers,
  getUserRank,
  isBotEnabled,
  setBotEnabled,
  getBotStats,
  resetSyncProgress,
  removeUserByInterlinkId,
} from "./db.js";
import { runOneSyncBatch } from "./sync.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticate(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data") || "";
  const user = await validateInitData(initData, env.BOT_TOKEN);
  return user; // null if invalid/missing
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");
  const DB = env.DB;

  // ── Public (any authenticated Telegram user): leaderboard ────────────────
  if (path === "/leaderboard" && request.method === "GET") {
    const user = await authenticate(request, env);
    if (!user) return json({ error: "unauthorized" }, 401);

    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
    const [page, total, myRank] = await Promise.all([
      getLeaderboardPage(DB, offset),
      countUsers(DB),
      getUserRank(DB, user.id),
    ]);

    return json({ page, total, offset, myRank });
  }

  // ── Everything below requires the caller to be the configured owner ──────
  const user = await authenticate(request, env);
  if (!user || !isOwner(env, user.id)) {
    return json({ error: "unauthorized" }, 401);
  }

  if (path === "/admin/stats" && request.method === "GET") {
    const stats = await getBotStats(DB);
    return json(stats);
  }

  if (path === "/admin/toggle-bot" && request.method === "POST") {
    const current = await isBotEnabled(DB);
    await setBotEnabled(DB, !current);
    return json({ enabled: !current });
  }

  if (path === "/admin/sync/reset" && request.method === "POST") {
    await resetSyncProgress(DB);
    return json({ ok: true });
  }

  if (path === "/admin/sync/run-batch" && request.method === "POST") {
    const progress = await runOneSyncBatch(DB, env);
    return json(progress);
  }

  if (path === "/admin/remove-user" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const interlink_id = String(body.interlink_id || "").trim();
    if (!/^\d+$/.test(interlink_id)) {
      return json({ error: "invalid interlink_id" }, 400);
    }
    const removed = await removeUserByInterlinkId(DB, interlink_id);
    if (!removed) return json({ error: "not found" }, 404);
    return json({ ok: true, removed });
  }

  return json({ error: "not found" }, 404);
}
