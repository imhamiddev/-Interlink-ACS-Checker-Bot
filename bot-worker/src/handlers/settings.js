import { sendMessage } from "../telegram.js";
import { isOwner, panelUrl } from "../config.js";
import { isGroupChat } from "../announce.js";

export async function handleSettings(env, DB, message) {
  const token = env.BOT_TOKEN;
  const chat_id = message.chat.id;
  const telegram_id = message.from.id;

  if (!isOwner(env, telegram_id)) return;

  if (isGroupChat(message)) {
    await sendMessage(
      token,
      chat_id,
      "⚙️ <b>Admin Panel</b>\n\nMessage me privately and send /settings there — this panel can't be opened from a group yet.",
      { parse_mode: "HTML" },
    );
    return;
  }

  const button = {
    text: "🛠 Open Admin Panel",
    web_app: { url: panelUrl(env, "/admin") },
  };

  await sendMessage(
    token,
    chat_id,
    "⚙️ <b>Admin Panel</b>\n\nTap below to manage the bot.",
    {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[button]] },
    },
  );
}
