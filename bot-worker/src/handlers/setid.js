import { sendMessage, replyExtra } from "../telegram.js";
import { fetchInterlinkProfile } from "../interlink.js";
import { getInterlinkOwner, upsertUser } from "../db.js";

function mentionFromRow(row) {
  if (row.username) return `@${row.username}`;
  return `<a href="tg://user?id=${row.telegram_id}">${row.full_name || "another user"}</a>`;
}

export async function handleSetId(env, DB, message) {
  const token = env.BOT_TOKEN;
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;
  const from = message.from;
  const text = (message.text || "").trim();
  const interlink_id = text.split(/\s+/)[1];

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
      `❌ This Interlink ID is already registered by ${mention}.`,
      replyExtra(message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    );
    return;
  }

  const profile = await fetchInterlinkProfile(env, interlink_id);
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
