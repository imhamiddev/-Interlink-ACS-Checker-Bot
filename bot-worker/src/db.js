export async function ensureTables(DB) {
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      interlink_id TEXT UNIQUE,
      username TEXT,
      full_name TEXT,
      acs REAL DEFAULT 0,
      notifications INTEGER DEFAULT 1
    )`,
  ).run();

  // Index to make leaderboard/rank queries and sync pagination cheap.
  await DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_users_acs ON users (acs DESC)`,
  ).run();

  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ).run();

  await DB.prepare(
    `INSERT OR IGNORE INTO config (key, value) VALUES ('bot_enabled', '1')`,
  ).run();

  await DB.prepare(
    `INSERT OR IGNORE INTO config (key, value) VALUES ('commands_registered', '0')`,
  ).run();

  await DB.prepare(
    `INSERT OR IGNORE INTO config (key, value) VALUES ('sync_offset', '0')`,
  ).run();

  await DB.prepare(
    `INSERT OR IGNORE INTO config (key, value) VALUES ('sync_accum', '{"updated":0}')`,
  ).run();

  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS rate_limit (
      telegram_id INTEGER PRIMARY KEY,
      timestamps TEXT NOT NULL DEFAULT '[]'
    )`,
  ).run();
}

// ── config table ─────────────────────────────────────────────────────────
export async function getConfig(DB, key) {
  const row = await DB.prepare("SELECT value FROM config WHERE key = ?")
    .bind(key)
    .first();
  return row?.value ?? null;
}

export async function setConfig(DB, key, value) {
  await DB.prepare(
    `INSERT INTO config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind(key, value)
    .run();
}

export async function isBotEnabled(DB) {
  return (await getConfig(DB, "bot_enabled")) === "1";
}

export async function setBotEnabled(DB, enabled) {
  await setConfig(DB, "bot_enabled", enabled ? "1" : "0");
}

// ── users table ──────────────────────────────────────────────────────────
export async function getUserByTelegram(DB, telegram_id) {
  return await DB.prepare("SELECT * FROM users WHERE telegram_id = ?")
    .bind(telegram_id)
    .first();
}

export async function getInterlinkOwner(
  DB,
  interlink_id,
  exclude_telegram_id = null,
) {
  let row;
  if (exclude_telegram_id) {
    row = await DB.prepare(
      "SELECT telegram_id, username, full_name FROM users WHERE interlink_id = ? AND telegram_id != ?",
    )
      .bind(interlink_id, exclude_telegram_id)
      .first();
  } else {
    row = await DB.prepare(
      "SELECT telegram_id, username, full_name FROM users WHERE interlink_id = ?",
    )
      .bind(interlink_id)
      .first();
  }
  return row ?? null;
}

export async function upsertUser(
  DB,
  telegram_id,
  interlink_id,
  username,
  full_name,
  acs = 0,
) {
  await DB.prepare(
    `INSERT INTO users (telegram_id, interlink_id, username, full_name, acs, notifications)
     VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(telegram_id) DO UPDATE SET
       interlink_id = excluded.interlink_id,
       username = excluded.username,
       full_name = excluded.full_name,
       acs = excluded.acs`,
  )
    .bind(telegram_id, interlink_id, username ?? null, full_name ?? null, acs)
    .run();
}

export async function updateUserAcs(DB, telegram_id, acs) {
  await DB.prepare("UPDATE users SET acs = ? WHERE telegram_id = ?")
    .bind(acs, telegram_id)
    .run();
}

export async function countUsers(DB) {
  const row = await DB.prepare("SELECT COUNT(*) as c FROM users").first();
  return row?.c ?? 0;
}

export async function getUserRank(DB, telegram_id) {
  const user = await getUserByTelegram(DB, telegram_id);
  if (!user) return null;
  const rankRow = await DB.prepare(
    `SELECT COUNT(*) as r FROM users WHERE acs > ?`,
  )
    .bind(user.acs)
    .first();
  const total = await countUsers(DB);
  return { rank: (rankRow?.r ?? 0) + 1, total, acs: user.acs };
}

// Paginated batch fetch for /sync-style ACS refresh, driven from the panel.
export async function getUsersBatch(DB, offset, limit) {
  const { results } = await DB.prepare(
    "SELECT telegram_id, interlink_id, acs, username, full_name FROM users ORDER BY telegram_id LIMIT ? OFFSET ?",
  )
    .bind(limit, offset)
    .all();
  return results || [];
}

// ── rate limiting ────────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10_000;

export async function checkRateLimit(DB, telegram_id) {
  const now = Date.now();
  const row = await DB.prepare(
    "SELECT timestamps FROM rate_limit WHERE telegram_id = ?",
  )
    .bind(telegram_id)
    .first();

  let timestamps = row ? JSON.parse(row.timestamps) : [];
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX) return false;

  timestamps.push(now);
  await DB.prepare(
    `INSERT INTO rate_limit (telegram_id, timestamps) VALUES (?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET timestamps = excluded.timestamps`,
  )
    .bind(telegram_id, JSON.stringify(timestamps))
    .run();

  return true;
}
