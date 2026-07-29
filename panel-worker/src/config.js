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
