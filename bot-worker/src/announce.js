export async function ensureAnnouncementTable(DB) {
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS announcement_target (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      chat_id INTEGER NOT NULL,
      thread_id INTEGER,
      command_thread_id INTEGER
    )`,
  ).run();
}

export async function getAnnouncementTarget(DB) {
  return await DB.prepare(
    "SELECT chat_id, thread_id, command_thread_id FROM announcement_target WHERE id = 1",
  ).first();
}

export async function setAnnounceTopic(DB, chat_id, thread_id) {
  await DB.prepare(
    `INSERT INTO announcement_target (id, chat_id, thread_id)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET chat_id = excluded.chat_id, thread_id = excluded.thread_id`,
  )
    .bind(chat_id, thread_id ?? null)
    .run();
}

export async function setCommandTopic(DB, chat_id, command_thread_id) {
  await DB.prepare(
    `INSERT INTO announcement_target (id, chat_id, thread_id, command_thread_id)
     VALUES (1, ?, NULL, ?)
     ON CONFLICT(id) DO UPDATE SET
       chat_id = excluded.chat_id,
       command_thread_id = excluded.command_thread_id`,
  )
    .bind(chat_id, command_thread_id ?? null)
    .run();
}

export function isCommandAllowed(message, target) {
  if (!target) return true;
  if (message.chat.id !== target.chat_id) return true; // not the configured group at all — let it through (e.g. DMs)
  if (target.command_thread_id == null) return true;

  const msgThread = message.message_thread_id ?? null;
  return (
    msgThread !== null && Number(msgThread) === Number(target.command_thread_id)
  );
}

export function isGroupChat(message) {
  return message.chat.type === "group" || message.chat.type === "supergroup";
}
