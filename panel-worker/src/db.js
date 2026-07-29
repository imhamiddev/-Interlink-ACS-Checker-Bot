// ── D1 query helpers used by the panel API ──────────────────────────────────
// This worker reads/writes the SAME D1 database as the bot worker
// (bind the same database_id in both wrangler.toml files).

const PAGE_SIZE = 25;

// Cursor-paginated leaderboard, ordered by ACS descending, so the whole
// table is never pulled into memory at once — only one page per request.
export async function getLeaderboardPage(DB, offset = 0, limit = PAGE_SIZE) {
  const { results } = await DB.prepare(
    `SELECT telegram_id, username, full_name, acs, interlink_id
     FROM users
     ORDER BY acs DESC, telegram_id ASC
     LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();
  return results || [];
}

export async function countUsers(DB) {
  const row = await DB.prepare("SELECT COUNT(*) as c FROM users").first();
  return row?.c ?? 0;
}

export async function getUserRank(DB, telegram_id) {
  const user = await DB.prepare("SELECT acs FROM users WHERE telegram_id = ?")
    .bind(telegram_id)
    .first();
  if (!user) return null;
  const rankRow = await DB.prepare("SELECT COUNT(*) as r FROM users WHERE acs > ?")
    .bind(user.acs)
    .first();
  return { rank: (rankRow?.r ?? 0) + 1, acs: user.acs };
}

export async function isBotEnabled(DB) {
  const row = await DB.prepare("SELECT value FROM config WHERE key = 'bot_enabled'").first();
  return row?.value === "1";
}

export async function setBotEnabled(DB, enabled) {
  await DB.prepare(
    `INSERT INTO config (key, value) VALUES ('bot_enabled', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind(enabled ? "1" : "0")
    .run();
}

export async function getBotStats(DB) {
  const total = await countUsers(DB);
  const enabled = await isBotEnabled(DB);
  const offsetRow = await DB.prepare("SELECT value FROM config WHERE key = 'sync_offset'").first();
  const accumRow = await DB.prepare("SELECT value FROM config WHERE key = 'sync_accum'").first();
  const offset = parseInt(offsetRow?.value ?? "0", 10);
  const accum = accumRow ? JSON.parse(accumRow.value) : { updated: 0 };
  return { total, enabled, syncOffset: offset, syncUpdated: accum.updated };
}

// ── Manual 10-by-10 sync batch, triggered from the admin panel ─────────────
const SYNC_BATCH_SIZE = 10;

export async function getUsersSyncBatch(DB, offset) {
  const { results } = await DB.prepare(
    "SELECT telegram_id, interlink_id, acs, username, full_name FROM users ORDER BY telegram_id LIMIT ? OFFSET ?",
  )
    .bind(SYNC_BATCH_SIZE, offset)
    .all();
  return results || [];
}

export async function updateUserAcs(DB, telegram_id, acs) {
  await DB.prepare("UPDATE users SET acs = ? WHERE telegram_id = ?").bind(acs, telegram_id).run();
}

export async function getSyncOffset(DB) {
  const row = await DB.prepare("SELECT value FROM config WHERE key = 'sync_offset'").first();
  return parseInt(row?.value ?? "0", 10);
}

export async function setSyncOffset(DB, offset) {
  await DB.prepare(
    `INSERT INTO config (key, value) VALUES ('sync_offset', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind(String(offset))
    .run();
}

export async function bumpSyncAccum(DB, delta) {
  const row = await DB.prepare("SELECT value FROM config WHERE key = 'sync_accum'").first();
  const accum = row ? JSON.parse(row.value) : { updated: 0 };
  accum.updated += delta;
  await DB.prepare(
    `INSERT INTO config (key, value) VALUES ('sync_accum', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind(JSON.stringify(accum))
    .run();
  return accum;
}

export async function resetSyncProgress(DB) {
  await setSyncOffset(DB, 0);
  await DB.prepare(
    `INSERT INTO config (key, value) VALUES ('sync_accum', '{"updated":0}')
     ON CONFLICT(key) DO UPDATE SET value = '{"updated":0}'`,
  ).run();
}

export async function removeUserByInterlinkId(DB, interlink_id) {
  const row = await DB.prepare(
    "SELECT telegram_id, username, full_name FROM users WHERE interlink_id = ?",
  )
    .bind(interlink_id)
    .first();
  if (!row) return null;
  await DB.prepare("DELETE FROM users WHERE interlink_id = ?").bind(interlink_id).run();
  return row;
}
