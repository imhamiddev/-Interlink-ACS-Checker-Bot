export function getOwnerIds(env) {
  return (env.OWNER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

export function isOwner(env, telegram_id) {
  return getOwnerIds(env).includes(Number(telegram_id));
}

export function interlinkBase(env) {
  return env.INTERLINK_API_BASE || "https://prod.interlinklabs.ai/api/v1";
}

export function panelUrl(env, path = "") {
  const base = (env.PANEL_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}
