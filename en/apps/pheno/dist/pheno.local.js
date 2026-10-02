(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/storage.js
  var DB_NAME = "pheno";
  var DB_VERSION = 1;
  var req = (r) => new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  function openDb(name = DB_NAME, factory = globalThis.indexedDB) {
    return new Promise((resolve, reject) => {
      const r = factory.open(name, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        const plants = db.createObjectStore("plants", { keyPath: "id" });
        plants.createIndex("archivedAt", "archivedAt");
        plants.createIndex("varietyKey", "varietyKey");
        const events = db.createObjectStore("events", { keyPath: "id" });
        events.createIndex("plantId", "plantId");
        events.createIndex("plantType", ["plantId", "type"]);
        events.createIndex("occurredAt", "occurredAt");
        const photos = db.createObjectStore("photos", { keyPath: "id" });
        photos.createIndex("plantId", "plantId");
        db.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  function withTx(db, storeNames, mode, fn) {
    return new Promise((resolve, reject) => {
      const names = [].concat(storeNames);
      const tx = db.transaction(names, mode);
      const stores = {};
      for (const n of names) stores[n] = tx.objectStore(n);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
      Promise.resolve().then(() => fn(stores)).then(
        (r) => {
          result = r;
        },
        (e) => {
          try {
            tx.abort();
          } catch {
          }
          reject(e);
        }
      );
    });
  }
  var idbReq = req;
  var getPlant = (db, id) => withTx(db, "plants", "readonly", (s) => req(s.plants.get(id)));
  var listPlants = (db) => withTx(db, "plants", "readonly", (s) => req(s.plants.getAll()));
  var getEvents = (db, plantId) => withTx(db, "events", "readonly", (s) => req(s.events.index("plantId").getAll(plantId)));
  var getAllEvents = (db) => withTx(db, "events", "readonly", (s) => req(s.events.getAll()));
  var putPhoto = (db, photo) => withTx(db, "photos", "readwrite", (s) => req(s.photos.put(photo)));
  var getPhoto = (db, id) => withTx(db, "photos", "readonly", (s) => req(s.photos.get(id)));
  var metaGet = (db, key) => withTx(db, "meta", "readonly", async (s) => (await req(s.meta.get(key)))?.value);
  var metaSet = (db, key, value) => withTx(db, "meta", "readwrite", (s) => req(s.meta.put({ key, value })));
  function deletePlantData(db, plantId) {
    return withTx(db, ["plants", "events", "photos"], "readwrite", async (s) => {
      const evKeys = await req(s.events.index("plantId").getAllKeys(plantId));
      const phKeys = await req(s.photos.index("plantId").getAllKeys(plantId));
      for (const k of evKeys) s.events.delete(k);
      for (const k of phKeys) s.photos.delete(k);
      s.plants.delete(plantId);
      return { events: evKeys.length, photos: phKeys.length };
    });
  }
  async function ensurePersistence() {
    try {
      const st = globalThis.navigator?.storage;
      if (!st?.persist) return { supported: false, persisted: false };
      if (await st.persisted()) return { supported: true, persisted: true };
      return { supported: true, persisted: await st.persist() };
    } catch {
      return { supported: false, persisted: false };
    }
  }
  var listPhotoKeys = (db) => withTx(db, "photos", "readonly", (s) => req(s.photos.getAllKeys()));

  // js/profile.js
  var PROFILE_KEYS = ["garden", "houseplants", "controlled", "mixed"];
  var PROFILE_SOURCES = ["url", "onboarding", "settings"];
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
  var PROFILES = {
    garden: {
      preselect: { environment: "outdoor", lifecycle: "cycle" },
      dashboard: ["tasks", "season", "varieties"],
      examples: [["Raj\u010De #1", "San Marzano"], ["Jahodn\xEDk", "Elsanta"], ["Chilli", "Habanero"]]
    },
    houseplants: {
      preselect: { environment: "indoor", lifecycle: "perennial", harvestable: false },
      dashboard: ["tasks", "milestones"],
      examples: [["Monstera", "Deliciosa"], ["F\xEDkus", "Benjamin"], ["Orchidej", "Phalaenopsis"]]
    },
    controlled: {
      preselect: { environment: "controlled", measurementsFirst: true },
      dashboard: ["tasks", "measurements", "cycles"],
      examples: [["Sal\xE1t", "Lollo rosso"], ["Bazalka #1", "Genovese"], ["Jahodn\xEDk", "Albion"]]
    },
    mixed: { preselect: {}, dashboard: ["tasks"], examples: null }
  };
  PROFILES.mixed.examples = [...PROFILES.garden.examples, ...PROFILES.houseplants.examples, ...PROFILES.controlled.examples];
  var isProfile = (v) => PROFILE_KEYS.includes(v);
  function example(profile, index = 0) {
    const list = (PROFILES[profile] || PROFILES.mixed).examples;
    return list[Math.abs(index) % list.length];
  }
  var clean = (v) => String(v).replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 100);
  function parseAcquisition(search) {
    const q = new URLSearchParams(search || "");
    const profile = isProfile(q.get("profile")) ? q.get("profile") : null;
    const utm = {};
    for (const k of UTM_KEYS) {
      const v = q.get(k);
      if (v != null && clean(v)) utm[k] = clean(v);
    }
    return { profile, utm: Object.keys(utm).length ? utm : null };
  }
  function stripAcquisition(search) {
    const q = new URLSearchParams(search || "");
    for (const k of ["profile", ...UTM_KEYS]) q.delete(k);
    const s = q.toString();
    return s ? `?${s}` : "";
  }
  var getProfile = async (db) => {
    const v = await metaGet(db, "profile");
    return isProfile(v) ? v : null;
  };
  async function setProfile(db, profile, source) {
    if (!isProfile(profile) || !PROFILE_SOURCES.includes(source)) throw new Error("Neplatn\xFD profil.");
    await metaSet(db, "profile", profile);
    await metaSet(db, "profileSource", source);
  }
  async function applyAcquisition(db, search, now2 = (/* @__PURE__ */ new Date()).toISOString()) {
    const { profile, utm } = parseAcquisition(search);
    if (utm && await metaGet(db, "acquisition") == null) await metaSet(db, "acquisition", { ...utm, capturedAt: now2 });
    let current = await getProfile(db);
    if (!current && profile) {
      await setProfile(db, profile, "url");
      current = profile;
    }
    return current;
  }

  // js/ctx.js
  var ctx = { db: null, hemisphere: "north", profile: null };
  var now = () => (/* @__PURE__ */ new Date()).toISOString();
  async function initCtx(db) {
    ctx.db = db;
    ctx.hemisphere = await metaGet(db, "hemisphere") === "south" ? "south" : "north";
    ctx.profile = await getProfile(db);
    return ctx;
  }
  var hemisphereKnown = () => metaGet(ctx.db, "hemisphere").then((v) => v === "north" || v === "south");
  async function setHemisphere(v) {
    ctx.hemisphere = v;
    await metaSet(ctx.db, "hemisphere", v);
  }
  async function loadAll() {
    const [plants, events] = await Promise.all([listPlants(ctx.db), getAllEvents(ctx.db)]);
    const byPlant = /* @__PURE__ */ new Map();
    for (const e of events) {
      if (!byPlant.has(e.plantId)) byPlant.set(e.plantId, []);
      byPlant.get(e.plantId).push(e);
    }
    return { plants, byPlant, events };
  }
  var engineOpts = () => ({ hemisphere: ctx.hemisphere });
  var THEME_KEY = "pheno.theme";
  function getTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "svetle" ? "svetle" : "tmave";
    } catch {
      return "tmave";
    }
  }
  function setTheme(name) {
    document.documentElement.dataset.theme = name;
    try {
      localStorage.setItem(THEME_KEY, name);
    } catch {
    }
  }

  // js/dom.js
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== "string" || k === "value" || k === "checked" || k === "disabled" || k === "hidden") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  function icon(name, cls = "") {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", `ui-icon ${cls}`.trim());
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
  }
  function clear(el) {
    el.replaceChildren();
    return el;
  }
  function put(el, ...children) {
    el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
    return el;
  }
  function field(label, input, hint) {
    return h("div", { class: "field" }, h("label", {}, label), input, hint ? h("div", { class: "field-hint" }, hint) : null);
  }
  function chipGroup(options, value, onChange) {
    let cur = value;
    const el = h("div", { class: "chip-group", role: "radiogroup" });
    const btns = options.map(([v, label]) => h("button", {
      type: "button",
      class: "chip" + (v === cur ? " selected" : ""),
      dataset: { value: v },
      onclick: () => {
        set(v);
        onChange?.(v);
      }
    }, label));
    el.append(...btns);
    function set(v) {
      cur = v;
      btns.forEach((b) => b.classList.toggle("selected", b.dataset.value === String(v)));
    }
    return { el, get: () => cur, set };
  }

  // js/events.js
  var events_exports = {};
  __export(events_exports, {
    EVENT_TYPES: () => EVENT_TYPES,
    appendEvents: () => appendEvents,
    buildEvents: () => buildEvents,
    compareEvents: () => compareEvents,
    createPlant: () => createPlant,
    deletePlantPermanently: () => deletePlantPermanently,
    rebuildAll: () => rebuildAll,
    snoozeTask: () => snoozeTask,
    updatePlantMeta: () => updatePlantMeta,
    voidEvent: () => voidEvent
  });

  // js/config-categories.js
  var CYCLE_STAGES = {
    herb: ["seedling", "vegetative", "flowering", "harvested", "done"],
    vegetable: ["seedling", "vegetative", "flowering", "fruiting", "harvested", "done"],
    fruit: ["planted", "growing", "flowering", "fruiting", "harvested", "done"],
    tree_shrub: ["planted", "growing", "flowering", "fruiting", "harvested", "done"],
    flower: ["seedling", "vegetative", "budding", "flowering", "done"],
    other: ["growing", "harvested", "done"]
  };
  var PERENNIAL_STAGES = ["planted", "growing", "flowering", "fruiting", "dormant"];
  var STAGE_FLAGS = { done: { terminal: true }, dormant: { dormant: true } };
  var num = (key, min = 0) => ({ key, type: "number", min });
  var CATEGORIES = {
    herb: {
      lifecycle: "cycle",
      harvestable: true,
      fertilizingDays: 14,
      pestCheckDays: 7,
      baseDryingDays: 3,
      harvestFields: [num("freshWeight"), num("processedWeight")],
      criteria: ["aroma", "flavor", "usability"]
    },
    vegetable: {
      lifecycle: "cycle",
      harvestable: true,
      fertilizingDays: 10,
      pestCheckDays: 5,
      baseDryingDays: 2,
      harvestFields: [num("totalWeight"), num("pieceCount"), num("avgSize")],
      criteria: ["taste", "texture", "yieldSatisfaction"]
    },
    fruit: {
      lifecycle: "cycle",
      harvestable: true,
      fertilizingDays: 21,
      pestCheckDays: 7,
      baseDryingDays: 3,
      harvestFields: [num("totalWeight"), num("pieceCount"), num("brix")],
      criteria: ["sweetness", "juiciness", "appearance"]
    },
    flower: {
      lifecycle: "cycle",
      harvestable: true,
      fertilizingDays: 14,
      pestCheckDays: 10,
      baseDryingDays: 3,
      harvestFields: [num("bloomCount"), num("bloomDurationDays"), num("totalWeight")],
      criteria: ["appearance", "fragrance", "bloomDuration"]
    },
    tree_shrub: {
      lifecycle: "perennial",
      harvestable: true,
      fertilizingDays: 30,
      pestCheckDays: 14,
      baseDryingDays: 5,
      harvestFields: [num("totalWeight"), num("pieceCount")],
      criteria: ["taste", "appearance"]
    },
    other: {
      lifecycle: "cycle",
      harvestable: false,
      fertilizingDays: 14,
      pestCheckDays: 7,
      baseDryingDays: 3,
      harvestFields: [num("quantity")],
      criteria: []
    }
  };
  var ENVIRONMENTS = ["outdoor", "greenhouse", "indoor", "controlled"];
  var SOURCES = ["seed", "cutting", "seedling", "other"];
  var PROBLEM_TYPES = ["pest", "mold", "wilting", "nutrient", "other"];
  var PROCESSING_METHODS = ["drying", "fermenting", "pickling", "freezing", "storing", "none", "other"];
  var MOISTURE_ANSWERS = ["dry", "ok", "wet"];
  var RATING_MAX = 5;
  function getStages(category, lifecycle) {
    if (lifecycle === "perennial") return PERENNIAL_STAGES;
    return CYCLE_STAGES[category] || CYCLE_STAGES.other;
  }

  // js/config-engine.js
  var ENV_MULTIPLIER = { outdoor: 1, greenhouse: 0.8, indoor: 1.3, controlled: 1 };
  var STAGE_FACTOR = {
    seedling: 1.2,
    planted: 1,
    growing: 1,
    vegetative: 1,
    harvested: 1,
    budding: 0.9,
    flowering: 0.9,
    fruiting: 0.8,
    dormant: 3,
    done: 1
  };
  var SEASON_MODIFIER = { summer: 0.85, spring: 1, autumn: 1, winter: 1.3 };
  var SEASONAL_ENVIRONMENTS = ["outdoor", "greenhouse"];
  var PEST_BOOST_DAYS = 14;
  var LEARN = {
    minInformative: 5,
    minFactor: 0.4,
    maxFactor: 3,
    window: 5,
    blendOld: 0.6,
    blendNew: 0.4,
    confidenceN: 8
  };
  var RULE = {
    dryLate: 1.1,
    wetEarly: 0.9,
    impliedDry: 0.85,
    impliedOk: 1.05,
    impliedWet: 1.3,
    blendDry: 0.5,
    blendOk: 0.3,
    recheckFraction: 0.3
  };
  var FERT_STAGE_FACTOR = {};
  var FOLLOWUP_DAYS = 3;
  var LOOKAHEAD_DAYS = 3;
  var EVAL_REMINDER_DAYS = [14, 44, 74];
  var EVAL_REVIEW_DAYS = 90;

  // js/model.js
  var model_exports = {};
  __export(model_exports, {
    buildPlant: () => buildPlant,
    clearProjectors: () => clearProjectors,
    clonePlantInput: () => clonePlantInput,
    emptyCache: () => emptyCache,
    liveEvents: () => liveEvents,
    projectPlant: () => projectPlant,
    registerProjector: () => registerProjector,
    unregisterProjector: () => unregisterProjector
  });

  // js/strings.cs.js
  var S = {
    appName: "Ember Pheno",
    subtitle: "Den\xEDk p\u011Bstitele",
    nav: { overview: "P\u0159ehled", walk: "Obch\u016Fzka", varieties: "Odr\u016Fdy", settings: "Nastaven\xED" },
    theme: { dark: "Tmav\xE9", light: "Sv\u011Btl\xE9" },
    category: {
      herb: "Bylinka",
      vegetable: "Zelenina",
      fruit: "Ovoce",
      flower: "Kv\u011Btina",
      tree_shrub: "Strom / ke\u0159",
      other: "Jin\xE9"
    },
    environment: { outdoor: "Venku", greenhouse: "Sklen\xEDk", indoor: "Uvnit\u0159", controlled: "\u0158\xEDzen\xE9 prost\u0159ed\xED" },
    lifecycle: { cycle: "Jednolet\xFD cyklus", perennial: "V\xEDcelet\xE1" },
    stage: {
      seedling: "Semen\xE1\u010Dek",
      planted: "Zasazeno",
      growing: "R\u016Fst",
      vegetative: "Vegetativn\xED r\u016Fst",
      budding: "Poupata",
      flowering: "Kveten\xED",
      fruiting: "Ploden\xED",
      harvested: "Sklizeno",
      dormant: "Klid",
      done: "Dokon\u010Deno"
    },
    moisture: { dry: "Such\xE9", ok: "Akor\xE1t", wet: "Vlhk\xE9" },
    problem: { pest: "\u0160k\u016Fdci", mold: "Pl\xEDse\u0148", wilting: "Vadnut\xED", nutrient: "\u017Diviny", other: "Jin\xE9" },
    processing: {
      drying: "Su\u0161en\xED",
      fermenting: "Fermentace",
      pickling: "Nakl\xE1d\xE1n\xED",
      freezing: "Zmrazen\xED",
      storing: "Skladov\xE1n\xED",
      none: "Bez zpracov\xE1n\xED",
      other: "Jin\xE9"
    },
    source: { seed: "Semeno", cutting: "\u0158\xEDzek", seedling: "Sazenice", other: "Jin\xE9" },
    task: { watering: "Zal\xEDt", fertilizing: "P\u0159ihnojit", pestCheck: "Zkontrolovat \u0161k\u016Fdce" },
    harvestField: {
      freshWeight: "\u010Cerstv\xE1 hmotnost (g)",
      processedWeight: "Zpracovan\xE1 hmotnost (g)",
      totalWeight: "Celkov\xE1 hmotnost (kg)",
      pieceCount: "Po\u010Det kus\u016F (ks)",
      avgSize: "Pr\u016Fm\u011Brn\xE1 velikost (cm)",
      brix: "Brix (\xB0Bx)",
      bloomCount: "Po\u010Det kv\u011Bt\u016F (ks)",
      bloomDurationDays: "Doba kveten\xED (dny)",
      quantity: "Mno\u017Estv\xED (ks)",
      processingMethod: "Zpracov\xE1n\xED",
      processingDays: "Dn\xED zpracov\xE1n\xED",
      note: "Pozn\xE1mka"
    },
    criterion: {
      overall: "Celkov\u011B",
      aroma: "Aroma",
      flavor: "Chu\u0165",
      usability: "Vyu\u017Eitelnost",
      taste: "Chu\u0165",
      texture: "Textura",
      yieldSatisfaction: "Spokojenost s v\xFDnosem",
      sweetness: "Sladkost",
      juiciness: "\u0160\u0165avnatost",
      appearance: "Vzhled",
      fragrance: "V\u016Fn\u011B",
      bloomDuration: "Doba kveten\xED"
    },
    err: {
      name: "Zadej n\xE1zev rostliny.",
      category: "Vyber kategorii.",
      environment: "Vyber prost\u0159ed\xED.",
      notHarvestable: "Tato rostlina se neskl\xEDz\xED.",
      archived: "Rostlina je archivovan\xE1.",
      notArchived: "Rostlina nen\xED archivovan\xE1.",
      confirmName: "Pro trval\xE9 smaz\xE1n\xED opi\u0161 n\xE1zev rostliny.",
      invalid: "Neplatn\xFD z\xE1znam."
    },
    taskLabel: {
      moisture: "Zkontrolovat vlhkost",
      fertilizing: "P\u0159ihnojit",
      pestCheck: "Zkontrolovat \u0161k\u016Fdce",
      problemFollowUp: "Zkontrolovat probl\xE9m",
      evaluation: "Ohodnotit sklize\u0148",
      evaluationReview: "Zm\u011Bnil se tv\u016Fj n\xE1zor?"
    },
    ui: {
      today: "Dnes",
      tomorrow: "Z\xEDtra",
      yesterday: "V\u010Dera",
      overdue: "Po term\xEDnu",
      upcoming: "Nadch\xE1zej\xEDc\xED",
      doneToday: "Hotovo dnes",
      careToday: "Dne\u0161n\xED p\xE9\u010De",
      nextStep: "Nejbli\u017E\u0161\xED krok",
      needsAttention: "Vy\u017Eaduje pozornost",
      myPlants: "Moje rostliny",
      newPlant: "Nov\xE1 rostlina",
      all: "V\u0161e",
      save: "Ulo\u017Eit",
      cancel: "Zru\u0161it",
      back: "Zp\u011Bt",
      edit: "Upravit",
      delete: "Smazat trvale",
      snooze: "Odlo\u017Eit",
      undo: "Zp\u011Bt",
      done: "Hotovo",
      noPlants: "Zat\xEDm \u017E\xE1dn\xE9 rostliny. P\u0159idej prvn\xED.",
      noTasks: "\u017D\xE1dn\xE9 \xFAkoly na dohled.",
      soon: "P\u0159ipravujeme v dal\u0161\xEDm vyd\xE1n\xED.",
      appearance: "Vzhled",
      hemisphere: "Polokoule",
      north: "Severn\xED",
      south: "Ji\u017En\xED",
      version: "Verze",
      name: "N\xE1zev",
      variety: "Odr\u016Fda",
      category: "Kategorie",
      environment: "Prost\u0159ed\xED",
      lifecycle: "\u017Divotn\xED cyklus",
      harvestable: "Skl\xEDz\xED se",
      stageLabel: "F\xE1ze",
      location: "M\xEDsto",
      sourceLabel: "P\u016Fvod",
      startDate: "Datum zalo\u017Een\xED",
      photo: "Fotka",
      note: "Pozn\xE1mka",
      date: "Datum a \u010Das",
      watered: "Zalito",
      wateredNow: "Zalito",
      moistureCheck: "Kontrola vlhkosti",
      fertilize: "Hnojen\xED",
      pestCheck: "Kontrola \u0161k\u016Fdc\u016F",
      problem: "Probl\xE9m",
      addNote: "Pozn\xE1mka",
      addPhoto: "Fotka",
      measurement: "M\u011B\u0159en\xED",
      milestone: "Miln\xEDk",
      changeEnv: "Zm\u011Bna prost\u0159ed\xED",
      timeline: "Den\xEDk",
      care: "P\xE9\u010De",
      drying: "Schnut\xED",
      base: "Z\xE1klad",
      learned: "Nau\u010Deno",
      confidence: "Jistota",
      baseOverride: "Vlastn\xED z\xE1klad (dny)",
      clone: "Zalo\u017Eit znovu",
      voidIt: "Zru\u0161it z\xE1znam",
      days: "dn\xED",
      foundPests: "N\u011Bco jsem na\u0161el",
      severity: "Z\xE1va\u017Enost",
      sinceWatering: "od posledn\xED z\xE1livky",
      stillProblem: "Probl\xE9m trv\xE1",
      harvest: "Sklize\u0148",
      harvests: "Sklizn\u011B",
      milestones: "Miln\xEDky",
      evaluation: "Hodnocen\xED",
      careTab: "P\xE9\u010De",
      recordHarvest: "Zaznamenat sklize\u0148",
      evaluate: "Ohodnotit",
      updateEval: "Upravit hodnocen\xED",
      processing: "Zpracov\xE1n\xED po sklizni",
      processingDays: "Dn\xED zpracov\xE1n\xED",
      wouldGrowAgain: "P\u011Bstoval bych znovu",
      yes: "Ano",
      no: "Ne",
      season: "Sez\xF3na (rok)",
      current: "Aktu\xE1ln\xED",
      history: "Historie",
      noHarvests: "Zat\xEDm \u017E\xE1dn\xE9 sklizn\u011B.",
      noMilestones: "Zat\xEDm \u017E\xE1dn\xE9 miln\xEDky.",
      noEval: "Zat\xEDm nehodnoceno.",
      total: "Celkem",
      daysAfter: "dn\xED po sklizni",
      harvestSaved: "Sklize\u0148 ulo\u017Eena",
      nextStage: "P\u0159esunout do f\xE1ze",
      endCycle: "Ukon\u010Dit cyklus",
      keepGoing: "Je\u0161t\u011B skl\xEDz\xEDm",
      archive: "Archivovat",
      unarchive: "Obnovit z archivu",
      archived: "Archivov\xE1no",
      later: "Pozd\u011Bji",
      archiveAsk: "Archivovat rostlinu? Z\u016Fstane v Odr\u016Fd\xE1ch a p\u016Fjde ji hodnotit d\xE1l.",
      archiveTitle: "Archiv",
      varietiesTitle: "Odr\u016Fdy",
      unnamed: "bez odr\u016Fdy",
      plantsWord: "rostlin",
      avgRating: "Pr\u016Fm\u011Br hodnocen\xED",
      growAgainShare: "P\u011Bstovat znovu",
      yieldTotal: "V\xFDnos celkem",
      yieldPerPlant: "Na rostlinu",
      avgCycle: "D\xE9lka cyklu",
      problemsPer: "Probl\xE9m\u016F na rostlinu",
      cycles: "Cykl\u016F / sez\xF3n",
      noVarieties: "Zat\xEDm nen\xED z \u010Deho po\u010D\xEDtat.",
      overallRequired: "Zvol celkov\xE9 hodnocen\xED.",
      plantsOfVariety: "Rostliny t\xE9to odr\u016Fdy",
      fillOne: "Vypl\u0148 aspo\u0148 jednu hodnotu.",
      seasonWord: "Sez\xF3na",
      resolved: "Vy\u0159e\u0161eno",
      recordedUndo: "Zaznamen\xE1no"
    },
    persistWarn: "Prohl\xED\u017Ee\u010D nepotvrdil trval\xE9 \xFAlo\u017Ei\u0161t\u011B. Doporu\u010Dujeme pravideln\u011B z\xE1lohovat.",
    profile: {
      question: "Co p\u011Bstuje\u0161 nej\u010Dast\u011Bji?",
      intro: "Jen nastav\xED v\xFDchoz\xED hodnoty a uk\xE1zkov\xE9 texty. Nic se neskr\xFDv\xE1 a p\u016Fjde to zm\u011Bnit v Nastaven\xED.",
      garden: "Zahrada, balkon a sklen\xEDk",
      houseplants: "Pokojovky",
      controlled: "Vnit\u0159n\xED p\u011Bstov\xE1n\xED s \u0159\xEDzen\xFDmi podm\xEDnkami",
      mixed: "Od v\u0161eho n\u011Bco",
      skip: "P\u0159esko\u010Dit",
      restore: "Obnovit ze z\xE1lohy",
      label: "Co p\u011Bstuji nejv\xEDc",
      settingsHint: "M\u011Bn\xED jen v\xFDchoz\xED hodnoty a po\u0159ad\xED p\u0159ehledu.",
      season: "Sez\xF3na",
      seasonLine: (env, n) => `${n} ${n === 1 ? "rostlina" : n >= 2 && n <= 4 ? "rostliny" : "rostlin"} venku a ve sklen\xEDku \xB7 ${env}`,
      spring: "jaro",
      summer: "l\xE9to",
      autumn: "podzim",
      winter: "zima",
      varieties: "Odr\u016Fdy",
      milestones: "Posledn\xED miln\xEDky",
      measurements: "Posledn\xED m\u011B\u0159en\xED",
      cycles: "B\u011B\u017E\xEDc\xED cykly",
      none: "Zat\xEDm nic.",
      dayN: (n) => `den ${n}`,
      all: "V\u0161echny rostliny"
    },
    walk: {
      title: "Obch\u016Fzka",
      empty: "Nen\xED co obch\xE1zet. P\u0159idej prvn\xED rostlinu.",
      progress: (i, n) => `${i} z ${n}`,
      dueBadge: "\u010Dek\xE1 kontrola",
      answered: "Zaps\xE1no",
      prev: "Zp\u011Bt",
      next: "D\xE1l",
      skip: "P\u0159esko\u010Dit",
      doneTitle: "Obch\u016Fzka hotov\xE1",
      summary: (w, s) => `Zaps\xE1no ${w}, p\u0159esko\u010Deno ${s}.`,
      backHome: "Zp\u011Bt na p\u0159ehled",
      lastWatered: "Posledn\xED z\xE1livka",
      never: "zat\xEDm nezalito",
      expected: "O\u010Dek\xE1van\xE9 schnut\xED",
      swipe: "P\u0159eje\u010F prstem pro dal\u0161\xED rostlinu."
    },
    backup: {
      title: "Z\xE1loha dat",
      export: "Exportovat z\xE1lohu (ZIP)",
      import: "Obnovit ze z\xE1lohy",
      lastExport: "Posledn\xED export",
      never: "nikdy",
      exporting: "P\u0159ipravuji z\xE1lohu\u2026",
      exported: "Z\xE1loha sta\u017Eena",
      importing: "Importuji\u2026",
      importAsk: "Z\xE1loha se slou\u010D\xED se st\xE1vaj\xEDc\xEDmi daty. Existuj\xEDc\xED rostliny z\u016Fstanou beze zm\u011Bny, chyb\u011Bj\xEDc\xED se dopln\xED.",
      importBtn: "Importovat",
      pickFile: "Vyber soubor z\xE1lohy (.zip).",
      importDone: "Import dokon\u010Den",
      plantsAdded: "P\u0159id\xE1no rostlin",
      plantsExisting: "U\u017E existovalo",
      eventsAdded: "P\u0159id\xE1no ud\xE1lost\xED",
      photosAdded: "P\u0159id\xE1no fotek",
      skipped: "P\u0159esko\u010Deno",
      conflicts: "Rozd\xEDly u existuj\xEDc\xEDch rostlin (nep\u0159eps\xE1no)",
      failed: "Import se nepoda\u0159il",
      reminder: "Data nebyla dlouho z\xE1lohov\xE1na.",
      reminderBtn: "Z\xE1lohovat",
      dismiss: "Skr\xFDt",
      hint: "Data jsou jen v tomto za\u0159\xEDzen\xED. Z\xE1loha je jedin\xE1 pojistka proti ztr\xE1t\u011B."
    },
    storage: {
      title: "\xDAlo\u017Ei\u0161t\u011B",
      persistent: "Trval\xE9 \xFAlo\u017Ei\u0161t\u011B",
      usage: "Vyu\u017Eito",
      unknown: "nezn\xE1m\xE9",
      yes: "ano",
      no: "ne",
      installed: "Nainstalov\xE1no",
      installState: "Instalace",
      installedYes: "ano, b\u011B\u017E\xED jako aplikace",
      installedNo: "ne, b\u011B\u017E\xED v prohl\xED\u017Ee\u010Di",
      installGuide: "N\xE1vod k instalaci",
      iosWarn: "V z\xE1lo\u017Ece Safari m\u016F\u017Ee iOS data po t\xFDdnech nepou\u017E\xEDv\xE1n\xED smazat. P\u0159idej appku na plochu a z\xE1lohuj."
    },
    install: {
      title: "Instalace",
      intro: "Nainstalovan\xE1 aplikace se chov\xE1 stabiln\u011Bji a iOS j\xED data nema\u017Ee.",
      iosTitle: "iPhone / iPad (Safari)",
      ios: ["Otev\u0159i str\xE1nku v Safari.", "Klepni na Sd\xEDlet.", "Zvol P\u0159idat na plochu.", "Otev\xEDrej appku z ikony na plo\u0161e."],
      chromeTitle: "Android / po\u010D\xEDta\u010D (Chrome, Edge)",
      chrome: ["Klepni na Nainstalovat n\xED\u017Ee, nebo v menu prohl\xED\u017Ee\u010De zvol Instalovat aplikaci."],
      btn: "Nainstalovat",
      unavailable: "Prohl\xED\u017Ee\u010D te\u010F instalaci nenab\xEDz\xED. Pou\u017Eij menu prohl\xED\u017Ee\u010De.",
      done: "Aplikace u\u017E je nainstalovan\xE1."
    }
  };

  // js/utils.js
  var DAY_MS = 864e5;
  var lastTs = 0;
  var seq = 0;
  function uid() {
    const ts = Date.now();
    if (ts === lastTs) seq += 1;
    else {
      lastTs = ts;
      seq = 0;
    }
    const rnd = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
    return ts.toString(36).padStart(9, "0") + seq.toString(36).padStart(3, "0") + rnd;
  }
  var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
  function addDays(iso, days) {
    return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
  }
  function daysBetween(fromIso, toIso2) {
    return (new Date(toIso2).getTime() - new Date(fromIso).getTime()) / DAY_MS;
  }
  var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function mean(a) {
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  }
  function weightedMean(a) {
    if (!a.length) return 0;
    let s = 0, w = 0;
    a.forEach((v, i) => {
      s += v * (i + 1);
      w += i + 1;
    });
    return s / w;
  }
  function coefVariation(a) {
    if (a.length < 2) return 0;
    const m = mean(a);
    if (m === 0) return 0;
    const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length;
    return Math.sqrt(v) / m;
  }
  function normalizeKey(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  var MIRROR = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
  function seasonOf(iso, hemisphere = "north") {
    const m = new Date(iso).getMonth();
    const north = m === 11 || m <= 1 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
    return hemisphere === "south" ? MIRROR[north] : north;
  }
  function dayDiff(aIso, bIso) {
    const a = new Date(aIso), b = new Date(bIso);
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db - da) / 864e5);
  }
  var isNum = (v) => typeof v === "number" && Number.isFinite(v);
  function compareEvents(a, b) {
    return a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  var PhenoError = class extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = "PhenoError";
      this.code = code;
    }
  };

  // js/model.js
  var projectors = [];
  function registerProjector(p) {
    if (!projectors.includes(p)) projectors.push(p);
  }
  function unregisterProjector(p) {
    const i = projectors.indexOf(p);
    if (i >= 0) projectors.splice(i, 1);
  }
  function clearProjectors() {
    projectors.length = 0;
  }
  function emptyCache(prev) {
    return {
      stage: null,
      stageSince: null,
      environment: null,
      lastWateredAt: null,
      lastFertilizedAt: null,
      lastPestCheckAt: null,
      openProblems: [],
      pestBoostUntil: null,
      snoozedUntil: { ...prev?.snoozedUntil || {} },
      dryingDays: {},
      confidence: {},
      cacheRev: null
    };
  }
  function liveEvents(events) {
    const voided = new Set(events.filter((e) => e.type === "void").map((e) => e.payload.targetId));
    return events.filter((e) => e.type !== "void" && !voided.has(e.id)).sort(compareEvents);
  }
  function projectPlant(plant, events, opts = {}) {
    const live = liveEvents(events);
    const cache = emptyCache(plant.cache);
    let archivedAt = null;
    const ctx2 = { plant, cache, events: live, opts };
    for (const p of projectors) p.init?.(ctx2);
    for (const e of live) {
      const p = e.payload || {};
      switch (e.type) {
        case "created":
          cache.environment = p.environment;
          break;
        case "stage_change":
          cache.stage = p.to;
          cache.stageSince = e.occurredAt;
          break;
        case "environment_change":
          cache.environment = p.environment;
          break;
        case "watering":
          cache.lastWateredAt = e.occurredAt;
          break;
        case "moisture_check":
          if (p.watered) cache.lastWateredAt = e.occurredAt;
          break;
        case "fertilizing":
          cache.lastFertilizedAt = e.occurredAt;
          break;
        case "pest_check":
          cache.lastPestCheckAt = e.occurredAt;
          break;
        case "problem":
          cache.openProblems.push({ id: e.id, problemType: p.problemType, severity: p.severity, since: e.occurredAt });
          break;
        case "problem_resolved":
          cache.openProblems = cache.openProblems.filter((x) => x.id !== p.problemId);
          break;
        case "archive":
          archivedAt = e.occurredAt;
          break;
        case "unarchive":
          archivedAt = null;
          break;
        default:
          break;
      }
      for (const pr of projectors) pr.apply?.(e, ctx2);
      cache.cacheRev = e.id;
    }
    cache.pestBoostUntil = cache.openProblems.length ? addDays(cache.openProblems.reduce((m, x) => x.since > m ? x.since : m, ""), PEST_BOOST_DAYS) : null;
    for (const p of projectors) p.finalize?.(ctx2);
    return { ...plant, environment: cache.environment ?? plant.environment, archivedAt, cache };
  }
  function buildPlant(input, now2 = nowIso()) {
    const name = String(input?.name || "").trim();
    if (!name) throw new PhenoError("name", S.err.name);
    const cfg = CATEGORIES[input.category];
    if (!cfg) throw new PhenoError("category", S.err.category);
    if (!ENVIRONMENTS.includes(input.environment)) throw new PhenoError("environment", S.err.environment);
    const lifecycle = input.lifecycle || cfg.lifecycle;
    const stages = getStages(input.category, lifecycle);
    const stage = input.stage || stages[0];
    if (!stages.includes(stage)) throw new PhenoError("stage", S.err.invalid);
    const variety = String(input.variety || "").trim();
    const plant = {
      id: uid(),
      name,
      variety,
      varietyKey: normalizeKey(variety),
      category: input.category,
      lifecycle,
      environment: input.environment,
      harvestable: input.harvestable ?? cfg.harvestable,
      location: String(input.location || "").trim(),
      source: SOURCES.includes(input.source) ? input.source : "other",
      baseOverride: Number.isFinite(input.baseOverride) ? input.baseOverride : null,
      learnedBase: input.learnedBase && Object.keys(input.learnedBase).length ? { ...input.learnedBase } : null,
      startDate: input.startDate || now2,
      createdAt: now2,
      archivedAt: null,
      cache: emptyCache()
    };
    return { plant, stage };
  }
  var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function clonePlantInput(plant, existingNames = []) {
    const base = plant.name.replace(/\s*#\d+$/, "").trim();
    const re = new RegExp(`^${esc(base)} #(\\d+)$`);
    const nums = [1];
    for (const n of [plant.name, ...existingNames]) {
      if (n === base) nums.push(1);
      const m = n.match(re);
      if (m) nums.push(Number(m[1]));
    }
    const learned = plant.cache?.dryingDays && Object.keys(plant.cache.dryingDays).length ? { ...plant.cache.dryingDays } : plant.learnedBase;
    return {
      name: `${base} #${Math.max(...nums) + 1}`,
      variety: plant.variety,
      category: plant.category,
      lifecycle: plant.lifecycle,
      environment: plant.cache?.environment ?? plant.environment,
      harvestable: plant.harvestable,
      location: plant.location,
      source: plant.source,
      baseOverride: plant.baseOverride,
      learnedBase: learned || null
    };
  }

  // js/calendar.js
  var stageFactor = (stage) => STAGE_FACTOR[stage] ?? 1;
  var isTerminal = (stage) => !!STAGE_FLAGS[stage]?.terminal;
  var isDormant = (stage) => !!STAGE_FLAGS[stage]?.dormant;
  function baseDrying(plant, env, stage) {
    const cat = plant.baseOverride ?? CATEGORIES[plant.category]?.baseDryingDays ?? 3;
    return cat * (ENV_MULTIPLIER[env] ?? 1) * stageFactor(stage);
  }
  function seasonModifier(iso, env, hemisphere = "north") {
    return SEASONAL_ENVIRONMENTS.includes(env) ? SEASON_MODIFIER[seasonOf(iso, hemisphere)] : 1;
  }
  function dryingInfo(plant) {
    const c = plant.cache || {};
    const stage = c.stage;
    const base = baseDrying(plant, c.environment ?? plant.environment, stage);
    const learned = c.dryingDays?.[stage] ?? null;
    return { base, learned, d: learned ?? base, confidence: c.confidence?.[stage] ?? 0 };
  }
  var round2 = (v) => Math.round(v * 100) / 100;
  var cal = (ctx2) => ctx2.cal;
  var calendarProjector = {
    init(ctx2) {
      const c = ctx2.cache;
      c.dryingDays = { ...ctx2.plant.learnedBase || {} };
      c.confidence = {};
      c.learn = {};
      c.recheckAt = null;
      c.lastHarvestAt = null;
      c.harvestDates = [];
      c.evaluations = [];
      ctx2.cal = { stage: null, env: null, water: ctx2.plant.startDate };
    },
    apply(e, ctx2) {
      const c = ctx2.cache, k = cal(ctx2), p = e.payload || {};
      switch (e.type) {
        case "created":
          k.env = p.environment;
          break;
        case "stage_change": {
          const prev = k.stage;
          if (prev && c.dryingDays[prev] != null && c.dryingDays[p.to] == null) {
            c.dryingDays[p.to] = round2(c.dryingDays[prev] * stageFactor(p.to) / stageFactor(prev));
            c.confidence[p.to] = round2((c.confidence[prev] || 0) / 2);
          }
          k.stage = p.to;
          break;
        }
        case "environment_change": {
          const from = k.env;
          if (from && from !== p.environment) {
            const ratio = (ENV_MULTIPLIER[p.environment] ?? 1) / (ENV_MULTIPLIER[from] ?? 1);
            for (const st of Object.keys(c.dryingDays)) {
              c.dryingDays[st] = round2(c.dryingDays[st] * ratio);
              c.confidence[st] = round2((c.confidence[st] || 0) / 2);
            }
          }
          k.env = p.environment;
          break;
        }
        case "watering":
          k.water = e.occurredAt;
          c.recheckAt = null;
          break;
        case "moisture_check":
          learn(e, ctx2);
          if (p.watered) k.water = e.occurredAt;
          break;
        case "harvest":
          c.lastHarvestAt = e.occurredAt;
          c.harvestDates.push(e.occurredAt);
          break;
        case "evaluation":
          c.evaluations.push({ at: e.occurredAt, season: p.season ?? null });
          break;
        default:
          break;
      }
    }
  };
  registerProjector(calendarProjector);
  function learn(e, ctx2) {
    const c = ctx2.cache, k = cal(ctx2), answer = e.payload.answer, stage = k.stage;
    const env = k.env;
    const base = baseDrying(ctx2.plant, env, stage);
    let d = c.dryingDays[stage] ?? base;
    const mod = seasonModifier(e.occurredAt, env, ctx2.opts?.hemisphere);
    const t = daysBetween(k.water, e.occurredAt) / mod;
    let implied = null;
    if (answer === "dry") {
      if (t <= d * RULE.dryLate) {
        implied = t * RULE.impliedDry;
        d = RULE.blendDry * d + (1 - RULE.blendDry) * implied;
      }
    } else if (answer === "ok") {
      implied = t * RULE.impliedOk;
      d = (1 - RULE.blendOk) * d + RULE.blendOk * implied;
    } else if (t >= d * RULE.wetEarly) {
      implied = t * RULE.impliedWet;
      d = implied;
    }
    if (implied != null) {
      const st = c.learn[stage] || (c.learn[stage] = { n: 0, implied: [] });
      st.n += 1;
      st.implied = [...st.implied, implied].slice(-LEARN.window);
      d = clamp(d, Math.max(1, LEARN.minFactor * base), LEARN.maxFactor * base);
      if (st.n >= LEARN.minInformative) {
        d = LEARN.blendOld * d + LEARN.blendNew * weightedMean(st.implied);
        d = clamp(d, Math.max(1, LEARN.minFactor * base), LEARN.maxFactor * base);
      }
      c.dryingDays[stage] = round2(d);
      c.confidence[stage] = round2(Math.min(st.n / LEARN.confidenceN, 1) * (1 - Math.min(coefVariation(st.implied), 1)));
    }
    c.recheckAt = answer === "wet" ? addDays(e.occurredAt, Math.max(1, Math.ceil((c.dryingDays[stage] ?? d) * RULE.recheckFraction))) : null;
  }
  var SNOOZE_KEY = {
    moisture: "watering",
    fertilizing: "fertilizing",
    pestCheck: "pestCheck",
    problemFollowUp: "problemFollowUp",
    evaluation: "evaluation",
    evaluationReview: "evaluation"
  };
  function pestInterval(plant, now2) {
    const c = plant.cache;
    const base = CATEGORIES[plant.category].pestCheckDays;
    const boosted = c.pestBoostUntil && now2 < c.pestBoostUntil;
    if (!boosted) return base;
    if (c.openProblems.some((x) => x.problemType === "mold" && x.severity >= 2)) return 2;
    return Math.max(1, Math.round(base / 2));
  }
  function nextMoistureDue(plant, now2, hemisphere = "north") {
    const c = plant.cache, env = c.environment ?? plant.environment;
    if (c.recheckAt) return c.recheckAt;
    const { d } = dryingInfo(plant);
    const last = c.lastWateredAt ?? plant.startDate;
    return addDays(last, d * seasonModifier(now2, env, hemisphere));
  }
  function evaluationDue(plant, now2) {
    const c = plant.cache, cfg = plant.harvestable;
    if (!cfg || plant.reminders === false || !c.harvestDates?.length) return null;
    const evals = c.evaluations || [];
    if (plant.lifecycle === "perennial") {
      const years = [...new Set(c.harvestDates.map((h2) => new Date(h2).getFullYear()))].sort();
      const missing = years.filter((y2) => !evals.some((x) => x.season === y2));
      if (!missing.length) return null;
      const y = missing[missing.length - 1];
      const last = c.harvestDates.filter((h2) => new Date(h2).getFullYear() === y).sort().pop();
      return { type: "evaluation", due: pickReminder(last, now2), season: y };
    }
    if (!evals.length) return { type: "evaluation", due: pickReminder(c.lastHarvestAt, now2), season: null };
    if (evals.length === 1) {
      const due = addDays(evals[0].at, EVAL_REVIEW_DAYS);
      if (now2 >= due) return { type: "evaluationReview", due, season: evals[0].season };
    }
    return null;
  }
  function pickReminder(lastHarvest, now2) {
    const dates = EVAL_REMINDER_DAYS.map((n) => addDays(lastHarvest, n));
    const passed = dates.filter((x) => x <= now2);
    return passed.length ? passed[passed.length - 1] : dates[0];
  }
  function getPlantTasks(plant, now2, { hemisphere = "north" } = {}) {
    const c = plant.cache;
    if (!c || plant.archivedAt) return [];
    const out = [];
    const push = (type, due, extra = {}) => out.push({
      plantId: plant.id,
      plantName: plant.name,
      type,
      snoozeKey: SNOOZE_KEY[type],
      dueAt: due,
      ...extra
    });
    const ended = isTerminal(c.stage);
    if (!ended) push("moisture", nextMoistureDue(plant, now2, hemisphere));
    if (!ended && !isDormant(c.stage)) {
      const days = CATEGORIES[plant.category].fertilizingDays * (FERT_STAGE_FACTOR[c.stage] ?? 1);
      push("fertilizing", addDays(c.lastFertilizedAt ?? plant.startDate, days));
    }
    if (!ended) push("pestCheck", addDays(c.lastPestCheckAt ?? plant.startDate, pestInterval(plant, now2)));
    for (const pr of ended ? [] : c.openProblems) {
      const ref = c.lastPestCheckAt && c.lastPestCheckAt > pr.since ? c.lastPestCheckAt : pr.since;
      const due = addDays(ref, FOLLOWUP_DAYS);
      if (due <= addDays(pr.since, PEST_BOOST_DAYS)) push("problemFollowUp", due, { problemId: pr.id });
    }
    const ev = evaluationDue(plant, now2);
    if (ev) push(ev.type, ev.due, { season: ev.season });
    return out.filter((t) => {
      const until = c.snoozedUntil?.[t.snoozeKey];
      return !(until && until > now2);
    });
  }
  var ORDER = { overdue: 0, today: 1, upcoming: 2 };
  function computeTasks(plants, now2, opts = {}) {
    const out = [];
    for (const plant of plants) {
      for (const t of getPlantTasks(plant, now2, opts)) {
        const daysUntil = dayDiff(now2, t.dueAt);
        if (daysUntil > LOOKAHEAD_DAYS) continue;
        out.push({ ...t, daysUntil, urgency: daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : "upcoming" });
      }
    }
    return out.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency] || (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0));
  }

  // js/events.js
  var EVENT_TYPES = [
    "created",
    "stage_change",
    "environment_change",
    "watering",
    "moisture_check",
    "fertilizing",
    "pest_check",
    "problem",
    "problem_resolved",
    "note",
    "photo",
    "measurement",
    "milestone",
    "harvest",
    "evaluation",
    "archive",
    "unarchive",
    "void"
  ];
  var ARCHIVED_OK = ["unarchive", "evaluation", "note", "photo", "void"];
  var COMPLETES = {
    watering: ["watering"],
    moisture_check: ["watering"],
    fertilizing: ["fertilizing"],
    pest_check: ["pestCheck", "problemFollowUp"],
    evaluation: ["evaluation"]
  };
  var bad = (msg = S.err.invalid) => new PhenoError("invalid", msg);
  var str = (v) => typeof v === "string" && v.trim().length > 0;
  function validatePayload(type, payload, plant, live) {
    const p = payload || {};
    const cfg = CATEGORIES[plant.category];
    switch (type) {
      case "created":
        if (!ENVIRONMENTS.includes(p.environment)) throw bad(S.err.environment);
        return { environment: p.environment };
      case "stage_change": {
        if (!getStages(plant.category, plant.lifecycle).includes(p.to)) throw bad();
        return { from: p.from ?? null, to: p.to };
      }
      case "environment_change":
        if (!ENVIRONMENTS.includes(p.environment)) throw bad(S.err.environment);
        return { environment: p.environment };
      case "watering": {
        const out = {};
        if (p.amountMl != null) {
          if (!isNum(p.amountMl) || p.amountMl < 0) throw bad();
          out.amountMl = p.amountMl;
        }
        if (p.note) out.note = String(p.note);
        return out;
      }
      case "moisture_check":
        if (!MOISTURE_ANSWERS.includes(p.answer)) throw bad();
        return { answer: p.answer, watered: !!p.watered };
      case "fertilizing":
        return { ...p.product ? { product: String(p.product) } : {}, ...p.note ? { note: String(p.note) } : {} };
      case "pest_check":
        return { found: !!p.found, ...p.note ? { note: String(p.note) } : {} };
      case "problem": {
        if (!PROBLEM_TYPES.includes(p.problemType)) throw bad();
        const sev = p.severity ?? 1;
        if (![1, 2, 3].includes(sev)) throw bad();
        return { problemType: p.problemType, severity: sev, ...p.note ? { note: String(p.note) } : {} };
      }
      case "problem_resolved": {
        const target = live.find((e) => e.id === p.problemId && e.type === "problem");
        if (!target) throw bad();
        return { problemId: p.problemId };
      }
      case "note":
        if (!str(p.text)) throw bad();
        return { text: p.text.trim() };
      case "photo":
        if (!str(p.photoId)) throw bad();
        return { photoId: p.photoId, ...p.caption ? { caption: String(p.caption) } : {} };
      case "measurement":
        if (!str(p.kind) || !isNum(p.value)) throw bad();
        return { kind: p.kind.trim(), value: p.value, ...p.unit ? { unit: String(p.unit) } : {} };
      case "milestone":
        if (!str(p.label)) throw bad();
        return { label: p.label.trim() };
      case "harvest": {
        if (!plant.harvestable) throw bad(S.err.notHarvestable);
        const out = {};
        for (const f of cfg.harvestFields) {
          const v = p[f.key];
          if (v == null || v === "") continue;
          if (!isNum(v) || v < f.min) throw bad();
          out[f.key] = v;
        }
        if (p.processingMethod != null) {
          if (!PROCESSING_METHODS.includes(p.processingMethod)) throw bad();
          out.processingMethod = p.processingMethod;
        }
        if (p.processingDays != null) {
          if (!isNum(p.processingDays) || p.processingDays < 0) throw bad();
          out.processingDays = p.processingDays;
        }
        if (p.note) out.note = String(p.note);
        if (!Object.keys(out).length) throw bad();
        return out;
      }
      case "evaluation": {
        if (!plant.harvestable && plant.lifecycle !== "perennial") throw bad(S.err.notHarvestable);
        const scores = p.scores || {};
        const allowed = ["overall", ...cfg.criteria];
        const out = {};
        for (const [k, v] of Object.entries(scores)) {
          if (!allowed.includes(k)) throw bad();
          if (!Number.isInteger(v) || v < 1 || v > RATING_MAX) throw bad();
          out[k] = v;
        }
        if (out.overall == null) throw bad();
        const res = { scores: out };
        if (p.wouldGrowAgain != null) res.wouldGrowAgain = !!p.wouldGrowAgain;
        if (p.note) res.note = String(p.note);
        if (p.season != null) {
          if (plant.lifecycle !== "perennial" || !plant.harvestable || !Number.isInteger(p.season)) throw bad();
          res.season = p.season;
        }
        return res;
      }
      case "archive":
      case "unarchive":
        return {};
      case "void": {
        const target = live.find((e) => e.id === p.targetId);
        if (!target || target.type === "created") throw bad();
        return { targetId: p.targetId, ...p.reason ? { reason: String(p.reason) } : {} };
      }
      default:
        throw bad();
    }
  }
  function lastBefore(live, pred, at) {
    let found = null;
    for (const e of live) if (e.occurredAt <= at && pred(e)) found = e;
    return found;
  }
  function buildEvents(plant, existing, inputs, now2 = nowIso(), opts = {}) {
    const built = [];
    let all = existing.slice();
    for (const inp of inputs) {
      if (!EVENT_TYPES.includes(inp.type)) throw bad();
      const cur = projectPlant(plant, all, opts);
      if (inp.type !== "created") {
        if (cur.archivedAt && !ARCHIVED_OK.includes(inp.type)) throw new PhenoError("archived", S.err.archived);
        if (inp.type === "archive" && cur.archivedAt) throw new PhenoError("archived", S.err.archived);
        if (inp.type === "unarchive" && !cur.archivedAt) throw new PhenoError("notArchived", S.err.notArchived);
      }
      const live = liveEvents(all);
      const payload = validatePayload(inp.type, inp.payload, plant, live);
      const occurredAt = inp.occurredAt || now2;
      if (inp.type === "watering" || inp.type === "moisture_check") {
        const prev = lastBefore(live, (e) => e.type === "watering" || e.type === "moisture_check" && e.payload.watered, occurredAt);
        payload.daysSinceWatering = prev ? daysBetween(prev.occurredAt, occurredAt) : null;
      }
      if (inp.type === "harvest") {
        const prev = lastBefore(live, (e) => e.type === "harvest", occurredAt);
        payload.daysSinceLastHarvest = prev ? daysBetween(prev.occurredAt, occurredAt) : null;
      }
      if (inp.type === "evaluation") {
        const prev = lastBefore(live, (e) => e.type === "harvest", occurredAt);
        payload.daysSinceLastHarvest = prev ? daysBetween(prev.occurredAt, occurredAt) : null;
      }
      const ev = { id: uid(), plantId: plant.id, type: inp.type, occurredAt, recordedAt: now2, payload };
      built.push(ev);
      all = all.concat(ev);
    }
    return built;
  }
  async function readOpts(s) {
    const h2 = await idbReq(s.meta.get("hemisphere"));
    return { hemisphere: h2?.value === "south" ? "south" : "north" };
  }
  function appendEvents(db, plantId, inputs, { now: now2 } = {}) {
    return withTx(db, ["plants", "events", "meta"], "readwrite", async (s) => {
      const plant = await idbReq(s.plants.get(plantId));
      if (!plant) throw bad();
      const opts = await readOpts(s);
      const existing = await idbReq(s.events.index("plantId").getAll(plantId));
      const events = buildEvents(plant, existing, inputs, now2, opts);
      const snoozed = { ...plant.cache?.snoozedUntil || {} };
      for (const e of events) for (const k of COMPLETES[e.type] || []) delete snoozed[k];
      const base = { ...plant, cache: { ...plant.cache, snoozedUntil: snoozed } };
      const next = projectPlant(base, existing.concat(events), opts);
      for (const e of events) s.events.put(e);
      s.plants.put(next);
      return { plant: next, events };
    });
  }
  var voidEvent = (db, plantId, targetId, reason) => appendEvents(db, plantId, [{ type: "void", payload: { targetId, reason } }]);
  async function createPlant(db, input, { now: now2 = nowIso() } = {}) {
    const { plant, stage } = buildPlant(input, now2);
    const at = input.startDate || now2;
    const opts = await withTx(db, "meta", "readonly", readOpts);
    const events = buildEvents(plant, [], [
      { type: "created", payload: { environment: input.environment }, occurredAt: at },
      { type: "stage_change", payload: { from: null, to: stage }, occurredAt: at }
    ], now2, opts);
    const projected = projectPlant(plant, events, opts);
    return withTx(db, ["plants", "events"], "readwrite", async (s) => {
      for (const e of events) s.events.put(e);
      s.plants.put(projected);
      return projected;
    });
  }
  function rebuildAll(db) {
    return withTx(db, ["plants", "events", "meta"], "readwrite", async (s) => {
      const opts = await readOpts(s);
      const plants = await idbReq(s.plants.getAll());
      for (const pl2 of plants) {
        const evs = await idbReq(s.events.index("plantId").getAll(pl2.id));
        s.plants.put(projectPlant(pl2, evs, opts));
      }
      return plants.length;
    });
  }
  function updatePlantMeta(db, plantId, patch) {
    return withTx(db, ["plants", "events", "meta"], "readwrite", async (s) => {
      const plant = await idbReq(s.plants.get(plantId));
      if (!plant) throw bad();
      const next = { ...plant };
      if ("name" in patch) {
        if (!str(patch.name)) throw new PhenoError("name", S.err.name);
        next.name = patch.name.trim();
      }
      if ("variety" in patch) {
        next.variety = String(patch.variety || "").trim();
        next.varietyKey = normalizeKey(next.variety);
      }
      if ("location" in patch) next.location = String(patch.location || "").trim();
      if ("source" in patch && SOURCES.includes(patch.source)) next.source = patch.source;
      if ("baseOverride" in patch) {
        const v = patch.baseOverride;
        if (v != null && (!isNum(v) || v <= 0)) throw bad();
        next.baseOverride = v ?? null;
      }
      const opts = await readOpts(s);
      const events = await idbReq(s.events.index("plantId").getAll(plantId));
      const out = projectPlant(next, events, opts);
      s.plants.put(out);
      return out;
    });
  }
  function snoozeTask(db, plantId, taskType, untilIso) {
    return withTx(db, "plants", "readwrite", async (s) => {
      const plant = await idbReq(s.plants.get(plantId));
      if (!plant) throw bad();
      plant.cache = { ...plant.cache, snoozedUntil: { ...plant.cache.snoozedUntil, [taskType]: untilIso } };
      s.plants.put(plant);
      return plant;
    });
  }
  async function deletePlantPermanently(db, plantId, typedName) {
    const plant = await withTx(db, "plants", "readonly", (s) => idbReq(s.plants.get(plantId)));
    if (!plant) throw bad();
    if (String(typedName || "").trim() !== plant.name) throw new PhenoError("confirmName", S.err.confirmName);
    return deletePlantData(db, plantId);
  }

  // js/icons.js
  var SPRITE = `<symbol id="i-overview" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="m14 17 2 2 5-6"/></symbol>
<symbol id="i-checklist" viewBox="0 0 24 24"><path d="M9 4h6M9 3h6v3H9zM7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M7 11h2m3 0h5M7 16l2 2 3-4m2 3h3"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><path d="m10 2-.5 2.2-2 1.1-2.1-.8L3.5 7.7l1.6 1.6v2.4l-1.6 1.6 1.9 3.2 2.1-.8 2 1.1L10 19h4l.5-2.2 2-1.1 2.1.8 1.9-3.2-1.6-1.6V9.3l1.6-1.6-1.9-3.2-2.1.8-2-1.1L14 2h-4Z" transform="translate(0 1.5)"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-status-ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></symbol>
<symbol id="i-status-expiring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M12 3v2"/></symbol>
<symbol id="i-status-critical" viewBox="0 0 24 24"><path d="M10.2 4.5 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.8 4.5a2 2 0 0 0-3.6 0Z"/><path d="M12 9v5m0 3h.01"/></symbol>
<symbol id="i-status-review" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M8 10.5l1.8 1.8 3.5-3.5"/></symbol>
<symbol id="i-drop" viewBox="0 0 24 24"><path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3Z"/><path d="M9.2 14.2a3 3 0 0 0 2.3 2.4"/></symbol>
<symbol id="i-leaf" viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c3-4 6-7 10-9"/></symbol>
<symbol id="i-bug" viewBox="0 0 24 24"><ellipse cx="12" cy="13.5" rx="4" ry="5.5"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0M12 8v11M8 11 4.5 9M8 15l-4 1.5M16 11l3.5-2M16 15l4 1.5M10 4 8.5 2M14 4l1.5-2"/></symbol>
<symbol id="i-thermo" viewBox="0 0 24 24"><path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/></symbol>
<symbol id="i-scissors" viewBox="0 0 24 24"><circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8l12 9M8 16 20 7"/></symbol>
<symbol id="i-pot" viewBox="0 0 24 24"><path d="M5 9h14l-1.6 10.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8L5 9Z"/><path d="M4 9h16M12 9V5m0 0c-2 0-3.5-1-4-3 2 0 3.5 1 4 3Zm0 0c2 0 3.5-1 4-3-2 0-3.5 1-4 3Z"/></symbol>
<symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.4"/></symbol>
<symbol id="i-note" viewBox="0 0 24 24"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M8.5 12h7M8.5 16h5"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></symbol>
<symbol id="i-flag" viewBox="0 0 24 24"><path d="M6 21V4M6 5h11l-2 3.5 2 3.5H6"/></symbol>
<symbol id="i-ruler" viewBox="0 0 24 24"><path d="M3 15.5 15.5 3 21 8.5 8.5 21 3 15.5Z"/><path d="m7 12 2.5 2.5M10 9l2.5 2.5M13 6l2 2"/></symbol>
<symbol id="i-swap" viewBox="0 0 24 24"><path d="M4 8h14l-3-3M20 16H6l3 3"/></symbol>
<symbol id="i-stage" viewBox="0 0 24 24"><path d="M4 20h16M7 20v-5M12 20V9M17 20V4"/></symbol>
<symbol id="i-sprout" viewBox="0 0 24 24"><path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6Zm0 2c0-3 2.5-5 6-5 0 3-2.5 5-6 5Z"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></symbol>
`;
  function injectSprite() {
    const d = document.createElement("div");
    d.innerHTML = '<svg class="ui-icon-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + SPRITE + "</svg>";
    document.body.prepend(d.firstChild);
  }

  // js/sheet.js
  var overlay = null;
  var onCloseCb = null;
  function ensure() {
    if (overlay) return overlay;
    overlay = h("div", { class: "modal-overlay", id: "sheet-overlay", onclick: (e) => {
      if (e.target === overlay) closeSheet();
    } });
    document.body.append(overlay);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheet();
    });
    return overlay;
  }
  function openSheet(title, body, { onClose } = {}) {
    const ov = ensure();
    onCloseCb = onClose || null;
    ov.replaceChildren(h(
      "div",
      { class: "modal-sheet", role: "dialog", "aria-label": title },
      h(
        "div",
        { class: "modal-title" },
        h("h2", {}, title),
        h("button", { type: "button", "aria-label": "Zav\u0159\xEDt", onclick: () => closeSheet() }, icon("close"))
      ),
      body
    ));
    ov.classList.add("active");
    ov.querySelector("input:not([type=file]):not([type=hidden]), textarea")?.focus?.();
  }
  function closeSheet() {
    if (!overlay) return;
    overlay.classList.remove("active");
    overlay.replaceChildren();
    const cb = onCloseCb;
    onCloseCb = null;
    cb?.();
  }
  var toastTimer = null;
  function toast(text, { action, onAction } = {}) {
    let t = document.getElementById("toast");
    if (!t) {
      t = h("div", { id: "toast", class: "toast", role: "status" });
      document.body.append(t);
    }
    put(t.replaceChildren() ?? t, h("span", {}, text), action ? h("button", { type: "button", onclick: () => {
      t.classList.remove("show");
      onAction?.();
    } }, action) : null);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 5e3);
  }

  // js/router.js
  var routes = [];
  var root = null;
  var seq2 = 0;
  var gate = null;
  var setGate = (fn) => {
    gate = fn;
  };
  function route(pattern, handler, nav = null) {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/:([a-z]+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    }) + "$");
    routes.push({ re, keys, handler, nav });
  }
  function guard() {
    const mine = seq2;
    return () => mine === seq2;
  }
  function navigate(path) {
    if (location.hash === "#" + path) return render();
    location.hash = "#" + path;
    return void 0;
  }
  function parseHash(hash = location.hash) {
    const raw = hash.replace(/^#/, "") || "/";
    const [path, query = ""] = raw.split("?");
    return { path: path || "/", query: Object.fromEntries(new URLSearchParams(query)) };
  }
  async function render() {
    if (!root) return;
    const mine = ++seq2;
    const { path, query } = parseHash();
    closeSheet();
    const redirect = gate ? await gate(path) : null;
    if (mine !== seq2) return;
    if (redirect && redirect !== path) {
      navigate(redirect);
      return;
    }
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      document.querySelectorAll(".bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.nav === r.nav));
      try {
        await r.handler(root, params, query);
      } catch (err) {
        console.error(err);
        put(clear(root), h("div", { class: "empty-state" }, `Chyba: ${err.message}`));
      }
      if (mine === seq2) window.scrollTo(0, 0);
      return;
    }
    navigate("/");
  }
  function startRouter(el) {
    root = el;
    window.addEventListener("hashchange", render);
    return render();
  }

  // js/version.js
  var VERSION = "RCv0.19";

  // js/backup.js
  var SCHEMA_VERSION = 1;
  var PORTABLE_META = ["hemisphere", "profile", "profileSource", "acquisition"];
  var MAX_TEXT = 2e4;
  var jszip = (JSZip) => JSZip || globalThis.JSZip || (() => {
    throw new Error("JSZip nen\xED na\u010Dten\xFD");
  })();
  var isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  var isDate = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
  var isId = (v) => typeof v === "string" && v.length > 0 && v.length <= 80 && /^[\w.-]+$/.test(v);
  async function exportBackup(db, { JSZip, now: now2 = nowIso() } = {}) {
    const Z = jszip(JSZip);
    const zip = new Z();
    const plants = await listPlants(db);
    const events = await getAllEvents(db);
    const meta = {};
    for (const k of PORTABLE_META) {
      const v = await metaGet(db, k);
      if (v !== void 0) meta[k] = v;
    }
    const photoIds = await listPhotoKeys(db);
    const photos = [];
    for (const id of photoIds) {
      const rec = await getPhoto(db, id);
      if (!rec) continue;
      photos.push({ id: rec.id, plantId: rec.plantId, createdAt: rec.createdAt });
      zip.file(`photos/${rec.id}.jpg`, new Uint8Array(await rec.blob.arrayBuffer()), { binary: true });
    }
    zip.file("manifest.json", JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now2,
      appVersion: VERSION,
      counts: { plants: plants.length, events: events.length, photos: photos.length }
    }, null, 2));
    zip.file("data.json", JSON.stringify({ plants, events, meta, photos }));
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", streamFiles: true });
    await metaSet(db, "lastExportAt", now2);
    await metaSet(db, "eventsAtExport", events.length);
    return bytes;
  }
  var txt = (v, max = 200) => String(v ?? "").slice(0, max);
  function cleanPlant(p) {
    if (!isObj(p) || !isId(p.id) || typeof p.name !== "string" || !p.name.trim()) return null;
    if (!CATEGORIES[p.category] || !ENVIRONMENTS.includes(p.environment) || !isDate(p.startDate)) return null;
    const lifecycle = p.lifecycle === "perennial" ? "perennial" : "cycle";
    const learned = isObj(p.learnedBase) ? Object.fromEntries(Object.entries(p.learnedBase).filter(([, v]) => Number.isFinite(v) && v > 0)) : null;
    const variety = txt(p.variety).trim();
    return {
      id: p.id,
      name: txt(p.name).trim(),
      variety,
      varietyKey: normalizeKey(variety),
      category: p.category,
      lifecycle,
      environment: p.environment,
      harvestable: !!p.harvestable,
      location: txt(p.location).trim(),
      source: SOURCES.includes(p.source) ? p.source : "other",
      baseOverride: Number.isFinite(p.baseOverride) && p.baseOverride > 0 ? p.baseOverride : null,
      learnedBase: learned && Object.keys(learned).length ? learned : null,
      startDate: p.startDate,
      createdAt: isDate(p.createdAt) ? p.createdAt : p.startDate,
      ...p.reminders === false ? { reminders: false } : {},
      archivedAt: null,
      cache: emptyCache()
    };
  }
  function cleanEvent(e) {
    if (!isObj(e) || !isId(e.id) || !isId(e.plantId) || !EVENT_TYPES.includes(e.type)) return null;
    if (!isDate(e.occurredAt) || !isDate(e.recordedAt) || !isObj(e.payload)) return null;
    if (JSON.stringify(e.payload).length > MAX_TEXT) return null;
    return { id: e.id, plantId: e.plantId, type: e.type, occurredAt: e.occurredAt, recordedAt: e.recordedAt, payload: e.payload };
  }
  async function readBackup(input, { JSZip } = {}) {
    const Z = jszip(JSZip);
    let zip;
    try {
      zip = await Z.loadAsync(input);
    } catch {
      throw new Error("Soubor nen\xED platn\xE1 z\xE1loha (ZIP).");
    }
    const mf = zip.file("manifest.json"), df = zip.file("data.json");
    if (!mf || !df) throw new Error("V z\xE1loze chyb\xED manifest.json nebo data.json.");
    let manifest, data;
    try {
      manifest = JSON.parse(await mf.async("string"));
      data = JSON.parse(await df.async("string"));
    } catch {
      throw new Error("Z\xE1loha je po\u0161kozen\xE1 (JSON).");
    }
    if (!Number.isInteger(manifest?.schemaVersion) || manifest.schemaVersion < 1) throw new Error("Z\xE1loha nem\xE1 platnou verzi sch\xE9matu.");
    if (manifest.schemaVersion > SCHEMA_VERSION) throw new Error(`Z\xE1loha je z nov\u011Bj\u0161\xED verze aplikace (sch\xE9ma ${manifest.schemaVersion}). Aktualizuj aplikaci.`);
    if (!isObj(data) || !Array.isArray(data.plants) || !Array.isArray(data.events)) throw new Error("Z\xE1loha je po\u0161kozen\xE1 (data).");
    const plants = data.plants.map(cleanPlant).filter(Boolean);
    const ids = new Set(plants.map((p) => p.id));
    const events = data.events.map(cleanEvent).filter(Boolean);
    const skipped = data.plants.length - plants.length + (data.events.length - events.length);
    const photoList = Array.isArray(data.photos) ? data.photos.filter((p) => isObj(p) && isId(p.id) && isId(p.plantId)) : [];
    const meta = {};
    for (const k of PORTABLE_META) if (isObj(data.meta) && k in data.meta) meta[k] = data.meta[k];
    if (meta.hemisphere && !["north", "south"].includes(meta.hemisphere)) delete meta.hemisphere;
    if (meta.profile && !PROFILE_KEYS.includes(meta.profile)) {
      delete meta.profile;
      delete meta.profileSource;
    }
    if (meta.profileSource && !PROFILE_SOURCES.includes(meta.profileSource)) delete meta.profileSource;
    if ("acquisition" in meta) meta.acquisition = cleanAcquisition(meta.acquisition);
    if (meta.acquisition == null) delete meta.acquisition;
    return { zip, manifest, plants, events, photoList, meta, skipped, archivePlantIds: ids };
  }
  function cleanAcquisition(a) {
    if (!isObj(a)) return null;
    const out = {};
    for (const k of UTM_KEYS) if (typeof a[k] === "string" && a[k].trim()) out[k] = a[k].replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 100);
    if (typeof a.capturedAt === "string" && !Number.isNaN(Date.parse(a.capturedAt))) out.capturedAt = a.capturedAt;
    return Object.keys(out).length ? out : null;
  }
  var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  async function importBackup(db, input, { JSZip } = {}) {
    const parsed = await readBackup(input, { JSZip });
    const localPlants = new Map((await listPlants(db)).map((p) => [p.id, p]));
    const localEvents = new Map((await getAllEvents(db)).map((e) => [e.id, e]));
    const report = { plantsAdded: 0, plantsExisting: 0, eventsAdded: 0, eventsExisting: 0, photosAdded: 0, skipped: parsed.skipped, conflicts: [] };
    const plantsToPut = [];
    for (const p of parsed.plants) {
      const cur = localPlants.get(p.id);
      if (!cur) {
        plantsToPut.push(p);
        localPlants.set(p.id, p);
        report.plantsAdded += 1;
        continue;
      }
      report.plantsExisting += 1;
      const keys = ["name", "variety", "category", "lifecycle", "harvestable", "location", "startDate"];
      if (keys.some((k) => cur[k] !== p[k])) report.conflicts.push({ kind: "plant", id: p.id, name: cur.name });
    }
    const eventsToPut = [];
    for (const e of parsed.events) {
      if (!localPlants.has(e.plantId)) {
        report.skipped += 1;
        continue;
      }
      const cur = localEvents.get(e.id);
      if (!cur) {
        eventsToPut.push(e);
        localEvents.set(e.id, e);
        report.eventsAdded += 1;
        continue;
      }
      report.eventsExisting += 1;
      if (cur.plantId !== e.plantId || cur.type !== e.type || cur.occurredAt !== e.occurredAt || !same(cur.payload, e.payload)) {
        report.conflicts.push({ kind: "event", id: e.id, type: e.type });
      }
    }
    const have = new Set(await listPhotoKeys(db));
    for (const ph of parsed.photoList) {
      if (have.has(ph.id) || !localPlants.has(ph.plantId)) continue;
      const f = parsed.zip.file(`photos/${ph.id}.jpg`);
      if (!f) continue;
      const bytes = await f.async("uint8array");
      if (bytes[0] !== 255 || bytes[1] !== 216) {
        report.skipped += 1;
        continue;
      }
      await putPhoto(db, { id: ph.id, plantId: ph.plantId, blob: new Blob([bytes], { type: "image/jpeg" }), createdAt: isDate(ph.createdAt) ? ph.createdAt : nowIso() });
      report.photosAdded += 1;
    }
    await withTx(db, ["plants", "events", "meta"], "readwrite", async (s) => {
      for (const p of plantsToPut) s.plants.put(p);
      for (const e of eventsToPut) s.events.put(e);
      for (const [k, v] of Object.entries(parsed.meta)) {
        const exists = await new Promise((res, rej) => {
          const r = s.meta.get(k);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        if (!exists) s.meta.put({ key: k, value: v });
      }
      return null;
    });
    await metaSet(db, "schemaVersion", SCHEMA_VERSION);
    await rebuildAll(db);
    return report;
  }
  async function backupReminderDue(db, now2 = nowIso()) {
    const [last, atExport, dismissed] = await Promise.all([metaGet(db, "lastExportAt"), metaGet(db, "eventsAtExport"), metaGet(db, "backupDismissedAt")]);
    const events = await getAllEvents(db);
    if (!events.length) return false;
    const since = last ?? events.reduce((m, e) => e.recordedAt < m ? e.recordedAt : m, events[0].recordedAt);
    const days = (Date.parse(now2) - Date.parse(since)) / 864e5;
    const fresh = events.length - (atExport ?? 0);
    if (days < 30 || fresh < 10) return false;
    if (dismissed && (Date.parse(now2) - Date.parse(dismissed)) / 864e5 < 7) return false;
    return true;
  }
  var dismissBackupReminder = (db, now2 = nowIso()) => metaSet(db, "backupDismissedAt", now2);

  // js/format.js
  var fmtDate = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
  var fmtDateTime = (iso) => new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  var pl = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  var daysWord = (n) => pl(n, "den", "dny", "dn\xED");
  function relDay(iso, now2) {
    const d = dayDiff(now2, iso);
    if (d === 0) return "dnes";
    if (d === 1) return "z\xEDtra";
    if (d === -1) return "v\u010Dera";
    return d > 0 ? `za ${d} ${daysWord(d)}` : `p\u0159ed ${-d} ${daysWord(-d)}`;
  }
  var num2 = (v, digits = 1) => (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString("cs-CZ");
  function toLocalInput(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  var fromLocalInput = (v) => v ? new Date(v).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  var starsText = (n, max = 5) => {
    const r = Math.max(0, Math.min(max, Math.round(n)));
    return "\u2605".repeat(r) + "\u2606".repeat(max - r);
  };
  var plantsWord = (n) => pl(n, "rostlina", "rostliny", "rostlin");

  // js/pwa.js
  var deferredPrompt = null;
  var listeners = /* @__PURE__ */ new Set();
  function initPwa() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      listeners.forEach((f) => f());
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      listeners.forEach((f) => f());
    });
    const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if ("serviceWorker" in navigator && secure) {
      const prod = location.hostname === "blog.myscriptorium.cz";
      navigator.serviceWorker.register(new URL("sw.js", document.baseURI).href, { scope: prod ? "/en/apps/pheno" : new URL("./", document.baseURI).pathname, updateViaCache: "none" }).catch((e) => console.warn("SW registration failed", e));
    }
  }
  var onInstallChange = (f) => {
    listeners.add(f);
    return () => listeners.delete(f);
  };
  var canPromptInstall = () => !!deferredPrompt;
  async function promptInstall() {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach((f) => f());
    return outcome;
  }
  function isStandalone() {
    return !!(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone);
  }
  function platform() {
    const ua = navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return { ios, android: /Android/.test(ua) };
  }
  var iosBrowserTab = () => platform().ios && !isStandalone();
  async function requestPersistence(db) {
    const r = await ensurePersistence();
    try {
      await metaSet(db, "persistGranted", r.persisted);
    } catch {
    }
    return r;
  }
  async function storageEstimate() {
    try {
      const e = await navigator.storage?.estimate?.();
      return e && e.quota ? { usage: e.usage || 0, quota: e.quota } : null;
    } catch {
      return null;
    }
  }
  var persistGranted = (db) => metaGet(db, "persistGranted");

  // js/ui-settings.js
  var mb = (b) => `${(b / 1048576).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} MB`;
  var row = (label, value, id) => h("div", { class: "settings-row" }, h("span", {}, label), h("strong", { id }, value));
  function download(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    const a = h("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  async function doExport(rerender) {
    toast(S.backup.exporting);
    try {
      const bytes = await exportBackup(ctx.db, { JSZip: globalThis.JSZip });
      download(bytes, `pheno_zaloha_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.zip`);
      toast(S.backup.exported);
      rerender?.();
    } catch (e) {
      toast(`${S.backup.failed}: ${e.message}`);
    }
  }
  function reportView(r) {
    const lines = [
      [S.backup.plantsAdded, r.plantsAdded],
      [S.backup.plantsExisting, r.plantsExisting],
      [S.backup.eventsAdded, r.eventsAdded],
      [S.backup.photosAdded, r.photosAdded],
      [S.backup.skipped, r.skipped]
    ];
    return h(
      "div",
      { id: "import-report" },
      lines.map(([l, v]) => row(l, String(v))),
      r.conflicts?.length ? h(
        "div",
        {},
        h("div", { class: "section-title" }, S.backup.conflicts),
        h("ul", { class: "conflicts" }, r.conflicts.map((c) => h("li", {}, c.kind === "plant" ? `Rostlina ${c.name}` : `Ud\xE1lost ${c.type} (${c.id})`)))
      ) : null,
      h("div", { class: "form-actions" }, h("button", { type: "button", class: "btn btn-primary", onclick: () => {
        closeSheet();
        navigate("/");
      } }, S.ui.done))
    );
  }
  function importSheet(rerender) {
    const file = h("input", { type: "file", id: "import-file", accept: ".zip,application/zip" });
    const err = h("div", { class: "form-error", id: "import-error" });
    const go = h("button", { type: "button", class: "btn btn-primary", id: "btn-import-go", onclick: async () => {
      if (!file.files[0]) {
        err.textContent = S.backup.pickFile;
        return;
      }
      go.disabled = true;
      err.textContent = S.backup.importing;
      try {
        const report = await importBackup(ctx.db, file.files[0], { JSZip: globalThis.JSZip });
        await initCtx(ctx.db);
        openSheet(S.backup.importDone, reportView(report));
        rerender?.();
      } catch (e) {
        err.textContent = `${S.backup.failed}: ${e.message}`;
        go.disabled = false;
      }
    } }, S.backup.importBtn);
    openSheet(S.backup.import, h(
      "div",
      {},
      h("p", { class: "muted" }, S.backup.importAsk),
      field("", file),
      err,
      h("div", { class: "form-actions" }, h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel), go)
    ));
  }
  async function renderSettings(root2) {
    const alive = guard();
    const rerender = () => renderSettings(root2);
    const persisted = await persistGranted(ctx.db) ?? (navigator.storage?.persisted ? await navigator.storage.persisted() : null);
    const est = await storageEstimate();
    const lastExport = await metaGet(ctx.db, "lastExportAt");
    const theme = chipGroup([["tmave", S.theme.dark], ["svetle", S.theme.light]], getTheme(), setTheme);
    theme.el.id = "theme-chips";
    const prof = chipGroup(PROFILE_KEYS.map((k) => [k, S.profile[k]]), ctx.profile, async (v) => {
      await setProfile(ctx.db, v, "settings");
      ctx.profile = v;
    });
    prof.el.id = "profile-chips";
    const hemi = chipGroup([["north", S.ui.north], ["south", S.ui.south]], ctx.hemisphere, setHemisphere);
    hemi.el.id = "hemisphere-chips";
    if (!alive()) return void 0;
    put(
      clear(root2),
      h("div", { class: "top-bar" }, h("h1", {}, S.nav.settings)),
      h(
        "div",
        { class: "card pad" },
        field(S.ui.appearance, theme.el),
        field(S.profile.label, prof.el, S.profile.settingsHint),
        field(S.ui.hemisphere, hemi.el, "Ovliv\u0148uje ro\u010Dn\xED obdob\xED u rostlin venku a ve sklen\xEDku.")
      ),
      h(
        "div",
        { class: "card pad" },
        h("h3", {}, S.backup.title),
        h("p", { class: "muted" }, S.backup.hint),
        row(S.backup.lastExport, lastExport ? fmtDateTime(lastExport) : S.backup.never, "last-export"),
        h(
          "div",
          { class: "form-actions" },
          h("button", { type: "button", class: "btn btn-primary", id: "btn-export", onclick: () => doExport(rerender) }, S.backup.export),
          h("button", { type: "button", class: "btn btn-secondary", id: "btn-import", onclick: () => importSheet(rerender) }, S.backup.import)
        )
      ),
      h(
        "div",
        { class: "card pad" },
        h("h3", {}, S.storage.title),
        row(S.storage.persistent, persisted == null ? S.storage.unknown : persisted ? S.storage.yes : S.storage.no, "persist-state"),
        persisted === false ? h("p", { class: "muted" }, S.persistWarn) : null,
        est ? row(S.storage.usage, `${mb(est.usage)} / ${mb(est.quota)}`, "storage-usage") : null,
        row(S.storage.installState, isStandalone() ? S.storage.installedYes : S.storage.installedNo, "install-state"),
        iosBrowserTab() ? h("div", { class: "banner critical", id: "ios-warn" }, S.storage.iosWarn) : null,
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-install-guide", onclick: () => navigate("/install") }, S.storage.installGuide)
      ),
      h("div", { class: "card pad" }, row(S.ui.version, VERSION))
    );
  }

  // js/ui-onboarding.js
  async function renderOnboarding(root2) {
    const choose = async (key) => {
      await setProfile(ctx.db, key, "onboarding");
      navigate("/");
    };
    put(
      clear(root2),
      h("div", { class: "top-bar" }, h("h1", {}, S.profile.question)),
      h("p", { class: "muted" }, S.profile.intro),
      h(
        "div",
        { class: "stack onboarding-options", id: "onboarding" },
        PROFILE_KEYS.map((k) => h("button", { type: "button", class: "btn btn-secondary option-btn", dataset: { profile: k }, onclick: () => choose(k) }, S.profile[k]))
      ),
      h(
        "div",
        { class: "form-actions onboarding-skip" },
        h("button", { type: "button", class: "btn btn-secondary", id: "onboarding-skip", onclick: () => choose("mixed") }, S.profile.skip)
      ),
      h("button", { type: "button", class: "btn btn-ghost", id: "onboarding-restore", onclick: () => importSheet(() => navigate("/")) }, S.profile.restore)
    );
  }

  // js/photos.js
  var urls = /* @__PURE__ */ new Map();
  function resizeImage(file, max = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * k), hgt = Math.round(img.height * k);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = hgt;
        canvas.getContext("2d").drawImage(img, 0, 0, w, hgt);
        URL.revokeObjectURL(src);
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Fotku se nepoda\u0159ilo zpracovat")), "image/jpeg", quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(src);
        reject(new Error("Soubor nen\xED obr\xE1zek"));
      };
      img.src = src;
    });
  }
  async function savePhotoFile(db, plantId, file) {
    const blob = await resizeImage(file);
    const id = uid();
    await putPhoto(db, { id, plantId, blob, createdAt: nowIso() });
    return id;
  }
  async function photoUrl(db, id) {
    if (!id) return null;
    if (urls.has(id)) return urls.get(id);
    const rec = await getPhoto(db, id);
    if (!rec) return null;
    const u = URL.createObjectURL(rec.blob);
    urls.set(id, u);
    return u;
  }

  // js/timeline.js
  var DONE_TYPES = ["watering", "moisture_check", "fertilizing", "pest_check"];
  function doneToday(events, now2) {
    return liveEvents(events).filter((e) => DONE_TYPES.includes(e.type) && dayDiff(e.occurredAt, now2) === 0).length;
  }
  function latestPhotoId(events) {
    const photos = liveEvents(events).filter((e) => e.type === "photo");
    return photos.length ? photos.at(-1).payload.photoId : null;
  }
  function describeEvent(e) {
    const p = e.payload || {};
    switch (e.type) {
      case "created":
        return { icon: "sprout", title: "Rostlina zalo\u017Eena", detail: `${S.environment[p.environment] || ""}` };
      case "stage_change":
        return { icon: "stage", title: `F\xE1ze: ${S.stage[p.to] || p.to}`, detail: "" };
      case "environment_change":
        return { icon: "swap", title: `Prost\u0159ed\xED: ${S.environment[p.environment]}`, detail: "" };
      case "watering":
        return { icon: "drop", title: "Zalito", detail: p.amountMl ? `${p.amountMl} ml` : "" };
      case "moisture_check":
        return { icon: "drop", title: `Vlhkost: ${S.moisture[p.answer]}`, detail: p.watered ? "zalito" : "nezalito", answer: p.answer };
      case "fertilizing":
        return { icon: "leaf", title: "P\u0159ihnojeno", detail: p.product || "" };
      case "pest_check":
        return { icon: "bug", title: "Kontrola \u0161k\u016Fdc\u016F", detail: p.found ? "nalezeno" : "\u010Disto" };
      case "problem":
        return { icon: "bug", title: `Probl\xE9m: ${S.problem[p.problemType]}`, detail: `z\xE1va\u017Enost ${p.severity}${p.note ? ` \xB7 ${p.note}` : ""}` };
      case "problem_resolved":
        return { icon: "check", title: "Probl\xE9m vy\u0159e\u0161en", detail: "" };
      case "note":
        return { icon: "note", title: "Pozn\xE1mka", detail: p.text };
      case "photo":
        return { icon: "camera", title: "Fotka", detail: p.caption || "", photoId: p.photoId };
      case "measurement":
        return { icon: "thermo", title: `M\u011B\u0159en\xED: ${p.kind}`, detail: `${num2(p.value, 2)}${p.unit ? ` ${p.unit}` : ""}` };
      case "milestone":
        return { icon: "flag", title: p.label, detail: "" };
      case "harvest":
        return { icon: "leaf", title: "Sklize\u0148", detail: "" };
      case "evaluation":
        return { icon: "check", title: "Hodnocen\xED", detail: `${p.scores?.overall}/5` };
      case "archive":
        return { icon: "pot", title: "Archivov\xE1no", detail: "" };
      case "unarchive":
        return { icon: "pot", title: "Obnoveno z archivu", detail: "" };
      default:
        return { icon: "note", title: e.type, detail: "" };
    }
  }
  function diaryRows(events) {
    return liveEvents(events).slice().reverse().map((e) => ({ event: e, ...describeEvent(e) }));
  }

  // js/stats.js
  var overallOf = (e) => e.payload?.scores?.overall;
  var validOverall = (e) => Number.isFinite(overallOf(e));
  var yieldKey = (category) => CATEGORIES[category]?.harvestFields[0]?.key ?? null;
  function currentEvaluations(plant, events) {
    const evs = liveEvents(events).filter((e) => e.type === "evaluation" && validOverall(e));
    if (plant.lifecycle !== "perennial") return evs.length ? [evs.at(-1)] : [];
    const bySeason = /* @__PURE__ */ new Map();
    for (const e of evs) bySeason.set(e.payload.season ?? null, e);
    return [...bySeason.values()].sort((a, b) => a.occurredAt < b.occurredAt ? -1 : 1);
  }
  function latestEvaluation(events, season) {
    const evs = liveEvents(events).filter((e) => e.type === "evaluation" && validOverall(e) && (season === void 0 || (e.payload.season ?? null) === season));
    return evs.at(-1) ?? null;
  }
  function evaluationHistory(events) {
    const live = liveEvents(events);
    const harvests = live.filter((e) => e.type === "harvest");
    return live.filter((e) => e.type === "evaluation" && validOverall(e)).reverse().map((e) => {
      const prev = harvests.filter((h2) => h2.occurredAt <= e.occurredAt).at(-1);
      return {
        event: e,
        at: e.occurredAt,
        overall: overallOf(e),
        note: e.payload.note || "",
        season: e.payload.season ?? null,
        daysAfterHarvest: prev ? daysBetween(prev.occurredAt, e.occurredAt) : e.payload.daysSinceLastHarvest ?? null
      };
    });
  }
  function harvestTotals(plant, events) {
    const totals = {};
    for (const f of CATEGORIES[plant.category].harvestFields) {
      totals[f.key] = liveEvents(events).filter((e) => e.type === "harvest").reduce((s, e) => s + (Number.isFinite(e.payload[f.key]) ? e.payload[f.key] : 0), 0);
    }
    return totals;
  }
  function plantSummary(plant, events) {
    const live = liveEvents(events);
    const harvests = live.filter((e) => e.type === "harvest");
    const evals = currentEvaluations(plant, events);
    const yk = yieldKey(plant.category);
    const yieldSum = harvests.reduce((s, e) => s + (Number.isFinite(e.payload[yk]) ? e.payload[yk] : 0), 0);
    const seasons = plant.lifecycle === "perennial" ? new Set(harvests.map((e) => new Date(e.occurredAt).getFullYear())).size : harvests.length ? 1 : 0;
    let cycleDays = null;
    if (plant.lifecycle !== "perennial") {
      const end = live.filter((e) => e.type === "stage_change" && STAGE_FLAGS[e.payload.to]?.terminal).at(-1) ?? harvests.at(-1);
      if (end) cycleDays = daysBetween(plant.startDate, end.occurredAt);
    }
    const overall = evals.length ? mean(evals.map(overallOf)) : null;
    const last = latestEvaluation(events);
    return {
      plantId: plant.id,
      harvestCount: harvests.length,
      seasons,
      yield: yieldSum,
      yieldKey: yk,
      overall,
      wouldGrowAgain: last && last.payload.wouldGrowAgain != null ? !!last.payload.wouldGrowAgain : null,
      cycleDays,
      problems: live.filter((e) => e.type === "problem").length,
      evaluated: evals.length > 0
    };
  }
  function varietyGroupKey(plant) {
    const key = plant.varietyKey || normalizeKey(plant.variety);
    return key ? { key, unnamed: false } : { key: normalizeKey(plant.name), unnamed: true };
  }
  var avg = (xs) => xs.length ? mean(xs) : null;
  function aggregateVarieties(plants, byPlant) {
    const groups = /* @__PURE__ */ new Map();
    for (const plant of plants) {
      const { key, unnamed } = varietyGroupKey(plant);
      const gk = `${plant.category}|${key}`;
      if (!groups.has(gk)) groups.set(gk, { category: plant.category, key, unnamed, items: [] });
      groups.get(gk).items.push({ plant, summary: plantSummary(plant, byPlant.get(plant.id) || []) });
    }
    return [...groups.values()].map((g) => {
      const items = g.items.sort((a, b) => a.plant.startDate < b.plant.startDate ? 1 : -1);
      const sums = items.map((i) => i.summary);
      const rated = sums.filter((s) => s.overall != null);
      const grow = sums.filter((s) => s.wouldGrowAgain != null);
      const harvested = sums.filter((s) => s.harvestCount > 0);
      const totalYield = sums.reduce((s, x) => s + x.yield, 0);
      return {
        category: g.category,
        key: g.key,
        unnamed: g.unnamed,
        label: g.unnamed ? items[0].plant.name : items[0].plant.variety || g.key,
        items,
        plantCount: items.length,
        cycles: sums.reduce((s, x) => s + x.seasons, 0),
        avgOverall: avg(rated.map((s) => s.overall)),
        wouldGrowAgainShare: grow.length ? grow.filter((s) => s.wouldGrowAgain).length / grow.length : null,
        totalYield,
        yieldPerPlant: harvested.length ? totalYield / harvested.length : null,
        yieldKey: yieldKey(g.category),
        avgCycleDays: avg(sums.filter((s) => s.cycleDays != null).map((s) => s.cycleDays)),
        problemsPerPlant: sums.reduce((s, x) => s + x.problems, 0) / items.length
      };
    }).sort((a, b) => (b.avgOverall ?? -1) - (a.avgOverall ?? -1) || b.plantCount - a.plantCount);
  }
  function overviewNumbers(plants, byPlant) {
    const sums = plants.map((p) => plantSummary(p, byPlant.get(p.id) || []));
    return {
      plants: plants.length,
      archived: plants.filter((p) => p.archivedAt).length,
      harvests: sums.reduce((s, x) => s + x.harvestCount, 0),
      evaluated: sums.filter((x) => x.evaluated).length
    };
  }

  // js/ui-forms.js
  async function submit(plantId, inputs, message, done) {
    try {
      const { events } = await appendEvents(ctx.db, plantId, inputs);
      closeSheet();
      toast(message, {
        action: S.ui.undo,
        onAction: async () => {
          for (const e of events) await voidEvent(ctx.db, plantId, e.id);
          done?.();
        }
      });
      done?.();
      return events;
    } catch (err) {
      toast(err.message || S.err.invalid);
      return null;
    }
  }
  function dateField() {
    const input = h("input", { type: "datetime-local", value: toLocalInput(now()) });
    return { el: field(S.ui.date, input), get: () => fromLocalInput(input.value) };
  }
  var buttons = (onSave, label = S.ui.save) => h(
    "div",
    { class: "form-actions" },
    h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel),
    h("button", { type: "button", class: "btn btn-primary", onclick: onSave }, label)
  );
  function moistureSheet(plant, done) {
    const info = dryingInfo(plant);
    const last = plant.cache.lastWateredAt ?? plant.startDate;
    const t = daysBetween(last, now());
    let answer = null, touched = false;
    const cb = h("input", { type: "checkbox", checked: true });
    cb.addEventListener("change", () => {
      touched = true;
    });
    const d = dateField();
    const opts = MOISTURE_ANSWERS.map((a) => h("button", {
      type: "button",
      class: `moisture-btn ${a}`,
      dataset: { answer: a },
      onclick: () => {
        answer = a;
        opts.forEach((o) => o.classList.toggle("selected", o.dataset.answer === a));
        if (!touched) cb.checked = a !== "wet";
        save.disabled = false;
      }
    }, S.moisture[a]));
    const save = h("button", { type: "button", class: "btn btn-primary", disabled: true, onclick: () => {
      if (!answer) return;
      submit(
        plant.id,
        [{ type: "moisture_check", occurredAt: d.get(), payload: { answer, watered: cb.checked } }],
        `${S.moisture[answer]}${cb.checked ? " \xB7 zalito" : ""}`,
        done
      );
    } }, S.ui.save);
    openSheet(`${S.ui.moistureCheck} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, `Od posledn\xED z\xE1livky uplynulo ${num2(t)} dne. O\u010Dek\xE1van\xE9 schnut\xED: ${num2(info.d)} dne.`),
      h("div", { class: "moisture-row" }, opts),
      h("label", { class: "check-row" }, cb, h("span", {}, S.ui.watered)),
      d.el,
      h("div", { class: "form-actions" }, h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel), save)
    ));
  }
  function fertilizeSheet(plant, done) {
    const product = h("input", { type: "text", placeholder: "nepovinn\xE9" });
    const d = dateField();
    openSheet(`${S.ui.fertilize} \u2013 ${plant.name}`, h(
      "div",
      {},
      field("P\u0159\xEDpravek", product),
      d.el,
      buttons(() => submit(plant.id, [{ type: "fertilizing", occurredAt: d.get(), payload: { product: product.value } }], "P\u0159ihnojeno", done))
    ));
  }
  function pestCheckSheet(plant, done) {
    const found = h("input", { type: "checkbox" });
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    openSheet(`${S.ui.pestCheck} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("label", { class: "check-row" }, found, h("span", {}, S.ui.foundPests)),
      field(S.ui.note, note),
      d.el,
      buttons(() => submit(plant.id, [{ type: "pest_check", occurredAt: d.get(), payload: { found: found.checked, note: note.value } }], "Kontrola zaps\xE1na", done))
    ));
  }
  function problemSheet(plant, done) {
    const type = chipGroup(PROBLEM_TYPES.map((k) => [k, S.problem[k]]), "pest");
    const sev = chipGroup([[1, "1 \u2013 lehk\xE9"], [2, "2 \u2013 st\u0159edn\xED"], [3, "3 \u2013 v\xE1\u017En\xE9"]], 1);
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    openSheet(`${S.ui.problem} \u2013 ${plant.name}`, h(
      "div",
      {},
      field("Typ", type.el),
      field(S.ui.severity, sev.el),
      field(S.ui.note, note),
      d.el,
      buttons(() => submit(plant.id, [{ type: "problem", occurredAt: d.get(), payload: { problemType: type.get(), severity: sev.get(), note: note.value } }], "Probl\xE9m zaps\xE1n", done))
    ));
  }
  function followUpSheet(plant, task, done) {
    const btn = (label, cls, fn) => h("button", { type: "button", class: `btn ${cls}`, onclick: fn }, label);
    openSheet(`${S.taskLabel.problemFollowUp} \u2013 ${plant.name}`, h(
      "div",
      { class: "stack" },
      btn(S.ui.stillProblem, "btn-secondary", () => submit(plant.id, [{ type: "pest_check", payload: { found: true } }], "Kontrola zaps\xE1na", done)),
      btn(S.ui.resolved, "btn-primary", () => submit(plant.id, [
        { type: "pest_check", payload: { found: false } },
        { type: "problem_resolved", payload: { problemId: task.problemId } }
      ], "Probl\xE9m vy\u0159e\u0161en", done))
    ));
  }
  function noteSheet(plant, done) {
    const text = h("textarea", { rows: 4 });
    const d = dateField();
    openSheet(`${S.ui.addNote} \u2013 ${plant.name}`, h(
      "div",
      {},
      field(S.ui.note, text),
      d.el,
      buttons(() => submit(plant.id, [{ type: "note", occurredAt: d.get(), payload: { text: text.value } }], "Pozn\xE1mka ulo\u017Eena", done))
    ));
  }
  function photoSheet(plant, done) {
    const file = h("input", { type: "file", accept: "image/*", capture: "environment" });
    const caption = h("input", { type: "text", placeholder: "nepovinn\xE9" });
    const d = dateField();
    openSheet(`${S.ui.addPhoto} \u2013 ${plant.name}`, h(
      "div",
      {},
      field(S.ui.photo, file),
      field("Popisek", caption),
      d.el,
      buttons(async () => {
        if (!file.files[0]) return toast(S.err.invalid);
        try {
          const photoId = await savePhotoFile(ctx.db, plant.id, file.files[0]);
          await submit(plant.id, [{ type: "photo", occurredAt: d.get(), payload: { photoId, caption: caption.value } }], "Fotka ulo\u017Eena", done);
        } catch (e) {
          toast(e.message);
        }
      })
    ));
  }
  var MEASURES = [["v\xFD\u0161ka", "cm"], ["teplota", "\xB0C"], ["pH", ""], ["EC", "mS/cm"], ["vlhkost vzduchu", "%"], ["jin\xE9", ""]];
  function measurementSheet(plant, done) {
    const kind = chipGroup(MEASURES.map(([k]) => [k, k]), "v\xFD\u0161ka");
    const value = h("input", { type: "number", step: "any", inputmode: "decimal" });
    const d = dateField();
    openSheet(`${S.ui.measurement} \u2013 ${plant.name}`, h(
      "div",
      {},
      field("Veli\u010Dina", kind.el),
      field("Hodnota", value),
      d.el,
      buttons(() => {
        const unit = MEASURES.find(([k]) => k === kind.get())[1];
        submit(plant.id, [{ type: "measurement", occurredAt: d.get(), payload: { kind: kind.get(), value: value.value === "" ? NaN : Number(value.value), unit } }], "M\u011B\u0159en\xED ulo\u017Eeno", done);
      })
    ));
  }
  var MILESTONES = ["P\u0159esazen\xED", "\u0158ez", "Zako\u0159en\u011Bn\xED", "V\xFDsev", "P\u0159enesen\xED ven"];
  function milestoneSheet(plant, done) {
    const label = h("input", { type: "text", placeholder: "nap\u0159. P\u0159esazen\xED" });
    const chips = chipGroup(MILESTONES.map((m) => [m, m]), null, (v) => {
      label.value = v;
    });
    const d = dateField();
    openSheet(`${S.ui.milestone} \u2013 ${plant.name}`, h(
      "div",
      {},
      chips.el,
      field("N\xE1zev", label),
      d.el,
      buttons(() => submit(plant.id, [{ type: "milestone", occurredAt: d.get(), payload: { label: label.value } }], "Miln\xEDk ulo\u017Een", done))
    ));
  }
  function environmentSheet(plant, done) {
    const env = chipGroup(Object.entries(S.environment), plant.cache.environment);
    const d = dateField();
    openSheet(`${S.ui.changeEnv} \u2013 ${plant.name}`, h(
      "div",
      {},
      field(S.ui.environment, env.el),
      d.el,
      buttons(() => {
        if (env.get() === plant.cache.environment) return closeSheet();
        submit(plant.id, [{ type: "environment_change", occurredAt: d.get(), payload: { environment: env.get() } }], "Prost\u0159ed\xED zm\u011Bn\u011Bno", done);
      })
    ));
  }
  var quickWatered = (plant, done) => submit(plant.id, [{ type: "watering", payload: {} }], "Zalito", done);
  async function snoozeSheet(task, done) {
    const btn = (n) => h("button", { type: "button", class: "btn btn-secondary", onclick: async () => {
      const d = /* @__PURE__ */ new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + n);
      await snoozeTask(ctx.db, task.plantId, task.snoozeKey, d.toISOString());
      closeSheet();
      toast(`Odlo\u017Eeno do ${relDay(d.toISOString(), now())}`);
      done?.();
    } }, n === 1 ? "Na z\xEDtra" : `Na ${n} dny`);
    openSheet(`${S.ui.snooze} \u2013 ${task.plantName}`, h("div", { class: "stack" }, [1, 2, 3].map(btn)));
  }
  var terminalStage = (plant) => getStages(plant.category, plant.lifecycle).find((k) => STAGE_FLAGS[k]?.terminal) ?? null;
  function archiveSheet(plant, done) {
    openSheet(`${S.ui.archive} \u2013 ${plant.name}`, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, S.ui.archiveAsk),
      h("button", { type: "button", class: "btn btn-primary", id: "btn-do-archive", onclick: async () => {
        try {
          await appendEvents(ctx.db, plant.id, [{ type: "archive", payload: {} }]);
          closeSheet();
          toast("Archivov\xE1no");
          done?.();
        } catch (e) {
          toast(e.message);
        }
      } }, S.ui.archive),
      h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.later)
    ));
  }
  function harvestFollowUp(plant, done) {
    if (plant.lifecycle === "perennial") return;
    const stages = getStages(plant.category, plant.lifecycle);
    const term = terminalStage(plant);
    const cur = stages.indexOf(plant.cache.stage);
    const next = stages[cur + 1];
    const btn = (label, cls, fn, id) => h("button", { type: "button", class: `btn ${cls}`, id, onclick: fn }, label);
    const go = async (to, after) => {
      try {
        await appendEvents(ctx.db, plant.id, [{ type: "stage_change", payload: { from: plant.cache.stage, to } }]);
        closeSheet();
        done?.();
        after?.();
      } catch (e) {
        toast(e.message);
      }
    };
    const buttons2 = [];
    if (next && next !== term) buttons2.push(btn(`${S.ui.nextStage} \u201E${S.stage[next]}\u201C`, "btn-secondary", () => go(next), "btn-next-stage"));
    if (term && plant.cache.stage !== term) {
      buttons2.push(btn(S.ui.endCycle, "btn-primary", () => go(term, () => archiveSheet({ ...plant, cache: { ...plant.cache, stage: term } }, done)), "btn-end-cycle"));
    }
    buttons2.push(btn(S.ui.keepGoing, "btn-secondary", () => {
      closeSheet();
      done?.();
    }, "btn-keep"));
    openSheet(S.ui.harvestSaved, h("div", { class: "stack" }, buttons2));
  }
  function harvestSheet(plant, done) {
    const cfg = CATEGORIES[plant.category];
    const inputs = cfg.harvestFields.map((f) => ({ f, el: h("input", { type: "number", step: "any", min: f.min, inputmode: "decimal", dataset: { key: f.key } }) }));
    const method = chipGroup([["", "\u2014"], ...PROCESSING_METHODS.map((m) => [m, S.processing[m]])], "");
    const days = h("input", { type: "number", step: "1", min: "0", inputmode: "numeric" });
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    const save = async () => {
      const payload = {};
      for (const { f, el } of inputs) if (el.value !== "") payload[f.key] = Number(el.value);
      if (!Object.keys(payload).length) return toast(S.ui.fillOne);
      if (method.get()) payload.processingMethod = method.get();
      if (days.value !== "") payload.processingDays = Number(days.value);
      if (note.value.trim()) payload.note = note.value.trim();
      const ok = await submit(plant.id, [{ type: "harvest", occurredAt: d.get(), payload }], S.ui.harvestSaved, done);
      if (ok) harvestFollowUp(plant, done);
    };
    openSheet(`${S.ui.recordHarvest} \u2013 ${plant.name}`, h(
      "div",
      {},
      d.el,
      inputs.map(({ f, el }) => field(S.harvestField[f.key] || f.key, el)),
      field(S.ui.processing, method.el),
      field(S.ui.processingDays, days),
      field(S.ui.note, note),
      buttons(save)
    ));
  }
  function starPicker(value, onChange) {
    let cur = value || 0;
    const el = h("div", { class: "star-row", role: "radiogroup" });
    const btns = [];
    const paint = () => btns.forEach((b, i) => {
      b.textContent = i < cur ? "\u2605" : "\u2606";
      b.classList.toggle("on", i < cur);
    });
    for (let i = 1; i <= RATING_MAX; i++) {
      btns.push(h("button", {
        type: "button",
        class: "star-btn",
        dataset: { star: i },
        "aria-label": `${i}`,
        onclick: () => {
          cur = cur === i ? 0 : i;
          paint();
          onChange?.(cur);
        }
      }));
    }
    el.append(...btns);
    paint();
    return { el, get: () => cur };
  }
  async function evaluationSheet(plant, done) {
    const events = await getEvents(ctx.db, plant.id);
    const perennialHarvest = plant.lifecycle === "perennial" && plant.harvestable;
    const prev = latestEvaluation(events);
    const p = prev?.payload || {};
    const criteria = ["overall", ...CATEGORIES[plant.category].criteria];
    const pickers = Object.fromEntries(criteria.map((k) => [k, starPicker(p.scores?.[k])]));
    let grow = p.wouldGrowAgain ?? null;
    const growChips = chipGroup([["yes", S.ui.yes], ["no", S.ui.no]], grow == null ? null : grow ? "yes" : "no", (v) => {
      grow = v === "yes";
    });
    growChips.el.id = "eval-grow";
    const note = h("textarea", { rows: 3 });
    note.value = p.note || "";
    const season = h("input", { type: "number", step: "1", min: "2000", max: "2100", value: p.season ?? (/* @__PURE__ */ new Date()).getFullYear() });
    const d = dateField();
    const save = () => {
      if (!pickers.overall.get()) return toast(S.ui.overallRequired);
      const scores = {};
      for (const k of criteria) if (pickers[k].get()) scores[k] = pickers[k].get();
      const payload = { scores };
      if (grow != null) payload.wouldGrowAgain = grow;
      if (note.value.trim()) payload.note = note.value.trim();
      if (perennialHarvest && season.value !== "") payload.season = Number(season.value);
      submit(plant.id, [{ type: "evaluation", occurredAt: d.get(), payload }], "Hodnocen\xED ulo\u017Eeno", done);
    };
    openSheet(`${S.ui.evaluation} \u2013 ${plant.name}`, h(
      "div",
      {},
      criteria.map((k) => field(S.criterion[k], pickers[k].el)),
      field(S.ui.wouldGrowAgain, growChips.el),
      perennialHarvest ? field(S.ui.season, season) : null,
      field(S.ui.note, note),
      d.el,
      buttons(save)
    ));
  }

  // js/ui-dashboard.js
  var filters = { location: "all", environment: "all", category: "all" };
  var CAT_ICON = { herb: "leaf", vegetable: "sprout", fruit: "pot", flower: "sun", tree_shrub: "leaf", other: "pot" };
  var DOT = { overdue: "expired", today: "missing", upcoming: "needs_check" };
  function runTask(task, plant, done) {
    switch (task.type) {
      case "moisture":
        return moistureSheet(plant, done);
      case "fertilizing":
        return submit(plant.id, [{ type: "fertilizing", payload: {} }], "P\u0159ihnojeno", done);
      case "pestCheck":
        return submit(plant.id, [{ type: "pest_check", payload: { found: false } }], "Kontrola zaps\xE1na", done);
      case "problemFollowUp":
        return followUpSheet(plant, task, done);
      case "evaluation":
      case "evaluationReview":
        return evaluationSheet(plant, done);
      default:
        return null;
    }
  }
  function matches(p) {
    return (filters.location === "all" || p.location === filters.location) && (filters.environment === "all" || p.cache.environment === filters.environment) && (filters.category === "all" || p.category === filters.category);
  }
  function filterBar(active, rerender) {
    const groups = [
      ["location", "M\xEDsto", [...new Set(active.map((p) => p.location).filter(Boolean))].map((v) => [v, v])],
      ["environment", S.ui.environment, [...new Set(active.map((p) => p.cache.environment))].map((v) => [v, S.environment[v]])],
      ["category", S.ui.category, [...new Set(active.map((p) => p.category))].map((v) => [v, S.category[v]])]
    ].filter(([, , opts]) => opts.length > 1);
    if (!groups.length) return null;
    return h("div", { class: "filter-bar" }, groups.map(([key, label, opts]) => {
      const g = chipGroup([["all", `${label}: ${S.ui.all}`], ...opts], filters[key], (v) => {
        filters[key] = v;
        rerender();
      });
      g.el.classList.add("pill-row");
      return g.el;
    }));
  }
  function taskRow(task, plant, done) {
    const when = task.urgency === "overdue" ? `Po term\xEDnu \xB7 ${relDay(task.dueAt, now())}` : task.urgency === "today" ? "Dnes" : `Nadch\xE1zej\xEDc\xED \xB7 ${relDay(task.dueAt, now())}`;
    return h(
      "div",
      {
        class: "item-row task-row",
        role: "button",
        tabindex: 0,
        dataset: { task: task.type, plant: task.plantId },
        onclick: () => navigate(`/plant/${task.plantId}`)
      },
      h("span", { class: `badge-dot ${DOT[task.urgency]}` }),
      h(
        "div",
        { class: "item-info" },
        h("div", { class: "item-name" }, `${task.plantName} \u2013 ${S.taskLabel[task.type]}`),
        h("div", { class: "item-detail" }, h("span", { class: "item-sub" }, when))
      ),
      h(
        "div",
        { class: "item-actions qty-stepper" },
        h("button", {
          type: "button",
          class: "btn-quick",
          "aria-label": S.ui.done,
          dataset: { act: "do" },
          onclick: (e) => {
            e.stopPropagation();
            runTask(task, plant, done);
          }
        }, icon("check")),
        h("button", {
          type: "button",
          class: "qty-btn",
          "aria-label": S.ui.snooze,
          dataset: { act: "snooze" },
          onclick: (e) => {
            e.stopPropagation();
            snoozeSheet(task, done);
          }
        }, icon("clock"))
      )
    );
  }
  async function plantCard(plant, events, nextTask) {
    const cfg = CATEGORIES[plant.category];
    const url = await photoUrl(ctx.db, latestPhotoId(events));
    const stage = S.stage[plant.cache.stage] || plant.cache.stage;
    return h(
      "button",
      { type: "button", class: "plant-card", dataset: { plant: plant.id }, onclick: () => navigate(`/plant/${plant.id}`) },
      h("div", { class: "plant-photo" }, url ? h("img", { src: url, alt: plant.name }) : icon(CAT_ICON[plant.category] || "pot", "plant-photo-icon")),
      h(
        "div",
        { class: "plant-card-body" },
        h("div", { class: "plant-name" }, plant.name),
        h("div", { class: "plant-sub" }, plant.variety || S.category[plant.category]),
        h("div", { class: "plant-tags" }, h("span", { class: "tag" }, stage), h("span", { class: "tag" }, S.environment[plant.cache.environment])),
        nextTask ? h("div", { class: `plant-next ${nextTask.urgency}` }, `${S.taskLabel[nextTask.type]} \xB7 ${relDay(nextTask.dueAt, now())}`) : null
      ),
      cfg ? null : null
    );
  }
  async function renderDashboard(root2) {
    const alive = guard();
    const { plants, byPlant } = await loadAll();
    const active = plants.filter((p) => !p.archivedAt);
    const rerender = () => renderDashboard(root2);
    const list = active.filter(matches);
    const byId = new Map(active.map((p) => [p.id, p]));
    const nowIso2 = now();
    const opts = engineOpts();
    const remind = active.length ? await backupReminderDue(ctx.db, nowIso2) : false;
    const tasks = computeTasks(list, nowIso2, opts);
    const count = (u) => tasks.filter((t) => t.urgency === u).length;
    const done = list.reduce((n, p) => n + doneToday(byPlant.get(p.id) || [], nowIso2), 0);
    const open = count("overdue") + count("today");
    const total = done + open;
    const pct2 = total ? Math.round(done / total * 100) : active.length ? 100 : 0;
    const level = !active.length ? "empty" : pct2 >= 100 ? "done" : pct2 < 34 ? "starting" : "building";
    if (!alive()) return void 0;
    clear(root2);
    root2.append(
      h(
        "div",
        { class: "top-bar" },
        h("h1", {}, S.nav.overview),
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-new", "aria-label": S.ui.newPlant, onclick: () => navigate("/new") }, icon("plus"))
      ),
      h(
        "section",
        { class: "readiness-panel", dataset: { level } },
        h("div", { class: "readiness-mark" }, h("div", { class: "readiness-ring", style: `--readiness:${pct2}%` }, h("span", {}, `${pct2} %`))),
        h(
          "div",
          { class: "readiness-copy" },
          h("span", { class: "readiness-eyebrow" }, S.ui.careToday),
          h("strong", {}, total ? `${done} z ${total} \xFAkol\u016F` : "Dnes nic ne\u010Dek\xE1"),
          h("span", {}, active.length ? "Spln\u011Bn\xE9 kontroly a z\xE1livky se po\u010D\xEDtaj\xED do dne." : S.ui.noPlants)
        )
      ),
      h(
        "div",
        { class: "summary-grid" },
        tile("ok", "status-ok", done, S.ui.doneToday),
        tile("expired", "status-critical", count("overdue"), S.ui.overdue),
        tile("missing", "status-expiring", count("today"), S.ui.today),
        tile("review", "status-review", count("upcoming"), S.ui.upcoming)
      )
    );
    if (remind) {
      root2.append(h(
        "div",
        { class: "banner backup-banner", id: "backup-banner" },
        h("span", { class: "grow" }, S.backup.reminder),
        h("button", { type: "button", class: "btn btn-secondary btn-sm", id: "banner-export", onclick: async () => {
          await doExport();
          rerender();
        } }, S.backup.reminderBtn),
        h("button", { type: "button", class: "btn btn-ghost btn-sm", id: "banner-dismiss", onclick: async () => {
          await dismissBackupReminder(ctx.db);
          rerender();
        } }, S.backup.dismiss)
      ));
    }
    const first = tasks[0];
    if (first) {
      root2.append(h(
        "div",
        {
          class: "next-action",
          role: "button",
          tabindex: 0,
          id: "next-action",
          onclick: () => runTask(first, byId.get(first.plantId), rerender)
        },
        h("div", { class: "next-action-icon" }, icon(first.type === "moisture" ? "drop" : first.type === "fertilizing" ? "leaf" : first.type.startsWith("evaluation") ? "status-ok" : "bug")),
        h(
          "div",
          { class: "next-action-copy" },
          h("span", {}, S.ui.nextStep),
          h("strong", {}, `${first.plantName} \u2013 ${S.taskLabel[first.type]}`),
          h("small", {}, relDay(first.dueAt, nowIso2))
        ),
        h("button", { type: "button", "aria-label": S.ui.done }, icon("chevron"))
      ));
    }
    const bar = filterBar(active, rerender);
    if (bar) root2.append(bar);
    root2.append(h("div", { class: "section-title" }, S.ui.needsAttention));
    root2.append(tasks.length ? h("div", { class: "card task-list" }, tasks.map((t) => taskRow(t, byId.get(t.plantId), rerender))) : h("div", { class: "empty-state" }, S.ui.noTasks));
    for (const key of PROFILES[ctx.profile]?.dashboard || []) {
      const sec = key === "tasks" ? null : profileSection(key, active, plants, byPlant, nowIso2);
      if (sec) root2.append(sec);
    }
    root2.append(h("div", { class: "section-title" }, `${S.ui.myPlants} (${list.length})`));
    if (!list.length) {
      root2.append(h("div", { class: "empty-state" }, S.ui.noPlants));
    } else {
      const cards = await Promise.all(list.map((p) => {
        const next = getPlantTasks(p, nowIso2, opts).sort((a, b) => a.dueAt < b.dueAt ? -1 : 1)[0];
        const withUrg = next ? { ...next, urgency: next.dueAt < nowIso2 ? "overdue" : "upcoming" } : null;
        return plantCard(p, byPlant.get(p.id) || [], withUrg);
      }));
      root2.append(h("div", { class: "plant-grid" }, cards));
    }
    root2.append(h("button", { type: "button", class: "btn btn-primary add-plant", onclick: () => navigate("/new") }, icon("plus"), S.ui.newPlant));
  }
  function tile(cls, sym, n, label) {
    return h(
      "div",
      { class: `summary-tile ${cls}` },
      h("div", { class: "summary-tile-top" }, icon(sym, "summary-symbol")),
      h("div", { class: "num" }, n),
      h("div", { class: "lbl" }, label)
    );
  }
  var secRow = (text, sub, path) => h(
    "div",
    { class: "item-row profile-row", role: "button", tabindex: 0, onclick: path ? () => navigate(path) : null },
    h("div", { class: "item-info" }, h("div", { class: "item-name" }, text), sub ? h("div", { class: "item-detail" }, h("span", { class: "item-sub" }, sub)) : null)
  );
  function profileSection(key, active, all, byPlant, nowIso2) {
    if (!all.length) return null;
    const S_ = S.profile;
    let rows = [];
    if (key === "season") {
      const outdoor = active.filter((p) => SEASONAL_ENVIRONMENTS.includes(p.cache.environment));
      rows = [secRow(S_.seasonLine(S_[seasonOf(nowIso2, ctx.hemisphere)], outdoor.length))];
    } else if (key === "varieties") {
      rows = aggregateVarieties(all, byPlant).slice(0, 3).map((g) => secRow(g.label, [S.category[g.category], g.avgOverall != null ? `${num2(g.avgOverall)} \u2605` : null, `${g.plantCount} ${plantsWord(g.plantCount)}`].filter(Boolean).join(" \xB7 "), `/variety/${g.category}/${encodeURIComponent(g.key)}`));
    } else if (key === "milestones" || key === "measurements") {
      const type = key === "milestones" ? "milestone" : "measurement";
      rows = active.flatMap((p) => liveEvents(byPlant.get(p.id) || []).filter((e) => e.type === type).map((e) => ({ p, e }))).sort((a, b) => a.e.occurredAt < b.e.occurredAt ? 1 : -1).slice(0, 5).map(({ p, e }) => secRow(
        type === "milestone" ? `${p.name} \u2013 ${e.payload.label}` : `${p.name} \u2013 ${e.payload.kind}: ${num2(e.payload.value, 2)}${e.payload.unit ? ` ${e.payload.unit}` : ""}`,
        fmtDate(e.occurredAt),
        `/plant/${p.id}`
      ));
    } else if (key === "cycles") {
      rows = active.filter((p) => p.lifecycle === "cycle").sort((a, b) => a.startDate < b.startDate ? -1 : 1).slice(0, 5).map((p) => secRow(p.name, `${S.stage[p.cache.stage] || p.cache.stage} \xB7 ${S_.dayN(dayDiff(p.startDate, nowIso2) + 1)}`, `/plant/${p.id}`));
    }
    return h(
      "section",
      { class: "profile-section", dataset: { section: key } },
      h("div", { class: "section-title" }, S_[key]),
      h("div", { class: "card task-list" }, rows.length ? rows : h("div", { class: "empty-state" }, S_.none))
    );
  }

  // js/ui-walk.js
  var cmp = (a, b) => (a || "").localeCompare(b || "", "cs");
  function walkPlants(plants) {
    return plants.filter((p) => !p.archivedAt && !isTerminal(p.cache.stage) && !isDormant(p.cache.stage)).sort((a, b) => cmp(a.location, b.location) || cmp(a.name, b.name));
  }
  async function renderWalk(root2) {
    const alive = guard();
    const { plants, byPlant } = await loadAll();
    const list = walkPlants(plants);
    if (!alive()) return void 0;
    if (!list.length) {
      put(clear(root2), h("div", { class: "top-bar" }, h("h1", {}, S.walk.title)), h("div", { class: "empty-state", id: "walk-empty" }, S.walk.empty));
      return void 0;
    }
    const opts = engineOpts();
    const nowIso2 = now();
    const state = { i: 0, written: 0, answers: /* @__PURE__ */ new Map() };
    const due = new Set(list.filter((p) => getPlantTasks(p, nowIso2, opts).some((t) => t.type === "moisture" && t.dueAt <= nowIso2)).map((p) => p.id));
    async function show() {
      if (!alive()) return;
      if (state.i >= list.length) return summary();
      const p = list[state.i];
      const done = state.answers.get(p.id);
      const url = await photoUrl(ctx.db, latestPhotoId(byPlant.get(p.id) || []));
      const info = dryingInfo(p);
      const last = p.cache.lastWateredAt;
      const cb = h("input", { type: "checkbox", id: "walk-watered", checked: true });
      let touched = false;
      cb.addEventListener("change", () => {
        touched = true;
      });
      const answerBtns = MOISTURE_ANSWERS.map((a) => h("button", {
        type: "button",
        class: `moisture-btn walk-btn ${a}${done?.answer === a ? " selected" : ""}`,
        dataset: { answer: a },
        disabled: !!done,
        onclick: () => write(p, a, touched ? cb.checked : a !== "wet")
      }, S.moisture[a]));
      cb.addEventListener("change", () => {
      });
      const card = h(
        "div",
        { class: "walk-card", id: "walk-card" },
        h("div", { class: "walk-photo" }, url ? h("img", { src: url, alt: p.name }) : icon(CAT_ICON[p.category] || "pot", "plant-photo-icon")),
        h(
          "div",
          { class: "walk-body" },
          h(
            "div",
            { class: "walk-progress" },
            S.walk.progress(state.i + 1, list.length),
            due.has(p.id) ? h("span", { class: "tag walk-due" }, S.walk.dueBadge) : null
          ),
          h("h2", { class: "walk-name" }, p.name),
          h("div", { class: "plant-sub" }, [p.variety, p.location].filter(Boolean).join(" \xB7 ") || S.category[p.category]),
          h("div", { class: "muted" }, `${S.walk.lastWatered}: ${last ? `${fmtDate(last)} (${num2(daysBetween(last, nowIso2))} d)` : S.walk.never} \xB7 ${S.walk.expected}: ${num2(info.d)} d`),
          done ? h("div", { class: "banner walk-answered", id: "walk-answered" }, `${S.walk.answered}: ${S.moisture[done.answer]}`) : null,
          h("div", { class: "moisture-row walk-row" }, answerBtns),
          done ? null : h("label", { class: "check-row" }, cb, h("span", {}, S.ui.watered))
        ),
        h(
          "div",
          { class: "walk-nav" },
          h("button", { type: "button", class: "btn btn-secondary", id: "walk-prev", disabled: state.i === 0, onclick: () => go(-1) }, S.walk.prev),
          h("button", { type: "button", class: "btn btn-secondary", id: "walk-next", onclick: () => go(1) }, done ? S.walk.next : S.walk.skip)
        ),
        h("p", { class: "muted walk-hint" }, S.walk.swipe)
      );
      let x0 = null, y0 = null;
      card.addEventListener("touchstart", (e) => {
        x0 = e.changedTouches[0].clientX;
        y0 = e.changedTouches[0].clientY;
      }, { passive: true });
      card.addEventListener("touchend", (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }, { passive: true });
      put(clear(root2), h(
        "div",
        { class: "top-bar" },
        h("h1", {}, S.walk.title),
        h("button", { type: "button", class: "btn btn-ghost", id: "walk-exit", "aria-label": S.ui.back, onclick: () => navigate("/") }, icon("close"))
      ), card);
    }
    function go(dir) {
      state.i = Math.max(0, state.i + dir);
      show();
    }
    async function write(p, answer, watered) {
      try {
        const { events } = await appendEvents(ctx.db, p.id, [{ type: "moisture_check", payload: { answer, watered } }]);
        state.answers.set(p.id, { answer, eventId: events[0].id });
        state.written += 1;
        toast(`${p.name}: ${S.moisture[answer]}${watered ? " \xB7 zalito" : ""}`, {
          action: S.ui.undo,
          onAction: async () => {
            await voidEvent(ctx.db, p.id, events[0].id);
            state.answers.delete(p.id);
            state.written -= 1;
            show();
          }
        });
        state.i += 1;
        show();
      } catch (e) {
        toast(e.message || S.err.invalid);
      }
    }
    function summary() {
      put(
        clear(root2),
        h("div", { class: "top-bar" }, h("h1", {}, S.walk.doneTitle)),
        h(
          "div",
          { class: "card pad", id: "walk-summary" },
          h("p", {}, S.walk.summary(state.written, list.length - state.answers.size)),
          h(
            "div",
            { class: "form-actions" },
            h("button", { type: "button", class: "btn btn-secondary", id: "walk-back", onclick: () => {
              state.i = list.length - 1;
              show();
            } }, S.walk.prev),
            h("button", { type: "button", class: "btn btn-primary", id: "walk-home", onclick: () => navigate("/") }, S.walk.backHome)
          )
        )
      );
    }
    await show();
    return void 0;
  }

  // js/ui-install.js
  var steps = (list) => h("ol", { class: "install-steps" }, list.map((t) => h("li", {}, t)));
  async function renderInstall(root2) {
    const { ios } = platform();
    const build = () => {
      const btn = h("button", {
        type: "button",
        class: "btn btn-primary",
        id: "btn-install",
        disabled: !canPromptInstall(),
        onclick: async () => {
          await promptInstall();
          build();
        }
      }, S.install.btn);
      put(
        clear(root2),
        h(
          "div",
          { class: "top-bar" },
          h("button", { type: "button", class: "btn btn-ghost", "aria-label": S.ui.back, onclick: () => navigate("/settings") }, icon("back")),
          h("h1", {}, S.install.title)
        ),
        h("p", { class: "muted" }, S.install.intro),
        isStandalone() ? h("div", { class: "banner", id: "install-done" }, S.install.done) : null,
        h("div", { class: "card pad", id: "install-ios" }, h("h3", {}, S.install.iosTitle), steps(S.install.ios)),
        h(
          "div",
          { class: "card pad", id: "install-chrome" },
          h("h3", {}, S.install.chromeTitle),
          steps(S.install.chrome),
          ios ? null : btn,
          !ios && !canPromptInstall() ? h("p", { class: "muted" }, S.install.unavailable) : null
        )
      );
    };
    build();
    onInstallChange(build);
  }

  // js/ui-plant-form.js
  function askHemisphere() {
    return hemisphereKnown().then((known) => {
      if (known) return null;
      return new Promise((resolve) => {
        const pick = async (v) => {
          await setHemisphere(v);
          closeSheet();
          resolve(v);
        };
        openSheet(
          S.ui.hemisphere,
          h(
            "div",
            { class: "stack" },
            h("p", { class: "muted" }, "Ro\u010Dn\xED obdob\xED ovliv\u0148uje z\xE1livku venku. Kde p\u011Bstuje\u0161?"),
            h("button", { type: "button", class: "btn btn-primary", dataset: { hemi: "north" }, onclick: () => pick("north") }, S.ui.north),
            h("button", { type: "button", class: "btn btn-secondary", dataset: { hemi: "south" }, onclick: () => pick("south") }, S.ui.south)
          ),
          { onClose: () => resolve(null) }
        );
      });
    });
  }
  var datalist = (id, values) => h("datalist", { id }, values.map((v) => h("option", { value: v })));
  var dateOnly = (iso) => toLocalInput(iso).slice(0, 10);
  var toIso = (d) => !d || d === dateOnly(now()) ? now() : (/* @__PURE__ */ new Date(`${d}T12:00:00`)).toISOString();
  async function renderPlantForm(root2, id, query = {}) {
    const alive = guard();
    const { plants } = await loadAll();
    const editing = id ? plants.find((p) => p.id === id) : null;
    if (id && !editing) return navigate("/");
    const pre = editing ? {} : PROFILES[ctx.profile]?.preselect || {};
    const source = editing || (query.clone ? plants.find((p) => p.id === query.clone) : null);
    const init = editing ? {
      name: editing.name,
      variety: editing.variety,
      category: editing.category,
      lifecycle: editing.lifecycle,
      environment: editing.cache.environment,
      harvestable: editing.harvestable,
      location: editing.location,
      source: editing.source,
      baseOverride: editing.baseOverride
    } : source ? clonePlantInput(source, plants.map((p) => p.name)) : { category: null, environment: pre.environment ?? null, lifecycle: pre.lifecycle, harvestable: pre.harvestable, source: "seed" };
    const [exName, exVariety] = example(ctx.profile, plants.length);
    const st = { category: init.category, lifecycle: init.lifecycle, environment: init.environment, source: init.source || "seed" };
    const name = h("input", { type: "text", id: "f-name", value: init.name || "", placeholder: `nap\u0159. ${exName}` });
    const variety = h("input", { type: "text", id: "f-variety", value: init.variety || "", list: "dl-variety", placeholder: `nap\u0159. ${exVariety}` });
    const location2 = h("input", { type: "text", id: "f-location", value: init.location || "", list: "dl-location", placeholder: "nap\u0159. balkon" });
    const cat = chipGroup(Object.entries(S.category), st.category, (v) => {
      if (editing) return;
      setCategory(v);
    });
    cat.el.id = "f-category";
    const life = chipGroup(Object.entries(S.lifecycle), st.lifecycle, (v) => {
      if (editing) return;
      st.lifecycle = v;
      fillStages();
    });
    const env = chipGroup(Object.entries(S.environment), st.environment, (v) => {
      st.environment = v;
    });
    env.el.id = "f-environment";
    const src = chipGroup(SOURCES.map((s) => [s, S.source[s]]), st.source, (v) => {
      st.source = v;
    });
    const harv = h("input", { type: "checkbox", id: "f-harvestable", checked: init.harvestable ?? true, disabled: !!editing });
    const stage = h("select", { id: "f-stage", disabled: !!editing });
    const start = h("input", { type: "date", id: "f-start", value: dateOnly(now()) });
    const photo = h("input", { type: "file", id: "f-photo", accept: "image/*", capture: "environment" });
    const note = h("textarea", { id: "f-note", rows: 2 });
    const base = h("input", {
      type: "number",
      id: "f-base",
      step: "any",
      min: "0.5",
      inputmode: "decimal",
      value: init.baseOverride ?? "",
      placeholder: "ponech pr\xE1zdn\xE9 = automaticky"
    });
    function fillStages() {
      if (!st.category) {
        stage.replaceChildren();
        return;
      }
      const list = getStages(st.category, st.lifecycle);
      stage.replaceChildren(...list.map((s) => h("option", { value: s }, S.stage[s])));
    }
    function setCategory(v) {
      st.category = v;
      cat.set(v);
      st.lifecycle = pre.lifecycle === "perennial" ? "perennial" : CATEGORIES[v].lifecycle;
      life.set(st.lifecycle);
      harv.checked = pre.harvestable ?? CATEGORIES[v].harvestable;
      fillStages();
    }
    if (st.category) {
      if (!st.lifecycle) st.lifecycle = CATEGORIES[st.category].lifecycle;
      life.set(st.lifecycle);
    }
    fillStages();
    const errBox = h("div", { class: "form-error", id: "form-error", role: "alert" });
    const save = async () => {
      errBox.textContent = "";
      try {
        if (editing) {
          await updatePlantMeta(ctx.db, id, {
            name: name.value,
            variety: variety.value,
            location: location2.value,
            source: st.source,
            baseOverride: base.value === "" ? null : Number(base.value)
          });
          if (st.environment && st.environment !== editing.cache.environment) {
            if (SEASONAL_ENVIRONMENTS.includes(st.environment)) await askHemisphere();
            await appendEvents(ctx.db, id, [{ type: "environment_change", payload: { environment: st.environment } }]);
          }
          toast("Ulo\u017Eeno");
          return navigate(`/plant/${id}`);
        }
        if (!name.value.trim()) throw new Error(S.err.name);
        if (!st.category) throw new Error(S.err.category);
        if (!st.environment) throw new Error(S.err.environment);
        if (SEASONAL_ENVIRONMENTS.includes(st.environment)) await askHemisphere();
        const plant = await createPlant(ctx.db, {
          name: name.value,
          variety: variety.value,
          category: st.category,
          lifecycle: st.lifecycle,
          environment: st.environment,
          harvestable: harv.checked,
          stage: stage.value,
          location: location2.value,
          source: st.source,
          startDate: toIso(start.value),
          baseOverride: base.value === "" ? null : Number(base.value),
          learnedBase: init.learnedBase || null
        });
        const extra = [];
        if (photo.files[0]) {
          const photoId = await savePhotoFile(ctx.db, plant.id, photo.files[0]);
          extra.push({ type: "photo", payload: { photoId } });
        }
        if (note.value.trim()) extra.push({ type: "note", payload: { text: note.value } });
        if (extra.length) await appendEvents(ctx.db, plant.id, extra);
        requestPersistence(ctx.db);
        return navigate(`/plant/${plant.id}`);
      } catch (e) {
        errBox.textContent = e.message || S.err.invalid;
        return void 0;
      }
    };
    const remove = () => {
      const typed = h("input", { type: "text", id: "f-confirm", placeholder: editing.name });
      openSheet(S.ui.delete, h(
        "div",
        {},
        h("p", { class: "muted" }, `${S.err.confirmName} Sma\u017Ee se rostlina, jej\xED z\xE1znamy i fotky.`),
        field(S.ui.name, typed),
        h(
          "div",
          { class: "form-actions" },
          h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel),
          h("button", { type: "button", class: "btn btn-danger", id: "btn-confirm-delete", onclick: async () => {
            try {
              await deletePlantPermanently(ctx.db, id, typed.value);
              closeSheet();
              toast("Smaz\xE1no");
              navigate("/");
            } catch (e) {
              toast(e.message);
            }
          } }, S.ui.delete)
        )
      ));
    };
    if (!alive()) return void 0;
    put(
      clear(root2),
      h(
        "div",
        { class: "top-bar" },
        h("button", { type: "button", class: "btn btn-ghost", "aria-label": S.ui.back, onclick: () => navigate(editing ? `/plant/${id}` : "/") }, icon("back")),
        h("h1", {}, editing ? S.ui.edit : query.clone ? S.ui.clone : S.ui.newPlant),
        h("span")
      ),
      h(
        "form",
        { class: "plant-form", onsubmit: (e) => {
          e.preventDefault();
          save();
        } },
        field(`${S.ui.name} *`, name),
        field(S.ui.variety, variety),
        field(`${S.ui.category} *`, cat.el, editing ? "Kategorii nelze m\u011Bnit." : null),
        field(S.ui.lifecycle, life.el),
        field(`${S.ui.environment} *`, env.el),
        h("label", { class: "check-row" }, harv, h("span", {}, S.ui.harvestable)),
        editing ? null : field(S.ui.stageLabel, stage),
        field(S.ui.location, location2),
        field(S.ui.sourceLabel, src.el),
        editing ? null : field(S.ui.startDate, start),
        field(S.ui.baseOverride, base),
        editing ? null : field(S.ui.photo, photo),
        editing ? null : field(S.ui.note, note),
        datalist("dl-variety", [...new Set(plants.map((p) => p.variety).filter(Boolean))]),
        datalist("dl-location", [...new Set(plants.map((p) => p.location).filter(Boolean))]),
        errBox,
        h(
          "div",
          { class: "form-actions" },
          h("button", { type: "button", class: "btn btn-secondary", onclick: () => navigate(editing ? `/plant/${id}` : "/") }, S.ui.cancel),
          h("button", { type: "submit", class: "btn btn-primary", id: "btn-save" }, S.ui.save)
        ),
        editing ? h("button", { type: "button", class: "btn btn-danger delete-plant", id: "btn-delete", onclick: remove }, icon("trash"), S.ui.delete) : null
      )
    );
    return void 0;
  }

  // js/ui-plant.js
  var tab = "diary";
  var tabPlant = null;
  var DOT2 = { overdue: "expired", today: "missing", upcoming: "needs_check" };
  async function renderPlant(root2, id) {
    const alive = guard();
    const plant = await getPlant(ctx.db, id);
    if (!plant) return navigate("/");
    const events = await getEvents(ctx.db, id);
    const refresh = () => renderPlant(root2, id);
    const nowIso2 = now();
    const url = await photoUrl(ctx.db, latestPhotoId(events));
    const stages = getStages(plant.category, plant.lifecycle);
    const info = dryingInfo(plant);
    const tasks = getPlantTasks(plant, nowIso2, engineOpts()).sort((a, b) => a.dueAt < b.dueAt ? -1 : 1);
    const locked = !!plant.archivedAt;
    const stageSel = h("select", {
      id: "stage-select",
      disabled: locked,
      onchange: async (e) => {
        const to = e.target.value;
        if (to === plant.cache.stage) return;
        await submit(id, [{ type: "stage_change", payload: { from: plant.cache.stage, to } }], `F\xE1ze: ${S.stage[to]}`, refresh);
      }
    }, stages.map((s) => h("option", { value: s, selected: s === plant.cache.stage }, S.stage[s])));
    const act = (key, ic, label, fn) => h(
      "button",
      { type: "button", class: "action-btn", dataset: { act: key }, onclick: fn },
      icon(ic),
      h("span", {}, label)
    );
    const actionList = [
      act("water", "drop", S.ui.wateredNow, () => quickWatered(plant, refresh)),
      act("moisture", "drop", S.ui.moistureCheck, () => moistureSheet(plant, refresh)),
      act("fertilize", "leaf", S.ui.fertilize, () => fertilizeSheet(plant, refresh)),
      act("pest", "bug", S.ui.pestCheck, () => pestCheckSheet(plant, refresh)),
      act("problem", "status-critical", S.ui.problem, () => problemSheet(plant, refresh)),
      act("note", "note", S.ui.addNote, () => noteSheet(plant, refresh)),
      act("photo", "camera", S.ui.addPhoto, () => photoSheet(plant, refresh)),
      act("measure", "thermo", S.ui.measurement, () => measurementSheet(plant, refresh)),
      act("milestone", "flag", S.ui.milestone, () => milestoneSheet(plant, refresh)),
      plant.harvestable ? act("harvest", "leaf", S.ui.harvest, () => harvestSheet(plant, refresh)) : null,
      act("env", "swap", S.ui.changeEnv, async () => {
        await askHemisphere();
        environmentSheet(plant, refresh);
      })
    ].filter(Boolean);
    if (PROFILES[ctx.profile]?.preselect.measurementsFirst) actionList.sort((a, b) => (b.dataset.act === "measure") - (a.dataset.act === "measure"));
    const actions = locked ? null : h("div", { class: "action-grid" }, actionList);
    const taskRows = tasks.map((t) => h(
      "div",
      { class: "item-row task-row", dataset: { task: t.type } },
      h("span", { class: `badge-dot ${DOT2[t.urgency]}` }),
      h(
        "div",
        { class: "item-info" },
        h("div", { class: "item-name" }, S.taskLabel[t.type]),
        h("div", { class: "item-detail" }, h("span", { class: "item-sub" }, relDay(t.dueAt, nowIso2)))
      ),
      h(
        "div",
        { class: "item-actions qty-stepper" },
        h("button", { type: "button", class: "btn-quick", "aria-label": S.ui.done, onclick: () => runTask(t, plant, refresh) }, icon("check")),
        h("button", { type: "button", class: "qty-btn", "aria-label": S.ui.snooze, onclick: () => snoozeSheet(t, refresh) }, icon("clock"))
      )
    ));
    const live = liveEvents(events);
    const canEval = plant.harvestable || plant.lifecycle === "perennial";
    const tabs = [
      ["diary", S.ui.timeline],
      plant.harvestable ? ["harvests", S.ui.harvests] : ["milestones", S.ui.milestones],
      canEval ? ["evaluation", S.ui.evaluation] : null,
      ["care", S.ui.careTab]
    ].filter(Boolean);
    if (tabPlant !== id || !tabs.some(([k]) => k === tab)) {
      tab = "diary";
      tabPlant = id;
    }
    const panel = h("div", { id: "tab-panel" });
    const showTab = async () => {
      put(panel.replaceChildren() ?? panel, await buildPanel());
    };
    async function buildPanel() {
      if (tab === "harvests") return harvestsPanel();
      if (tab === "milestones") return milestonesPanel();
      if (tab === "evaluation") return evaluationPanel();
      if (tab === "care") return carePanel();
      return diaryPanel();
    }
    async function diaryPanel() {
      const rows = diaryRows(events);
      const items = await Promise.all(rows.map(async (r) => {
        const src = r.photoId ? await photoUrl(ctx.db, r.photoId) : null;
        const canVoid = !locked || ["note", "photo", "evaluation"].includes(r.event.type);
        return h(
          "div",
          { class: "timeline-row", dataset: { event: r.event.type } },
          h("div", { class: "timeline-icon" }, icon(r.icon)),
          h(
            "div",
            { class: "timeline-body" },
            h("div", { class: "timeline-title" }, r.title),
            r.detail ? h("div", { class: "timeline-detail" }, r.detail) : null,
            src ? h("img", { class: "timeline-photo", src, alt: r.detail || "Fotka" }) : null,
            h("div", { class: "timeline-date" }, fmtDateTime(r.event.occurredAt))
          ),
          r.event.type === "created" || !canVoid ? null : h("button", {
            type: "button",
            class: "btn btn-ghost btn-sm",
            "aria-label": S.ui.voidIt,
            title: S.ui.voidIt,
            onclick: async () => {
              try {
                await voidEvent(ctx.db, id, r.event.id);
                toast("Z\xE1znam zru\u0161en");
                refresh();
              } catch (e) {
                toast(e.message);
              }
            }
          }, icon("trash"))
        );
      }));
      return h("div", { class: "card timeline" }, items);
    }
    function harvestsPanel() {
      const cfg = CATEGORIES[plant.category];
      const hv = live.filter((e) => e.type === "harvest").reverse();
      const totals = harvestTotals(plant, events);
      const line = (p) => cfg.harvestFields.filter((f) => Number.isFinite(p[f.key])).map((f) => `${S.harvestField[f.key]}: ${num2(p[f.key], 2)}`).join(" \xB7 ");
      return h(
        "div",
        {},
        locked ? null : h("button", { type: "button", class: "btn btn-primary panel-btn", id: "btn-harvest", onclick: () => harvestSheet(plant, refresh) }, icon("plus"), S.ui.recordHarvest),
        hv.length ? h("div", { class: "card timeline" }, hv.map((e) => h(
          "div",
          { class: "timeline-row", dataset: { event: "harvest" } },
          h("div", { class: "timeline-icon" }, icon("leaf")),
          h(
            "div",
            { class: "timeline-body" },
            h("div", { class: "timeline-title" }, fmtDate(e.occurredAt)),
            h("div", { class: "timeline-detail" }, line(e.payload)),
            e.payload.processingMethod ? h("div", { class: "timeline-detail" }, `${S.processing[e.payload.processingMethod]}${e.payload.processingDays != null ? ` \xB7 ${e.payload.processingDays} ${S.ui.days}` : ""}`) : null,
            e.payload.note ? h("div", { class: "timeline-detail" }, e.payload.note) : null
          )
        ))) : h("div", { class: "empty-state" }, S.ui.noHarvests),
        hv.length ? h("div", { class: "card pad", id: "harvest-total" }, h("strong", {}, `${S.ui.total}: `), line(totals)) : null
      );
    }
    function milestonesPanel() {
      const ms = live.filter((e) => e.type === "milestone").reverse();
      return h(
        "div",
        {},
        ms.length ? h("div", { class: "card timeline" }, ms.map((e) => h(
          "div",
          { class: "timeline-row" },
          h("div", { class: "timeline-icon" }, icon("flag")),
          h(
            "div",
            { class: "timeline-body" },
            h("div", { class: "timeline-title" }, e.payload.label),
            h("div", { class: "timeline-date" }, fmtDate(e.occurredAt))
          )
        ))) : h("div", { class: "empty-state" }, S.ui.noMilestones),
        locked ? null : h("button", { type: "button", class: "btn btn-secondary panel-btn", onclick: () => milestoneSheet(plant, refresh) }, icon("flag"), S.ui.milestone)
      );
    }
    function evaluationPanel() {
      const hist = evaluationHistory(events);
      const cur = hist[0];
      const criteria = ["overall", ...cfgCriteria()];
      return h(
        "div",
        {},
        cur ? h(
          "div",
          { class: "card pad", id: "eval-current" },
          h("div", { class: "eval-head" }, h("strong", {}, S.ui.current), cur.season ? h("span", { class: "tag" }, `${S.ui.seasonWord} ${cur.season}`) : null),
          criteria.filter((k) => cur.event.payload.scores[k]).map((k) => h(
            "div",
            { class: "eval-line" },
            h("span", {}, S.criterion[k]),
            h("span", { class: "stars" }, starsText(cur.event.payload.scores[k]))
          )),
          cur.event.payload.wouldGrowAgain != null ? h("div", { class: "eval-line" }, h("span", {}, S.ui.wouldGrowAgain), h("strong", {}, cur.event.payload.wouldGrowAgain ? S.ui.yes : S.ui.no)) : null,
          cur.note ? h("div", { class: "muted" }, `\u201E${cur.note}\u201C`) : null
        ) : h("div", { class: "empty-state" }, S.ui.noEval),
        h(
          "button",
          { type: "button", class: "btn btn-primary panel-btn", id: "btn-evaluate", onclick: () => evaluationSheet(plant, refresh) },
          icon("check"),
          cur ? S.ui.updateEval : S.ui.evaluate
        ),
        hist.length > 1 ? h("div", { class: "section-title flush" }, S.ui.history) : null,
        hist.length > 1 ? h("div", { class: "card timeline", id: "eval-history" }, hist.map((r) => h(
          "div",
          { class: "timeline-row muted-row" },
          h(
            "div",
            { class: "timeline-body" },
            h("div", { class: "timeline-title" }, h("span", { class: "stars" }, starsText(r.overall)), r.season ? ` \xB7 ${r.season}` : ""),
            r.note ? h("div", { class: "timeline-detail" }, r.note) : null,
            h("div", { class: "timeline-date" }, `${fmtDate(r.at)}${r.daysAfterHarvest != null ? ` \xB7 ${r.daysAfterHarvest} ${S.ui.daysAfter}` : ""}`)
          )
        ))) : null
      );
    }
    function cfgCriteria() {
      return CATEGORIES[plant.category].criteria;
    }
    function carePanel() {
      return h(
        "div",
        {},
        h(
          "div",
          { class: "card drying-info", id: "drying-info" },
          h("div", {}, `${S.ui.base}: `, h("strong", {}, `${num2(info.base)} ${S.ui.days}`)),
          h("div", {}, `${S.ui.learned}: `, h("strong", {}, info.learned == null ? "\u2014" : `${num2(info.learned)} ${S.ui.days}`)),
          h("div", {}, `${S.ui.confidence}: `, h("strong", {}, `${Math.round((info.confidence || 0) * 100)} %`)),
          plant.baseOverride ? h("div", {}, `${S.ui.baseOverride}: `, h("strong", {}, num2(plant.baseOverride))) : null
        ),
        tasks.length ? h("div", { class: "card task-list" }, taskRows) : h("div", { class: "empty-state" }, S.ui.noTasks)
      );
    }
    const tabBar = h("div", { class: "tab-bar", role: "tablist" }, tabs.map(([k, label]) => h("button", {
      type: "button",
      class: "tab-btn" + (k === tab ? " active" : ""),
      dataset: { tab: k },
      role: "tab",
      onclick: async (e) => {
        tab = k;
        tabBar.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === e.currentTarget));
        await showTab();
      }
    }, label)));
    await showTab();
    const bottom = locked ? h("button", { type: "button", class: "btn btn-secondary panel-btn", id: "btn-unarchive", onclick: async () => {
      try {
        await appendEvents(ctx.db, id, [{ type: "unarchive", payload: {} }]);
        toast("Obnoveno");
        refresh();
      } catch (e) {
        toast(e.message);
      }
    } }, S.ui.unarchive) : h("button", { type: "button", class: "btn btn-secondary panel-btn", id: "btn-archive", onclick: () => archiveSheet(plant, () => navigate("/")) }, icon("pot"), S.ui.archive);
    if (!alive()) return void 0;
    put(
      clear(root2),
      h(
        "div",
        { class: "top-bar" },
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-back", "aria-label": S.ui.back, onclick: () => navigate("/") }, icon("back")),
        h(
          "div",
          { class: "top-actions" },
          h("button", {
            type: "button",
            class: "btn btn-ghost",
            "aria-label": S.ui.clone,
            title: S.ui.clone,
            id: "btn-clone",
            onclick: () => navigate(`/new?clone=${id}`)
          }, icon("sprout")),
          h("button", {
            type: "button",
            class: "btn btn-ghost",
            "aria-label": S.ui.edit,
            id: "btn-edit",
            onclick: () => navigate(`/plant/${id}/edit`)
          }, icon("edit"))
        )
      ),
      h(
        "div",
        { class: "plant-hero" },
        url ? h("img", { src: url, alt: plant.name }) : icon(CAT_ICON[plant.category] || "pot", "plant-photo-icon")
      ),
      h("h2", { class: "plant-title" }, plant.name),
      h(
        "div",
        { class: "plant-tags" },
        plant.variety ? h("span", { class: "tag" }, plant.variety) : null,
        h("span", { class: "tag" }, S.category[plant.category]),
        h("span", { class: "tag" }, S.environment[plant.cache.environment]),
        plant.location ? h("span", { class: "tag" }, plant.location) : null,
        locked ? h("span", { class: "tag" }, S.ui.archived) : null
      ),
      h("div", { class: "field" }, h("label", {}, S.ui.stageLabel), stageSel),
      plant.cache.openProblems.length ? h(
        "div",
        { class: "problem-banner" },
        icon("status-critical"),
        plant.cache.openProblems.map((p) => S.problem[p.problemType]).join(", ")
      ) : null,
      actions,
      tabBar,
      panel,
      bottom
    );
    return void 0;
  }

  // js/ui-stats.js
  var unitOf = (category) => {
    const key = CATEGORIES[category].harvestFields[0].key;
    return (S.harvestField[key].match(/\(([^)]+)\)/) || [])[1] || "";
  };
  var pct = (v) => v == null ? "\u2014" : `${Math.round(v * 100)} %`;
  var rating = (v) => v == null ? "\u2014" : h("span", { class: "stars" }, starsText(v), ` ${num2(v)}`);
  var kv = (label, value) => h("div", { class: "kv" }, h("span", {}, label), h("strong", {}, value));
  function varietyCard(g) {
    const unit = unitOf(g.category);
    return h(
      "button",
      {
        type: "button",
        class: "card variety-card",
        dataset: { variety: g.key, category: g.category },
        onclick: () => navigate(`/variety/${g.category}/${encodeURIComponent(g.key)}`)
      },
      h(
        "div",
        { class: "variety-head" },
        h(
          "div",
          {},
          h("div", { class: "plant-name" }, g.label),
          h("div", { class: "plant-sub" }, `${S.category[g.category]}${g.unnamed ? ` \xB7 ${S.ui.unnamed}` : ""}`)
        ),
        h("span", { class: "tag" }, `${g.plantCount} ${plantsWord(g.plantCount)}`)
      ),
      h(
        "div",
        { class: "variety-grid" },
        kv(S.ui.avgRating, rating(g.avgOverall)),
        kv(S.ui.growAgainShare, pct(g.wouldGrowAgainShare)),
        kv(S.ui.yieldTotal, g.totalYield ? `${num2(g.totalYield, 2)} ${unit}` : "\u2014"),
        kv(S.ui.avgCycle, g.avgCycleDays == null ? "\u2014" : `${Math.round(g.avgCycleDays)} ${S.ui.days}`)
      )
    );
  }
  async function plantCard2(plant, byPlant, onclick) {
    const evs = byPlant.get(plant.id) || [];
    const url = await photoUrl(ctx.db, latestPhotoId(evs));
    const sum = plantSummary(plant, evs);
    return h(
      "button",
      { type: "button", class: "plant-card", dataset: { plant: plant.id }, onclick },
      h("div", { class: "plant-photo" }, url ? h("img", { src: url, alt: plant.name }) : icon(CAT_ICON[plant.category] || "pot", "plant-photo-icon")),
      h(
        "div",
        { class: "plant-card-body" },
        h("div", { class: "plant-name" }, plant.name),
        h("div", { class: "plant-sub" }, `${S.category[plant.category]} \xB7 ${fmtDate(plant.startDate)}`),
        sum.overall != null ? h("div", { class: "stars" }, starsText(sum.overall)) : null
      )
    );
  }
  async function renderVarieties(root2) {
    const alive = guard();
    const { plants, byPlant } = await loadAll();
    const groups = aggregateVarieties(plants, byPlant);
    const nums = overviewNumbers(plants, byPlant);
    const archived = plants.filter((p) => p.archivedAt);
    const cards = await Promise.all(archived.map((p) => plantCard2(p, byPlant, () => navigate(`/plant/${p.id}`))));
    if (!alive()) return void 0;
    put(
      clear(root2),
      h("div", { class: "top-bar" }, h("h1", {}, S.ui.varietiesTitle)),
      h(
        "div",
        { class: "summary-grid" },
        tile2(nums.plants, "Rostliny"),
        tile2(nums.harvests, "Sklizn\u011B"),
        tile2(nums.evaluated, "Hodnoceno"),
        tile2(nums.archived, "Archiv")
      ),
      groups.length ? h("div", { class: "variety-list" }, groups.map(varietyCard)) : h("div", { class: "empty-state" }, S.ui.noVarieties),
      h("div", { class: "section-title" }, `${S.ui.archiveTitle} (${archived.length})`),
      archived.length ? h("div", { class: "plant-grid", id: "archive-grid" }, cards) : h("div", { class: "empty-state" }, S.ui.noPlants)
    );
  }
  var tile2 = (n, label) => h("div", { class: "summary-tile" }, h("div", { class: "num" }, n), h("div", { class: "lbl" }, label));
  async function renderVariety(root2, category, key) {
    const alive = guard();
    const { plants, byPlant } = await loadAll();
    const g = aggregateVarieties(plants, byPlant).find((x) => x.category === category && x.key === key);
    if (!g) return navigate("/varieties");
    const unit = unitOf(category);
    const rows = g.items.map(({ plant, summary: s }) => h(
      "button",
      {
        type: "button",
        class: "card variety-plant",
        dataset: { plant: plant.id },
        onclick: () => navigate(`/plant/${plant.id}`)
      },
      h(
        "div",
        { class: "variety-head" },
        h(
          "div",
          {},
          h("div", { class: "plant-name" }, plant.name),
          h("div", { class: "plant-sub" }, `${fmtDate(plant.startDate)}${plant.archivedAt ? ` \xB7 ${S.ui.archived}` : ""}`)
        ),
        s.overall != null ? h("span", { class: "stars" }, starsText(s.overall)) : h("span", { class: "muted" }, "\u2014")
      ),
      h(
        "div",
        { class: "variety-grid" },
        kv(S.ui.harvests, s.harvestCount),
        kv(S.ui.yieldTotal, s.yield ? `${num2(s.yield, 2)} ${unit}` : "\u2014"),
        kv(S.ui.avgCycle, s.cycleDays == null ? "\u2014" : `${s.cycleDays} ${S.ui.days}`),
        kv(S.ui.growAgainShare, s.wouldGrowAgain == null ? "\u2014" : s.wouldGrowAgain ? S.ui.yes : S.ui.no)
      )
    ));
    if (!alive()) return void 0;
    put(
      clear(root2),
      h(
        "div",
        { class: "top-bar" },
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-back", "aria-label": S.ui.back, onclick: () => navigate("/varieties") }, icon("back")),
        h("h1", {}, g.label),
        h("span")
      ),
      h("div", { class: "plant-tags pad-x" }, h("span", { class: "tag" }, S.category[category]), g.unnamed ? h("span", { class: "tag" }, S.ui.unnamed) : null),
      varietyCard(g),
      h("div", { class: "section-title" }, S.ui.plantsOfVariety),
      h("div", { class: "variety-list", id: "variety-plants" }, rows),
      h("div", { class: "card pad" }, kv(S.ui.cycles, g.cycles), kv(S.ui.problemsPer, num2(g.problemsPerPlant)))
    );
  }

  // js/main.js
  var NAV = [
    ["/", "overview", S.nav.overview, "overview"],
    ["/walk", "checklist", S.nav.walk, "walk"],
    ["/varieties", "leaf", S.nav.varieties, "varieties"],
    ["/settings", "settings", S.nav.settings, "settings"]
  ];
  async function boot() {
    setTheme(getTheme());
    injectSprite();
    document.getElementById("app-name").textContent = S.appName;
    document.getElementById("app-sub").textContent = S.subtitle;
    document.getElementById("version").textContent = VERSION;
    document.getElementById("bottom-nav").append(...NAV.map(([path, ic, label, key]) => h("button", { type: "button", dataset: { nav: key }, onclick: () => navigate(path) }, icon(ic, "nav-icon"), label)));
    const db = await openDb();
    await initCtx(db);
    initPwa();
    ctx.profile = await applyAcquisition(db, location.search);
    if (location.search && stripAcquisition(location.search) !== location.search) {
      history.replaceState(null, "", `${location.pathname}${stripAcquisition(location.search)}${location.hash}`);
    }
    setGate(async (path) => {
      ctx.profile = await getProfile(db);
      if (!ctx.profile && path !== "/onboarding") return "/onboarding";
      if (ctx.profile && path === "/onboarding") return "/";
      return null;
    });
    if (await metaGet(db, "schemaVersion") == null) await metaSet(db, "schemaVersion", 1);
    if ((await listPlants(db)).length) await requestPersistence(db);
    route("/", renderDashboard, "overview");
    route("/new", (r, _p, q) => renderPlantForm(r, null, q), "overview");
    route("/plant/:id", (r, p) => renderPlant(r, p.id), "overview");
    route("/plant/:id/edit", (r, p) => renderPlantForm(r, p.id), "overview");
    route("/walk", renderWalk, "walk");
    route("/onboarding", renderOnboarding, "overview");
    route("/varieties", renderVarieties, "varieties");
    route("/variety/:category/:key", (r, p) => renderVariety(r, p.category, p.key), "varieties");
    route("/settings", renderSettings, "settings");
    route("/install", renderInstall, "settings");
    await startRouter(document.getElementById("view"));
    window.pheno = { db, ...events_exports, ...model_exports };
  }
  boot().catch((e) => {
    document.getElementById("view").textContent = `Chyba: ${e.message}`;
    console.error(e);
  });
})();
