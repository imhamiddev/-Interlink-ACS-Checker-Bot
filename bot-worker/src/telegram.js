// ── Thin wrappers around the Telegram Bot API ──────────────────────────────

export function apiUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function call(token, method, body) {
  const res = await fetch(apiUrl(token, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(
      `Telegram API error in ${method}:`,
      JSON.stringify(data),
      "payload:",
      JSON.stringify(body),
    );
  }
  return data;
}

export function sendMessage(token, chat_id, text, extra = {}) {
  return call(token, "sendMessage", { chat_id, text, ...extra });
}

export function editMessageText(token, chat_id, message_id, text, extra = {}) {
  return call(token, "editMessageText", {
    chat_id,
    message_id,
    text,
    ...extra,
  });
}

export function editMessageCaption(
  token,
  chat_id,
  message_id,
  caption,
  extra = {},
) {
  return call(token, "editMessageCaption", {
    chat_id,
    message_id,
    caption,
    ...extra,
  });
}

export function answerCallbackQuery(
  token,
  callback_query_id,
  text = "",
  extra = {},
) {
  return call(token, "answerCallbackQuery", {
    callback_query_id,
    text,
    ...extra,
  });
}

export function setMyCommands(token, commands, scope) {
  return call(token, "setMyCommands", { commands, scope });
}

export function replyExtra(message, extra = {}) {
  const thread_id = message.message_thread_id;
  return {
    reply_parameters: {
      message_id: message.message_id,
      allow_sending_without_reply: true,
    },
    ...(thread_id != null ? { message_thread_id: thread_id } : {}),
    ...extra,
  };
}

export async function reportError(token, ownerIds, err, context = "") {
  const errorText =
    `⚠️ <b>Bot Error</b>${context ? ` — <i>${context}</i>` : ""}\n\n` +
    `<code>${String(err?.stack || err).slice(0, 3000)}</code>`;

  for (const id of ownerIds) {
    try {
      await sendMessage(token, id, errorText, { parse_mode: "HTML" });
    } catch {
      console.error("Failed to send error report:", err);
    }
  }
}
