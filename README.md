# Interlink ACS Bot — Bot Worker + Panel Worker

Two independent Cloudflare Workers sharing one D1 database.

```
bot-worker/     Telegram webhook — commands, callbacks, no UI
panel-worker/   Mini App (leaderboard + admin panel) and its JSON API
```

## What changed vs. the old single-file bot

1. **Secrets/config moved to env vars.** `BOT_TOKEN` is a secret; `OWNER_IDS`,
   `PANEL_URL`, `INTERLINK_API_BASE` are plain vars in `wrangler.toml`.
   Nothing is hardcoded in source anymore.
2. **Topic-tracking removed entirely.** No `known_topics` table, no
   "detect which forum topic a message came from" logic.
3. **Group broadcast / `/say` removed entirely.** No `say_pending` table, no
   topic picker, no `copyMessage` broadcast flow, no `setup-id-gp` /
   `setup-msg-gp` group commands, no announcement-target table.
4. **Code is split into small modules** instead of one file:
   `telegram.js`, `config.js`, `db.js`, `interlink.js`, `callbacks.js`, and
   one file per command under `handlers/`.

## New features

- **`/rank`** no longer sends a leaderboard message. It sends one message with
  an inline "Open Leaderboard" button that launches a Telegram Mini App
  (`panel-worker`'s `/leaderboard` page). The app paginates 25 rows at a time
  straight from D1 (`ORDER BY acs DESC LIMIT/OFFSET`), so it scales to any
  number of users without loading them all into memory or into a chat message.
- **`/settings`** (owner-only, numeric ID from `OWNER_IDS`) sends an inline
  "Open Admin Panel" button that launches the `/admin` Mini App. The page is
  gated server-side: the API validates Telegram's `initData` HMAC and checks
  the resulting user ID against `OWNER_IDS` before returning anything.
- **No more `/sync` command.** ACS syncing now lives in the admin panel as a
  "Run next batch" button that checks 10 users against the Interlink API,
  updates D1, DMs any user whose ACS increased, and remembers its offset in
  the `config` table so you can run it batch-by-batch over time (or hit
  "Reset" to start over).

## Database

Both workers must bind the **same D1 database** (same `database_id` in both
`wrangler.toml` files). Tables, created by `bot-worker`'s `ensureTables()`:

- `users (telegram_id, interlink_id, username, full_name, acs, notifications)`
  — indexed on `acs DESC` for cheap leaderboard/rank queries.
- `config (key, value)` — `bot_enabled`, `sync_offset`, `sync_accum`,
  `commands_registered`.
- `rate_limit (telegram_id, timestamps)` — per-user command throttling.

## Deploying

### 1. Create the D1 database once

```bash
wrangler d1 create interlink-db
```

Copy the returned `database_id` into **both** `bot-worker/wrangler.toml` and
`panel-worker/wrangler.toml`.

### 2. Deploy the panel worker first (bot needs its URL)

```bash
cd panel-worker
wrangler secret put BOT_TOKEN      # same token as the bot
wrangler deploy
```

Note the deployed URL (e.g. `https://interlink-panel.<subdomain>.workers.dev`).

### 3. Deploy the bot worker

```bash
cd bot-worker
wrangler secret put BOT_TOKEN
```

Edit `wrangler.toml`: set `PANEL_URL` to the panel worker's URL from step 2,
and confirm `OWNER_IDS` (comma-separated numeric Telegram IDs).

```bash
wrangler deploy
```

### 4. Point the Telegram webhook at the bot worker

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://interlink-bot.<subdomain>.workers.dev"
```

### 5. Register the Mini App URLs with BotFather (optional but recommended)

The bot already sends `web_app` inline buttons pointing at `PANEL_URL`, so
this works without any BotFather menu configuration — but you can also set
`/leaderboard` and `/admin` as a persistent Menu Button via `@BotFather` →
"Menu Button" if you'd like a shortcut outside of the commands.

## Commands

| Command | Who | Behavior |
|---|---|---|
| `/setid <id>` | anyone | Registers/links a Telegram user to an Interlink ID |
| `/acs <id>` | anyone | Shows a profile card with Daily Tasks / ACS History buttons |
| `/rank` | anyone | Opens the leaderboard Mini App |
| `/settings` | owner only | Opens the admin Mini App |

## Design

The Mini Apps share `theme.css`: white background, deep-violet accents
(`#6D28D9`/`#4C1D95`), Inter typeface, soft card shadows. The leaderboard's
rank badges use a subtle gold/silver/bronze gradient only for the top 3 —
an encoding of real rank information rather than decoration.
