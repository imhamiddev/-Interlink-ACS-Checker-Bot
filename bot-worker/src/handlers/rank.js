import { sendMessage, replyExtra } from "../telegram.js";
import { panelUrl } from "../config.js";
import { isGroupChat } from "../announce.js";

export async function handleRank(env, DB, message) {
  const token = env.BOT_TOKEN;
  const chat_id = message.chat.id;
  const url = panelUrl(env, "/leaderboard");

  let button;
  if (isGroupChat(message)) {
    const botUsername = env.BOT_USERNAME;
    const appShortName = env.BOT_APP_SHORT_NAME;
    if (!botUsername || !appShortName) {
      await sendMessage(
        token,
        chat_id,
        "🏆 <b>Leaderboard</b>\n\nMessage me privately and send /rank there to open it — group links can't be authenticated yet.",
        replyExtra(message, { parse_mode: "HTML" }),
      );
      return;
    }
    button = {
      text: "🏆 Open Leaderboard",
      url: `https://t.me/${botUsername}/${appShortName}`,
    };
  } else {
    button = { text: "🏆 Open Leaderboard", web_app: { url } };
  }

  const keyboard = { inline_keyboard: [[button]] };

  await sendMessage(
    token,
    chat_id,
    "🏆 <b>Leaderboard</b>\n\nTap below to see the full ranking.",
    replyExtra(message, { parse_mode: "HTML", reply_markup: keyboard }),
  );
}
