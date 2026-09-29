/**
 * app.js
 * Hlavní logika appky - onboarding, dashboard, správa kategorií/položek,
 * checklist mód, feed, nastavení. Čistý JS, žádný framework (viz MRD tech stack).
 *
 * LOKALIZACE: veškerý UI text jde přes I18n.t()/data-i18n atributy (js/i18n.js).
 * Šablonové názvy/poznámky (kategorie, položky) jde přes getCategoryDisplayName/
 * getItemDisplayName/getItemDisplayNote (data-model.js), které se přepnou na
 * aktuální jazyk automaticky, dokud uživatel text ručně needituje (pak se
 * uloží jako literál - viz saveItemModal).
 */

(function () {
  "use strict";

  /* ---------- Apply saved theme + locale ASAP (before first paint) ---------- */
  let bootTheme = "light";
  try {
    const savedTheme = localStorage.getItem("evac_theme");
    if (savedTheme) { document.documentElement.setAttribute("data-theme", savedTheme); bootTheme = savedTheme; }
  } catch (e) { /* localStorage unavailable - default theme stays */ }
  I18n.setLocale(I18n.detectInitialLocale());
  renderThemeEmblem(bootTheme);

  /* ---------- State ---------- */
  const state = {
    profile: null,
    categories: [],
    items: [],
    activeCategoryId: null,
    activeScreen: "dashboard",
    dashboardCategoryFilter: null, // null = all categories
    editingItem: { id: null, categoryId: null, photoBlob: null, originalDisplayedName: "", originalDisplayedNote: "", originalUnitLabel: "" },
    ob: {
      adults: 1, children: 0, seniors: 0, pets: 0, pet_type: "dog",
      days: 10, customDays: 14, durationChoice: "10",
      selectedTemplateCats: new Set()
    }
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Install to home screen (Android/Chrome prompt + iOS manual steps) ---------- */
  let deferredInstallPrompt = null;

  function isStandaloneDisplay() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function isIOSDevice() {
    // iPadOS 13+ reports as "MacIntel" in the UA string - touch points is what still tells it apart from a real Mac.
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  /**
   * True when running inside the native Kotlin/WebView shell (see the
   * Android project's MainActivity, which appends this token to the WebView's
   * user-agent string). That shell is already "installed" by definition and
   * handles background notifications natively (WorkManager + a headless
   * WebView check, see assets/headless.html) instead of through the browser
   * Notification API - so both the install banner and the browser permission
   * flow below are irrelevant there and are replaced with a single status line.
   */
  function isNativeShell() {
    return /EvacApp\//.test(navigator.userAgent);
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    renderInstallSection();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    renderInstallSection();
  });

  function renderInstallSection() {
    const heading = $("#install-section-heading");
    const section = $("#install-section");
    const banner = $("#install-installed-banner");
    const statusEl = $("#install-status");
    const btn = $("#install-btn");
    const iosSteps = $("#install-ios-steps");
    if (!banner || !statusEl || !btn || !iosSteps) return; // settings screen not in DOM yet

    if (isNativeShell()) {
      // Already running as the installed native app - nothing to install.
      heading.style.display = "none";
      section.style.display = "none";
      return;
    }
    heading.style.display = "block";
    section.style.display = "block";

    const standalone = isStandaloneDisplay();
    banner.style.display = standalone ? "flex" : "none";
    statusEl.style.display = standalone ? "none" : "block";
    btn.style.display = "none";
    iosSteps.style.display = "none";

    if (standalone) return;

    if (deferredInstallPrompt) {
      statusEl.textContent = I18n.t("install.promptAvailable");
      btn.style.display = "block";
    } else if (isIOSDevice()) {
      statusEl.textContent = "";
      iosSteps.style.display = "block";
    } else {
      statusEl.textContent = I18n.t("install.genericHint");
    }
  }

  async function installApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    renderInstallSection();
  }

  // Every theme's full CSS variable set lives in css/themes.css under
  // [data-theme="<key>"] - this list only drives which ones show up as
  // swatches in Settings, in this display order.
  const THEME_LIST = [
    "light", "dark", "colorful", "contrast",
    "scifi", "fantasy", "aesthetic", "ddr", "scriptorium",
    "dirty", "secret", "handwritten", "terminal", "fallout", "intothewild"
  ];

  function fmtQty(n) {
    if (n === null || n === undefined) return "0";
    const r = Math.round(n * 100) / 100;
    return String(r);
  }

  /* ============================================================
   * TRANSLATIONS - static DOM pass
   * ============================================================ */
  function applyStaticTranslations() {
    $$("[data-i18n]").forEach((el) => { el.textContent = I18n.t(el.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach((el) => { el.placeholder = I18n.t(el.dataset.i18nPlaceholder); });
    $$("[data-i18n-title]").forEach((el) => { el.title = I18n.t(el.dataset.i18nTitle); });
    $$("[data-i18n-aria-label]").forEach((el) => { el.setAttribute("aria-label", I18n.t(el.dataset.i18nAriaLabel)); });
    populateLanguageSelect();
  }

  function populateLanguageSelect() {
    const sel = $("#set-language");
    if (!sel) return;
    const current = sel.value || (state.profile ? state.profile.locale : I18n.getLocale());
    sel.innerHTML = "";
    I18n.availableLocales().forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = loc.code;
      opt.textContent = loc.name;
      sel.appendChild(opt);
    });
    sel.value = current || I18n.getLocale();
  }

  async function changeLocale(code) {
    I18n.setLocale(code);
    if (state.profile) {
      state.profile.locale = code;
      await Storage.put("profiles", state.profile);
    }
    applyStaticTranslations();
    rerenderActiveScreen();
  }

  function rerenderActiveScreen() {
    if (!state.profile) { renderOnboardingStep(obStep); return; }
    const handlers = {
      dashboard: renderDashboard,
      category: renderCategoryScreen,
      checklist: renderChecklist,
      feed: () => renderFeed(false),
      settings: renderSettings
    };
    (handlers[state.activeScreen] || renderDashboard)();
  }

  /* ============================================================
   * INIT
   * ============================================================ */
  async function init() {
    applyStaticTranslations();
    bindStaticEvents();
    if (typeof NotificationsRuntime !== "undefined" && !isNativeShell()) {
      // Inside the native shell, offline is already guaranteed by bundled
      // assets and background checks run natively (see CheckWorker.kt) -
      // registering the SW here would just be dead weight.
      NotificationsRuntime.registerServiceWorker();
    }
    const onboardingDone = await Storage.getMeta("onboarding_complete", false);
    if (!onboardingDone) {
      showOnlyScreen("screen-onboarding");
      renderOnboardingStep(0);
      return;
    }
    await loadAllFromStorage();
    I18n.setLocale(state.profile.locale || I18n.getLocale());
    applyStaticTranslations();
    applyTheme(state.profile.theme || "light");
    $("#bottom-nav").style.display = "flex";
    state.activeScreen = "dashboard";
    showOnlyScreen("screen-dashboard");
    renderDashboard();
    if (typeof NotificationsRuntime !== "undefined" && !isNativeShell()) {
      NotificationsRuntime.runForegroundCheck(state.items, state.profile);
      NotificationsRuntime.pokeServiceWorker();
    }
  }

  async function loadAllFromStorage() {
    const profileId = await Storage.getMeta("active_profile_id");
    state.profile = await Storage.get("profiles", profileId);
    state.categories = await Storage.getAll("categories");
    state.items = await Storage.getAll("items");
    await migrateLegacyI18nData();
  }

  /**
   * One-time backfill for data created before i18n_key/name_overridden/
   * note_overridden existed (e.g. a kit set up with an earlier build of the
   * app). Without this, old items have no translation pointer at all, so
   * switching language relabels the UI chrome but not the item/category
   * names themselves - they just keep showing whatever literal text they
   * were created with.
   *
   * Matched by category id + exact name against TEMPLATE_DATA (the only
   * link the old records still carry). A name that matches the template's
   * Czech default exactly is treated as never-edited (tracks translations
   * again); anything else is treated as a genuine user edit and kept as
   * literal text, never overwritten. Runs once - afterwards every record
   * has i18n_key explicitly set (string or null), which this check skips.
   */
  async function migrateLegacyI18nData() {
    let categoriesChanged = false;
    let itemsChanged = false;

    state.categories.forEach((cat) => {
      if (cat.i18n_key !== undefined) return;
      const def = TEMPLATE_DATA.categories.find((c) => c.id === cat.id);
      if (def) {
        cat.i18n_key = def.key;
        cat.name_overridden = cat.name !== def.name;
      } else {
        cat.i18n_key = null;
        cat.name_overridden = true;
      }
      categoriesChanged = true;
    });

    state.items.forEach((item) => {
      if (item.i18n_key !== undefined) return;
      const cat = state.categories.find((c) => c.id === item.category_id);
      const catDef = cat ? TEMPLATE_DATA.categories.find((c) => c.id === cat.id) : null;
      const def = catDef ? catDef.items.find((d) => d.name === item.name) : null;
      if (def) {
        item.i18n_key = def.key;
        item.name_overridden = false;
        item.note_overridden = (item.note || "") !== (def.note || "");
      } else {
        item.i18n_key = null;
        item.name_overridden = true;
        item.note_overridden = true;
      }
      itemsChanged = true;
    });

    if (state.profile && !state.profile.locale) {
      state.profile.locale = I18n.getLocale();
      await Storage.put("profiles", state.profile);
    }
    // Themes were renamed since an earlier build ("color" -> "colorful");
    // the CSS still recognizes both keys, but keep the stored value current.
    if (state.profile && state.profile.theme === "color") {
      state.profile.theme = "colorful";
      await Storage.put("profiles", state.profile);
    }
    if (categoriesChanged) await Storage.bulkPut("categories", state.categories);
    if (itemsChanged) await Storage.bulkPut("items", state.items);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("evac_theme", theme); } catch (e) {}
    renderThemeEmblem(theme);
  }

  /** Swaps the fixed-corner watermark icon (see .theme-emblem in style.css)
   * to match the active theme. Safe to call before THEME_ICONS/DOM are
   * fully ready - both are guarded. */
  function renderThemeEmblem(theme) {
    const el = document.getElementById("theme-emblem");
    if (!el || typeof THEME_ICONS === "undefined") return;
    const icon = THEME_ICONS[theme] || THEME_ICONS.light || "";
    el.innerHTML = icon ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icon}</svg>` : "";
  }

  /**
   * Builds the theme picker grid from THEME_LIST. Each swatch element itself
   * carries data-theme="<key>" so its preview strip, label font and border
   * all resolve against THAT theme's own CSS variables via normal cascade
   * (see .theme-swatch / .swatch-preview in style.css) - no per-theme JS
   * color lookup table to keep in sync with themes.css.
   */
  function renderThemeSwatches() {
    const wrap = $("#theme-swatches");
    if (!wrap) return;
    const current = state.profile.theme || "light";
    wrap.innerHTML = "";
    THEME_LIST.forEach((key) => {
      const sw = document.createElement("div");
      sw.className = "theme-swatch" + (key === current ? " selected" : "");
      sw.setAttribute("data-theme", key);
      const icon = (typeof THEME_ICONS !== "undefined" && THEME_ICONS[key]) || "";
      const iconMarkup = icon ? `<span class="swatch-icon-badge"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icon}</svg></span>` : "";
      sw.innerHTML = `<div class="swatch-preview">${iconMarkup}</div><span>${I18n.t("theme." + key)}</span>`;
      sw.addEventListener("click", () => {
        state.profile.theme = key;
        applyTheme(key);
        Storage.put("profiles", state.profile);
        renderThemeSwatches();
      });
      wrap.appendChild(sw);
    });
  }

  function showOnlyScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $("#" + id).classList.add("active");
  }

  /* ============================================================
   * NAVIGATION
   * ============================================================ */
  function bindStaticEvents() {
    document.body.addEventListener("click", onGlobalClick);
    let lastResume = 0;
    const refreshOnResume = () => {
      if (!state.profile || Date.now() - lastResume < 1000) return;
      lastResume = Date.now();
      if (["dashboard", "category", "checklist"].includes(state.activeScreen)) rerenderActiveScreen();
      if (typeof NotificationsRuntime !== "undefined" && !isNativeShell()) {
        NotificationsRuntime.runForegroundCheck(state.items, state.profile);
      }
    };
    window.addEventListener("focus", refreshOnResume);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshOnResume(); });

    $$("#duration-chips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#duration-chips .chip").forEach((c) => c.classList.remove("selected"));
        chip.classList.add("selected");
        state.ob.durationChoice = chip.dataset.days;
        $("#custom-days-field").style.display = chip.dataset.days === "custom" ? "block" : "none";
      });
    });

    $$(".bottom-nav button[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => navigateTo(btn.dataset.nav));
    });

    $("#in-pets").addEventListener("input", () => {
      $("#pet-type-field").style.display = parseInt($("#in-pets").value || "0", 10) > 0 ? "block" : "none";
    });

    $("#set-language").addEventListener("change", (e) => changeLocale(e.target.value));

    $("#import-file-input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) handleImportFile(file);
    });
  }

  function navigateTo(screen) {
    $$(".bottom-nav button[data-nav]").forEach((b) => b.classList.toggle("active", b.dataset.nav === screen));
    state.activeScreen = screen;
    if (screen === "dashboard") { showOnlyScreen("screen-dashboard"); renderDashboard(); }
    if (screen === "checklist") { showOnlyScreen("screen-checklist"); renderChecklist(); }
    if (screen === "feed") { showOnlyScreen("screen-feed"); renderFeed(); }
    if (screen === "settings") { showOnlyScreen("screen-settings"); renderSettings(); }
  }

  function onGlobalClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const handlers = {
      "ob-next": obNext,
      "ob-prev": obPrev,
      "ob-finish": finishOnboarding,
      "inc": () => obCounterChange(el.dataset.field, 1),
      "dec": () => obCounterChange(el.dataset.field, -1),
      "open-settings": () => navigateTo("settings"),
      "back-to-dashboard": () => navigateTo("dashboard"),
      "open-checklist": () => navigateTo("checklist"),
      "add-category": () => openCategoryModal(null),
      "close-category-modal": closeCategoryModal,
      "save-category": saveCategoryModal,
      "add-item": () => openItemModal(null, state.activeCategoryId),
      "close-item-modal": closeItemModal,
      "save-item": saveItemModal,
      "delete-item": deleteItemModal,
      "refresh-feed": () => renderFeed(true),
      "save-settings": saveSettings,
      "mark-annual-review": markAnnualReviewDone,
      "reset-app": resetApp,
      "export-data": exportData,
      "trigger-import": () => $("#import-file-input").click(),
      "enable-notifications": enableNotifications,
      "install-app": installApp,
      "reset-checklist": resetChecklist,
      "rename-category": () => openCategoryModal(state.activeCategoryId),
      "delete-category": () => deleteCategoryHandler(state.activeCategoryId),
      "qty-dec": (btn) => quickAdjustQuantity(btn.dataset.itemId, -1),
      "qty-inc": (btn) => quickAdjustQuantity(btn.dataset.itemId, 1),
      "quick-check": (btn) => quickMarkChecked(btn.dataset.itemId)
    };
    if (handlers[action]) handlers[action](el);
  }

  /* ============================================================
   * ONBOARDING
   * ============================================================ */
  function obCounterChange(field, delta) {
    state.ob[field] = Math.max(0, (state.ob[field] || 0) + delta);
    $("#in-" + field).value = state.ob[field];
    if (field === "pets") {
      $("#pet-type-field").style.display = state.ob.pets > 0 ? "block" : "none";
    }
  }

  let obStep = 0;
  function obNext() {
    if (obStep === 1) {
      state.ob.pet_type = $("#in-pet-type").value;
      state.ob.days = state.ob.durationChoice === "custom"
        ? Math.max(1, parseInt($("#in-custom-days").value || "1", 10))
        : parseInt(state.ob.durationChoice, 10);
    }
    if (obStep === 2) {
      state.ob.selectedTemplateCats = new Set(
        $$("#template-category-list input[type=checkbox]:checked").map((cb) => cb.dataset.catId)
      );
      renderObSummary();
    }
    obStep = Math.min(3, obStep + 1);
    renderOnboardingStep(obStep);
  }
  function obPrev() {
    obStep = Math.max(0, obStep - 1);
    renderOnboardingStep(obStep);
  }
  function renderOnboardingStep(step) {
    $$(".ob-step").forEach((s, i) => { s.style.display = i === step ? "block" : "none"; });
    if (step === 2) renderTemplateCategoryList();
  }

  function renderTemplateCategoryList() {
    const wrap = $("#template-category-list");
    wrap.innerHTML = "";
    TEMPLATE_DATA.categories.forEach((cat) => {
      const profileLike = { adults: state.ob.adults, children: state.ob.children, seniors: state.ob.seniors, pets: state.ob.pets };
      if (cat.conditional && !evaluateConditional(cat.conditional, profileLike)) return;
      const row = document.createElement("label");
      row.className = "checklist-select";
      const catName = I18n.tt("category." + cat.key) || cat.name;
      row.innerHTML = `
        <input type="checkbox" data-cat-id="${cat.id}" checked>
        <span class="cs-name">${catName}</span>
        <span class="cs-count">${I18n.t("common.itemsCount", { count: cat.items.length })}</span>`;
      wrap.appendChild(row);
    });
  }

  function renderObSummary() {
    const days = state.ob.days;
    const catCount = state.ob.selectedTemplateCats.size;
    const petLabel = state.ob.pets > 0 ? " (" + I18n.t("petType." + state.ob.pet_type) + ")" : "";
    $("#ob-summary").innerHTML = `
      <div class="settings-row"><span>${I18n.t("onboarding.household.adults")}</span><span>${state.ob.adults}</span></div>
      <div class="settings-row"><span>${I18n.t("onboarding.household.children")}</span><span>${state.ob.children}</span></div>
      <div class="settings-row"><span>${I18n.t("onboarding.household.seniors")}</span><span>${state.ob.seniors}</span></div>
      <div class="settings-row"><span>${I18n.t("onboarding.household.pets")}</span><span>${state.ob.pets}${petLabel}</span></div>
      <div class="settings-row"><span>${I18n.t("onboarding.household.duration")}</span><span>${I18n.t("common.daysCount", { count: days })}</span></div>
      <div class="settings-row"><span>${I18n.t("onboarding.summary.categories")}</span><span>${catCount}</span></div>
    `;
  }

  async function finishOnboarding() {
    const profile = createProfile({
      adults: state.ob.adults,
      children: state.ob.children,
      seniors: state.ob.seniors,
      pets: state.ob.pets,
      pet_type: state.ob.pet_type,
      days: state.ob.days,
      coefficients: TEMPLATE_DATA.coefficients,
      locale: I18n.getLocale()
    });

    const categoriesToSave = [];
    const itemsToSave = [];
    let sortOrder = 0;

    TEMPLATE_DATA.categories.forEach((catDef) => {
      if (!state.ob.selectedTemplateCats.has(catDef.id)) return;
      if (catDef.conditional && !evaluateConditional(catDef.conditional, profile)) return;
      const category = createCategory({ id: catDef.id, name: catDef.name, i18n_key: catDef.key, sort_order: sortOrder++ });
      categoriesToSave.push(category);
      catDef.items.forEach((itemDef) => {
        if (itemDef.conditional && !evaluateConditional(itemDef.conditional, profile)) return;
        itemsToSave.push(createItemFromTemplate(itemDef, profile, category.id));
      });
    });

    await Storage.put("profiles", profile);
    await Storage.bulkPut("categories", categoriesToSave);
    if (itemsToSave.length) await Storage.bulkPut("items", itemsToSave);
    await Storage.setMeta("active_profile_id", profile.id);
    await Storage.setMeta("onboarding_complete", true);

    state.profile = profile;
    state.categories = categoriesToSave;
    state.items = itemsToSave;

    applyTheme(profile.theme);
    $("#bottom-nav").style.display = "flex";
    navigateTo("dashboard");
  }

  /* ============================================================
   * DASHBOARD
   * ============================================================ */
  const CATEGORY_ICON_PATHS = {
    documents: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    water: '<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M8 16a4 4 0 0 0 4 4"/>',
    food: '<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 21V3c-3 2-4 5-4 10h4"/>',
    medical: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M9 5V3h6v2M12 9v8M8 13h8"/>',
    equipment: '<path d="m14 3 7 7-4 4-7-7 4-4ZM10 10l4 4-8 8-4-4 8-8ZM7 15l2 2"/>',
    hygiene: '<path d="M4 11h16v4a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7v-4ZM9 11V6a3 3 0 0 1 6 0v5M3 11h18"/>',
    clothing: '<path d="m8 3-5 4 3 4 2-2v12h8V9l2 2 3-4-5-4c-1 3-7 3-8 0Z"/>',
    misc: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 13h18M11 12h2v3h-2z"/>',
    pets: '<path d="M12 14c-3 0-6 2-6 5 0 2 2 3 4 2a6 6 0 0 1 4 0c2 1 4 0 4-2 0-3-3-5-6-5Z"/><circle cx="5" cy="10" r="1.5"/><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="19" cy="10" r="1.5"/>'
  };
  function categoryIcon(key) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CATEGORY_ICON_PATHS[key] || '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10"/>'}</svg>`;
  }
  function renderDashboard() {
    const summary = getDashboardSummary(state.items, state.profile);
    const pct = summary.total ? Math.max(0, Math.min(100, Number(summary.ok_pct) || 0)) : 0;
    const total = summary.ok + summary.missing + summary.expiring_soon + summary.expired + summary.needs_check;
    const level = total === 0 ? "empty" : pct >= 80 ? "ready" : pct >= 40 ? "building" : "starting";
    const readiness = $("#dash-readiness");
    readiness.dataset.level = level;
    $("#dash-readiness-ring").style.setProperty("--readiness", pct + "%");
    $("#dash-readiness-number").textContent = pct + "%";
    $("#dash-readiness-title").textContent = I18n.t("dashboard.milestone." + getReadinessMilestone(pct, total));
    $("#dash-readiness-detail").textContent = I18n.t("dashboard.readyCount", { ready: summary.ok, total });
    const share = (count) => total ? Math.round(count / total * 100) : 0;
    const summaryTile = (type, icon, count, label) => `
      <div class="summary-tile ${type}">
        <div class="summary-tile-top"><svg class="ui-icon summary-symbol" aria-hidden="true"><use href="#ui-status-${icon}"/></svg><span class="summary-share">${share(count)}%</span></div>
        <div class="num">${count}</div><div class="lbl">${label}</div>
      </div>`;
    $("#dash-summary").innerHTML = `
      ${summaryTile("ok", "ok", summary.ok, I18n.t("status.ok"))}
      ${summaryTile("missing", "missing", summary.missing, I18n.t("status.missing"))}
      ${summaryTile("expiring", "expiring", summary.expiring_soon, I18n.t("status.expiring_soon"))}
      ${summaryTile(summary.expired ? "expired" : "review", summary.expired ? "critical" : "review", summary.expired + summary.needs_check, I18n.t("dashboard.summary.criticalCheck"))}
    `;
    $("#dash-progress-fill").style.width = pct + "%";
    $("#dash-progress").setAttribute("aria-valuenow", String(pct));
    $("#dash-progress").setAttribute("aria-label", I18n.t("dashboard.readiness"));

    const annualBanner = $("#dash-annual-banner");
    annualBanner.innerHTML = isAnnualReviewDue(state.profile)
      ? `<div class="banner critical">${I18n.t("dashboard.annualDueBanner")}</div>`
      : "";

    renderDashboardCategoryFilter();

    const attentionAll = getItemsNeedingAttention(state.items, state.profile);
    const nextPanel = $("#dash-next-action");
    const nextItem = attentionAll[0];
    nextPanel.hidden = !nextItem;
    nextPanel.dataset.alert = nextItem && nextItem.status === ITEM_STATUS.EXPIRED ? "expired" : "none";
    if (nextItem) {
      $("#dash-next-name").textContent = getItemDisplayName(nextItem);
      $("#dash-next-detail").textContent = I18n.t("status." + nextItem.status) + " · " + itemSubtext(nextItem);
      $("#dash-next-button").setAttribute("aria-label", I18n.t("dashboard.openItem") + ": " + getItemDisplayName(nextItem));
      $("#dash-next-button").onclick = () => openItemModal(nextItem.id, nextItem.category_id);
    } else {
      $("#dash-next-button").onclick = null;
    }
    const attention = state.dashboardCategoryFilter
      ? attentionAll.filter((i) => i.category_id === state.dashboardCategoryFilter)
      : attentionAll;
    const list = $("#dash-attention-list");
    if (!attentionAll.length) {
      list.innerHTML = `<div class="empty-state">${I18n.t("dashboard.allGood")}</div>`;
    } else if (!attention.length) {
      list.innerHTML = `<div class="empty-state">${I18n.t("dashboard.noneInCategory")}</div>`;
    } else {
      list.innerHTML = "";
      attention.forEach((item) => list.appendChild(renderItemRow(item)));
    }

    const catList = $("#dash-category-list");
    catList.innerHTML = "";
    if (!state.categories.length) {
      catList.innerHTML = `<div class="empty-state">${I18n.t("dashboard.noCategories")}</div>`;
    }
    state.categories
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((cat) => {
        const catItems = state.items.filter((i) => i.category_id === cat.id);
        const annotated = annotateItemsWithStatus(catItems, state.profile);
        const attentionCount = annotated.filter((i) => i.status !== ITEM_STATUS.OK).length;
        const row = document.createElement("div");
        row.className = "category-row";
        const metaText = I18n.t("common.itemsCount", { count: catItems.length })
          + (attentionCount ? I18n.t("dashboard.attentionSuffix", { count: attentionCount }) : "");
        const icon = document.createElement("span");
        icon.className = "cat-icon";
        icon.innerHTML = categoryIcon(cat.i18n_key || cat.id);
        const content = document.createElement("div");
        content.className = "cat-content";
        const name = document.createElement("div");
        name.className = "cat-name";
        name.textContent = getCategoryDisplayName(cat);
        const meta = document.createElement("div");
        meta.className = "cat-meta";
        meta.textContent = metaText;
        const meter = document.createElement("span");
        meter.className = "cat-meter";
        meter.style.setProperty("--cat-progress", (catItems.length ? Math.round(100 * (catItems.length - attentionCount) / catItems.length) : 0) + "%");
        meter.setAttribute("aria-hidden", "true");
        content.append(name, meta, meter);
        const chevron = document.createElement("span");
        chevron.className = "cat-chevron";
        chevron.textContent = "›";
        row.append(icon, content, chevron);
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCategoryScreen(cat.id); } });
        row.addEventListener("click", () => openCategoryScreen(cat.id));
        catList.appendChild(row);
      });
  }

  function renderDashboardCategoryFilter() {
    const wrap = $("#dash-category-filter");
    if (!wrap) return;
    if (state.categories.length < 2) { wrap.innerHTML = ""; return; }

    wrap.innerHTML = "";
    const allChip = document.createElement("span");
    allChip.className = "chip" + (state.dashboardCategoryFilter ? "" : " selected");
    allChip.textContent = I18n.t("dashboard.filterAll");
    allChip.addEventListener("click", () => { state.dashboardCategoryFilter = null; renderDashboard(); });
    wrap.appendChild(allChip);

    state.categories.slice().sort((a, b) => a.sort_order - b.sort_order).forEach((cat) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (state.dashboardCategoryFilter === cat.id ? " selected" : "");
      chip.textContent = getCategoryDisplayName(cat);
      chip.addEventListener("click", () => { state.dashboardCategoryFilter = cat.id; renderDashboard(); });
      wrap.appendChild(chip);
    });
  }

  function renderItemRow(item, animateUrgent = false) {
    const row = document.createElement("div");
    row.className = "item-row";
    if (item.status === ITEM_STATUS.EXPIRED) row.classList.add("is-expired");
    else if (item.status === ITEM_STATUS.EXPIRING_SOON) row.classList.add("is-expiring");
    if (animateUrgent && item.status === ITEM_STATUS.EXPIRED) row.classList.add("is-focus-urgent");
    const dot = document.createElement("span");
    dot.className = "badge-dot " + item.status;
    dot.setAttribute("aria-hidden", "true");
    const info = document.createElement("div");
    info.className = "item-info";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = getItemDisplayName(item);
    const detail = document.createElement("div");
    detail.className = "item-detail";
    const sub = document.createElement("span");
    sub.className = "item-sub";
    sub.textContent = itemSubtext(item);
    const status = document.createElement("span");
    status.className = "item-status-label status-text " + item.status;
    status.textContent = I18n.t("status." + item.status);
    detail.append(sub, status);
    info.append(name, detail);
    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.innerHTML = renderQuickActions(item);
    actions.querySelectorAll("button").forEach((button) => {
      button.dataset.itemId = item.id;
      button.setAttribute("aria-label", I18n.t(button.dataset.action === "qty-dec" ? "item.decrease" : button.dataset.action === "qty-inc" ? "item.increase" : "item.quickCheck") + ": " + getItemDisplayName(item));
    });
    row.append(dot, info, actions);
    row.tabIndex = 0;
    row.addEventListener("keydown", (e) => { if (e.target === row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openItemModal(item.id, item.category_id); } });
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return; // quick-action buttons handle themselves
      openItemModal(item.id, item.category_id);
    });
    return row;
  }

  function renderQuickActions(item) {
    if (item.type === ITEM_TYPES.UKON) {
      return `<button class="btn-quick" data-action="quick-check" title="${I18n.t("item.quickCheck")}">✓</button>`;
    }
    return `
      <div class="qty-stepper">
        <button class="qty-btn" data-action="qty-dec">−</button>
        <button class="qty-btn" data-action="qty-inc">+</button>
      </div>`;
  }

  async function quickAdjustQuantity(itemId, direction) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const step = QUANTITY_STEP_BY_UNIT[item.unit] || 1;
    item.current_quantity = Math.max(0, roundQuantity((item.current_quantity || 0) + direction * step, item.unit));
    await Storage.put("items", item);
    rerenderActiveScreen();
  }

  async function quickMarkChecked(itemId) {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    item.last_checked_at = todayISO();
    await Storage.put("items", item);
    rerenderActiveScreen();
  }

  function itemSubtext(item) {
    if (item.type === ITEM_TYPES.UKON) {
      return I18n.t("item.subtext.checkInterval", { days: item.interval_check_days });
    }
    return fmtQty(item.current_quantity) + " / " + fmtQty(item.required_quantity) + " " + getUnitLabel(item.unit)
      + (item.expiration_date ? I18n.t("item.subtext.expSuffix", { date: item.expiration_date }) : "");
  }

  /* ============================================================
   * CATEGORY DETAIL
   * ============================================================ */
  function openCategoryScreen(catId) {
    state.activeCategoryId = catId;
    state.activeScreen = "category";
    showOnlyScreen("screen-category");
    renderCategoryScreen();
  }

  function renderCategoryScreen() {
    const cat = state.categories.find((c) => c.id === state.activeCategoryId);
    if (!cat) return navigateTo("dashboard");
    $("#cat-title").textContent = getCategoryDisplayName(cat);
    const items = annotateItemsWithStatus(state.items.filter((i) => i.category_id === cat.id), state.profile);
    const ready = items.filter((i) => i.status === ITEM_STATUS.OK).length;
    const pct = items.length ? Math.round(ready / items.length * 100) : 0;
    $("#cat-overview").dataset.alert = items.some((i) => i.status === ITEM_STATUS.EXPIRED) ? "expired" : "none";
    $("#cat-overview-icon").innerHTML = categoryIcon(cat.i18n_key || cat.id);
    $("#cat-overview-count").textContent = I18n.t("category.readyItems", { ready, total: items.length });
    $("#cat-overview-percent").textContent = pct + " %";
    $("#cat-overview-fill").style.width = pct + "%";
    const list = $("#cat-item-list");
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = `<div class="empty-state">${I18n.t("category.noItems")}</div>`;
    }
    let urgentAnimated = false;
    items.forEach((item) => {
      const animate = !urgentAnimated && item.status === ITEM_STATUS.EXPIRED;
      if (animate) urgentAnimated = true;
      list.appendChild(renderItemRow(item, animate));
    });
  }

  /* ============================================================
   * ITEM MODAL
   * ============================================================ */
  function openItemModal(itemId, categoryId) {
    closeCategoryModal();
    const isNew = !itemId;
    const item = isNew ? null : state.items.find((i) => i.id === itemId);

    const displayedName = item ? getItemDisplayName(item) : "";
    const displayedNote = item ? getItemDisplayNote(item) : "";
    const displayedUnit = item ? getUnitLabel(item.unit) : getUnitLabel("pcs");

    state.editingItem = {
      id: itemId, categoryId, photoBlob: null,
      originalDisplayedName: displayedName,
      originalDisplayedNote: displayedNote,
      originalUnitLabel: displayedUnit
    };

    $("#item-modal-title").textContent = I18n.t(isNew ? "item.modal.titleNew" : "item.modal.titleEdit");
    $("#item-name").value = displayedName;
    $("#item-type").value = item ? item.type : "trvala";
    $("#item-unit").value = displayedUnit;
    $("#item-required").value = item ? item.required_quantity : 1;
    $("#item-current").value = item ? item.current_quantity : 0;
    $("#item-expiration").value = item && item.expiration_date ? item.expiration_date : "";
    $("#item-notify-days").value = item && item.notification_days_before !== null ? item.notification_days_before : "";
    $("#item-interval-days").value = item && item.interval_check_days ? item.interval_check_days : 90;
    $("#item-note").value = displayedNote;
    $("#item-photo-input").value = "";
    $("#item-delete-btn").style.display = isNew ? "none" : "block";

    toggleItemTypeFields();
    $("#item-type").onchange = toggleItemTypeFields;

    const preview = $("#item-photo-preview");
    preview.classList.remove("active");
    if (item && item.photo_id) {
      Storage.getPhotoUrl(item.photo_id).then((url) => {
        if (url) { preview.src = url; preview.classList.add("active"); }
      });
    }
    $("#item-photo-input").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      state.editingItem.photoBlob = file;
      preview.src = URL.createObjectURL(file);
      preview.classList.add("active");
    };

    $("#item-modal-overlay").classList.add("active");
  }

  function toggleItemTypeFields() {
    const isUkon = $("#item-type").value === "ukon";
    $("#item-interval-field").style.display = isUkon ? "block" : "none";
    $("#item-expiration-field").style.display = isUkon ? "none" : "block";
  }

  function closeItemModal() {
    $("#item-modal-overlay").classList.remove("active");
  }

  async function saveItemModal() {
    const name = $("#item-name").value.trim();
    if (!name) { alert(I18n.t("item.modal.nameRequired")); return; }
    const type = $("#item-type").value;
    const { id, categoryId, photoBlob, originalDisplayedName, originalDisplayedNote, originalUnitLabel } = state.editingItem;
    let item = id ? state.items.find((i) => i.id === id) : null;

    if (!item) {
      item = createCustomItem({ name, type }, categoryId);
    }

    // Template-origin items: typing something different from the currently
    // displayed (localized) text locks that field in as free-text from now on.
    // Leaving it untouched keeps it tracking the live translation.
    if (item.i18n_key) {
      if (name !== originalDisplayedName) item.name_overridden = true;
      const note = $("#item-note").value.trim();
      if (note !== originalDisplayedNote) item.note_overridden = true;
    }

    item.name = name;
    item.type = type;

    const typedUnit = $("#item-unit").value.trim();
    item.unit = (typedUnit === originalUnitLabel && item.unit) ? item.unit : (typedUnit || "pcs");

    item.required_quantity = parseFloat($("#item-required").value) || 0;
    item.current_quantity = parseFloat($("#item-current").value) || 0;
    item.note = $("#item-note").value.trim();

    if (type === ITEM_TYPES.UKON) {
      item.interval_check_days = parseInt($("#item-interval-days").value, 10) || 90;
      item.expiration_date = null;
      item.expiration_tracked = false;
      if (!item.last_checked_at) item.last_checked_at = todayISO();
    } else {
      const exp = $("#item-expiration").value;
      item.expiration_date = exp || null;
      item.expiration_tracked = !!exp;
      item.interval_check_days = null;
    }
    const notifyVal = $("#item-notify-days").value;
    item.notification_days_before = notifyVal === "" ? null : parseInt(notifyVal, 10);

    if (photoBlob) {
      if (!item.photo_id) item.photo_id = uid("photo");
      await Storage.savePhoto(item.photo_id, photoBlob);
    }

    await Storage.put("items", item);
    const idx = state.items.findIndex((i) => i.id === item.id);
    if (idx === -1) state.items.push(item); else state.items[idx] = item;

    closeItemModal();
    renderCategoryScreen();
    renderDashboard();
  }

  async function deleteItemModal() {
    const { id } = state.editingItem;
    if (!id) return;
    if (!confirm(I18n.t("item.modal.deleteConfirm"))) return;
    await Storage.delete("items", id);
    state.items = state.items.filter((i) => i.id !== id);
    closeItemModal();
    renderCategoryScreen();
    renderDashboard();
  }

  /* ============================================================
   * CATEGORY MODAL (create, or rename an existing one)
   * ============================================================ */
  let editingCategoryId = null;

  function openCategoryModal(categoryId) {
    closeItemModal();
    editingCategoryId = categoryId || null;
    const cat = editingCategoryId ? state.categories.find((c) => c.id === editingCategoryId) : null;
    $("#category-modal-title").textContent = I18n.t(cat ? "category.modal.titleEdit" : "category.modal.title");
    $("#new-category-name").value = cat ? getCategoryDisplayName(cat) : "";
    $("#category-modal-overlay").classList.add("active");
  }
  function closeCategoryModal() {
    $("#category-modal-overlay").classList.remove("active");
  }
  async function saveCategoryModal() {
    const name = $("#new-category-name").value.trim();
    if (!name) { alert(I18n.t("category.modal.nameRequired")); return; }

    if (editingCategoryId) {
      const cat = state.categories.find((c) => c.id === editingCategoryId);
      if (cat) {
        if (cat.i18n_key && name !== getCategoryDisplayName(cat)) cat.name_overridden = true;
        cat.name = name;
        await Storage.put("categories", cat);
      }
      closeCategoryModal();
      renderCategoryScreen();
      renderDashboard();
      return;
    }

    const category = createCategory({ name, custom: true, sort_order: state.categories.length });
    await Storage.put("categories", category);
    state.categories.push(category);
    closeCategoryModal();
    renderDashboard();
    openCategoryScreen(category.id);
  }

  async function deleteCategoryHandler(categoryId) {
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const items = state.items.filter((i) => i.category_id === categoryId);
    if (!confirm(I18n.t("category.deleteConfirm", { name: getCategoryDisplayName(cat), count: items.length }))) return;

    await Storage.delete("categories", categoryId);
    await Promise.all(items.map((i) => Storage.delete("items", i.id)));
    state.categories = state.categories.filter((c) => c.id !== categoryId);
    state.items = state.items.filter((i) => i.category_id !== categoryId);
    if (state.dashboardCategoryFilter === categoryId) state.dashboardCategoryFilter = null;
    navigateTo("dashboard");
  }

  /* ============================================================
   * CHECKLIST MODE
   * ============================================================ */
  function renderChecklist() {
    const annotated = annotateItemsWithStatus(state.items, state.profile)
      .filter((i) => i.type !== ITEM_TYPES.UKON);
    const packedCount = annotated.filter((i) => i.packed).length;
    $("#checklist-progress").textContent = I18n.t("checklist.progress", { packed: packedCount, total: annotated.length });
    const packedPct = annotated.length ? Math.round(packedCount / annotated.length * 100) : 0;
    $("#packing-percent").textContent = packedPct + " %";
    $("#packing-fill").style.width = packedPct + "%";
    $("#packing-panel").setAttribute("aria-valuenow", String(packedPct));
    $("#packing-panel").setAttribute("aria-label", I18n.t("checklist.packingProgress"));
    $("#packing-remaining").textContent = annotated.length
      ? I18n.t(packedCount === annotated.length ? "checklist.complete" : "checklist.remaining", { count: annotated.length - packedCount })
      : I18n.t("checklist.empty");
    $("#checklist-reset-btn").style.display = packedCount ? "block" : "none";

    const byCat = {};
    annotated.forEach((item) => {
      (byCat[item.category_id] = byCat[item.category_id] || []).push(item);
    });

    const wrap = $("#checklist-groups");
    wrap.innerHTML = "";
    state.categories
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((cat) => {
        const items = (byCat[cat.id] || []).sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
        if (!items.length) return;
        const title = document.createElement("h3");
        title.className = "checklist-group-title";
        const icon = document.createElement("span");
        icon.className = "checklist-group-icon";
        icon.innerHTML = categoryIcon(cat.i18n_key || cat.id);
        const titleName = document.createElement("span");
        titleName.textContent = getCategoryDisplayName(cat);
        const count = document.createElement("span");
        count.className = "checklist-group-count";
        count.textContent = items.filter((i) => i.packed).length + " / " + items.length;
        title.append(icon, titleName, count);
        wrap.appendChild(title);
        const card = document.createElement("div");
        card.className = "card";
        items.forEach((item) => card.appendChild(renderChecklistRow(item)));
        wrap.appendChild(card);
      });
  }

  function renderChecklistRow(item) {
    const row = document.createElement("label");
    row.className = "checklist-item" + (item.packed ? " packed" : "");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!item.packed;
    const copy = document.createElement("div");
    copy.className = "ci-copy";
    const name = document.createElement("div");
    name.className = "ci-name";
    name.textContent = getItemDisplayName(item);
    const meta = document.createElement("div");
    meta.className = "ci-meta status-text " + item.status;
    meta.textContent = I18n.t("status." + item.status) + " · " + fmtQty(item.current_quantity) + "/" + fmtQty(item.required_quantity) + " " + getUnitLabel(item.unit);
    copy.append(name, meta);
    row.append(checkbox, copy);
    row.querySelector("input").addEventListener("change", async (e) => {
      item.packed = e.target.checked;
      await Storage.put("items", item);
      const idx = state.items.findIndex((i) => i.id === item.id);
      if (idx !== -1) state.items[idx].packed = item.packed;
      renderChecklist();
    });
    return row;
  }

  async function resetChecklist() {
    if (!confirm(I18n.t("checklist.resetConfirm"))) return;
    const packedItems = state.items.filter((i) => i.packed);
    packedItems.forEach((i) => { i.packed = false; });
    await Storage.bulkPut("items", packedItems);
    renderChecklist();
  }

  /* ============================================================
   * FEED
   * ============================================================ */
  async function renderFeed(forceRefresh) {
    const statusEl = $("#feed-status");
    const listEl = $("#feed-list");
    statusEl.innerHTML = `<p style="text-align:center;">${I18n.t("feed.loading")}</p>`;
    let result;
    if (forceRefresh || navigator.onLine !== false) {
      result = await Feed.fetchAll();
    } else {
      result = Feed.getCachedOnly();
    }
    if (result.fromCache && result.items.length) {
      const note = result.fetched_at
        ? I18n.t("feed.offlineNoteWithTime", { note: I18n.t("feed.offlineNote"), time: new Date(result.fetched_at).toLocaleString(I18n.getLocale()) })
        : I18n.t("feed.offlineNote");
      statusEl.innerHTML = `<div class="feed-offline-note">${note}</div>`;
    } else if (result.error || navigator.onLine === false) {
      statusEl.innerHTML = `<div class="feed-offline-note">${I18n.t("feed.unavailable")}</div>`;
    } else {
      statusEl.innerHTML = "";
    }
    listEl.innerHTML = "";
    if (!result.items.length) {
      listEl.innerHTML = `<div class="empty-state">${I18n.t("feed.empty")}</div>`;
      return;
    }
    result.items.forEach((it) => {
      const div = document.createElement("div");
      div.className = "feed-item";
      const source = document.createElement("div");
      source.className = "fi-source";
      source.textContent = it.source || "";
      const title = document.createElement("div");
      title.className = "fi-title";
      title.textContent = it.title || "";
      let link = null;
      try {
        const url = new URL(it.link);
        if (url.protocol === "https:" || url.protocol === "http:") link = url.href;
      } catch (e) { /* malformed feed link: show title without a link */ }
      if (link) {
        const anchor = document.createElement("a");
        anchor.href = link;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.appendChild(title);
        div.appendChild(source, anchor);
      } else {
        div.append(source, title);
      }
      const date = document.createElement("div");
      date.className = "fi-date";
      const parsedDate = it.pubDate ? new Date(it.pubDate) : null;
      date.textContent = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toLocaleString(I18n.getLocale()) : "";
      div.appendChild(date);
      listEl.appendChild(div);
    });
  }

  /* ============================================================
   * SETTINGS
   * ============================================================ */
  function renderSettings() {
    populateLanguageSelect();
    renderInstallSection();

    renderThemeSwatches();

    $("#set-adults").textContent = state.profile.adults;
    $("#set-children").textContent = state.profile.children;
    $("#set-seniors").textContent = state.profile.seniors;
    $("#set-pets").textContent = state.profile.pets + (state.profile.pets ? " (" + I18n.t("petType." + state.profile.pet_type) + ")" : "");
    $("#set-days").textContent = I18n.t("common.daysCount", { count: state.profile.days });

    $("#set-notify-days").value = state.profile.global_notification_days_before;
    $("#set-coef-children").value = state.profile.coefficients.children;
    $("#set-coef-seniors").value = state.profile.coefficients.seniors;

    let dueInfo = isAnnualReviewDue(state.profile)
      ? I18n.t("settings.annualDue")
      : I18n.t("settings.annualNext", { days: daysUntilAnnualReview(state.profile) });
    if (state.profile.last_annual_review_at) {
      dueInfo += I18n.t("settings.annualLast", { date: state.profile.last_annual_review_at.slice(0, 10) });
    }
    $("#set-annual-info").textContent = dueInfo;

    renderNotificationStatus();
  }

  function renderNotificationStatus() {
    const statusEl = $("#notif-status");
    const btn = $("#notif-enable-btn");
    if (isNativeShell()) {
      // Handled natively (WorkManager + a headless background check, posted
      // through Android's own notification system) - the Web Notification
      // API isn't used at all in this shell, so there's nothing to enable here.
      statusEl.textContent = I18n.t("notif.nativeManaged");
      btn.style.display = "none";
      return;
    }
    if (typeof NotificationsRuntime === "undefined") { statusEl.textContent = ""; btn.style.display = "none"; return; }
    if (isIOSDevice() && !isStandaloneDisplay()) {
      // iOS only grants Notification permission to a PWA added to the home screen -
      // in a plain Safari tab the button would do nothing, so explain that instead.
      statusEl.textContent = I18n.t("notif.iosInstallFirst");
      btn.style.display = "none";
      return;
    }
    const status = NotificationsRuntime.getPermissionStatus();
    const labels = { granted: "notif.statusEnabled", denied: "notif.statusDenied", default: "notif.statusDefault", unsupported: "notif.statusUnsupported" };
    statusEl.textContent = I18n.t(labels[status] || "notif.statusDefault");
    btn.style.display = status === "default" ? "block" : "none";
  }

  async function enableNotifications() {
    if (typeof NotificationsRuntime === "undefined") return;
    await NotificationsRuntime.requestPermission();
    renderNotificationStatus();
    NotificationsRuntime.runForegroundCheck(state.items, state.profile);
  }

  /* ---------------- Backup export / import ---------------- */

  async function exportData() {
    const data = await Storage.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evakuacni-zavazadlo-zaloha-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert(I18n.t("settings.exportDone"));
  }

  function handleImportFile(file) {
    if (!confirm(I18n.t("settings.importConfirm"))) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { alert(I18n.t("settings.importInvalid")); return; }
      try {
        await Storage.importAll(data);
      } catch (e) {
        alert(I18n.t("settings.importInvalid"));
        return;
      }
      alert(I18n.t("settings.importDone"));
      location.reload();
    };
    reader.onerror = () => alert(I18n.t("settings.importInvalid"));
    reader.readAsText(file);
  }

  async function saveSettings() {
    state.profile.global_notification_days_before = parseInt($("#set-notify-days").value, 10) || 14;
    state.profile.coefficients = {
      children: parseFloat($("#set-coef-children").value) || 0,
      seniors: parseFloat($("#set-coef-seniors").value) || 0
    };
    await Storage.put("profiles", state.profile);
    alert(I18n.t("settings.saved"));
    renderDashboard();
  }

  async function markAnnualReviewDone() {
    state.profile.last_annual_review_at = new Date().toISOString();
    await Storage.put("profiles", state.profile);
    renderSettings();
    renderDashboard();
  }

  async function resetApp() {
    if (!confirm(I18n.t("settings.resetConfirm"))) return;
    await Promise.all([
      Storage.clear("meta"), Storage.clear("profiles"), Storage.clear("categories"),
      Storage.clear("items"), Storage.clear("photos")
    ]);
    location.reload();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
