import {
  editMessageText,
  editMessageCaption,
  answerCallbackQuery,
} from "./telegram.js";
import {
  fetchDailyTasks,
  fetchAcsHistory,
  fetchInterlinkProfile,
  fetchReferrals,
  formatProfile,
} from "./interlink.js";

function backKeyboard(lookup_id, owner_id) {
  return {
    inline_keyboard: [
      [{ text: "🔙 Back", callback_data: `back_${lookup_id}_${owner_id}` }],
    ],
  };
}

async function guardOwnerButton(token, callback_query, owner_id) {
  if (callback_query.from.id !== owner_id) {
    await answerCallbackQuery(
      token,
      callback_query.id,
      "❌ This button is not for you!",
      {
        show_alert: true,
      },
    );
    return false;
  }
  return true;
}

async function renderProfileCard(
  env,
  chat_id,
  message_id,
  isPhoto,
  lookup_id,
  telegram_id,
) {
  const token = env.BOT_TOKEN;
  const [profile, referralData] = await Promise.all([
    fetchInterlinkProfile(env, lookup_id),
    fetchReferrals(env, lookup_id),
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
      row.push({ text: name, url: s.link });
    }
    rows.push(row);
  }
  rows.push([
    {
      text: "📋 Daily Tasks",
      callback_data: `tasks_${lookup_id}_${telegram_id}`,
    },
    {
      text: "📈 ACS History",
      callback_data: `history_${lookup_id}_${telegram_id}`,
    },
  ]);
  const keyboard = { inline_keyboard: rows };

  if (isPhoto) {
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
}

export async function handleCallbackQuery(env, DB, callback_query) {
  const token = env.BOT_TOKEN;
  const chat_id = callback_query.message.chat.id;
  const message_id = callback_query.message.message_id;
  const data = callback_query.data;
  const isPhoto = !!callback_query.message.photo;

  if (data.startsWith("tasks_")) {
    const [, lookup_id, ownerIdStr] = data.split("_");
    const owner_id = Number(ownerIdStr);
    if (!(await guardOwnerButton(token, callback_query, owner_id))) return;
    await answerCallbackQuery(token, callback_query.id);

    const taskData = await fetchDailyTasks(env, lookup_id);
    const kb = backKeyboard(lookup_id, owner_id);

    if (!taskData?.tasks || taskData.tasks.length === 0) {
      const noneText = "❌ No daily tasks found for this ID.";
      isPhoto
        ? await editMessageCaption(token, chat_id, message_id, noneText, {
            reply_markup: kb,
          })
        : await editMessageText(token, chat_id, message_id, noneText, {
            reply_markup: kb,
          });
      return;
    }

    const tasks = taskData.tasks.slice(0, 10);
    const lines = tasks.map(
      (t, i) =>
        `${i + 1}. 📌 <b>Task ${t.name}</b> — Score: <b>${t.score}</b> | Top: <b>${t.top}</b>`,
    );
    const newText = `📋 <b>Last 10 Daily Tasks</b> (ID: <code>${lookup_id}</code>)\n\n${lines.join("\n")}`;

    isPhoto
      ? await editMessageCaption(token, chat_id, message_id, newText, {
          parse_mode: "HTML",
          reply_markup: kb,
        })
      : await editMessageText(token, chat_id, message_id, newText, {
          parse_mode: "HTML",
          reply_markup: kb,
        });
    return;
  }

  if (data.startsWith("history_")) {
    const [, lookup_id, ownerIdStr] = data.split("_");
    const owner_id = Number(ownerIdStr);
    if (!(await guardOwnerButton(token, callback_query, owner_id))) return;
    await answerCallbackQuery(token, callback_query.id);

    const histData = await fetchAcsHistory(env, lookup_id);
    const kb = backKeyboard(lookup_id, owner_id);

    if (!histData?.histories || histData.histories.length === 0) {
      const noneText = "❌ No ACS history found for this ID.";
      isPhoto
        ? await editMessageCaption(token, chat_id, message_id, noneText, {
            reply_markup: kb,
          })
        : await editMessageText(token, chat_id, message_id, noneText, {
            reply_markup: kb,
          });
      return;
    }

    const histories = histData.histories.slice(0, 10);
    const reasonEmoji = (r) => (r === "bonus" ? "🎁" : "✅");
    const lines = histories.map((h) => {
      const date = new Date(h.createdAt).toUTCString().replace(" GMT", " UTC");
      const reason = h.reason === "bonus" ? "Bonus" : "Daily Task";
      return `${reasonEmoji(h.reason)} <b>${reason}</b> — <b>+${Number(h.acs).toFixed(2)} ACS</b>\n   📅 ${date}`;
    });
    const newText = `📈 <b>Recent ACS History</b> (ID: <code>${lookup_id}</code>)\n\n${lines.join("\n\n")}`;

    isPhoto
      ? await editMessageCaption(token, chat_id, message_id, newText, {
          parse_mode: "HTML",
          reply_markup: kb,
        })
      : await editMessageText(token, chat_id, message_id, newText, {
          parse_mode: "HTML",
          reply_markup: kb,
        });
    return;
  }

  if (data.startsWith("back_")) {
    const [, lookup_id, ownerIdStr] = data.split("_");
    const owner_id = Number(ownerIdStr);
    if (!(await guardOwnerButton(token, callback_query, owner_id))) return;
    await answerCallbackQuery(token, callback_query.id);
    await renderProfileCard(
      env,
      chat_id,
      message_id,
      isPhoto,
      lookup_id,
      owner_id,
    );
    return;
  }
}
