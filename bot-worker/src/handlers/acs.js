import { sendMessage, replyExtra, apiUrl } from "../telegram.js";
import {
  fetchInterlinkProfile,
  fetchReferrals,
  formatProfile,
} from "../interlink.js";

async function sendPhoto(token, chat_id, photo, caption, extra = {}) {
  return fetch(apiUrl(token, "sendPhoto"), {
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

export async function handleAcs(env, DB, message) {
  const token = env.BOT_TOKEN;
  const chat_id = message.chat.id;
  const text = (message.text || "").trim();
  const lookup_id = text.split(/\s+/)[1];

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
    fetchInterlinkProfile(env, lookup_id),
    fetchReferrals(env, lookup_id),
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
      row.push({ text: name, url: s.link });
    }
    rows.push(row);
  }

  rows.push([
    {
      text: "📋 Daily Tasks",
      callback_data: `tasks_${lookup_id}_${message.from.id}`,
    },
    {
      text: "📈 ACS History",
      callback_data: `history_${lookup_id}_${message.from.id}`,
    },
  ]);

  const keyboard = { inline_keyboard: rows };
  const avatar = profile.avatar;

  if (avatar) {
    await sendPhoto(
      token,
      chat_id,
      avatar,
      caption,
      replyExtra(message, { reply_markup: keyboard }),
    );
  } else {
    await sendMessage(
      token,
      chat_id,
      caption,
      replyExtra(message, { reply_markup: keyboard, parse_mode: "HTML" }),
    );
  }
}
