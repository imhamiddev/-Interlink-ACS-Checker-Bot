import { isOwner, getOwnerIds } from "./config.js";
import { reportError, sendMessage, setMyCommands } from "./telegram.js";
import {
  ensureTables,
  isBotEnabled,
  getConfig,
  setConfig,
  checkRateLimit,
} from "./db.js";
import {
  ensureAnnouncementTable,
  getAnnouncementTarget,
  isCommandAllowed,
  isGroupChat,
} from "./announce.js";
import { handleSetId } from "./handlers/setid.js";
import { handleAcs } from "./handlers/acs.js";
import { handleRank } from "./handlers/rank.js";
import { handleSettings } from "./handlers/settings.js";
import {
  handleSetAnnounce,
  handleSetUsage,
} from "./handlers/announce_setup.js";
import { handleCallbackQuery } from "./callbacks.js";

const USER_COMMANDS = [
  { command: "setid", description: "Register your Interlink ID" },
  { command: "acs", description: "Look up ACS for an Interlink ID" },
  { command: "rank", description: "Open the leaderboard" },
];

const OWNER_PRIVATE_COMMANDS = [
  { command: "settings", description: "Open the admin panel" },
];

const OWNER_GROUP_COMMANDS = [
  ...USER_COMMANDS,
  {
    command: "set_announce",
    description: "Set this topic for ACS announcements (owner)",
  },
  {
    command: "set_usage",
    description: "Restrict user commands to this topic (owner)",
  },
];

async function ensureCommandsRegistered(env, DB) {
  const registered = await getConfig(DB, "commands_registered");
  if (registered === "1") return;

  await setMyCommands(env.BOT_TOKEN, USER_COMMANDS, { type: "default" });

  const target = await getAnnouncementTarget(DB);
  for (const ownerId of getOwnerIds(env)) {
    await setMyCommands(
      env.BOT_TOKEN,
      [...USER_COMMANDS, ...OWNER_PRIVATE_COMMANDS],
      {
        type: "chat",
        chat_id: ownerId,
      },
    );

    if (target?.chat_id) {
      await setMyCommands(env.BOT_TOKEN, OWNER_GROUP_COMMANDS, {
        type: "chat_member",
        chat_id: target.chat_id,
        user_id: ownerId,
      });
    }
  }
  await setConfig(DB, "commands_registered", "1");
}

async function handleMessage(env, DB, message) {
  const token = env.BOT_TOKEN;
  const telegram_id = message.from?.id;
  const text = (message.text || "").trim();
  const textLower = text.toLowerCase();
  const owner = isOwner(env, telegram_id);

  // Friendly entry point: /start in a private chat (however it was reached)
  // shows the leaderboard button directly instead of making the user type /rank.
  if (
    textLower === "/start" ||
    textLower.startsWith("/start ") ||
    textLower.startsWith("/start@")
  ) {
    if (!isGroupChat(message)) {
      await handleRank(env, DB, message);
    }
    return;
  }

  if (textLower === "/settings" || textLower.startsWith("/settings@")) {
    await handleSettings(env, DB, message);
    return;
  }

  if (textLower === "/set_announce" || textLower.startsWith("/set_announce@")) {
    await handleSetAnnounce(env, DB, message);
    return;
  }

  if (textLower === "/set_usage" || textLower.startsWith("/set_usage@")) {
    await handleSetUsage(env, DB, message);
    return;
  }

  const isUserCommand =
    textLower.startsWith("/acs") ||
    textLower.startsWith("/setid") ||
    textLower.startsWith("/rank");

  if (!isUserCommand) return;

  const target = await getAnnouncementTarget(DB);
  if (!isCommandAllowed(message, target)) return;

  if (!owner) {
    const allowed = await checkRateLimit(DB, telegram_id);
    if (!allowed) {
      await sendMessage(
        token,
        message.chat.id,
        "⏳ You're sending commands too fast. Please wait a few seconds.",
        {
          reply_parameters: {
            message_id: message.message_id,
            allow_sending_without_reply: true,
          },
          ...(message.message_thread_id != null
            ? { message_thread_id: message.message_thread_id }
            : {}),
        },
      );
      return;
    }
  }

  if (textLower.startsWith("/acs")) {
    await handleAcs(env, DB, message);
  } else if (textLower.startsWith("/setid")) {
    await handleSetId(env, DB, message);
  } else if (textLower.startsWith("/rank")) {
    await handleRank(env, DB, message);
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    let update;
    try {
      update = await request.json();
    } catch (err) {
      await reportError(
        env.BOT_TOKEN,
        getOwnerIds(env),
        err,
        "JSON parse failed",
      );
      return new Response("Bad Request", { status: 400 });
    }

    const DB = env.DB;

    try {
      await ensureTables(DB);
      await ensureAnnouncementTable(DB);
    } catch (err) {
      await reportError(env.BOT_TOKEN, getOwnerIds(env), err, "ensureTables");
      return new Response("OK");
    }

    try {
      await ensureCommandsRegistered(env, DB);
    } catch (err) {
      console.error("Failed to register commands:", err);
    }

    try {
      const botEnabled = await isBotEnabled(DB);

      if (!botEnabled) {
        // While disabled, only the owner's /settings (to re-enable via panel) works.
        const isOwnerSettingsMsg =
          isOwner(env, update.message?.from?.id) &&
          (update.message?.text?.trim() === "/settings" ||
            update.message?.text?.trim().startsWith("/settings@"));

        if (isOwnerSettingsMsg) {
          await handleMessage(env, DB, update.message);
        }
        return new Response("OK");
      }

      if (update.message) {
        await handleMessage(env, DB, update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(env, DB, update.callback_query);
      }
    } catch (err) {
      console.error("Error handling update:", err);
      await reportError(env.BOT_TOKEN, getOwnerIds(env), err, "handleUpdate");
    }

    return new Response("OK");
  },
};
