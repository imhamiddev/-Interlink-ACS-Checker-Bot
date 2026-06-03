const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const OWNER_IDS = [];
const ADMIN_IDS = [];

function isOwner(telegram_id) {
  return OWNER_IDS.includes(telegram_id);
}

function isAdmin(telegram_id) {
  return OWNER_IDS.includes(telegram_id) || ADMIN_IDS.includes(telegram_id);
}

async function sendMessage(token, chat_id, text, extra = {}) {
  return fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, ...extra }),
  });
}

async function sendPhoto(token, chat_id, photo, caption, extra = {}) {
  return fetch(`${TELEGRAM_API(token)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id,
      photo,
      caption,
      parse_mode: "HTML",
      ...extra,
    }),
  });
}

async function deleteMessage(token, chat_id, message_id) {
  return fetch(`${TELEGRAM_API(token)}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, message_id }),
  });
}

async function editMessageText(token, chat_id, message_id, text, extra = {}) {
  return fetch(`${TELEGRAM_API(token)}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, message_id, text, ...extra }),
  });
}
async function editMessageCaption(
  token,
  chat_id,
  message_id,
  caption,
  extra = {},
) {
  return fetch(`${TELEGRAM_API(token)}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, message_id, caption, ...extra }),
  });
}

async function answerCallbackQuery(token, callback_query_id, text = "") {
  return fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id, text }),
  });
}
async function sendMessageDraft(token, chat_id, text, extra = {}) {
  const draftId = Date.now();
  const chunks = buildDraftChunks(text, 4);

  for (const chunk of chunks) {
    await fetch(`${TELEGRAM_API(token)}/sendMessageDraft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, draft_id: draftId, text: chunk }),
    });
    await new Promise((r) => setTimeout(r, 60));
  }

  await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, ...extra }),
  });
}

function buildDraftChunks(text, step) {
  const chunks = [];
  for (let i = step; i < text.length; i += step) {
    chunks.push(text.slice(0, i));
  }
  chunks.push(text);
  return chunks;
}

async function copyMessage(
  token,
  chat_id,
  from_chat_id,
  message_id,
  extra = {},
) {
  return fetch(`${TELEGRAM_API(token)}/copyMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, from_chat_id, message_id, ...extra }),
  });
}

async function reportError(token, err, context = "") {
  const errorText =
    `⚠️ <b>Bot Error</b>${context ? ` — <i>${context}</i>` : ""}\n\n` +
    `<code>${String(err?.stack || err).slice(0, 3000)}</code>\n\n` +
    `<a href="tg://user?id=${OWNER_IDS[0]}">🔔 Owner</a>`;

  for (const id of OWNER_IDS) {
    try {
      await sendMessage(token, id, errorText, { parse_mode: "HTML" });
    } catch {
      console.error("Failed to send error report:", err);
    }
  }
}

function replyExtra(message, extra = {}) {
  return {
    reply_parameters: {
      message_id: message.message_id,
      allow_sending_without_reply: true,
    },
    ...(message.message_thread_id
      ? { message_thread_id: message.message_thread_id }
      : {}),
    ...extra,
  };
}

async function fetchInterlinkProfile(interlink_id, maxAttempts = 1) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(
        `https://prod.interlinklabs.ai/api/v1/ambassador-profile/get-profile/${interlink_id}`,
      );
      const json = await res.json();
      if (json.statusCode === 200 && json.data?.haveProfile) return json.data;
      return null;
    } catch (err) {
      if (attempt === maxAttempts) return null;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return null;
}

async function fetchReferrals(interlink_id) {
  try {
    const res = await fetch(
      `https://prod.interlinklabs.ai/api/v1/acs-history/get-referrals/${interlink_id}`,
    );
    const json = await res.json();
    if (json.statusCode === 200) return json.data;
    return null;
  } catch {
    return null;
  }
}

async function fetchDailyTasks(interlink_id) {
  try {
    const res = await fetch(
      `https://prod.interlinklabs.ai/api/v1/acs-history/daily-task/${interlink_id}`,
    );
    const json = await res.json();
    if (json.statusCode === 200) return json.data;
    return null;
  } catch {
    return null;
  }
}

async function fetchAcsHistory(interlink_id) {
  try {
    const res = await fetch(
      `https://prod.interlinklabs.ai/api/v1/acs-history/get-acs-history/${interlink_id}`,
    );
    const json = await res.json();
    if (json.statusCode === 200) return json.data;
    return null;
  } catch {
    return null;
  }
}

function formatProfile(profile, interlink_id, totalReferrals = null) {
  const tier = profile.userMetadata?.tierNameAmbassador || "Unknown";
  const acs = profile.acs != null ? Number(profile.acs).toFixed(2) : "-";
  const country = profile.country || "-";
  const badgeCount = profile.badges?.length ?? 0;
  const referralLine =
    totalReferrals != null
      ? `👥 <b>Total Referrals:</b> ${totalReferrals}\n`
      : "";

  return (
    `👤 <b>${profile.firstName} ${profile.lastName}</b>\n` +
    `🆔 <b>ID:</b> <code>${interlink_id}</code>\n` +
    `🌍 <b>Country:</b> ${country}\n` +
    `⭐ <b>Level:</b> ${tier}\n` +
    `📊 <b>ACS:</b> ${acs}\n` +
    `🏅 <b>Badges:</b> ${badgeCount}\n` +
    referralLine +
    `\n<blockquote>‼️If you have any issues, contact <a href="https://t.me/imhamiddev">Support</a></blockquote>`
  );
}

function lookupSocialKeyboard(socialLinks) {
  const rows = [];
  for (let i = 0; i < socialLinks.length; i += 2) {
    const row = [];
    for (let j = i; j < Math.min(i + 2, socialLinks.length); j++) {
      const s = socialLinks[j];
      const name = s.social.charAt(0).toUpperCase() + s.social.slice(1);
      row.push({ text: name, url: s.link, style: "primary" });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

function settingsKeyboard(botEnabled = true) {
  return {
    inline_keyboard: [
      [
        {
          text: botEnabled ? "🟢 Bot: ON" : "🔴 Bot: OFF",
          callback_data: "toggle_bot",
          style: botEnabled ? "success" : "danger",
        },
      ],
    ],
  };
}

async function ensureTables(DB) {
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
    `CREATE TABLE IF NOT EXISTS announcement_target (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      chat_id INTEGER NOT NULL,
      thread_id INTEGER,
      command_thread_id INTEGER
    )`,
  ).run();

  try {
    await DB.prepare(
      `ALTER TABLE announcement_target ADD COLUMN command_thread_id INTEGER`,
    ).run();
  } catch {
    // Column already exists — ignore
  }

  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS rate_limit (
      telegram_id INTEGER PRIMARY KEY,
      timestamps TEXT NOT NULL DEFAULT '[]'
    )`,
  ).run();

  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS say_pending (
      telegram_id INTEGER PRIMARY KEY,
      from_chat_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      prompt_message_id INTEGER,
      thread_id INTEGER,
      created_at INTEGER NOT NULL
    )`,
  ).run();

  // ── جدول جدید: ذخیره تاپیک‌های شناخته‌شده گروه ──
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS known_topics (
      thread_id INTEGER PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      name TEXT
    )`,
  ).run();

  // اگه say_pending قبلاً بدون thread_id بوده، ستون رو اضافه کن
  try {
    await DB.prepare(
      `ALTER TABLE say_pending ADD COLUMN thread_id INTEGER`,
    ).run();
  } catch {
    // already exists — ignore
  }
}

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10_000;

async function checkRateLimit(DB, telegram_id) {
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

async function isBotEnabled(DB) {
  const row = await DB.prepare(
    "SELECT value FROM config WHERE key = 'bot_enabled'",
  ).first();
  return row?.value === "1";
}

async function setBotEnabled(DB, enabled) {
  await DB.prepare("UPDATE config SET value = ? WHERE key = 'bot_enabled'")
    .bind(enabled ? "1" : "0")
    .run();
}

async function getAnnouncementTarget(DB) {
  return await DB.prepare(
    "SELECT chat_id, thread_id, command_thread_id FROM announcement_target WHERE id = 1",
  ).first();
}

async function setAnnouncementTarget(DB, chat_id, thread_id) {
  await DB.prepare(
    `INSERT INTO announcement_target (id, chat_id, thread_id)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET chat_id = excluded.chat_id, thread_id = excluded.thread_id`,
  )
    .bind(chat_id, thread_id ?? null)
    .run();
}

async function setCommandTarget(DB, chat_id, command_thread_id) {
  await DB.prepare(
    `INSERT INTO announcement_target (id, chat_id, thread_id, command_thread_id)
     VALUES (1, ?, NULL, ?)
     ON CONFLICT(id) DO UPDATE SET
       chat_id = excluded.chat_id,
       command_thread_id = excluded.command_thread_id`,
  )
    .bind(chat_id, command_thread_id ?? null)
    .run();

  return true;
}

function isCommandAllowed(message, target) {
  if (!target || message.chat.id !== target.chat_id) return false;

  if (target.command_thread_id != null) {
    const msgThread = message.message_thread_id ?? null;
    return (
      msgThread !== null &&
      Number(msgThread) === Number(target.command_thread_id)
    );
  }

  return true;
}

async function getUserByTelegram(DB, telegram_id) {
  return await DB.prepare("SELECT * FROM users WHERE telegram_id = ?")
    .bind(telegram_id)
    .first();
}

async function getInterlinkOwner(DB, interlink_id, exclude_telegram_id = null) {
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

async function upsertUser(
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

async function updateUserAcs(DB, telegram_id, acs) {
  await DB.prepare("UPDATE users SET acs = ? WHERE telegram_id = ?")
    .bind(acs, telegram_id)
    .run();
}

function isGroupChat(message) {
  return message.chat.type === "group" || message.chat.type === "supergroup";
}

function mentionFromRow(row) {
  if (row.username) return `@${row.username}`;
  return `<a href="tg://user?id=${row.telegram_id}">${row.full_name || "another user"}</a>`;
}

const USER_COMMANDS = [
  { command: "setid", description: "Register your Interlink ID" },
  { command: "acs", description: "Look up ACS for an Interlink ID" },
  { command: "top", description: "Show top 10 leaderboard" },
];

const ADMIN_COMMANDS_GROUP = [
  ...USER_COMMANDS,
  { command: "sync", description: "Manually sync ACS for all users (admin)" },
];

const OWNER_COMMANDS_GROUP = [
  ...USER_COMMANDS,
  { command: "stats", description: "Show bot statistics (owner)" },
  {
    command: "removeuser",
    description: "Remove a user by Interlink ID (owner)",
  },
  { command: "sync", description: "Manually sync ACS for all users (owner)" },
];

const OWNER_PRIVATE_COMMANDS = [
  {
    command: "say",
    description: "Send a message to the group topic as the bot",
  },
  { command: "settings", description: "Bot settings" },
  { command: "sync", description: "Manually sync ACS for all users" },
  { command: "stats", description: "Show bot statistics" },
];

const ADMIN_PRIVATE_COMMANDS = [
  { command: "sync", description: "Manually sync ACS for all users" },
];

async function registerBotCommands(token, group_chat_id = null) {
  const base = `${TELEGRAM_API(token)}/setMyCommands`;

  await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: USER_COMMANDS,
      scope: { type: "all_group_chats" },
    }),
  });

  for (const ownerId of OWNER_IDS) {
    await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: OWNER_PRIVATE_COMMANDS,
        scope: { type: "chat", chat_id: ownerId },
      }),
    });
  }

  for (const adminId of ADMIN_IDS) {
    await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: ADMIN_PRIVATE_COMMANDS,
        scope: { type: "chat", chat_id: adminId },
      }),
    });
  }

  if (group_chat_id) {
    for (const ownerId of OWNER_IDS) {
      await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: OWNER_COMMANDS_GROUP,
          scope: {
            type: "chat_member",
            chat_id: group_chat_id,
            user_id: ownerId,
          },
        }),
      });
    }

    for (const adminId of ADMIN_IDS) {
      await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: ADMIN_COMMANDS_GROUP,
          scope: {
            type: "chat_member",
            chat_id: group_chat_id,
            user_id: adminId,
          },
        }),
      });
    }
  }
}

async function ensureCommandsRegistered(token, DB) {
  const target = await getAnnouncementTarget(DB);
  await registerBotCommands(token, target?.chat_id ?? null);
}

async function handleSetup(token, DB, message) {
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  if (!isOwner(telegram_id)) return;

  if (!isGroupChat(message)) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ This command only works inside a group.",
      replyExtra(message),
    );
    return;
  }

  const thread_id = message.message_thread_id ?? null;

  const steps = [
    "⏳ Setting up... [░░░░░░░░░░] 0%",
    "⏳ Setting up... [██░░░░░░░░] 20%",
    "⏳ Setting up... [████░░░░░░] 40%",
    "⏳ Setting up... [██████░░░░] 60%",
    "⏳ Setting up... [████████░░] 80%",
    "⏳ Setting up... [██████████] 100%",
  ];

  const threadExtra = thread_id ? { message_thread_id: thread_id } : {};

  const sentRes = await sendMessage(token, chat_id, steps[0], threadExtra);
  const sentJson = await sentRes.json();
  const progressMsgId = sentJson?.result?.message_id;

  if (!progressMsgId) {
    await setAnnouncementTarget(DB, chat_id, thread_id);
    await sendMessage(
      token,
      chat_id,
      "✅ This topic has been registered as the ACS announcement channel.",
      threadExtra,
    );
    return;
  }

  for (let i = 1; i < steps.length; i++) {
    await new Promise((r) => setTimeout(r, 900));
    await editMessageText(token, chat_id, progressMsgId, steps[i], threadExtra);
  }

  await setAnnouncementTarget(DB, chat_id, thread_id);
  await registerBotCommands(token, chat_id);

  await new Promise((r) => setTimeout(r, 400));
  await editMessageText(
    token,
    chat_id,
    progressMsgId,
    "✅ This topic has been registered as the ACS announcement channel.",
    threadExtra,
  );
}

async function handleSetupMsg(token, DB, message) {
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  if (!isOwner(telegram_id)) return;

  if (!isGroupChat(message)) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ This command only works inside a group.",
      replyExtra(message),
    );
    return;
  }

  const thread_id = message.message_thread_id ?? null;
  const threadExtra = thread_id ? { message_thread_id: thread_id } : {};

  await setCommandTarget(DB, chat_id, thread_id);

  const topicLabel =
    thread_id != null ? `topic #${thread_id}` : "the General topic";

  await sendMessage(
    token,
    chat_id,
    `✅ <b>Command topic registered!</b>\n\nThe bot will now only respond to user commands (<code>/setid</code>, <code>/acs</code>, <code>/top</code>) sent in ${topicLabel}.`,
    { parse_mode: "HTML", ...threadExtra },
  );
}

async function handleSetId(token, DB, message) {
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;
  const from = message.from;
  const text = (message.text || "").trim();
  const parts = text.split(/\s+/);
  const interlink_id = parts[1];

  if (!interlink_id) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ Please provide your Interlink ID.\n\nExample: <code>/setid 12345</code>",
      replyExtra(message, { parse_mode: "HTML" }),
    );
    return;
  }

  if (!/^\d+$/.test(interlink_id)) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ Interlink ID must be numeric only.",
      replyExtra(message),
    );
    return;
  }

  const ownerRow = await getInterlinkOwner(DB, interlink_id, telegram_id);
  if (ownerRow) {
    const mention = mentionFromRow(ownerRow);
    await sendMessage(
      token,
      chat_id,
      `❌ This Interlink ID is already registered by ${mention}.\nIf you have an issue that cannot be resolved, contact <a href="https://t.me/imhamiddev">Support</a>.`,
      replyExtra(message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    );
    return;
  }

  const profile = await fetchInterlinkProfile(interlink_id);
  if (!profile) {
    await sendMessage(
      token,
      chat_id,
      `❌ No profile found for ID <b>${interlink_id}</b>.\n\nPlease try again with a valid Interlink ID.`,
      replyExtra(message, { parse_mode: "HTML" }),
    );
    return;
  }

  const full_name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const currentAcs = profile.acs ?? 0;

  await upsertUser(
    DB,
    telegram_id,
    interlink_id,
    from.username,
    full_name,
    currentAcs,
  );

  await sendMessage(
    token,
    chat_id,
    `✅ Interlink ID <b>${interlink_id}</b> registered for <b>${profile.firstName} ${profile.lastName}</b>.\n📊 Current ACS: <b>${Number(currentAcs).toFixed(2)}</b>`,
    replyExtra(message, { parse_mode: "HTML" }),
  );
}

async function handleAcs(token, DB, message) {
  const chat_id = message.chat.id;
  const text = (message.text || "").trim();
  const parts = text.split(/\s+/);
  const lookup_id = parts[1];

  if (!lookup_id) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ Please provide an Interlink ID.\n\nExample: <code>/acs 12345</code>",
      replyExtra(message, { parse_mode: "HTML" }),
    );
    return;
  }

  if (!/^\d+$/.test(lookup_id)) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ Interlink ID must be numeric only.",
      replyExtra(message),
    );
    return;
  }

  const [profile, referralData] = await Promise.all([
    fetchInterlinkProfile(lookup_id),
    fetchReferrals(lookup_id),
  ]);

  if (!profile) {
    await sendMessage(
      token,
      chat_id,
      `❌ No profile found for ID <b>${lookup_id}</b>.`,
      replyExtra(message, { parse_mode: "HTML" }),
    );
    return;
  }

  const totalReferrals = referralData?.totalReferrals ?? null;
  const caption = formatProfile(profile, lookup_id, totalReferrals);
  const socialLinks = profile.socialLinks || [];

  const rows = [];

  for (let i = 0; i < socialLinks.length; i += 2) {
    const row = [];
    for (let j = i; j < Math.min(i + 2, socialLinks.length); j++) {
      const s = socialLinks[j];
      const name = s.social.charAt(0).toUpperCase() + s.social.slice(1);
      row.push({ text: name, url: s.link, style: "primary" });
    }
    rows.push(row);
  }

  rows.push([
    {
      text: "📋 Daily Tasks",
      callback_data: `tasks_${lookup_id}_${message.from.id}`,
      style: "danger",
    },
    {
      text: "📈 ACS History",
      callback_data: `history_${lookup_id}_${message.from.id}`,
      style: "danger",
    },
  ]);

  const keyboard = { inline_keyboard: rows };
  const extra = replyExtra(message, { reply_markup: keyboard });
  const avatar = profile.avatar;

  if (avatar) {
    await sendPhoto(token, chat_id, avatar, caption, extra);
  } else {
    await sendMessage(token, chat_id, caption, {
      parse_mode: "HTML",
      ...extra,
    });
  }
}

async function handleTop(token, DB, message) {
  const chat_id = message.chat.id;

  const { results } = await DB.prepare(
    `SELECT username, full_name, acs, interlink_id
     FROM users
     ORDER BY acs DESC
     LIMIT 10`,
  ).all();

  if (!results || results.length === 0) {
    await sendMessage(
      token,
      chat_id,
      "📊 No registered users yet.",
      replyExtra(message),
    );
    return;
  }

  const telegram_id = message.from?.id;
  const callerUser = await getUserByTelegram(DB, telegram_id);
  let rankLine = "";
  if (callerUser) {
    const rankRow = await DB.prepare(
      `SELECT COUNT(*) as r FROM users WHERE acs > (SELECT acs FROM users WHERE telegram_id = ?)`,
    )
      .bind(telegram_id)
      .first();
    const totalRow = await DB.prepare(
      `SELECT COUNT(*) as c FROM users`,
    ).first();
    const userRank = (rankRow?.r ?? 0) + 1;
    const totalUsers = totalRow?.c ?? 0;
    rankLine = `<blockquote>🏅 Your rank: #${userRank} of ${totalUsers}</blockquote>\n`;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = results.map((u, i) => {
    const rank = medals[i] ?? `${i + 1}.`;
    const rawName = u.full_name || u.username || `ID ${u.interlink_id}`;
    const shortName = rawName.slice(0, 12);
    const link = u.username
      ? `https://t.me/${u.username}`
      : `tg://user?id=${u.telegram_id}`;
    const name = `<a href="${link}">${shortName}</a>`;
    const acs = Number(u.acs).toFixed(2);
    return `${rank} ${name} — <b>${acs} ACS</b>`;
  });

  const text =
    rankLine +
    `🏆 <b>Top ${results.length} Leaderboard</b>\n\n` +
    lines.join("\n") +
    `\n\n<blockquote>‼️To appear on the leaderboard, set your ID using /setid 000</blockquote>`;

  await sendMessage(
    token,
    chat_id,
    text,
    replyExtra(message, { parse_mode: "HTML", disable_web_page_preview: true }),
  );
}

async function handleStats(token, DB, message) {
  const chat_id = message.chat.id;
  if (!isOwner(message.from.id)) return;

  const total = await DB.prepare("SELECT COUNT(*) as c FROM users").first();
  const botOn = await isBotEnabled(DB);

  const text =
    `📊 <b>Bot Stats</b>\n\n` +
    `👥 <b>Total users:</b> ${total?.c ?? 0}\n` +
    `🤖 <b>Bot status:</b> ${botOn ? "🟢 ON" : "🔴 OFF"}`;

  await sendMessage(
    token,
    chat_id,
    text,
    replyExtra(message, { parse_mode: "HTML" }),
  );
}

async function handleRemoveUser(token, DB, message) {
  const chat_id = message.chat.id;
  if (!isOwner(message.from.id)) return;

  const parts = (message.text || "").trim().split(/\s+/);
  const interlink_id = parts[1];

  if (!interlink_id) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ Please provide an Interlink ID.\n\nExample: <code>/removeuser 12345</code>",
      replyExtra(message, { parse_mode: "HTML" }),
    );
    return;
  }

  const row = await DB.prepare(
    "SELECT telegram_id, username, full_name FROM users WHERE interlink_id = ?",
  )
    .bind(interlink_id)
    .first();

  if (!row) {
    await sendMessage(
      token,
      chat_id,
      `❌ No user found with Interlink ID <b>${interlink_id}</b>.`,
      replyExtra(message, { parse_mode: "HTML" }),
    );
    return;
  }

  await DB.prepare("DELETE FROM users WHERE interlink_id = ?")
    .bind(interlink_id)
    .run();

  const mention = mentionFromRow(row);
  await sendMessage(
    token,
    chat_id,
    `✅ User ${mention} (Interlink ID <b>${interlink_id}</b>) has been removed.`,
    replyExtra(message, { parse_mode: "HTML" }),
  );
}

async function handleSettings(token, DB, message) {
  const chat_id = message.chat.id;
  if (!isOwner(message.from.id)) return;
  if (isGroupChat(message)) return;

  await sendMessage(token, chat_id, "⚙️ <b>Settings</b>", {
    parse_mode: "HTML",
    reply_markup: settingsKeyboard(await isBotEnabled(DB)),
  });
}

// ── handleSay — نمایش لیست تاپیک‌ها برای انتخاب ──────────────────────────────
async function handleSay(token, DB, message) {
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  if (!isOwner(telegram_id)) return;
  if (isGroupChat(message)) return;

  const target = await getAnnouncementTarget(DB);
  if (!target) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ No announcement topic has been set up yet.\n\nFirst use <code>setup-id-gp</code> inside the group to configure it.",
      replyExtra(message, { parse_mode: "HTML" }),
    );
    return;
  }

  // پاک کردن pending قبلی
  await DB.prepare("DELETE FROM say_pending WHERE telegram_id = ?")
    .bind(telegram_id)
    .run();

  // ذخیره یک ردیف اولیه
  await DB.prepare(
    `INSERT INTO say_pending (telegram_id, from_chat_id, message_id, prompt_message_id, thread_id, created_at)
     VALUES (?, 0, 0, NULL, NULL, ?)`,
  )
    .bind(telegram_id, Date.now())
    .run();

  // گرفتن لیست تاپیک‌های ذخیره‌شده این گروه
  const { results: topics } = await DB.prepare(
    "SELECT thread_id, name FROM known_topics WHERE chat_id = ? ORDER BY name ASC",
  )
    .bind(target.chat_id)
    .all();

  if (!topics || topics.length === 0) {
    // هیچ تاپیکی هنوز ذخیره نشده — پیام بفرست بدون انتخاب تاپیک
    const sentRes = await sendMessage(
      token,
      chat_id,
      "⚠️ <b>No topics found yet.</b>\n\nTopics are saved automatically when the bot receives a message in them. Send a message in each topic first.\n\n✍️ <b>Send your message now</b> — it will be sent to the default topic.",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "❌ Cancel",
                callback_data: "say_cancel",
                style: "danger",
              },
            ],
          ],
        },
      },
    );
    const sentJson = await sentRes.json();
    const promptMsgId = sentJson?.result?.message_id;

    await DB.prepare(
      "UPDATE say_pending SET prompt_message_id = ?, thread_id = ? WHERE telegram_id = ?",
    )
      .bind(promptMsgId ?? null, target.thread_id ?? null, telegram_id)
      .run();

    return;
  }

  // ساختن keyboard با دکمه برای هر تاپیک (۲ تا در هر ردیف)
  const topicRows = [];
  for (let i = 0; i < topics.length; i += 2) {
    const row = [];
    for (let j = i; j < Math.min(i + 2, topics.length); j++) {
      const t = topics[j];
      row.push({
        text: t.name ?? `Topic #${t.thread_id}`,
        callback_data: `say_pick_${t.thread_id}`,
        style: "primary",
      });
    }
    topicRows.push(row);
  }
  topicRows.push([
    { text: "❌ Cancel", callback_data: "say_cancel", style: "danger" },
  ]);

  await sendMessage(
    token,
    chat_id,
    "📨 <b>Choose the topic to send your message to:</b>",
    {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: topicRows },
    },
  );
}

// ── handleSayAwaitingMessage ──────────────────────────────────────────────────
async function handleSayAwaitingMessage(token, DB, message) {
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  const pending = await DB.prepare(
    "SELECT * FROM say_pending WHERE telegram_id = ?",
  )
    .bind(telegram_id)
    .first();

  if (!pending) return false;
  if (pending.message_id !== 0) return false;
  // اگه هنوز thread_id انتخاب نشده (منتظر کلیک روی تاپیکه) رو نادیده بگیر
  if (pending.prompt_message_id === null && pending.thread_id === null)
    return false;

  if (pending.prompt_message_id) {
    await deleteMessage(token, chat_id, pending.prompt_message_id);
  }

  await DB.prepare(
    `UPDATE say_pending SET from_chat_id = ?, message_id = ?, created_at = ?
     WHERE telegram_id = ?`,
  )
    .bind(chat_id, message.message_id, Date.now(), telegram_id)
    .run();

  const confirmRes = await sendMessage(
    token,
    chat_id,
    "👆 <b>Preview of your message above.</b>\n\nSend this to the selected topic?",
    {
      parse_mode: "HTML",
      reply_parameters: {
        message_id: message.message_id,
        allow_sending_without_reply: true,
      },
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Send", callback_data: "say_confirm", style: "success" },
            { text: "❌ Cancel", callback_data: "say_cancel", style: "danger" },
          ],
        ],
      },
    },
  );
  const confirmJson = await confirmRes.json();
  const confirmMsgId = confirmJson?.result?.message_id;

  await DB.prepare(
    "UPDATE say_pending SET prompt_message_id = ? WHERE telegram_id = ?",
  )
    .bind(confirmMsgId ?? null, telegram_id)
    .run();

  return true;
}

// ── Sync helpers ──────────────────────────────────────────────────────────────

const SYNC_BATCH_SIZE = 10;

async function checkSingleUser(DB, user) {
  try {
    const profile = await fetchInterlinkProfile(user.interlink_id);
    if (!profile) return null;

    const newAcs = profile.acs ?? 0;
    const oldAcs = user.acs ?? 0;

    if (newAcs > oldAcs) {
      await updateUserAcs(DB, user.telegram_id, newAcs);
      return { user, oldAcs, newAcs };
    }
    return null;
  } catch (err) {
    console.error(`Failed ACS check for ${user.telegram_id}:`, err);
    return null;
  }
}

async function sendGroupedNotifications(token, target, updates) {
  if (!target || updates.length === 0) return;

  const GROUP_SIZE = 10;
  const extra = {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Any issues?",
            url: "https://t.me/imhamiddev",
            style: "success",
          },
        ],
      ],
    },
    ...(target.thread_id ? { message_thread_id: target.thread_id } : {}),
  };

  for (let i = 0; i < updates.length; i += GROUP_SIZE) {
    const group = updates.slice(i, i + GROUP_SIZE);

    const lines = group.map(({ user, oldAcs, newAcs }) => {
      const diff = (newAcs - oldAcs).toFixed(2);
      const total = Number(newAcs).toFixed(2);
      const name = user.username
        ? `@${user.username}`
        : `<a href="tg://user?id=${user.telegram_id}">${user.full_name || "User"}</a>`;
      return `• ${name} — <b>+${diff} ACS</b> (total: ${total})`;
    });

    const text =
      `🎉 <b>ACS Updates</b>\n\n` +
      lines.join("\n") +
      `\n\n<blockquote>To get notified when your ACS is updated, set your ID using <code>/setid 000</code></blockquote>`;

    await sendMessage(token, target.chat_id, text, extra);

    if (i + GROUP_SIZE < updates.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function runSyncBatch(token, DB, chat_id, total, editMsgId) {
  const offsetRow = await DB.prepare(
    "SELECT value FROM config WHERE key = 'sync_offset'",
  ).first();
  const offset = parseInt(offsetRow?.value ?? "0", 10);

  const { results: users } = await DB.prepare(
    "SELECT telegram_id, interlink_id, acs, notifications, username, full_name FROM users LIMIT ? OFFSET ?",
  )
    .bind(SYNC_BATCH_SIZE, offset)
    .all();

  if (!users || users.length === 0) {
    const accumRow = await DB.prepare(
      "SELECT value FROM config WHERE key = 'sync_accum'",
    ).first();
    const accum = accumRow ? JSON.parse(accumRow.value) : { updated: 0 };

    const finalText =
      `✅ <b>Sync complete!</b>\n` +
      `👥 Users checked: ${total}\n` +
      `🎉 Total ACS updates: ${accum.updated}`;

    await DB.prepare(
      "INSERT INTO config (key, value) VALUES ('sync_accum', '{\"updated\":0}') ON CONFLICT(key) DO UPDATE SET value = '{\"updated\":0}'",
    ).run();

    if (editMsgId) {
      await editMessageText(token, chat_id, editMsgId, finalText, {
        parse_mode: "HTML",
      });
    } else {
      await sendMessage(token, chat_id, finalText, { parse_mode: "HTML" });
    }
    return;
  }

  const batchEnd = offset + users.length;
  const isLastBatch = batchEnd >= total;

  const results = await Promise.all(users.map((u) => checkSingleUser(DB, u)));
  const updates = results.filter(Boolean);

  const accumRow = await DB.prepare(
    "SELECT value FROM config WHERE key = 'sync_accum'",
  ).first();
  const prevAccum = accumRow ? JSON.parse(accumRow.value) : { updated: 0 };
  const newAccum = { updated: prevAccum.updated + updates.length };

  await DB.prepare(
    "INSERT INTO config (key, value) VALUES ('sync_accum', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(JSON.stringify(newAccum))
    .run();

  await DB.prepare(
    "INSERT INTO config (key, value) VALUES ('sync_offset', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(String(batchEnd))
    .run();

  if (updates.length > 0) {
    const target = await getAnnouncementTarget(DB);
    await sendGroupedNotifications(token, target, updates);
  }

  if (isLastBatch) {
    const finalText =
      `✅ <b>Sync complete!</b>\n` +
      `👥 Users checked: ${total}\n` +
      `🎉 Total ACS updates: ${newAccum.updated}`;

    await DB.prepare(
      "INSERT INTO config (key, value) VALUES ('sync_accum', '{\"updated\":0}') ON CONFLICT(key) DO UPDATE SET value = '{\"updated\":0}'",
    ).run();

    if (editMsgId) {
      await editMessageText(token, chat_id, editMsgId, finalText, {
        parse_mode: "HTML",
      });
    } else {
      await sendMessage(token, chat_id, finalText, { parse_mode: "HTML" });
    }
  } else {
    const progressText =
      `🔄 <b>Sync in progress...</b>\n` +
      `👥 Checked: ${batchEnd} / ${total}\n` +
      `🎉 Updates found so far: ${newAccum.updated}`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `▶Continue (${batchEnd}/${total})`,
            callback_data: "sync_continue",
            style: "success",
          },
        ],
      ],
    };

    if (editMsgId) {
      await editMessageText(token, chat_id, editMsgId, progressText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } else {
      await sendMessage(token, chat_id, progressText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    }
  }
}

async function handleSync(token, DB, message) {
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  if (!isAdmin(telegram_id)) return;

  const totalRow = await DB.prepare("SELECT COUNT(*) as c FROM users").first();
  const total = totalRow?.c ?? 0;

  if (total === 0) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ No registered users to sync.",
      replyExtra(message),
    );
    return;
  }

  await DB.prepare(
    "INSERT INTO config (key, value) VALUES ('sync_offset', '0') ON CONFLICT(key) DO UPDATE SET value = '0'",
  ).run();
  await DB.prepare(
    "INSERT INTO config (key, value) VALUES ('sync_accum', '{\"updated\":0}') ON CONFLICT(key) DO UPDATE SET value = '{\"updated\":0}'",
  ).run();

  await runSyncBatch(token, DB, chat_id, total, null);
}

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallbackQuery(token, DB, callback_query) {
  const chat_id = callback_query.message.chat.id;
  const message_id = callback_query.message.message_id;
  const telegram_id = callback_query.from.id;
  const data = callback_query.data;

  if (data === "sync_continue") {
    if (!isAdmin(telegram_id)) return;

    const totalRow = await DB.prepare(
      "SELECT COUNT(*) as c FROM users",
    ).first();
    const total = totalRow?.c ?? 0;

    await runSyncBatch(token, DB, chat_id, total, message_id);
    return;
  }

  if (data === "toggle_bot") {
    if (!isOwner(telegram_id)) return;
    const current = await isBotEnabled(DB);
    await setBotEnabled(DB, !current);
    const nowEnabled = !current;
    await editMessageText(token, chat_id, message_id, "⚙️ <b>Settings</b>", {
      parse_mode: "HTML",
      reply_markup: settingsKeyboard(nowEnabled),
    });
    await answerCallbackQuery(
      token,
      callback_query.id,
      nowEnabled ? "✅ Bot is now ON" : "🔴 Bot is now OFF",
    );
    return;
  }

  // ── جدید: انتخاب تاپیک برای say ──
  if (data.startsWith("say_pick_")) {
    if (!isOwner(telegram_id)) return;

    const thread_id = Number(data.replace("say_pick_", ""));

    const pending = await DB.prepare(
      "SELECT * FROM say_pending WHERE telegram_id = ?",
    )
      .bind(telegram_id)
      .first();

    if (!pending) {
      await answerCallbackQuery(
        token,
        callback_query.id,
        "⚠️ Session expired. Use /say again.",
      );
      return;
    }

    // ذخیره thread_id انتخاب‌شده
    await DB.prepare(
      "UPDATE say_pending SET thread_id = ? WHERE telegram_id = ?",
    )
      .bind(thread_id, telegram_id)
      .run();

    // پیدا کردن اسم تاپیک
    const topicRow = await DB.prepare(
      "SELECT name FROM known_topics WHERE thread_id = ?",
    )
      .bind(thread_id)
      .first();
    const topicName = topicRow?.name ?? `Topic #${thread_id}`;

    await editMessageText(
      token,
      chat_id,
      message_id,
      `✅ Topic selected: <b>${topicName}</b>\n\n✍️ <b>Now send your message.</b>\n\nYou can use bold, italic, quotes — any formatting. I'll send it exactly as-is.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "❌ Cancel",
                callback_data: "say_cancel",
                style: "danger",
              },
            ],
          ],
        },
      },
    );

    // ذخیره message_id پرامپت برای حذف بعداً
    await DB.prepare(
      "UPDATE say_pending SET prompt_message_id = ? WHERE telegram_id = ?",
    )
      .bind(message_id, telegram_id)
      .run();

    await answerCallbackQuery(token, callback_query.id);
    return;
  }

  if (data === "say_cancel") {
    if (!isOwner(telegram_id)) return;

    await DB.prepare("DELETE FROM say_pending WHERE telegram_id = ?")
      .bind(telegram_id)
      .run();

    await editMessageText(
      token,
      chat_id,
      message_id,
      "❌ <b>Cancelled.</b> Message was not sent.",
      { parse_mode: "HTML" },
    );
    return;
  }

  if (data === "say_confirm") {
    if (!isOwner(telegram_id)) return;

    const pending = await DB.prepare(
      "SELECT * FROM say_pending WHERE telegram_id = ?",
    )
      .bind(telegram_id)
      .first();

    if (!pending || pending.message_id === 0) {
      await editMessageText(
        token,
        chat_id,
        message_id,
        "⚠️ No pending message found. Please start over with /say.",
        {},
      );
      return;
    }

    const target = await getAnnouncementTarget(DB);
    if (!target) {
      await editMessageText(
        token,
        chat_id,
        message_id,
        "⚠️ Announcement target not configured.",
        {},
      );
      await DB.prepare("DELETE FROM say_pending WHERE telegram_id = ?")
        .bind(telegram_id)
        .run();
      return;
    }

    const copyExtra = {};
    // استفاده از thread_id انتخاب‌شده توسط کاربر
    const chosenThread = pending.thread_id ?? target.thread_id ?? null;
    if (chosenThread) {
      copyExtra.message_thread_id = chosenThread;
    }

    const copyRes = await copyMessage(
      token,
      target.chat_id,
      pending.from_chat_id,
      pending.message_id,
      copyExtra,
    );
    const copyJson = await copyRes.json();

    await DB.prepare("DELETE FROM say_pending WHERE telegram_id = ?")
      .bind(telegram_id)
      .run();

    if (copyJson.ok) {
      await editMessageText(
        token,
        chat_id,
        message_id,
        "✅ <b>Message sent to the selected topic!</b>",
        { parse_mode: "HTML" },
      );
    } else {
      await editMessageText(
        token,
        chat_id,
        message_id,
        `❌ <b>Failed to send.</b>\n<code>${JSON.stringify(copyJson.description || copyJson)}</code>`,
        { parse_mode: "HTML" },
      );
    }
    return;
  }

  if (data.startsWith("tasks_")) {
    const parts = data.split("_");
    const lookup_id = parts[1];
    const owner_id = Number(parts[2]);

    if (telegram_id !== owner_id) {
      await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callback_query.id,
          text: "❌ This button is not for you!",
          show_alert: true,
        }),
      });
      return;
    }
    await answerCallbackQuery(token, callback_query.id);
    const taskData = await fetchDailyTasks(lookup_id);

    if (!taskData?.tasks || taskData.tasks.length === 0) {
      if (callback_query.message.photo) {
        await editMessageCaption(
          token,
          chat_id,
          message_id,
          "❌ No daily tasks found for this ID.",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔙 Back",
                    callback_data: `back_${lookup_id}_${owner_id}`,
                    style: "danger",
                  },
                ],
              ],
            },
          },
        );
      } else {
        await editMessageText(
          token,
          chat_id,
          message_id,
          "❌ No daily tasks found for this ID.",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔙 Back",
                    callback_data: `back_${lookup_id}_${owner_id}`,
                    style: "danger",
                  },
                ],
              ],
            },
          },
        );
      }
      return;
    }

    const tasks = taskData.tasks.slice(0, 10);
    const lines = tasks.map(
      (t, i) =>
        `${i + 1}. 📌 <b>Task ${t.name}</b> — Score: <b>${t.score}</b> | Top: <b>${t.top}</b>`,
    );

    const newText =
      `📋 <b>Last 10 Daily Tasks</b> (ID: <code>${lookup_id}</code>)\n\n` +
      lines.join("\n");

    const backKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔙 Back",
            callback_data: `back_${lookup_id}_${owner_id}`,
            style: "danger",
          },
        ],
      ],
    };

    if (callback_query.message.photo) {
      await editMessageCaption(token, chat_id, message_id, newText, {
        parse_mode: "HTML",
        reply_markup: backKeyboard,
      });
    } else {
      await editMessageText(token, chat_id, message_id, newText, {
        parse_mode: "HTML",
        reply_markup: backKeyboard,
      });
    }
    return;
  }

  if (data.startsWith("history_")) {
    const parts = data.split("_");
    const lookup_id = parts[1];
    const owner_id = Number(parts[2]);

    if (telegram_id !== owner_id) {
      await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callback_query.id,
          text: "❌ This button is not for you!",
          show_alert: true,
        }),
      });
      return;
    }
    await answerCallbackQuery(token, callback_query.id);
    const histData = await fetchAcsHistory(lookup_id);

    if (!histData?.histories || histData.histories.length === 0) {
      const noHistText = "❌ No ACS history found for this ID.";
      const backKb = {
        inline_keyboard: [
          [
            {
              text: "🔙 Back",
              callback_data: `back_${lookup_id}_${owner_id}`,
              style: "danger",
            },
          ],
        ],
      };
      if (callback_query.message.photo) {
        await editMessageCaption(token, chat_id, message_id, noHistText, {
          reply_markup: backKb,
        });
      } else {
        await editMessageText(token, chat_id, message_id, noHistText, {
          reply_markup: backKb,
        });
      }
      return;
    }

    const histories = histData.histories.slice(0, 10);
    const reasonEmoji = (r) => (r === "bonus" ? "🎁" : "✅");
    const lines = histories.map((h) => {
      const date = new Date(h.createdAt).toUTCString().replace(" GMT", " UTC");
      const reason = h.reason === "bonus" ? "Bonus" : "Daily Task";
      return (
        `${reasonEmoji(h.reason)} <b>${reason}</b> — <b>+${Number(h.acs).toFixed(2)} ACS</b>\n` +
        `   📅 ${date}`
      );
    });

    const newText =
      `📈 <b>Recent ACS History</b> (ID: <code>${lookup_id}</code>)\n\n` +
      lines.join("\n\n");

    const backKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔙 Back",
            callback_data: `back_${lookup_id}_${owner_id}`,
            style: "danger",
          },
        ],
      ],
    };

    if (callback_query.message.photo) {
      await editMessageCaption(token, chat_id, message_id, newText, {
        parse_mode: "HTML",
        reply_markup: backKeyboard,
      });
    } else {
      await editMessageText(token, chat_id, message_id, newText, {
        parse_mode: "HTML",
        reply_markup: backKeyboard,
      });
    }
    return;
  }

  if (data.startsWith("back_")) {
    const parts = data.split("_");
    const lookup_id = parts[1];
    const owner_id = Number(parts[2]);

    if (telegram_id !== owner_id) {
      await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callback_query.id,
          text: "❌ This button is not for you!",
          show_alert: true,
        }),
      });
      return;
    }
    await answerCallbackQuery(token, callback_query.id);
    const [profile, referralData] = await Promise.all([
      fetchInterlinkProfile(lookup_id),
      fetchReferrals(lookup_id),
    ]);

    if (!profile) return;

    const totalReferrals = referralData?.totalReferrals ?? null;
    const caption = formatProfile(profile, lookup_id, totalReferrals);
    const socialLinks = profile.socialLinks || [];

    const rows = [];
    for (let i = 0; i < socialLinks.length; i += 2) {
      const row = [];
      for (let j = i; j < Math.min(i + 2, socialLinks.length); j++) {
        const s = socialLinks[j];
        const name = s.social.charAt(0).toUpperCase() + s.social.slice(1);
        row.push({ text: name, url: s.link, style: "primary" });
      }
      rows.push(row);
    }
    rows.push([
      {
        text: "📋 Daily Tasks",
        callback_data: `tasks_${lookup_id}_${telegram_id}`,
        style: "danger",
      },
      {
        text: "📈 ACS History",
        callback_data: `history_${lookup_id}_${telegram_id}`,
        style: "danger",
      },
    ]);

    const keyboard = { inline_keyboard: rows };

    if (callback_query.message.photo) {
      await editMessageCaption(token, chat_id, message_id, caption, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } else {
      await editMessageText(token, chat_id, message_id, caption, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    }
    return;
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

async function handleMessage(token, DB, message) {
  const telegram_id = message.from?.id;
  const text = (message.text || "").trim();
  const textLower = text.toLowerCase();
  const inGroup = isGroupChat(message);
  const _isOwner = isOwner(telegram_id);
  const _isAdmin = isAdmin(telegram_id);

  // ── ذخیره تاپیک وقتی ربات پیامی از داخل تاپیک گروه دریافت می‌کنه ──
  if (inGroup && message.message_thread_id) {
    const topicName =
      message.reply_to_message?.forum_topic_created?.name ??
      message.forum_topic_created?.name ??
      null;
    try {
      await DB.prepare(
        `INSERT INTO known_topics (thread_id, chat_id, name)
         VALUES (?, ?, ?)
         ON CONFLICT(thread_id) DO UPDATE SET
           name = COALESCE(excluded.name, known_topics.name)`,
      )
        .bind(message.message_thread_id, message.chat.id, topicName)
        .run();
    } catch {
      // ignore
    }
  }

  if (!inGroup) {
    if (!_isAdmin) {
      await sendMessageDraft(
        token,
        message.chat.id,
        "🤖 This bot only works in the Interlink Coach House group. Please send your commands there.",
      );
      return;
    }

    if (_isOwner) {
      if (textLower === "/say" || textLower.startsWith("/say@")) {
        await handleSay(token, DB, message);
        return;
      }
      if (textLower === "/settings" || textLower.startsWith("/settings@")) {
        await handleSettings(token, DB, message);
        return;
      }
      if (textLower.startsWith("/sync")) {
        await handleSync(token, DB, message);
        return;
      }
      if (textLower.startsWith("/stats")) {
        await handleStats(token, DB, message);
        return;
      }

      const handledBySay = await handleSayAwaitingMessage(token, DB, message);
      if (handledBySay) return;
    } else if (_isAdmin) {
      if (textLower.startsWith("/sync")) {
        await handleSync(token, DB, message);
        return;
      }
    }
    return;
  }

  // ── Group message handling ────────────────────────────────────────────────

  if (textLower === "setup-id-gp" && _isOwner) {
    await handleSetup(token, DB, message);
    return;
  }

  if (textLower === "setup-msg-gp" && _isOwner) {
    await handleSetupMsg(token, DB, message);
    return;
  }

  const target = await getAnnouncementTarget(DB);

  if (!target || message.chat.id !== target.chat_id) return;

  if (_isOwner) {
    if (textLower.startsWith("/settings")) {
      await handleSettings(token, DB, message);
      return;
    }
    if (textLower.startsWith("/stats")) {
      await handleStats(token, DB, message);
      return;
    }
    if (textLower.startsWith("/removeuser")) {
      await handleRemoveUser(token, DB, message);
      return;
    }
  }

  if (_isAdmin) {
    if (textLower.startsWith("/sync")) {
      await handleSync(token, DB, message);
      return;
    }
  }

  const isUserCommand =
    textLower.startsWith("/acs") ||
    textLower.startsWith("/setid") ||
    textLower.startsWith("/top");

  if (isUserCommand) {
    if (!isCommandAllowed(message, target)) return;

    if (!_isAdmin) {
      const allowed = await checkRateLimit(DB, telegram_id);
      if (!allowed) {
        await sendMessage(
          token,
          message.chat.id,
          "⏳ You're sending commands too fast. Please wait a few seconds.",
          replyExtra(message),
        );
        return;
      }
    }

    if (textLower.startsWith("/acs")) {
      await handleAcs(token, DB, message);
    } else if (textLower.startsWith("/setid")) {
      await handleSetId(token, DB, message);
    } else if (textLower.startsWith("/top")) {
      await handleTop(token, DB, message);
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    let update;
    try {
      update = await request.json();
    } catch (err) {
      await reportError(env.BOT_TOKEN, err, "JSON parse failed");
      return new Response("Bad Request", { status: 400 });
    }

    const token = env.BOT_TOKEN;
    const DB = env.DB;

    try {
      await ensureTables(DB);
    } catch (err) {
      await reportError(token, err, "ensureTables");
      return new Response("OK");
    }

    try {
      await ensureCommandsRegistered(token, DB);
    } catch (err) {
      console.error("Failed to register commands:", err);
    }

    try {
      const botEnabled = await isBotEnabled(DB);

      if (!botEnabled) {
        const isOwnerSettingsMsg =
          isOwner(update.message?.from?.id) &&
          (update.message?.text?.trim() === "/settings" ||
            update.message?.text?.trim().startsWith("/settings@"));
        const isOwnerToggleCb =
          isOwner(update.callback_query?.from?.id) &&
          update.callback_query?.data === "toggle_bot";

        if (isOwnerSettingsMsg) {
          await handleMessage(token, DB, update.message);
        } else if (isOwnerToggleCb) {
          await handleCallbackQuery(token, DB, update.callback_query);
        }
        return new Response("OK");
      }

      if (update.message) {
        await handleMessage(token, DB, update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(token, DB, update.callback_query);
      }
    } catch (err) {
      console.error("Error handling update:", err);
      await reportError(token, err, "handleUpdate");
    }

    return new Response("OK");
  },

  async scheduled(event, env, ctx) {
    const token = env.BOT_TOKEN;
    const DB = env.DB;
    try {
      await ensureTables(DB);
    } catch (err) {
      await reportError(token, err, "scheduled ACS check");
    }
  },
};
