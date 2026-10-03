/**
 * notifications.js
 * Lokální (bez serveru) odvození upozornění: expirace, kontrola úkonů, roční revize,
 * chybějící položky. Nic tady neposílá push notifikace - jde o výpočet stavu
 * pro dashboard badge / seznam "vyžaduje pozornost" (viz MRD bod 5).
 */

const STATUS_PRIORITY = {
  [ITEM_STATUS.EXPIRED]: 0,
  [ITEM_STATUS.MISSING]: 1,
  [ITEM_STATUS.EXPIRING_SOON]: 2,
  [ITEM_STATUS.NEEDS_CHECK]: 3,
  [ITEM_STATUS.OK]: 4
};

/** Localized status label, e.g. getStatusLabel(ITEM_STATUS.MISSING) -> "Chybí" / "Missing". */
function getStatusLabel(status) {
  if (typeof I18n === "undefined") return status;
  return I18n.t("status." + status);
}

/** Attach a computed `status` field to every item (does not mutate originals' status permanently unless caller saves it). */
function annotateItemsWithStatus(items, profile, today) {
  today = today || todayISO();
  return items.map((item) => ({ ...item, status: deriveItemStatus(item, profile, today) }));
}

/** Items that need attention, sorted by severity, most urgent first. */
function getItemsNeedingAttention(items, profile, today) {
  return annotateItemsWithStatus(items, profile, today)
    .filter((i) => i.status !== ITEM_STATUS.OK)
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
}

/** Time-sensitive alerts must still fire when an item is also short on quantity. */
function getTimeSensitiveItems(items, profile, today) {
  today = today || todayISO();
  return annotateItemsWithStatus(items, profile, today).filter((item) => {
    if ([ITEM_STATUS.EXPIRED, ITEM_STATUS.EXPIRING_SOON, ITEM_STATUS.NEEDS_CHECK].includes(item.status)) return true;
    if (!item.expiration_tracked || !item.expiration_date) return false;
    const notifyDays = item.notification_days_before ?? profile.global_notification_days_before ?? 14;
    return daysBetween(today, item.expiration_date) <= notifyDays;
  });
}

/** Dashboard summary: counts + percentages per status. */
function getDashboardSummary(items, profile, today) {
  const annotated = annotateItemsWithStatus(items, profile, today);
  const counts = { ok: 0, missing: 0, expiring_soon: 0, expired: 0, needs_check: 0, total: annotated.length };
  for (const it of annotated) {
    if (it.status === ITEM_STATUS.OK) counts.ok++;
    else if (it.status === ITEM_STATUS.MISSING) counts.missing++;
    else if (it.status === ITEM_STATUS.EXPIRING_SOON) counts.expiring_soon++;
    else if (it.status === ITEM_STATUS.EXPIRED) counts.expired++;
    else if (it.status === ITEM_STATUS.NEEDS_CHECK) counts.needs_check++;
  }
  counts.ok_pct = counts.total ? Math.round((counts.ok / counts.total) * 100) : 100;
  return counts;
}

/** Ten-point readiness bands beginning at 5%, with separate empty/complete states. */
function getReadinessMilestone(percent, total) {
  if (!total) return "empty";
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  if (value < 5) return "begin";
  if (value === 100) return "complete";
  return String(Math.min(9, Math.floor((value - 5) / 10)));
}

const ANNUAL_REVIEW_INTERVAL_DAYS = 365;

function isAnnualReviewDue(profile, today) {
  today = today || todayISO();
  const last = profile.last_annual_review_at ? profile.last_annual_review_at.slice(0, 10) : profile.created_at.slice(0, 10);
  return daysBetween(last, today) >= ANNUAL_REVIEW_INTERVAL_DAYS;
}

function daysUntilAnnualReview(profile, today) {
  today = today || todayISO();
  const last = profile.last_annual_review_at ? profile.last_annual_review_at.slice(0, 10) : profile.created_at.slice(0, 10);
  return ANNUAL_REVIEW_INTERVAL_DAYS - daysBetween(last, today);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STATUS_PRIORITY, getStatusLabel,
    annotateItemsWithStatus, getItemsNeedingAttention, getTimeSensitiveItems, getDashboardSummary,
    getReadinessMilestone,
    ANNUAL_REVIEW_INTERVAL_DAYS, isAnnualReviewDue, daysUntilAnnualReview
  };
}
