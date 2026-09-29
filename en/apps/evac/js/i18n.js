/**
 * i18n.js
 * Lokalizace - jeden centrální modul, žádné jiné soubory nenesou UI text natvrdo.
 *
 * ARCHITEKTURA (proč je to takhle - důležité pro rozšíření na 10+ jazyků):
 *  1. UI_STRINGS   - texty rozhraní appky (tlačítka, nadpisy, hlášky). Klíč je
 *                    stabilní cesta typu "dashboard.title", hodnota je text
 *                    NEBO objekt s pluralizačními tvary { one, few, other }.
 *  2. TEMPLATE_STRINGS - texty obsahu předpřipravených šablon (názvy kategorií
 *                    a položek + poznámky). Oddělené od UI_STRINGS záměrně:
 *                    obsah šablon je uživatelská data (uživatel je může
 *                    přejmenovat), zatímco UI_STRINGS je čistě rozhraní appky.
 *  3. UNIT_LABELS  - popisky pro jazykově neutrální kódy jednotek uložené
 *                    v datech (pcs, l, kg, pack, roll, pair, set, tablet,
 *                    sachet, czk, eur...).
 *  4. PLURAL_RULES - pro každý jazyk funkce (počet) -> tvar ("one"/"few"/"other"),
 *                    protože čeština má jiná pravidla množného čísla než
 *                    angličtina (a další jazyky budou mít jiná zase).
 *
 * PŘIDÁNÍ NOVÉHO JAZYKA (např. němčiny):
 *  - Přidat řádek do SUPPORTED_LOCALES: { code:"de", name:"Deutsch" }
 *  - Přidat `de: {...}` do UI_STRINGS, TEMPLATE_STRINGS a UNIT_LABELS
 *    (klidně postupně - chybějící klíč automaticky spadne na FALLBACK_LOCALE)
 *  - Volitelně přidat pravidlo do PLURAL_RULES.de (jinak se použije "other")
 *  Nikde jinde v kódu (app.js, index.html, templates.js...) se nic nemění -
 *  jazykový přepínač v Nastavení se generuje automaticky z SUPPORTED_LOCALES.
 */

const DEFAULT_LOCALE = "cs";
const FALLBACK_LOCALE = "en";

/**
 * Seznam jazyků nabízených v UI. Jazyk se v přepínači zobrazí, jen pokud
 * pro něj existuje záznam v UI_STRINGS (viz I18n.availableLocales()) -
 * takže sem je možné přidávat jazyky předem, ještě před dodáním překladu.
 */
const SUPPORTED_LOCALES = [
  { code: "cs", name: "Čeština" },
  { code: "en", name: "English" }
  // Připraveno na rozšíření, např.:
  // { code: "de", name: "Deutsch" },
  // { code: "sk", name: "Slovenčina" },
  // { code: "pl", name: "Polski" },
  // { code: "uk", name: "Українська" },
  // { code: "fr", name: "Français" },
  // { code: "es", name: "Español" },
  // { code: "it", name: "Italiano" },
  // { code: "ro", name: "Română" },
  // { code: "vi", name: "Tiếng Việt" },
];

const PLURAL_RULES = {
  cs: (n) => (n === 1 ? "one" : (n >= 2 && n <= 4 ? "few" : "other")),
  en: (n) => (n === 1 ? "one" : "other")
};

/* ================= UI_STRINGS ================= */
const UI_STRINGS = {
  cs: {
    "app.title": "Evakuační zavazadlo",
    "header.title": "Evakuační zavazadlo",

    "common.back": "‹ Zpět",
    "common.backToOverview": "‹ Zpět na přehled",
    "common.continue": "Pokračovat",
    "common.save": "Uložit",
    "common.create": "Vytvořit",

    "onboarding.welcome.title": "Evakuační zavazadlo",
    "onboarding.welcome.body": "Sestavte si a udržujte domácí zásoby pro krizové situace - vodu, jídlo, léky i doklady. Appka funguje offline a hlídá expirace za vás.",
    "onboarding.welcome.cta": "Začít nastavení",

    "onboarding.household.title": "Vaše domácnost",
    "onboarding.household.body": "Podle toho appka přepočítá potřebné množství zásob.",
    "onboarding.household.adults": "Dospělí",
    "onboarding.household.children": "Děti",
    "onboarding.household.seniors": "Senioři",
    "onboarding.household.pets": "Domácí mazlíčci",
    "onboarding.household.petType": "Druh zvířete",
    "onboarding.household.duration": "Doba udržitelnosti zásob",
    "onboarding.household.customDaysLabel": "Počet dní",

    "duration.48h": "48 h",
    "duration.72h": "72 h",
    "duration.5d": "5 dní",
    "duration.7d": "7 dní",
    "duration.10d": "10 dní",
    "duration.custom": "Vlastní",

    "petType.dog": "Pes",
    "petType.cat": "Kočka",
    "petType.other": "Jiné",

    "onboarding.templates.title": "Šablony kategorií",
    "onboarding.templates.body": "Vyberte, které kategorie chcete rovnou naimportovat. Kdykoliv později přidáte vlastní.",

    "onboarding.summary.title": "Souhrn",
    "onboarding.summary.categories": "Vybrané kategorie",
    "onboarding.summary.note": "Množství jde po importu kdykoliv ručně upravit u jednotlivých položek.",
    "onboarding.summary.cta": "Naimportovat a otevřít Dashboard",

    "dashboard.title": "Přehled",
    "dashboard.readiness": "Připravenost zavazadla",
    "dashboard.level.empty": "Začněte přidáním položek",
    "dashboard.level.starting": "První kroky",
    "dashboard.level.building": "Příprava pokračuje",
    "dashboard.level.ready": "Dobře připraveno",
    "dashboard.readyCount": "Připraveno {ready} z {total} položek",
    "dashboard.nextAction": "Nejbližší krok",
    "dashboard.openItem": "Otevřít položku",
    "dashboard.attentionTitle": "Vyžaduje pozornost",
    "dashboard.categoriesTitle": "Kategorie",
    "dashboard.addCategory": "+ Přidat vlastní kategorii",
    "dashboard.openChecklist": "Checklist mód pro evakuaci",
    "dashboard.allGood": "Vše v pořádku. 🎉",
    "dashboard.noneInCategory": "V této kategorii nic nevyžaduje pozornost.",
    "dashboard.filterAll": "Vše",
    "dashboard.noCategories": "Zatím žádné kategorie.",
    "dashboard.annualDueBanner": "⚠️ Roční revize zavazadla je po termínu. Projděte kategorie a zkontrolujte vše.",
    "dashboard.summary.criticalCheck": "Kritické/kontrola",

    "category.defaultTitle": "Kategorie",
    "category.readiness": "Stav kategorie",
    "category.readyItems": "{ready} z {total} připraveno",
    "item.decrease": "Snížit množství",
    "item.increase": "Zvýšit množství",
    "category.noItems": "Zatím žádné položky.",
    "category.addItem": "+ Přidat položku",

    "checklist.title": "Checklist mód",
    "checklist.body": "Zaškrtněte, co je sbaleno. Bez editace - rychlá orientace ve stresu.",
    "checklist.progress": "{packed} / {total} sbaleno",
    "checklist.packingProgress": "Průběh balení",
    "checklist.remaining": "Ještě sbalit: {count}",
    "checklist.complete": "Vše je sbaleno",
    "checklist.empty": "Zatím žádné položky k balení",

    "feed.title": "Novinky",
    "feed.empty": "Zatím žádné novinky k zobrazení.",
    "feed.loading": "Načítám novinky…",
    "feed.offlineNote": "Offline / nedostupný zdroj - zobrazena poslední uložená verze",
    "feed.offlineNoteWithTime": "{note} ({time})",

    "settings.title": "Nastavení",
    "settings.appearance": "Vzhled",
    "settings.language": "Jazyk",
    "settings.household": "Domácnost",
    "settings.householdNote": "Změna profilu v MVP zatím nepřepočítává zpětně existující položky - upravte množství ručně u položek, kterých se změna týká.",
    "settings.install": "Instalace do telefonu",
    "install.installed": "Appka je nainstalovaná v telefonu.",
    "install.promptAvailable": "Appku můžete nainstalovat na plochu - poběží jako samostatná appka i offline.",
    "install.button": "Instalovat appku",
    "install.genericHint": "Appku nainstalujete přes nabídku prohlížeče (obvykle „Přidat na plochu“ nebo „Nainstalovat appku“).",
    "install.iosIntro": "Na iPhonu/iPadu se appka instaluje ručně přes Safari:",
    "install.iosStep1": "1. Klepněte na 📤 Sdílet dole v Safari",
    "install.iosStep2": "2. Vyberte „Přidat na plochu“",
    "install.iosStep3": "3. Potvrďte „Přidat“",
    "install.iosNote": "Funguje jen v Safari (ne v Chrome na iOS) - jinak se volba „Přidat na plochu“ nenabídne.",
    "settings.notifications": "Notifikace",
    "settings.notifyDaysLabel": "Výchozí předstih upozornění na expiraci (dní)",
    "settings.coefficients": "Koeficienty přepočtu (spotřeba na den)",
    "settings.coefChildLabel": "Dítě (podíl spotřeby dospělého)",
    "settings.coefSeniorLabel": "Senior (podíl spotřeby dospělého)",
    "settings.saveSettings": "Uložit nastavení",
    "settings.saved": "Nastavení uloženo.",
    "settings.annualReview": "Roční revize",
    "settings.annualDue": "Roční revize je po termínu.",
    "settings.annualNext": "Příští roční revize za {days} dní.",
    "settings.annualLast": " (poslední: {date})",
    "settings.markAnnualDone": "Označit revizi jako hotovou dnes",
    "settings.data": "Data",
    "settings.resetApp": "Smazat vše a spustit znovu",
    "settings.resetConfirm": "Opravdu smazat všechna data appky a spustit nastavení znovu? Tuto akci nelze vrátit zpět.",
    "settings.exportData": "Exportovat zálohu (JSON)",
    "settings.importData": "Nahrát zálohu (JSON)",
    "settings.exportDone": "Záloha stažena.",
    "settings.importConfirm": "Nahrání zálohy přepíše všechna aktuální data appky. Pokračovat?",
    "settings.importInvalid": "Soubor nevypadá jako platná záloha této appky.",
    "settings.importDone": "Záloha nahrána. Appka se teď znovu načte.",

    "settings.pushNotifications": "Upozornění",
    "notif.enable": "Povolit upozornění",
    "notif.statusEnabled": "Upozornění jsou povolena.",
    "notif.statusDenied": "Upozornění jsou v prohlížeči zablokovaná - povol je v nastavení webu.",
    "notif.statusDefault": "Upozornění zatím nejsou zapnutá.",
    "notif.statusUnsupported": "Tento prohlížeč upozornění nepodporuje.",
    "notif.nativeManaged": "Upozornění na expiraci a kontroly appka hlídá automaticky na pozadí.",
    "notif.iosInstallFirst": "Na iPhonu/iPadu upozornění fungují až po instalaci appky na plochu (viz sekce Instalace do telefonu výše).",
    "notif.backgroundNote": "Appka umí upozornit na expiraci/kontrolu jednou denně i bez otevření, ale jen v Chrome/Edge nainstalovaných na plochu (Android/desktop) - záleží na prohlížeči, jak často to skutečně spustí. V Safari na iOS to bez vlastního serveru nejde; tam appka upozorní vždy aspoň při otevření.",
    "notif.summaryBody": { one: "{count} položka potřebuje pozornost (expirace/kontrola).", few: "{count} položky potřebují pozornost (expirace/kontrola).", other: "{count} položek potřebuje pozornost (expirace/kontrola)." },

    "theme.light": "Světlý",
    "theme.dark": "Tmavý",
    "theme.color": "Barevný",
    "theme.colorful": "Barevný",
    "theme.contrast": "Vysoký kontrast",
    "theme.scifi": "Sci-fi",
    "theme.fantasy": "Fantasy",
    "theme.aesthetic": "Aesthetic",
    "theme.ddr": "DDR",
    "theme.scriptorium": "Scriptorium",
    "theme.dirty": "Zašlý",
    "theme.secret": "Tajné",
    "theme.handwritten": "Ručně psané",
    "theme.terminal": "Terminál",
    "theme.fallout": "Fallout",
    "theme.intothewild": "Do divočiny",

    "item.modal.titleNew": "Nová položka",
    "item.modal.titleEdit": "Upravit položku",
    "item.modal.name": "Název",
    "item.modal.type": "Typ",
    "item.modal.unit": "Jednotka",
    "item.modal.unitPlaceholder": "ks, l, balení...",
    "item.modal.required": "Požadované množství",
    "item.modal.current": "Aktuální množství",
    "item.modal.expiration": "Datum expirace (nepovinné)",
    "item.modal.notifyDays": "Upozornit kolik dní předem (nepovinné, jinak globální nastavení)",
    "item.modal.intervalDays": "Interval kontroly (dní)",
    "item.modal.note": "Poznámka",
    "item.modal.notePlaceholder": "dávkování, alergie, poznámky...",
    "item.modal.photo": "Fotka",
    "item.modal.save": "Uložit",
    "item.modal.delete": "Smazat položku",
    "item.modal.nameRequired": "Zadejte název položky.",
    "item.modal.deleteConfirm": "Opravdu smazat tuto položku?",

    "itemType.spotrebni": "Spotřební",
    "itemType.trvala": "Trvalá",
    "itemType.dokument": "Dokument",
    "itemType.ukon": "Úkon",

    "category.modal.title": "Nová kategorie",
    "category.modal.titleEdit": "Přejmenovat kategorii",
    "category.modal.nameLabel": "Název kategorie",
    "category.modal.nameRequired": "Zadejte název kategorie.",
    "category.renameAction": "Přejmenovat kategorii",
    "category.deleteAction": "Smazat kategorii",
    "category.deleteConfirm": "Opravdu smazat kategorii „{name}“ včetně všech {count} položek? Tuto akci nelze vrátit zpět.",

    "item.quickCheck": "Zkontrolováno dnes",

    "checklist.reset": "Odškrtnout vše",
    "checklist.resetConfirm": "Odškrtnout všechny položky checklistu?",

    "nav.dashboard": "Přehled",
    "nav.checklist": "Checklist",
    "nav.feed": "Novinky",
    "nav.settings": "Nastavení",

    "status.ok": "OK",
    "status.missing": "Chybí",
    "status.expiring_soon": "Brzy expiruje",
    "status.expired": "Expirováno",
    "status.needs_check": "Ke kontrole",

    "item.subtext.checkInterval": "Kontrola každých {days} dní",
    "item.subtext.expSuffix": " · exp. {date}",

    "common.itemsCount": { one: "{count} položka", few: "{count} položky", other: "{count} položek" },
    "common.daysCount": { one: "{count} den", few: "{count} dny", other: "{count} dní" },
    "dashboard.attentionSuffix": { one: " · {count} vyžaduje pozornost", few: " · {count} vyžadují pozornost", other: " · {count} vyžaduje pozornost" }
  },

  en: {
    "app.title": "Evacuation Kit",
    "header.title": "Evac Bag",

    "common.back": "‹ Back",
    "common.backToOverview": "‹ Back to overview",
    "common.continue": "Continue",
    "common.save": "Save",
    "common.create": "Create",

    "onboarding.welcome.title": "Evacuation Kit",
    "onboarding.welcome.body": "Build and maintain your household emergency supplies - water, food, medication and documents. The app works offline and tracks expiry dates for you.",
    "onboarding.welcome.cta": "Start setup",

    "onboarding.household.title": "Your household",
    "onboarding.household.body": "The app uses this to calculate how much you need.",
    "onboarding.household.adults": "Adults",
    "onboarding.household.children": "Children",
    "onboarding.household.seniors": "Seniors",
    "onboarding.household.pets": "Pets",
    "onboarding.household.petType": "Type of pet",
    "onboarding.household.duration": "How long supplies should last",
    "onboarding.household.customDaysLabel": "Number of days",

    "duration.48h": "48 h",
    "duration.72h": "72 h",
    "duration.5d": "5 days",
    "duration.7d": "7 days",
    "duration.10d": "10 days",
    "duration.custom": "Custom",

    "petType.dog": "Dog",
    "petType.cat": "Cat",
    "petType.other": "Other",

    "onboarding.templates.title": "Category templates",
    "onboarding.templates.body": "Choose which categories to import right away. You can add your own anytime later.",

    "onboarding.summary.title": "Summary",
    "onboarding.summary.categories": "Selected categories",
    "onboarding.summary.note": "You can manually adjust quantities for any item after importing.",
    "onboarding.summary.cta": "Import and open Dashboard",

    "dashboard.title": "Overview",
    "dashboard.readiness": "Kit readiness",
    "dashboard.level.empty": "Start by adding items",
    "dashboard.level.starting": "First steps",
    "dashboard.level.building": "Preparation in progress",
    "dashboard.level.ready": "Well prepared",
    "dashboard.readyCount": "{ready} of {total} items ready",
    "dashboard.nextAction": "Next step",
    "dashboard.openItem": "Open item",
    "dashboard.attentionTitle": "Needs attention",
    "dashboard.categoriesTitle": "Categories",
    "dashboard.addCategory": "+ Add custom category",
    "dashboard.openChecklist": "Checklist mode for evacuation",
    "dashboard.allGood": "Everything's in order. 🎉",
    "dashboard.noneInCategory": "Nothing in this category needs attention.",
    "dashboard.filterAll": "All",
    "dashboard.noCategories": "No categories yet.",
    "dashboard.annualDueBanner": "⚠️ Your annual kit review is overdue. Go through your categories and check everything.",
    "dashboard.summary.criticalCheck": "Critical/check",

    "category.defaultTitle": "Category",
    "category.readiness": "Category readiness",
    "category.readyItems": "{ready} of {total} ready",
    "item.decrease": "Decrease quantity",
    "item.increase": "Increase quantity",
    "category.noItems": "No items yet.",
    "category.addItem": "+ Add item",

    "checklist.title": "Checklist mode",
    "checklist.body": "Tick off what's packed. No editing - fast orientation under stress.",
    "checklist.progress": "{packed} / {total} packed",
    "checklist.packingProgress": "Packing progress",
    "checklist.remaining": "Still to pack: {count}",
    "checklist.complete": "Everything is packed",
    "checklist.empty": "No items to pack yet",

    "feed.title": "News",
    "feed.empty": "No news to show yet.",
    "feed.loading": "Loading news…",
    "feed.offlineNote": "Offline / source unavailable - showing the last saved version",
    "feed.offlineNoteWithTime": "{note} ({time})",

    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.language": "Language",
    "settings.household": "Household",
    "settings.householdNote": "In this MVP, changing the profile does not retroactively recalculate existing items - adjust affected item quantities manually.",
    "settings.install": "Install on your phone",
    "install.installed": "The app is installed on this phone.",
    "install.promptAvailable": "You can install the app to your home screen - it'll run as a standalone app, even offline.",
    "install.button": "Install app",
    "install.genericHint": "Install the app from your browser's menu (usually \"Add to Home Screen\" or \"Install app\").",
    "install.iosIntro": "On iPhone/iPad the app is installed manually through Safari:",
    "install.iosStep1": "1. Tap 📤 Share at the bottom of Safari",
    "install.iosStep2": "2. Choose \"Add to Home Screen\"",
    "install.iosStep3": "3. Confirm \"Add\"",
    "install.iosNote": "Only works in Safari (not Chrome on iOS) - otherwise the \"Add to Home Screen\" option won't show up.",
    "settings.notifications": "Notifications",
    "settings.notifyDaysLabel": "Default lead time for expiry warnings (days)",
    "settings.coefficients": "Recalculation coefficients (daily consumption)",
    "settings.coefChildLabel": "Child (share of adult consumption)",
    "settings.coefSeniorLabel": "Senior (share of adult consumption)",
    "settings.saveSettings": "Save settings",
    "settings.saved": "Settings saved.",
    "settings.annualReview": "Annual review",
    "settings.annualDue": "The annual review is overdue.",
    "settings.annualNext": "Next annual review in {days} days.",
    "settings.annualLast": " (last: {date})",
    "settings.markAnnualDone": "Mark review as done today",
    "settings.data": "Data",
    "settings.resetApp": "Delete everything and start over",
    "settings.resetConfirm": "Really delete all app data and restart setup? This cannot be undone.",
    "settings.exportData": "Export backup (JSON)",
    "settings.importData": "Restore backup (JSON)",
    "settings.exportDone": "Backup downloaded.",
    "settings.importConfirm": "Restoring a backup will overwrite all current app data. Continue?",
    "settings.importInvalid": "This file doesn't look like a valid backup for this app.",
    "settings.importDone": "Backup restored. The app will now reload.",

    "settings.pushNotifications": "Notifications",
    "notif.enable": "Enable notifications",
    "notif.statusEnabled": "Notifications are enabled.",
    "notif.statusDenied": "Notifications are blocked in the browser - allow them in the site settings.",
    "notif.statusDefault": "Notifications aren't turned on yet.",
    "notif.statusUnsupported": "This browser doesn't support notifications.",
    "notif.nativeManaged": "The app checks for expiring/overdue items automatically in the background.",
    "notif.iosInstallFirst": "On iPhone/iPad, notifications only work after installing the app to your home screen (see \"Install on your phone\" above).",
    "notif.backgroundNote": "The app can send one daily alert about expiry/checks even when it's not open, but only in Chrome/Edge installed to the home screen or desktop - the browser decides how often that actually runs. On iOS Safari this isn't possible without a push server; there the app will still alert you every time you open it.",
    "notif.summaryBody": { one: "{count} item needs attention (expiry/check).", other: "{count} items need attention (expiry/check)." },

    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.color": "Colorful",
    "theme.colorful": "Colorful",
    "theme.contrast": "High contrast",
    "theme.scifi": "Sci-fi",
    "theme.fantasy": "Fantasy",
    "theme.aesthetic": "Aesthetic",
    "theme.ddr": "DDR",
    "theme.scriptorium": "Scriptorium",
    "theme.dirty": "Dirty",
    "theme.secret": "Secret",
    "theme.handwritten": "Handwritten",
    "theme.terminal": "Terminal",
    "theme.fallout": "Fallout",
    "theme.intothewild": "Into the Wild",

    "item.modal.titleNew": "New item",
    "item.modal.titleEdit": "Edit item",
    "item.modal.name": "Name",
    "item.modal.type": "Type",
    "item.modal.unit": "Unit",
    "item.modal.unitPlaceholder": "pcs, l, pack...",
    "item.modal.required": "Required quantity",
    "item.modal.current": "Current quantity",
    "item.modal.expiration": "Expiry date (optional)",
    "item.modal.notifyDays": "Warn how many days ahead (optional, otherwise global setting)",
    "item.modal.intervalDays": "Check interval (days)",
    "item.modal.note": "Note",
    "item.modal.notePlaceholder": "dosage, allergies, notes...",
    "item.modal.photo": "Photo",
    "item.modal.save": "Save",
    "item.modal.delete": "Delete item",
    "item.modal.nameRequired": "Please enter an item name.",
    "item.modal.deleteConfirm": "Really delete this item?",

    "itemType.spotrebni": "Consumable",
    "itemType.trvala": "Durable",
    "itemType.dokument": "Document",
    "itemType.ukon": "Task",

    "category.modal.title": "New category",
    "category.modal.titleEdit": "Rename category",
    "category.modal.nameLabel": "Category name",
    "category.modal.nameRequired": "Please enter a category name.",
    "category.renameAction": "Rename category",
    "category.deleteAction": "Delete category",
    "category.deleteConfirm": "Really delete category \"{name}\" including all {count} items? This cannot be undone.",

    "item.quickCheck": "Checked today",

    "checklist.reset": "Uncheck all",
    "checklist.resetConfirm": "Uncheck every checklist item?",

    "nav.dashboard": "Overview",
    "nav.checklist": "Checklist",
    "nav.feed": "News",
    "nav.settings": "Settings",

    "status.ok": "OK",
    "status.missing": "Missing",
    "status.expiring_soon": "Expiring soon",
    "status.expired": "Expired",
    "status.needs_check": "Needs check",

    "item.subtext.checkInterval": "Check every {days} days",
    "item.subtext.expSuffix": " · exp. {date}",

    "common.itemsCount": { one: "{count} item", other: "{count} items" },
    "common.daysCount": { one: "{count} day", other: "{count} days" },
    "dashboard.attentionSuffix": { one: " · {count} needs attention", other: " · {count} need attention" }
  }
};

/* ================= UNIT_LABELS ================= */
const UNIT_LABELS = {
  cs: { pcs: "ks", l: "l", g: "g", kg: "kg", pack: "balení", roll: "role", pair: "pár", set: "sada", tablet: "tablet", sachet: "sáček", czk: "Kč", eur: "EUR", "": "" },
  en: { pcs: "pcs", l: "L", g: "g", kg: "kg", pack: "pack", roll: "roll", pair: "pair", set: "set", tablet: "tablet", sachet: "sachet", czk: "CZK", eur: "EUR", "": "" }
};

/* ================= TEMPLATE_STRINGS ================= */
const TEMPLATE_STRINGS = {
  cs: {
    "category.documents": "Doklady a finance",
    "category.water": "Voda",
    "category.food": "Trvanlivé jídlo",
    "category.medical": "Lékárnička",
    "category.equipment": "Technika a nářadí",
    "category.hygiene": "Hygiena",
    "category.clothing": "Oblečení",
    "category.misc": "Ostatní",
    "category.pets": "Domácí mazlíčci",

    "item.doc_photos": "Foto dokladů v mobilu (OP, řidičák, kartička pojišťovny, pojistky)",
    "note.doc_photos": "Aktualizovat po každé výměně dokladu",
    "item.birth_cert_copies": "Kopie rodných listů",
    "item.cash_czk": "Hotovost CZK",
    "item.cash_eur": "Hotovost EUR",
    "item.contacts_list": "Seznam důležitých kontaktů (papírově)",

    "item.water_bottled": "Balená pitná voda",
    "item.water_canister": "Kanystr na užitkovou vodu",
    "item.water_purification_tablets": "Tablety na nouzové čištění vody",

    "item.food_uht_milk": "Trvanlivé mléko",
    "item.food_durable_bread": "Trvanlivé pečivo",
    "item.food_cereal": "Cereálie / müsli",
    "item.food_oats": "Ovesné vločky",
    "item.food_nuts": "Oříšky",
    "item.food_canned_meat": "Konzervy - maso",
    "item.food_canned_veg": "Konzervy - zelenina",
    "item.food_canned_legumes": "Konzervy - luštěniny",
    "item.food_canned_fruit": "Konzervy - ovoce",
    "item.food_honey_preserves": "Med a zavařeniny",
    "item.food_dried_fruit": "Sušené ovoce",
    "item.food_dried_meat": "Sušené maso",
    "item.food_energy_bars": "Energetické/proteinové tyčinky",
    "item.food_biscuits": "Sušenky",
    "item.food_chocolate": "Čokoláda",
    "item.food_glucose_sugar": "Hroznový cukr",
    "item.food_salt": "Sůl",
    "item.food_instant_meals": "Instantní polévky/jídla",

    "item.med_regular_medication": "Pravidelně užívané léky (na 2 týdny)",
    "note.med_regular_medication": "Doplnit vlastní seznam dle diagnózy",
    "item.med_allergy_card": "Voděodolný seznam alergií/krevní skupiny/dávkování",
    "item.med_inhaler_spare": "Inhalátor (náhradní)",
    "item.med_glasses_spare": "Náhradní brýle",
    "item.med_pressure_bandage": "Obvazy tlakové",
    "item.med_bandage": "Obvazy normální",
    "item.med_waterproof_plasters": "Voděodolné náplasti (cívka + sada)",
    "item.med_elastic_bandage": "Elastické obinadlo",
    "item.med_triangular_bandage": "Trojcípý šátek",
    "item.med_tourniquet": "Pryžové škrtidlo",
    "item.med_thermal_blanket": "Izotermická fólie",
    "item.med_scissors": "Ostré nůžky",
    "item.med_tweezers": "Pinzeta",
    "item.med_safety_pins": "Spínací špendlíky",
    "item.med_latex_gloves": "Latexové rukavice",
    "item.med_cpr_mask": "Resuscitační rouška",
    "item.med_disinfectant_spray": "Dezinfekční sprej",
    "item.med_painkillers": "Analgetika",
    "item.med_activated_charcoal": "Živočišné uhlí",
    "item.med_antidiarrheal": "Léky proti průjmu",
    "item.med_rehydration_salts": "Rehydratační roztok (prášek)",
    "item.med_hand_sanitizer": "Dezinfekční gel na ruce",

    "item.eq_smoke_gas_detector": "Autonomní detektor kouře a plynu",
    "note.eq_smoke_gas_detector": "Kontrola baterie",
    "item.eq_battery_radio": "Rádio na baterie",
    "item.eq_flashlight": "Svítilna na baterie",
    "item.eq_spare_batteries": "Náhradní baterie",
    "item.eq_gas_stove": "Propan-butanový vařič + náhradní náplň",
    "item.eq_multitool": "Multifunkční nůž",
    "item.eq_fire_blanket": "Hasicí deka",
    "item.eq_duct_tape": "Pevná lepicí páska",
    "item.eq_power_bank": "Power banka",
    "item.eq_cables_chargers": "Kabely/nabíječky",
    "item.eq_newspapers": "Staré noviny",
    "note.eq_newspapers": "podpal, izolace, hygiena",
    "item.eq_full_car_tank": "Plná nádrž v autě",
    "item.eq_paper_map": "Mapa oblasti (papírová)",

    "item.hyg_toilet_paper": "Toaletní papír",
    "item.hyg_sanitary_pads": "Hygienické vložky",
    "item.hyg_trash_bags": "Pytle na odpadky",
    "item.hyg_wet_wipes": "Vlhčené ubrousky",
    "item.hyg_paper_towels": "Papírové kuchyňské utěrky",
    "item.hyg_disposable_dishes": "Trvanlivé nádobí (jednorázové)",
    "item.hyg_soap_shampoo": "Mýdlo / šampon",
    "item.hyg_toothbrush_paste": "Zubní kartáček + pasta",

    "item.cloth_underwear": "Zásoba spodního prádla na 10 dní",
    "item.cloth_socks": "Ponožky",
    "item.cloth_raincoat": "Pláštěnka / nepromokavé oblečení",
    "item.cloth_sturdy_shoes": "Pevná obuv (náhradní)",
    "item.cloth_sleeping_bag": "Spací pytel / deka",
    "item.cloth_warm_layer": "Teplá vrstva oblečení",

    "item.misc_kids_games": "Karty / hry pro děti",
    "note.misc_kids_games": "jen pokud jsou v profilu děti",
    "item.misc_stationery": "Psací potřeby + papír",
    "item.misc_whistle": "Píšťalka (signalizace)",

    "item.pet_food": "Krmivo pro zvíře",
    "item.pet_water": "Voda pro zvíře",
    "item.pet_leash_carrier": "Vodítko/přepravka",
    "item.pet_vaccination_docs": "Doklady o očkování",
    "item.pet_medication": "Léky pro zvíře"
  },

  en: {
    "category.documents": "Documents & finance",
    "category.water": "Water",
    "category.food": "Non-perishable food",
    "category.medical": "First aid & medical",
    "category.equipment": "Equipment & tools",
    "category.hygiene": "Hygiene",
    "category.clothing": "Clothing",
    "category.misc": "Miscellaneous",
    "category.pets": "Pets",

    "item.doc_photos": "Photos of ID documents on your phone (ID card, driving licence, insurance card, policies)",
    "note.doc_photos": "Update after every document renewal",
    "item.birth_cert_copies": "Copies of birth certificates",
    "item.cash_czk": "Cash CZK",
    "item.cash_eur": "Cash EUR",
    "item.contacts_list": "List of important contacts (printed)",

    "item.water_bottled": "Bottled drinking water",
    "item.water_canister": "Canister for utility water",
    "item.water_purification_tablets": "Emergency water purification tablets",

    "item.food_uht_milk": "UHT milk",
    "item.food_durable_bread": "Long-life bread/crackers",
    "item.food_cereal": "Cereal / muesli",
    "item.food_oats": "Rolled oats",
    "item.food_nuts": "Nuts",
    "item.food_canned_meat": "Canned meat",
    "item.food_canned_veg": "Canned vegetables",
    "item.food_canned_legumes": "Canned legumes",
    "item.food_canned_fruit": "Canned fruit",
    "item.food_honey_preserves": "Honey & preserves",
    "item.food_dried_fruit": "Dried fruit",
    "item.food_dried_meat": "Dried meat",
    "item.food_energy_bars": "Energy/protein bars",
    "item.food_biscuits": "Biscuits",
    "item.food_chocolate": "Chocolate",
    "item.food_glucose_sugar": "Glucose/dextrose sugar",
    "item.food_salt": "Salt",
    "item.food_instant_meals": "Instant soups/meals",

    "item.med_regular_medication": "Regularly used medication (2-week supply)",
    "note.med_regular_medication": "Add your own list per diagnosis",
    "item.med_allergy_card": "Waterproof card with allergies/blood type/dosage",
    "item.med_inhaler_spare": "Spare inhaler",
    "item.med_glasses_spare": "Spare glasses",
    "item.med_pressure_bandage": "Pressure bandages",
    "item.med_bandage": "Standard bandages",
    "item.med_waterproof_plasters": "Waterproof plasters (roll + set)",
    "item.med_elastic_bandage": "Elastic bandage",
    "item.med_triangular_bandage": "Triangular bandage",
    "item.med_tourniquet": "Rubber tourniquet",
    "item.med_thermal_blanket": "Emergency thermal blanket",
    "item.med_scissors": "Sharp scissors",
    "item.med_tweezers": "Tweezers",
    "item.med_safety_pins": "Safety pins",
    "item.med_latex_gloves": "Latex gloves",
    "item.med_cpr_mask": "CPR resuscitation mask",
    "item.med_disinfectant_spray": "Disinfectant spray",
    "item.med_painkillers": "Painkillers",
    "item.med_activated_charcoal": "Activated charcoal",
    "item.med_antidiarrheal": "Anti-diarrhoeal medication",
    "item.med_rehydration_salts": "Oral rehydration salts (sachets)",
    "item.med_hand_sanitizer": "Hand sanitizer gel",

    "item.eq_smoke_gas_detector": "Standalone smoke & gas detector",
    "note.eq_smoke_gas_detector": "Check the battery",
    "item.eq_battery_radio": "Battery-powered radio",
    "item.eq_flashlight": "Battery flashlight",
    "item.eq_spare_batteries": "Spare batteries",
    "item.eq_gas_stove": "Propane-butane stove + spare cartridge",
    "item.eq_multitool": "Multitool knife",
    "item.eq_fire_blanket": "Fire blanket",
    "item.eq_duct_tape": "Heavy-duty duct tape",
    "item.eq_power_bank": "Power bank",
    "item.eq_cables_chargers": "Cables/chargers",
    "item.eq_newspapers": "Old newspapers",
    "note.eq_newspapers": "kindling, insulation, hygiene",
    "item.eq_full_car_tank": "Full fuel tank in the car",
    "item.eq_paper_map": "Paper map of the area",

    "item.hyg_toilet_paper": "Toilet paper",
    "item.hyg_sanitary_pads": "Sanitary pads",
    "item.hyg_trash_bags": "Trash bags",
    "item.hyg_wet_wipes": "Wet wipes",
    "item.hyg_paper_towels": "Paper kitchen towels",
    "item.hyg_disposable_dishes": "Disposable tableware",
    "item.hyg_soap_shampoo": "Soap / shampoo",
    "item.hyg_toothbrush_paste": "Toothbrush + toothpaste",

    "item.cloth_underwear": "10-day supply of underwear",
    "item.cloth_socks": "Socks",
    "item.cloth_raincoat": "Raincoat / waterproof clothing",
    "item.cloth_sturdy_shoes": "Sturdy shoes (spare pair)",
    "item.cloth_sleeping_bag": "Sleeping bag / blanket",
    "item.cloth_warm_layer": "Warm clothing layer",

    "item.misc_kids_games": "Cards / games for children",
    "note.misc_kids_games": "only if there are children in the profile",
    "item.misc_stationery": "Writing supplies + paper",
    "item.misc_whistle": "Whistle (signalling)",

    "item.pet_food": "Pet food",
    "item.pet_water": "Water for pet",
    "item.pet_leash_carrier": "Leash/carrier",
    "item.pet_vaccination_docs": "Vaccination records",
    "item.pet_medication": "Pet medication"
  }
};

/* ================= I18n runtime ================= */
const I18n = (function () {
  let locale = DEFAULT_LOCALE;

  function detectInitialLocale() {
    try {
      const saved = localStorage.getItem("evac_locale");
      if (saved && UI_STRINGS[saved]) return saved;
    } catch (e) { /* localStorage unavailable */ }
    const nav = ((navigator && navigator.language) || DEFAULT_LOCALE).slice(0, 2).toLowerCase();
    return UI_STRINGS[nav] ? nav : DEFAULT_LOCALE;
  }

  function setLocale(code) {
    locale = UI_STRINGS[code] ? code : DEFAULT_LOCALE;
    try { localStorage.setItem("evac_locale", locale); } catch (e) {}
    if (typeof document !== "undefined") document.documentElement.setAttribute("lang", locale);
  }

  function getLocale() { return locale; }

  function interpolate(str, vars) {
    if (!vars) return str;
    return Object.keys(vars).reduce((s, k) => s.split("{" + k + "}").join(vars[k]), str);
  }

  function lookup(dictSet, key) {
    const dict = dictSet[locale] || {};
    if (key in dict) return dict[key];
    const fb = dictSet[FALLBACK_LOCALE] || {};
    if (key in fb) return fb[key];
    return null;
  }

  /** UI string lookup. Returns the key itself if nothing is found (visible signal of a missing translation). */
  function t(key, vars) {
    const val = lookup(UI_STRINGS, key);
    if (val === null) return key;
    if (typeof val === "object") return interpolate(pickPlural(val, vars && vars.count), vars);
    return interpolate(val, vars);
  }

  function pickPlural(forms, count) {
    const rule = PLURAL_RULES[locale] || PLURAL_RULES[FALLBACK_LOCALE];
    const form = rule ? rule(count) : "other";
    return forms[form] || forms.other || forms.one || Object.values(forms)[0] || "";
  }

  /** Template-content string lookup (category/item names, notes). Returns null if missing (caller decides fallback). */
  function tt(key, vars) {
    const val = lookup(TEMPLATE_STRINGS, key);
    return val === null ? null : interpolate(val, vars);
  }

  function hasTemplate(key) {
    return lookup(TEMPLATE_STRINGS, key) !== null;
  }

  function unitLabel(unitCode) {
    const table = UNIT_LABELS[locale] || UNIT_LABELS[FALLBACK_LOCALE];
    if (unitCode in table) return table[unitCode];
    return unitCode; // custom/free-text unit typed by the user - show as-is
  }

  function availableLocales() {
    return SUPPORTED_LOCALES.filter((l) => UI_STRINGS[l.code]);
  }

  return { detectInitialLocale, setLocale, getLocale, t, tt, hasTemplate, unitLabel, availableLocales };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { I18n, UI_STRINGS, TEMPLATE_STRINGS, UNIT_LABELS, SUPPORTED_LOCALES, PLURAL_RULES };
}
