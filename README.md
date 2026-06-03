# 🤖 Interlink ACS Bot

A Telegram bot built on **Cloudflare Workers** that tracks and announces ACS (Ambassador Credit Score) updates for [Interlink](https://interlinklabs.ai) ambassadors inside a Telegram group.

---

## ✨ Features

- 🔍 **ACS Lookup** — Look up any ambassador's profile, ACS score, badges, and social links
- 📋 **Daily Tasks** — View the last 10 daily task scores for any Interlink ID
- 📈 **ACS History** — View recent ACS earning history with timestamps
- 👥 **Referral Count** — See total referrals alongside profile data
- 🏆 **Leaderboard** — Top 10 users ranked by ACS with your own rank shown
- 🔔 **Auto Sync** — Scheduled ACS sync with grouped update announcements in the group
- 📣 **Topic-Aware Announcements** — Supports Telegram supergroup forum topics
- 💬 **Say Command** — Owner can send messages to any group topic as the bot
- 🔒 **Access Control** — Owner / Admin / User role system with rate limiting
- ⚙️ **Settings Panel** — Toggle bot on/off from a private chat inline keyboard
- 🛡️ **Duplicate ID Protection** — Prevents two users from registering the same Interlink ID

---

## 🏗️ Tech Stack

| Technology | Purpose |
|---|---|
| [Cloudflare Workers](https://workers.cloudflare.com) | Serverless runtime |
| [Cloudflare D1](https://developers.cloudflare.com/d1/) | SQLite database |
| [Telegram Bot API](https://core.telegram.org/bots/api) | Bot communication |
| [Interlink API](https://interlinklabs.ai) | ACS & profile data |

---

## 📁 Project Structure

```
.
└── src/
    └── index.js       # All bot logic (single-file Worker)
wrangler.toml          # Cloudflare Workers config
```

---

## 🚀 Setup & Deployment

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `npm install -g wrangler`
- A Cloudflare account
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

---

### 1. Clone the repository

```bash
git clone https://github.com/USERNAME/REPO_NAME.git
cd REPO_NAME
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a D1 database

```bash
wrangler d1 create interlink-bot-db
```

Copy the `database_id` from the output and add it to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "interlink-bot-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Set your bot token as a secret

```bash
wrangler secret put BOT_TOKEN
```

Paste your bot token when prompted.

### 5. Set your Telegram user ID as owner

In `src/index.js`, find this line and replace with your Telegram numeric ID:

```js
const OWNER_IDS = [YOUR_TELEGRAM_ID];
```

### 6. Deploy

```bash
wrangler deploy
```

### 7. Set the webhook

```
https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://YOUR_WORKER.workers.dev
```

---

## ⚙️ Configuration

### Roles

| Role | How to set | Permissions |
|---|---|---|
| Owner | `OWNER_IDS` array in code | All commands + settings + say |
| Admin | `ADMIN_IDS` array in code | `/sync` + user commands |
| User | Anyone in the group | `/setid`, `/acs`, `/top` |

### Group Setup

After adding the bot to your group, run these commands **inside the group** as the owner:

| Command | Description |
|---|---|
| `setup-id-gp` | Register the current topic as the ACS announcement channel |
| `setup-msg-gp` | Register the current topic as the command input channel |

---

## 📋 Commands

### User Commands (in group)

| Command | Description |
|---|---|
| `/setid <ID>` | Register your Interlink ambassador ID |
| `/acs <ID>` | Look up profile, ACS, daily tasks, and history |
| `/top` | Show the top 10 ACS leaderboard |

### Owner Commands (in private)

| Command | Description |
|---|---|
| `/say` | Send a message to a group topic as the bot |
| `/settings` | Toggle bot on/off |
| `/sync` | Manually sync ACS for all registered users |
| `/stats` | Show total users and bot status |

### Admin Commands

| Command | Description |
|---|---|
| `/sync` | Manually trigger ACS sync |

---

## 🔐 Security

> ⚠️ **Never commit** your bot token or any secrets to the repository.
> Use `wrangler secret put` to store sensitive values securely.

---

## 📄 License

MIT
