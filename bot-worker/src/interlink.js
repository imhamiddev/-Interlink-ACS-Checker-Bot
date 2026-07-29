// ── Client for the external Interlink Labs API ─────────────────────────────
import { interlinkBase } from "./config.js";

export async function fetchInterlinkProfile(env, interlink_id) {
  try {
    const res = await fetch(
      `${interlinkBase(env)}/ambassador-profile/get-profile/${interlink_id}`,
    );
    const json = await res.json();
    if (json.statusCode === 200 && json.data?.haveProfile) return json.data;
    return null;
  } catch {
    return null;
  }
}

export async function fetchReferrals(env, interlink_id) {
  try {
    const res = await fetch(
      `${interlinkBase(env)}/acs-history/get-referrals/${interlink_id}`,
    );
    const json = await res.json();
    return json.statusCode === 200 ? json.data : null;
  } catch {
    return null;
  }
}

export async function fetchDailyTasks(env, interlink_id) {
  try {
    const res = await fetch(
      `${interlinkBase(env)}/acs-history/daily-task/${interlink_id}`,
    );
    const json = await res.json();
    return json.statusCode === 200 ? json.data : null;
  } catch {
    return null;
  }
}

export async function fetchAcsHistory(env, interlink_id) {
  try {
    const res = await fetch(
      `${interlinkBase(env)}/acs-history/get-acs-history/${interlink_id}`,
    );
    const json = await res.json();
    return json.statusCode === 200 ? json.data : null;
  } catch {
    return null;
  }
}

export function getEffectiveBadgeCount(profile) {
  const rawBadges = profile.badges ?? [];
  const tierName = profile.userMetadata?.tierNameAmbassador;
  const isModerator =
    typeof tierName === "string" && tierName.toLowerCase() === "moderator";
  const alreadyHasModeratorBadge = rawBadges.some(
    (b) => (b.type || "").toUpperCase() === "MODERATOR",
  );
  let count = rawBadges.length;
  if (isModerator && !alreadyHasModeratorBadge) count += 1;
  return count;
}

export function starRatingBar(average = 0) {
  const rounded = Math.round(Number(average) || 0);
  const full = Math.max(0, Math.min(5, rounded));
  return "⭐".repeat(full) + "☆".repeat(5 - full);
}

export function formatProfile(profile, interlink_id, totalReferrals = null) {
  const tier = profile.userMetadata?.tierNameAmbassador || "Unknown";
  const acs = profile.acs != null ? Number(profile.acs).toFixed(2) : "-";
  const country = profile.country || "-";
  const badgeCount = getEffectiveBadgeCount(profile);

  const referralLine =
    totalReferrals != null
      ? `👥 <b>Referrals:</b> <code>${totalReferrals}</code>\n`
      : "";

  const hasRating = profile.totalReviews != null && profile.totalReviews > 0;
  const ratingLine = hasRating
    ? `${starRatingBar(profile.averageRating)}  <b>${Number(profile.averageRating).toFixed(1)}</b>  <i>(${profile.totalReviews} review${profile.totalReviews === 1 ? "" : "s"})</i>\n`
    : `☆ <i>No reviews yet</i>\n`;

  const tipLine =
    profile.canTip != null
      ? `💸 <b>Tips:</b> ${profile.canTip ? "✅ Enabled" : "🚫 Disabled"}\n`
      : "";

  const warningsCount = profile.warnings ?? 0;
  const warningLine =
    warningsCount > 0
      ? `🚩 <b>Warnings:</b> <code>${warningsCount}</code>\n`
      : "";

  return (
    `👤 <b>${profile.firstName} ${profile.lastName}</b> \n` +
    `🆔 <b>ID:</b> <code>${interlink_id}</code> \n` +
    `🌍 <b>Country:</b> <code>${country}</code>\n` +
    `⭐ <b>Level:</b> <code>${tier}</code>\n` +
    `📊 <b>ACS:</b> <code>${acs}</code>\n` +
    `🏅 <b>Badges:</b> <code>${badgeCount}</code>\n` +
    referralLine +
    tipLine +
    warningLine +
    `\n${ratingLine}`
  );
}
