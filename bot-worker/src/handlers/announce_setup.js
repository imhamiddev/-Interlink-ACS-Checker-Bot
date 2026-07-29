import { sendMessage } from "../telegram.js";
import { isOwner } from "../config.js";
import { setAnnounceTopic, setCommandTopic, isGroupChat } from "../announce.js";

export async function handleSetAnnounce(env, DB, message) {
  const token = env.BOT_TOKEN;
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  if (!isOwner(env, telegram_id)) return;

  if (!isGroupChat(message)) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ This command only works inside a group topic.",
    );
    return;
  }

  const thread_id = message.message_thread_id ?? null;
  await setAnnounceTopic(DB, chat_id, thread_id);

  const label = thread_id != null ? `topic #${thread_id}` : "the General topic";
  const extra = thread_id ? { message_thread_id: thread_id } : {};

  await sendMessage(
    token,
    chat_id,
    `✅ <b>Announcement topic set!</b>\n\nACS update notifications will now be posted in ${label}.`,
    { parse_mode: "HTML", ...extra },
  );
}

export async function handleSetUsage(env, DB, message) {
  const token = env.BOT_TOKEN;
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  if (!isOwner(env, telegram_id)) return;

  if (!isGroupChat(message)) {
    await sendMessage(
      token,
      chat_id,
      "⚠️ This command only works inside a group topic.",
    );
    return;
  }

  const thread_id = message.message_thread_id ?? null;
  await setCommandTopic(DB, chat_id, thread_id);

  const label = thread_id != null ? `topic #${thread_id}` : "the General topic";
  const extra = thread_id ? { message_thread_id: thread_id } : {};

  await sendMessage(
    token,
    chat_id,
    `✅ <b>Command topic set!</b>\n\n/setid, /acs, and /rank will now only work in ${label}.`,
    { parse_mode: "HTML", ...extra },
  );
}
