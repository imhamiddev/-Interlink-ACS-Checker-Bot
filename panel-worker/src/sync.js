import {
  getUsersSyncBatch,
  updateUserAcs,
  getSyncOffset,
  setSyncOffset,
  bumpSyncAccum,
  countUsers,
} from "./db.js";

function interlinkBase(env) {
  return env.INTERLINK_API_BASE || "https://prod.interlinklabs.ai/api/v1";
}

async function fetchInterlinkProfile(env, interlink_id) {
  try {
    const res = await fetch(`${interlinkBase(env)}/ambassador-profile/get-profile/${interlink_id}`);
    const json = await res.json();
    if (json.statusCode === 200 && json.data?.haveProfile) return json.data;
    return null;
  } catch {
    return null;
  }
}

async function checkSingleUser(DB, env, user) {
  const profile = await fetchInterlinkProfile(env, user.interlink_id);
  if (!profile) return null;
  const newAcs = profile.acs ?? 0;
  const oldAcs = user.acs ?? 0;
  if (newAcs > oldAcs) {
    await updateUserAcs(DB, user.telegram_id, newAcs);
    return { user, oldAcs, newAcs };
  }
  return null;
}

async function getAnnouncementTarget(DB) {
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS announcement_target (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      chat_id INTEGER NOT NULL,
      thread_id INTEGER,
      command_thread_id INTEGER
    )`,
  ).run();
  return await DB.prepare(
    "SELECT chat_id, thread_id FROM announcement_target WHERE id = 1",
  ).first();
}

async function notifyUsers(env, updates) {
  const token = env.BOT_TOKEN;
  if (!token || updates.length === 0) return;

  for (const { user, oldAcs, newAcs } of updates) {
    const diff = (newAcs - oldAcs).toFixed(2);
    const total = Number(newAcs).toFixed(2);
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user.telegram_id,
          text: `🎉 <b>Your ACS was updated!</b>\n+${diff} ACS (total: ${total})`,
          parse_mode: "HTML",
        }),
      });
    } catch {
      // Notification failures shouldn't break the sync batch.
    }
  }
}

// Posts one grouped message per batch to the configured announcement topic
// (set via /set_announce in the bot). No-op if it hasn't been configured.
async function announceToGroup(DB, env, updates) {
  const token = env.BOT_TOKEN;
  if (!token || updates.length === 0) return;

  const target = await getAnnouncementTarget(DB);
  if (!target?.chat_id) return;

  const lines = updates.map(({ user, oldAcs, newAcs }) => {
    const diff = (newAcs - oldAcs).toFixed(2);
    const total = Number(newAcs).toFixed(2);
    const name = user.username
      ? `@${user.username}`
      : `<a href="tg://user?id=${user.telegram_id}">${user.full_name || "User"}</a>`;
    return `• ${name} — <b>+${diff} ACS</b> (total: ${total})`;
  });

  const text = `🎉 <b>ACS Updates</b>\n\n${lines.join("\n")}`;
  const extra = { parse_mode: "HTML" };
  if (target.thread_id) extra.message_thread_id = target.thread_id;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: target.chat_id, text, ...extra }),
    });
  } catch {
    // Group announcement failures shouldn't break the sync batch.
  }
}

// Runs exactly one 10-user batch and advances the stored offset.
// Returns progress info for the panel UI to render.
export async function runOneSyncBatch(DB, env) {
  const total = await countUsers(DB);
  if (total === 0) {
    return { done: true, total: 0, checked: 0, updatedThisBatch: 0, totalUpdated: 0 };
  }

  const offset = await getSyncOffset(DB);
  const users = await getUsersSyncBatch(DB, offset);

  if (users.length === 0) {
    // Reached the end — offset resets so the next run starts over.
    await setSyncOffset(DB, 0);
    return { done: true, total, checked: offset, updatedThisBatch: 0, totalUpdated: null };
  }

  const results = await Promise.all(users.map((u) => checkSingleUser(DB, env, u)));
  const updates = results.filter(Boolean);

  await notifyUsers(env, updates);
  await announceToGroup(DB, env, updates);

  const batchEnd = offset + users.length;
  await setSyncOffset(DB, batchEnd >= total ? 0 : batchEnd);
  const accum = await bumpSyncAccum(DB, updates.length);

  return {
    done: batchEnd >= total,
    total,
    checked: batchEnd,
    updatedThisBatch: updates.length,
    totalUpdated: accum.updated,
  };
}
