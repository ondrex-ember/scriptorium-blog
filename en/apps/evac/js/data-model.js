/**
 * data-model.js
 * Profil, Kategorie, Položka - tovární funkce, výpočet množství a odvozený stav.
 * Žádné IO zde - čisté funkce nad daty (IO řeší storage.js).
 */

const ITEM_TYPES = {
  SPOTREBNI: "spotrebni",   // consumable
  TRVALA: "trvala",         // durable, not scaled by days
  DOKUMENT: "dokument",     // document
  UKON: "ukon"              // recurring check/task
};

const ITEM_STATUS = {
  OK: "ok",
  MISSING: "missing",
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
  NEEDS_CHECK: "needs_check"
};

// Units treated as whole/discrete - required quantity rounded up to an integer.
// Locale-neutral codes (display labels are resolved separately, see js/i18n.js UNIT_LABELS).
const INTEGER_UNITS = new Set(["pcs", "pack", "pair", "set", "roll", "tablet", "sachet", "czk", "eur"]);

// Sensible +/- step per unit for the quick adjust buttons on item rows -
// bumping "current_quantity" by 1 g at a time would take forever.
const QUANTITY_STEP_BY_UNIT = {
  pcs: 1, pack: 1, pair: 1, set: 1, roll: 1, tablet: 1, sachet: 1,
  czk: 100, eur: 10, l: 1, kg: 0.5, g: 50
};

function uid(prefix) {
  return (prefix ? prefix + "_" : "") + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

function todayISO() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")].join("-");
}

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

/* ---------------- Profile ---------------- */

function createProfile(input) {
  const now = new Date().toISOString();
  return {
    id: input.id || uid("profile"),
    adults: Math.max(0, input.adults ?? 1),
    children: Math.max(0, input.children ?? 0),
    seniors: Math.max(0, input.seniors ?? 0),
    pets: Math.max(0, input.pets ?? 0),
    pet_type: input.pet_type || "",
    days: input.days ?? 72 / 24, // default 3 days, overwritten by onboarding choice
    coefficients: input.coefficients || { children: 0.75, seniors: 0.9 },
    global_notification_days_before: input.global_notification_days_before ?? 14,
    theme: input.theme || "light",
    locale: input.locale || "cs",
    created_at: input.created_at || now,
    last_annual_review_at: input.last_annual_review_at || null
  };
}

/** Effective headcount used for day-scaled consumption (children/seniors weighted). */
function effectivePersonsWeighted(profile) {
  const c = profile.coefficients || { children: 0.75, seniors: 0.9 };
  return profile.adults + profile.children * c.children + profile.seniors * c.seniors;
}

/** Raw headcount for flat per_person items (everyone needs their own copy/unit). */
function totalPersons(profile) {
  return profile.adults + profile.children + profile.seniors;
}

/* ---------------- Conditional expressions ---------------- */

/**
 * Very small, safe evaluator for expressions like "pets > 0" or "children > 0".
 * Only supports: <field> <op> <number>, op in > >= < <= == !=
 * Field is looked up directly on the profile object.
 */
function evaluateConditional(expr, profile) {
  if (!expr) return true;
  const m = String(expr).trim().match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(\.\d+)?)$/);
  if (!m) return true; // unknown expression shape -> fail open (don't hide data unexpectedly)
  const [, field, op, valueStr] = m;
  const left = profile[field];
  const right = parseFloat(valueStr);
  if (typeof left !== "number") return true;
  switch (op) {
    case ">": return left > right;
    case ">=": return left >= right;
    case "<": return left < right;
    case "<=": return left <= right;
    case "==": return left === right;
    case "!=": return left !== right;
    default: return true;
  }
}

/* ---------------- Quantity calculation ---------------- */

function roundQuantity(value, unit) {
  if (INTEGER_UNITS.has(unit)) return Math.ceil(value - 1e-9);
  return Math.round(value * 100) / 100;
}

/**
 * Compute požadované_množství for a template item definition, given a profile.
 * Mirrors the MRD rule:
 *  - scalable === false -> base_quantity as-is (not scaled)
 *  - consumption_per_person_per_day -> value * days * effectivePersonsWeighted(profile)
 *  - consumption_per_pet_per_day    -> value * days * profile.pets
 *  - per_person                     -> value * totalPersons(profile)
 *  - per_pet                        -> value * profile.pets
 */
function computeRequiredQuantity(def, profile) {
  if (!def.scalable) {
    return def.base_quantity ?? 0;
  }
  let qty = 0;
  if (typeof def.consumption_per_person_per_day === "number") {
    qty = def.consumption_per_person_per_day * profile.days * effectivePersonsWeighted(profile);
  } else if (typeof def.consumption_per_pet_per_day === "number") {
    qty = def.consumption_per_pet_per_day * profile.days * profile.pets;
  } else if (typeof def.per_person === "number") {
    qty = def.per_person * totalPersons(profile);
  } else if (typeof def.per_pet === "number") {
    qty = def.per_pet * profile.pets;
  } else {
    qty = def.base_quantity ?? 0;
  }
  return roundQuantity(qty, def.unit);
}

/* ---------------- Item / Category factories ---------------- */

/**
 * Template-origin items/categories carry an `i18n_key` pointer back to their
 * definition plus `name_overridden`/`note_overridden` flags. As long as those
 * flags stay false, the DISPLAYED name/note is looked up live via I18n.tt()
 * for whatever locale is active - so switching language relabels the whole
 * kit instantly. `name`/`note` still store a literal copy (the locale active
 * at creation time) as a safe fallback and as what gets shown once the user
 * edits the field by hand (the edit locks it in as free text - see
 * getItemDisplayName/getItemDisplayNote below and app.js saveItemModal).
 */
function createItemFromTemplate(def, profile, categoryId) {
  const required = computeRequiredQuantity(def, profile);
  return {
    id: uid("item"),
    category_id: categoryId,
    name: def.name,
    i18n_key: def.key || null,
    name_overridden: false,
    note_overridden: false,
    type: def.type,
    unit: def.unit,
    consumption_per_person_per_day: def.consumption_per_person_per_day ?? null,
    scalable: !!def.scalable,
    required_quantity: required,
    current_quantity: 0,
    expiration_date: null,
    expiration_tracked: !!def.expiration_tracked,
    interval_check_days: def.interval_check_days ?? null,
    last_checked_at: def.type === ITEM_TYPES.UKON ? todayISO() : null,
    photo_id: null,
    note: def.note || "",
    notification_days_before: def.notification_days_before ?? null, // per-item override
    packed: false, // checklist mode
    custom: false,
    created_at: new Date().toISOString()
  };
}

function createCustomItem(input, categoryId) {
  return {
    id: uid("item"),
    category_id: categoryId,
    name: input.name,
    i18n_key: null,
    name_overridden: true,
    note_overridden: true,
    type: input.type || ITEM_TYPES.TRVALA,
    unit: input.unit || "pcs",
    consumption_per_person_per_day: null,
    scalable: false,
    required_quantity: input.required_quantity ?? 1,
    current_quantity: input.current_quantity ?? 0,
    expiration_date: input.expiration_date || null,
    expiration_tracked: !!input.expiration_date,
    interval_check_days: input.interval_check_days ?? null,
    last_checked_at: input.type === ITEM_TYPES.UKON ? todayISO() : null,
    photo_id: null,
    note: input.note || "",
    notification_days_before: input.notification_days_before ?? null,
    packed: false,
    custom: true,
    created_at: new Date().toISOString()
  };
}

function createCategory(input) {
  return {
    id: input.id || uid("cat"),
    name: input.name,
    i18n_key: input.i18n_key || null,
    name_overridden: input.custom ? true : false,
    custom: !!input.custom,
    sort_order: input.sort_order ?? 0
  };
}

/* ---------------- Localized display helpers ----------------
 * Depend on the global I18n module (js/i18n.js). Guarded so this file still
 * loads standalone (e.g. under Node for tests) without I18n present.
 */

function getCategoryDisplayName(category) {
  if (typeof I18n !== "undefined" && category.i18n_key && !category.name_overridden) {
    const translated = I18n.tt("category." + category.i18n_key);
    if (translated !== null) return translated;
  }
  return category.name;
}

function getItemDisplayName(item) {
  if (typeof I18n !== "undefined" && item.i18n_key && !item.name_overridden) {
    const translated = I18n.tt("item." + item.i18n_key);
    if (translated !== null) return translated;
  }
  return item.name;
}

function getItemDisplayNote(item) {
  if (typeof I18n !== "undefined" && item.i18n_key && !item.note_overridden) {
    const translated = I18n.tt("note." + item.i18n_key);
    if (translated !== null) return translated;
  }
  return item.note;
}

function getUnitLabel(unit) {
  if (typeof I18n !== "undefined") return I18n.unitLabel(unit || "");
  return unit || "";
}

/* ---------------- Status derivation ---------------- */

/**
 * Derive display status for a single item.
 * Priority: expired > missing > expiring_soon > needs_check > ok
 */
function deriveItemStatus(item, profile, today) {
  today = today || todayISO();
  const notifyDays = item.notification_days_before ?? profile.global_notification_days_before ?? 14;

  let expiryState = null;
  if (item.expiration_tracked && item.expiration_date) {
    const diff = daysBetween(today, item.expiration_date);
    if (diff < 0) expiryState = ITEM_STATUS.EXPIRED;
    else if (diff <= notifyDays) expiryState = ITEM_STATUS.EXPIRING_SOON;
  }

  let checkState = null;
  if (item.type === ITEM_TYPES.UKON && item.interval_check_days) {
    const lastChecked = item.last_checked_at || item.created_at.slice(0, 10);
    const diff = daysBetween(lastChecked, today);
    if (diff >= item.interval_check_days) checkState = ITEM_STATUS.NEEDS_CHECK;
  }

  const isMissing = item.type !== ITEM_TYPES.UKON && item.current_quantity < item.required_quantity;

  if (expiryState === ITEM_STATUS.EXPIRED) return ITEM_STATUS.EXPIRED;
  if (isMissing) return ITEM_STATUS.MISSING;
  if (expiryState === ITEM_STATUS.EXPIRING_SOON) return ITEM_STATUS.EXPIRING_SOON;
  if (checkState === ITEM_STATUS.NEEDS_CHECK) return ITEM_STATUS.NEEDS_CHECK;
  return ITEM_STATUS.OK;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ITEM_TYPES, ITEM_STATUS,
    uid, todayISO, daysBetween,
    createProfile, effectivePersonsWeighted, totalPersons,
    evaluateConditional, computeRequiredQuantity,
    createItemFromTemplate, createCustomItem, createCategory,
    deriveItemStatus,
    getCategoryDisplayName, getItemDisplayName, getItemDisplayNote, getUnitLabel,
    QUANTITY_STEP_BY_UNIT
  };
}
