(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/config-categories.js
  var CYCLE_STAGES = {
    herb: ["seedling", "vegetative", "flowering", "harvested", "done"],
    vegetable: ["seedling", "vegetative", "flowering", "fruiting", "harvested", "done"],
    fruit: ["planted", "growing", "flowering", "fruiting", "harvested", "done"],
    tree_shrub: ["planted", "growing", "flowering", "fruiting", "harvested", "done"],
    flower: ["seedling", "vegetative", "budding", "flowering", "done"],
    houseplant: ["growing", "done"],
    other: ["growing", "harvested", "done"]
  };
  var PERENNIAL_STAGES = ["planted", "growing", "flowering", "fruiting", "dormant"];
  var STAGE_FLAGS = { done: { terminal: true }, harvested: { postHarvest: true }, dormant: { dormant: true } };
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
    houseplant: {
      lifecycle: "perennial",
      harvestable: false,
      fertilizingDays: 30,
      pestCheckDays: 14,
      baseDryingDays: 7,
      harvestFields: [],
      criteria: ["growth", "health", "appearance"]
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
  var PROCESSING_METHODS = ["drying", "curing", "fermenting", "pickling", "freezing", "storing", "none", "other"];
  var PROCESSING_PHASES = ["drying", "curing", "fermenting", "pickling", "freezing", "storing", "other"];
  var BATCH_PHASES = [...PROCESSING_PHASES, "ready", "used", "discarded"];
  var BATCH_ENDED = ["used", "discarded"];
  var FRESH_CATEGORIES = ["vegetable", "fruit", "tree_shrub"];
  var DRYNESS_MAX = 5;
  var CARE_KINDS = ["pruning", "repotting", "misting", "rotation", "cleaning", "custom"];
  var EVAL_KINDS = ["tasting", "final"];
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
  var FOLLOWUP_DAYS = 3;

  // js/config-rules.js
  var num2 = (key, group, def, min, max, unit, step = 1) => ({ key, group, kind: "num", def, min, max, unit, step });
  var bool = (key, group, def) => ({ key, group, kind: "bool", def });
  var choice = (key, group, def, options) => ({ key, group, kind: "choice", def, options });
  var AFTER_FINAL_HARVEST = ["ask", "auto", "manual"];
  var SUBSTRATES = ["soil", "coco", "hydro"];
  var SEASON_NAMES = ["spring", "summer", "autumn", "winter"];
  var SEASON_DEFAULTS = { spring: 1, summer: 0.85, autumn: 1, winter: 1.3 };
  var SEASON_ON = { outdoor: true, greenhouse: true, indoor: false, controlled: false };
  var categoryDefs = Object.entries(CATEGORIES).flatMap(([c, cfg]) => [
    num2(`cat.${c}.soilDays`, "category", cfg.baseDryingDays, 0.5, 60, "dn\xED", 0.5),
    num2(`cat.${c}.fertilizingDays`, "category", cfg.fertilizingDays, 1, 180, "dn\xED"),
    num2(`cat.${c}.pestCheckDays`, "category", cfg.pestCheckDays, 1, 90, "dn\xED")
  ]);
  var RULE_DEFS = [
    ...categoryDefs,
    num2("fertilizing.firstFeedDays", "fertilizing", 14, 0, 90, "dn\xED"),
    num2("fertilizing.fruitingFactor", "fertilizing", 0.8, 0.3, 1.5, "\xD7", 0.05),
    num2("fertilizing.stopBeforeHarvestDays", "fertilizing", 0, 0, 60, "dn\xED"),
    num2("batch.drying.minDays", "batch", 1, 1, 14, "dn\xED"),
    num2("batch.drying.maxDays", "batch", 7, 1, 30, "dn\xED"),
    num2("batch.drying.fraction", "batch", 0.3, 0.1, 0.6, "zb\xFDvaj\xEDc\xED doby", 0.05),
    num2("batch.drying.nearDays", "batch", 1, 1, 7, "dn\xED"),
    num2("batch.curing.firstWeekDays", "batch", 1, 1, 14, "dn\xED"),
    num2("batch.curing.monthDays", "batch", 3, 1, 30, "dn\xED"),
    num2("batch.curing.laterDays", "batch", 7, 1, 60, "dn\xED"),
    num2("batch.fermenting.days", "batch", 2, 1, 30, "dn\xED"),
    num2("batch.storing.freshDays", "batch", 7, 1, 90, "dn\xED"),
    num2("batch.storing.driedDays", "batch", 30, 1, 365, "dn\xED"),
    num2("batch.pickling.days", "batch", 30, 1, 365, "dn\xED"),
    num2("useBy.vegetable", "batch", 10, 1, 365, "dn\xED od sklizn\u011B"),
    num2("useBy.fruit", "batch", 14, 1, 365, "dn\xED od sklizn\u011B"),
    num2("useBy.tree_shrub", "batch", 60, 1, 365, "dn\xED od sklizn\u011B"),
    num2("eval.remind1Days", "eval", 30, 0, 730, "dn\xED od \u201Ek pou\u017Eit\xED\u201C"),
    num2("eval.remind2Days", "eval", 90, 0, 730, "dn\xED od \u201Ek pou\u017Eit\xED\u201C"),
    num2("eval.remind3Days", "eval", 365, 0, 1460, "dn\xED od \u201Ek pou\u017Eit\xED\u201C"),
    num2("eval.freshRemind1Days", "eval", 0, 0, 365, "dn\xED (\u010Derstv\xE9 plody)"),
    num2("eval.freshRemind2Days", "eval", 14, 0, 365, "dn\xED (\u010Derstv\xE9 plody)"),
    num2("eval.reviewDays", "eval", 90, 7, 730, "dn\xED po prvn\xEDm hodnocen\xED"),
    num2("drying.refDays", "drying", 7, 1, 60, "dn\xED"),
    num2("drying.refWeightG", "drying", 50, 1, 5e3, "g"),
    num2("drying.sizeExponent", "drying", 0.4, 0, 1, "", 0.05),
    num2("drying.minFactor", "drying", 0.5, 0.1, 1, "\xD7", 0.05),
    num2("drying.maxFactor", "drying", 8, 1, 20, "\xD7", 0.5),
    num2("drying.refHeightCm", "drying", 30, 5, 300, "cm"),
    num2("drying.blendOld", "drying", 0.6, 0.1, 0.95, "", 0.05),
    ...ENVIRONMENTS.map((e) => num2(`drying.env.${e}`, "drying", e === "outdoor" || e === "greenhouse" ? 0.9 : 1, 0.5, 2, "\xD7", 0.05)),
    num2("pot.refVolumeL", "pot", 5, 0.1, 500, "l", 0.5),
    num2("pot.volumeExponent", "pot", 0.5, 0, 1, "", 0.05),
    num2("pot.minFactor", "pot", 0.4, 0.1, 1, "\xD7", 0.05),
    num2("pot.maxFactor", "pot", 3, 1, 10, "\xD7", 0.5),
    ...SUBSTRATES.map((s) => num2(`pot.substrate.${s}`, "pot", { soil: 1, coco: 0.7, hydro: 0.5 }[s], 0.2, 3, "\xD7", 0.05)),
    ...SEASON_NAMES.map((s) => num2(`season.${s}`, "season", SEASON_DEFAULTS[s], 0.3, 3, "\xD7", 0.05)),
    ...ENVIRONMENTS.map((e) => bool(`season.on.${e}`, "season", SEASON_ON[e])),
    choice("afterFinalHarvest", "afterHarvest", "ask", AFTER_FINAL_HARVEST),
    num2("dashboard.lookaheadDays", "dashboard", 3, 0, 14, "dn\xED"),
    num2("stock.lowDays", "stock", 10, 1, 120, "dn\xED do vy\u010Derp\xE1n\xED"),
    num2("stock.rateWindowDays", "stock", 28, 7, 180, "dn\xED"),
    num2("stock.useByPct", "stock", 50, 5, 95, "% \u010Derstvosti"),
    num2("stock.lowQualityPct", "stock", 30, 5, 90, "% \u010Derstvosti"),
    num2("stock.minRateDays", "stock", 7, 1, 60, "dn\xED od prvn\xEDho odb\u011Bru")
  ];
  var RULE_GROUPS = [...new Set(RULE_DEFS.map((d) => d.group))];
  var BY_KEY = new Map(RULE_DEFS.map((d) => [d.key, d]));
  var DEFAULT_RULES = Object.freeze(Object.fromEntries(RULE_DEFS.map((d) => [d.key, d.def])));
  function validRule(key, value) {
    const d = BY_KEY.get(key);
    if (!d) return false;
    if (d.kind === "num") return typeof value === "number" && Number.isFinite(value) && value >= d.min && value <= d.max;
    if (d.kind === "bool") return typeof value === "boolean";
    return d.options.includes(value);
  }
  function cleanRules(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [k, v] of Object.entries(raw)) if (validRule(k, v) && v !== DEFAULT_RULES[k]) out[k] = v;
    return out;
  }
  var resolveRules = (overrides) => ({ ...DEFAULT_RULES, ...cleanRules(overrides) });
  var rv = (rules, key) => rules?.[key] ?? DEFAULT_RULES[key];

  // js/model.js
  var model_exports = {};
  __export(model_exports, {
    buildPlant: () => buildPlant,
    clearProjectors: () => clearProjectors,
    clonePlantInput: () => clonePlantInput,
    emptyCache: () => emptyCache,
    isPresetKey: () => isPresetKey,
    liveEvents: () => liveEvents,
    optionalPot: () => optionalPot,
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
      houseplant: "Pokojovka",
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
    substrate: { soil: "Zemina", coco: "Kokos", hydro: "Hydro" },
    crit: {
      title: "Krit\xE9ria hodnocen\xED",
      open: "Krit\xE9ria hodnocen\xED",
      openHint: "Pro ka\u017Edou kategorii p\u0159idej, p\u0159ejmenuj nebo odeber krit\xE9ria. Stupnice z\u016Fst\xE1v\xE1 1\u20135.",
      intro: "Krit\xE9ria se nab\xEDzej\xED v hodnocen\xED rostlin dan\xE9 kategorie. \u201ECelkov\u011B\u201C je povinn\xE9. Odebran\xE9 krit\xE9rium zmiz\xED z nov\xFDch hodnocen\xED, ale star\xE9 hodnoty z\u016Fstanou v historii a do nov\xFDch pr\u016Fm\u011Br\u016F se nepo\u010D\xEDtaj\xED.",
      overall: "Celkov\u011B (povinn\xE9)",
      add: "P\u0159idat",
      addHint: "Nov\xE9 krit\xE9rium, nap\u0159. Odolnost",
      removed: "Odebran\xE1 krit\xE9ria",
      restore: "Vr\xE1tit",
      remove: "Odebrat",
      reset: "V\xFDchoz\xED krit\xE9ria",
      saved: "Ulo\u017Eeno.",
      empty: "Zat\xEDm jen \u201ECelkov\u011B\u201C.",
      limit: "Dosa\u017Een maxim\xE1ln\xED po\u010Det krit\xE9ri\xED.",
      renameHint: "P\u0159ejmenovat"
    },
    rules: {
      title: "Pravidla a intervaly",
      open: "Pravidla a intervaly",
      intro: "V\u0161echny intervaly a koeficienty, kter\xE9 aplikace pou\u017E\xEDv\xE1. Zm\u011Bna se hned prop\xED\u0161e do \xFAkol\u016F. Cokoli m\u016F\u017Ee\u0161 vr\xE1tit na v\xFDchoz\xED hodnotu.",
      openHint: "Intervaly p\xE9\u010De, kontroly d\xE1vek po sklizni, odhad su\u0161en\xED, kv\u011Btin\xE1\u010De a ro\u010Dn\xED obdob\xED.",
      def: "v\xFDchoz\xED",
      changed: "zm\u011Bn\u011Bno",
      reset: "V\xFDchoz\xED",
      resetAll: "Vr\xE1tit v\u0161e na v\xFDchoz\xED",
      resetAllAsk: "V\u0161echny zm\u011Bn\u011Bn\xE9 hodnoty se vr\xE1t\xED na v\xFDchoz\xED. Pokra\u010Dovat?",
      resetDone: "Pravidla vr\xE1cena na v\xFDchoz\xED",
      saved: "Pravidla ulo\u017Eena",
      yes: "Ano",
      no: "Ne",
      changedCount: (n) => `Zm\u011Bn\u011Bno: ${n}`,
      invalid: (min, max) => `Zadej \u010D\xEDslo od ${min} do ${max}.`,
      order: "Hodnoty mus\xED j\xEDt od men\u0161\xED k v\u011Bt\u0161\xED.",
      group: {
        category: "Intervaly podle kategorie",
        fertilizing: "Hnojen\xED",
        batch: "D\xE1vky po sklizni",
        eval: "Hodnocen\xED a p\u0159ipom\xEDnky",
        drying: "Odhad doby su\u0161en\xED",
        pot: "Kv\u011Btin\xE1\u010D a substr\xE1t",
        season: "Ro\u010Dn\xED obdob\xED",
        afterHarvest: "Po posledn\xED sklizni",
        dashboard: "P\u0159ehled",
        stock: "Z\xE1soby po sklizni"
      },
      groupHint: {
        category: "Z\xE1kladn\xED doba schnut\xED substr\xE1tu, interval hnojen\xED a kontroly \u0161k\u016Fdc\u016F pro ka\u017Edou kategorii.",
        fertilizing: "Plat\xED jen pro rostliny, o kter\xE9 se pe\u010Duje. Po sklizni se hnojen\xED nep\u0159ipom\xEDn\xE1.",
        batch: "Jak \u010Dasto kontrolovat d\xE1vky v zpracov\xE1n\xED a kdy p\u0159ipomenout spot\u0159ebu \u010Derstv\xFDch plod\u016F.",
        eval: "P\u0159ipom\xEDnky se po\u010D\xEDtaj\xED od okam\u017Eiku \u201Ek pou\u017Eit\xED\u201C (u \u010Derstv\xFDch plod\u016F od sklizn\u011B).",
        drying: "Doba su\u0161en\xED = reference \xD7 velikost d\xE1vky^exponent \xD7 prost\u0159ed\xED \xD7 nau\u010Den\xFD pom\u011Br.",
        pot: "V\u011Bt\u0161\xED kv\u011Btin\xE1\u010D schne pomaleji, kokos a hydro rychleji.",
        season: "N\xE1sobek intervalu z\xE1livky podle ro\u010Dn\xEDho obdob\xED a prost\u0159ed\xED.",
        afterHarvest: "Co se stane s rostlinou, kdy\u017E zaznamen\xE1\u0161 posledn\xED sklize\u0148.",
        dashboard: "Hlavn\xED seznam ukazuje jen \xFAkoly po term\xEDnu a dne\u0161n\xED. Dal\u0161\xED jsou v rozbalovac\xED sekci \u201ENadch\xE1zej\xEDc\xED\u201C.",
        stock: "Predikce spot\u0159eby a prahy \u010Derstvosti. Polo\u010Dasy a kontroly jednotliv\xFDch zp\u016Fsob\u016F skladov\xE1n\xED nastav\xED\u0161 v Nastaven\xED \u2192 Skladov\xE1n\xED."
      },
      afterChoice: { ask: "Zeptat se", auto: "P\u0159epnout automaticky", manual: "Nic nem\u011Bnit" },
      afterHint: "Zelenina, bylinky a kv\u011Btiny p\u0159ejdou do \u201ESklizeno\u201C, v\xEDcelet\xE9 rostliny do \u201EKlid\u201C.",
      label: {
        "dashboard.lookaheadDays": "Nadch\xE1zej\xEDc\xED \xFAkoly: kolik dn\xED dop\u0159edu",
        "stock.lowDays": "Upozornit na doch\xE1z\xED z\xE1soba, kdy\u017E vydr\u017E\xED m\xE9n\u011B ne\u017E",
        "stock.rateWindowDays": "Spot\u0159eba: okno pro v\xFDpo\u010Det pr\u016Fm\u011Bru",
        "stock.useByPct": "Spot\u0159ebovat do: pr\xE1h \u010Derstvosti",
        "stock.lowQualityPct": "Varov\xE1n\xED p\u0159i \u010Derstvosti pod",
        "stock.minRateDays": "Predikce a\u017E po (dn\xED od prvn\xEDho odb\u011Bru)",
        "fertilizing.firstFeedDays": "Prvn\xED hnojen\xED po zalo\u017Een\xED",
        "fertilizing.fruitingFactor": "N\xE1sobek intervalu hnojen\xED p\u0159i ploden\xED",
        "fertilizing.stopBeforeHarvestDays": "Nehnojit p\u0159ed pl\xE1novanou sklizn\xED",
        "batch.drying.minDays": "Su\u0161en\xED: nejkrat\u0161\xED interval kontrol",
        "batch.drying.maxDays": "Su\u0161en\xED: nejdel\u0161\xED interval kontrol",
        "batch.drying.fraction": "Su\u0161en\xED: kontrola po \u010D\xE1sti zb\xFDvaj\xEDc\xED doby",
        "batch.drying.nearDays": "Su\u0161en\xED: interval u skoro such\xE9 d\xE1vky",
        "batch.curing.firstWeekDays": "Zr\xE1n\xED: prvn\xED t\xFDden",
        "batch.curing.monthDays": "Zr\xE1n\xED: do 4 t\xFDdn\u016F",
        "batch.curing.laterDays": "Zr\xE1n\xED: pozd\u011Bji",
        "batch.fermenting.days": "Fermentace: interval kontrol",
        "batch.storing.freshDays": "Skladov\xE1n\xED \u010Derstv\xFDch plod\u016F: interval kontrol",
        "batch.storing.driedDays": "Skladov\xE1n\xED su\u0161en\xFDch d\xE1vek: interval kontrol",
        "batch.pickling.days": "Nakl\xE1d\xE1n\xED: interval kontrol",
        "useBy.vegetable": "Spot\u0159ebovat zeleninu do",
        "useBy.fruit": "Spot\u0159ebovat ovoce do",
        "useBy.tree_shrub": "Spot\u0159ebovat plody strom\u016F a ke\u0159\u016F do",
        "eval.remind1Days": "Hodnocen\xED: 1. p\u0159ipom\xEDnka",
        "eval.remind2Days": "Hodnocen\xED: 2. p\u0159ipom\xEDnka",
        "eval.remind3Days": "Hodnocen\xED: 3. p\u0159ipom\xEDnka",
        "eval.freshRemind1Days": "\u010Cerstv\xE9 plody: 1. p\u0159ipom\xEDnka",
        "eval.freshRemind2Days": "\u010Cerstv\xE9 plody: 2. p\u0159ipom\xEDnka",
        "eval.reviewDays": "P\u0159ipomenout \u201EZm\u011Bnil se tv\u016Fj n\xE1zor?\u201C po",
        "drying.refDays": "Referen\u010Dn\xED doba su\u0161en\xED",
        "drying.refWeightG": "Referen\u010Dn\xED hmotnost d\xE1vky",
        "drying.sizeExponent": "Vliv velikosti d\xE1vky (exponent)",
        "drying.minFactor": "Nejkrat\u0161\xED odhad (n\xE1sobek reference)",
        "drying.maxFactor": "Nejdel\u0161\xED odhad (n\xE1sobek reference)",
        "drying.refHeightCm": "Referen\u010Dn\xED v\xFD\u0161ka rostliny",
        "drying.blendOld": "V\xE1ha dosavadn\xEDho odhadu p\u0159i u\u010Den\xED",
        "pot.refVolumeL": "Referen\u010Dn\xED objem kv\u011Btin\xE1\u010De",
        "pot.volumeExponent": "Vliv objemu kv\u011Btin\xE1\u010De (exponent)",
        "pot.minFactor": "Nejmen\u0161\xED koeficient kv\u011Btin\xE1\u010De",
        "pot.maxFactor": "Nejv\u011Bt\u0161\xED koeficient kv\u011Btin\xE1\u010De",
        afterFinalHarvest: "Po posledn\xED sklizni"
      },
      cat: { soilDays: "schnut\xED substr\xE1tu", fertilizingDays: "hnojen\xED", pestCheckDays: "kontrola \u0161k\u016Fdc\u016F" },
      dryEnv: "Su\u0161en\xED",
      potSub: "Substr\xE1t",
      seasonOf: "Sez\xF3na",
      seasonOn: "Sez\xF3nnost"
    },
    moisture: { dry: "Such\xE9", ok: "Akor\xE1t", wet: "Vlhk\xE9" },
    problem: { pest: "\u0160k\u016Fdci", mold: "Pl\xEDse\u0148", wilting: "Vadnut\xED", nutrient: "\u017Diviny", other: "Jin\xE9" },
    processing: {
      drying: "Su\u0161en\xED",
      curing: "Zr\xE1n\xED",
      fermenting: "Fermentace",
      pickling: "Nakl\xE1d\xE1n\xED",
      freezing: "Zmrazen\xED",
      storing: "Skladov\xE1n\xED",
      none: "Bez zpracov\xE1n\xED",
      other: "Jin\xE9"
    },
    batchPhase: {
      pending: "\u010Cek\xE1 na ur\u010Den\xED zpracov\xE1n\xED",
      drying: "Su\u0161en\xED",
      curing: "Zr\xE1n\xED",
      fermenting: "Fermentace",
      pickling: "Nakl\xE1d\xE1n\xED",
      freezing: "Zmrazeno",
      storing: "Skladov\xE1n\xED",
      other: "Jin\xE9 zpracov\xE1n\xED",
      ready: "K pou\u017Eit\xED",
      used: "Pou\u017Eito",
      discarded: "Vy\u0159azeno"
    },
    dryness: ["\u010Cerstv\xE9", "Vlhk\xE9", "Nap\u016Fl such\xE9", "Skoro such\xE9", "Such\xE9, dosych\xE1", "Hotovo, such\xE9"],
    care: { pruning: "\u0158ez", repotting: "P\u0159esazen\xED", misting: "Rosen\xED", rotation: "Oto\u010Den\xED", cleaning: "\u010Ci\u0161t\u011Bn\xED list\u016F", custom: "Jin\xE1 p\xE9\u010De" },
    evalKind: { tasting: "Ochutn\xE1vka", final: "Z\xE1v\u011Bre\u010Dn\xE9 hodnocen\xED" },
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
      growth: "R\u016Fst",
      health: "Zdrav\xED",
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
      invalid: "Neplatn\xFD z\xE1znam.",
      harvestDate: "Sklize\u0148 nem\u016F\u017Ee b\xFDt pozd\u011Bji ne\u017E jej\xED zpracov\xE1n\xED a kontroly.",
      stockInit: "Z\xE1sobu lze zalo\u017Eit a\u017E po ur\u010Den\xED zpracov\xE1n\xED a jen jednou.",
      noStock: "Z\xE1sobn\xEDk neexistuje nebo u\u017E je pr\xE1zdn\xFD.",
      stockAmount: "Odeb\xEDr\xE1\u0161 v\xEDc, ne\u017E v z\xE1sobn\xEDku zb\xFDv\xE1.",
      stockDate: "Z\xE1znam nem\u016F\u017Ee b\xFDt d\u0159\xEDv ne\u017E sklize\u0148 nebo zalo\u017Een\xED z\xE1soby."
    },
    taskLabel: {
      moisture: "Zkontrolovat vlhkost",
      fertilizing: "P\u0159ihnojit",
      pestCheck: "Zkontrolovat \u0161k\u016Fdce",
      problemFollowUp: "Zkontrolovat probl\xE9m",
      batchCheck: "Zkontrolovat d\xE1vku",
      useBy: "Spot\u0159ebovat d\xE1vku",
      evaluation: "Ohodnotit sklize\u0148",
      evaluationReview: "Zm\u011Bnil se tv\u016Fj n\xE1zor?",
      stockCheck: "Zkontrolovat z\xE1sobn\xEDk",
      stockAir: "Vyv\u011Btrat z\xE1sobn\xEDk",
      stockUseBy: "Spot\u0159ebovat z\xE1sobn\xEDk",
      stockLow: "Doch\xE1z\xED z\xE1soba"
    },
    stock: {
      method: {
        freezer: "Mraz\xE1k",
        vacuum: "Vakuum",
        jar: "Uzav\u0159en\xE1 sklenice",
        fridge: "Lednice",
        soil: "Zakopan\xE9 v zemi",
        hanging: "Vis\xED v su\u0161\xE1rn\u011B",
        open: "Tma, pokojov\xE1 teplota",
        light: "Na sv\u011Btle",
        other: "Jin\xFD zp\u016Fsob"
      },
      preset: { generic: "Obecn\xE1", tea: "\u010Caj a su\u0161en\xE9 bylinky", cure: "Zr\xE1n\xED (del\u0161\xED vyle\u017Een\xED)", fresh: "\u010Cerstv\xE9 plody" },
      param: {
        tHalfProcessed: "Polo\u010Das \u010Derstvosti zpracovan\xE9ho (dny)",
        tHalfFresh: "Polo\u010Das \u010Derstvosti nezpracovan\xE9ho (dny)",
        checkDays: "Kontrola ka\u017Ed\xFDch (dny)",
        moldRisk: "Riziko pl\xEDsn\u011B (0\u20132)",
        airEveryDays: "Vyv\u011Btrat ka\u017Ed\xFDch (dny, 0 = nikdy)",
        airForDays: "V\u011Btrat prvn\xEDch (dn\xED)",
        maturingDays: "Zr\xE1n\xED bez ztr\xE1ty (dny)",
        openCost: "Ztr\xE1ta za otev\u0159en\xED (pod\xEDl)"
      },
      presetField: { method: "V\xFDchoz\xED zp\u016Fsob", maturingDays: "Zr\xE1n\xED bez ztr\xE1ty (dny)", useByPct: "Spot\u0159ebovat p\u0159i \u010Derstvosti pod (%)", checkDays: "Kontrola ka\u017Ed\xFDch (dny)", kFactor: "Rychlost st\xE1rnut\xED (\xD7)" },
      tab: "Z\xE1soba",
      title: "Z\xE1soba",
      overview: "Z\xE1soby",
      overviewIntro: "Co je\u0161t\u011B zb\xFDv\xE1 po sklizni, nap\u0159\xED\u010D rostlinami.",
      empty: "Zat\xEDm \u017E\xE1dn\xE1 z\xE1soba. Po ur\u010Den\xED zpracov\xE1n\xED ji zalo\u017E v\xE1\u017Een\xEDm.",
      none: "\u017D\xE1dn\xE9 z\xE1soby k zobrazen\xED.",
      init: "Zalo\u017Eit z\xE1sobu",
      initTitle: "Zalo\u017Eit z\xE1sobu",
      initHint: "Kolik opravdu m\xE1\u0161 po zpracov\xE1n\xED. M\u016F\u017Ee\u0161 ji rozd\u011Blit do v\xEDce z\xE1sobn\xEDk\u016F (sklenice, s\xE1\u010Dky) s r\u016Fzn\xFDm ulo\u017Een\xEDm.",
      suggest: {
        processed: "Podle zadan\xE9 zpracovan\xE9 hmotnosti.",
        fresh: "Podle hmotnosti sklizn\u011B.",
        none: "Mno\u017Estv\xED zadej ru\u010Dn\u011B.",
        learned: (r) => `Odhad podle tv\xFDch p\u0159edchoz\xEDch d\xE1vek (\xD7${r}). Zva\u017E a p\u0159epi\u0161 podle v\xE1\u017Een\xED.`,
        default: "Hrub\xFD odhad (\u010Dtvrtina \u010Derstv\xE9 hmotnosti). Zva\u017E a p\u0159epi\u0161 podle v\xE1\u017Een\xED."
      },
      unit: "Jednotka",
      source: { weighed: "Zv\xE1\u017Eeno", estimate: "Odhad" },
      estimate: "Jen odhaduji",
      amount: "Mno\u017Estv\xED",
      label: "Ozna\u010Den\xED (nepovinn\xE9)",
      labelPh: "nap\u0159. sklenice A",
      storedIn: "Ulo\u017Een\xED",
      addContainer: "P\u0159idat z\xE1sobn\xEDk",
      removeContainer: "Odebrat \u0159\xE1dek",
      containerN: (n) => `Z\xE1sobn\xEDk ${n}`,
      tooMany: "V\xEDc z\xE1sobn\xEDk\u016F u\u017E nejde.",
      needAmount: "Zadej mno\u017Estv\xED u ka\u017Ed\xE9ho z\xE1sobn\xEDku.",
      saved: "Z\xE1soba zalo\u017Eena",
      left: "Zb\xFDv\xE1",
      of: "z",
      fresh: "\u010Derstvost",
      maturing: (d) => `zraje do ${d}`,
      useBy: (d) => `spot\u0159ebuj do ${d}`,
      belowUseBy: "pod prahem \u010Derstvosti",
      moldTag: "pl\xEDse\u0148",
      opened: (n) => `otev\u0159eno ${n}\xD7`,
      since: "od",
      learnedTag: (r, n) => `nau\u010Deno \xD7${r} (${n} ${n === 1 ? "kontrola" : n >= 2 && n <= 4 ? "kontroly" : "kontrol"})`,
      priorTag: (r) => `odhad z ostatn\xEDch \xD7${r}`,
      emptied: (n) => `Vy\u010Derp\xE1no nebo vy\u0159azeno: ${n}`,
      batch: "D\xE1vka",
      use: "Odebrat",
      useTitle: "Odebrat ze z\xE1soby",
      useHint: "Kolik te\u010F bere\u0161.",
      useAll: "Vz\xEDt v\u0161e",
      useCustom: "Jin\xE9 mno\u017Estv\xED",
      used: "Odebr\xE1no",
      usedAll: "Z\xE1sobn\xEDk je pr\xE1zdn\xFD",
      batchUsedUp: "D\xE1vka je spot\u0159ebovan\xE1",
      firstUse: "Prvn\xED odb\u011Br",
      tasteAsk: "Ochutn\xE1no? Zapi\u0161 si kr\xE1tk\xE9 hodnocen\xED, ne\u017E ti vyprch\xE1 z pam\u011Bti.",
      tasteNow: "Ohodnotit",
      tasteSkip: "Te\u010F ne",
      adjust: "Zb\xFDv\xE1 cca",
      adjustTitle: "Upravit zb\xFDvaj\xEDc\xED mno\u017Estv\xED",
      adjustHint: "Odhadni nebo zva\u017E, kolik ve skute\u010Dnosti zb\xFDv\xE1. Rozd\xEDl se zap\xED\u0161e jako spot\u0159eba.",
      adjusted: "Mno\u017Estv\xED upraveno",
      move: "P\u0159esunout",
      scope: "Rozsah",
      moveTitle: "P\u0159esunout nebo rozd\u011Blit",
      moveWhole: "Cel\xFD z\xE1sobn\xEDk",
      movePart: "Jen \u010D\xE1st",
      moveAmount: "Kolik p\u0159esunout",
      moveTo: "Nov\xFD zp\u016Fsob ulo\u017Een\xED",
      moved: "P\u0159esunuto",
      moveNeed: "Vyber jin\xFD zp\u016Fsob nebo \u010D\xE1st.",
      check: "Kontrola",
      checkTitle: "Kontrola z\xE1sobn\xEDku",
      checkHint: "V\u016Fn\u011B a vzhled sta\u010D\xED. Z nich se u\u010D\xED, jak rychle ti tenhle zp\u016Fsob ulo\u017Een\xED st\xE1rne.",
      scent: "V\u016Fn\u011B",
      look: "Vzhled",
      mold: "Pl\xEDse\u0148",
      moldNo: "Bez pl\xEDsn\u011B",
      moldYes: "Pl\xEDse\u0148",
      rh: "Vlhkost vzduchu v n\xE1dob\u011B (%)",
      aired: "Vyv\u011Btr\xE1no",
      checked: "Kontrola zaps\xE1na",
      needCheck: "Vypl\u0148 aspo\u0148 v\u016Fni, vzhled, pl\xEDse\u0148 nebo vlhkost.",
      moldAsk: "Pl\xEDse\u0148 v z\xE1sobn\xEDku. Vy\u0159adit ho? Ostatn\xED z\xE1sobn\xEDky dostanou kontrolu hned.",
      moldKeep: "Ponechat",
      discard: "Vy\u0159adit",
      discardTitle: "Vy\u0159adit zbytek",
      discardAsk: (a) => `Vy\u0159adit zb\xFDvaj\xEDc\xEDch ${a}?`,
      discarded: "Vy\u0159azeno",
      reason: "D\u016Fvod (nepovinn\xE9)",
      summary: "Celkem zb\xFDv\xE1",
      rate: (a, w) => `spot\u0159eba ${a}/den (posledn\xEDch ${w} dn\xED)`,
      noRate: "Spot\u0159ebu odhadnu po p\xE1r dnech odb\u011Br\u016F.",
      runOut: (days, d) => `vydr\u017E\xED ~${days} dn\xED (do ${d})`,
      presetLabel: "P\u0159edvolba",
      presetHint: "M\u011Bn\xED v\xFDchoz\xED ulo\u017Een\xED, zr\xE1n\xED a pr\xE1h \u010Derstvosti.",
      presetDefault: "V\xFDchoz\xED",
      presetPlant: "P\u0159edvolba z\xE1soby",
      presetPlantHint: "\u0158\xEDd\xED v\xFDchoz\xED ulo\u017Een\xED a st\xE1rnut\xED z\xE1soby. Pamatuje se i pro odr\u016Fdu.",
      weighPrompt: "D\xE1vka je hotov\xE1. Zv\xE1\u017Eit a zalo\u017Eit z\xE1sobu?",
      weighNow: "Zalo\u017Eit z\xE1sobu",
      weighLater: "Pozd\u011Bji",
      archiveWarn: (n) => `Zb\xFDv\xE1 ${n}. Z\xE1soba p\u016Fjde d\xE1l spot\u0159ebov\xE1vat i po archivaci.`,
      settingsTitle: "Skladov\xE1n\xED",
      settingsIntro: "Zp\u016Fsoby ulo\u017Een\xED a p\u0159edvolby z\xE1soby. \u010C\xEDsla jsou v\xFDchoz\xED odhady, p\u0159esn\u011Bji se dolad\xED z tv\xFDch kontrol.",
      methods: "Zp\u016Fsoby ulo\u017Een\xED",
      presets: "P\u0159edvolby z\xE1soby",
      categoryDefaults: "V\xFDchoz\xED p\u0159edvolba podle kategorie",
      addMethod: "Vlastn\xED zp\u016Fsob",
      addPreset: "Vlastn\xED p\u0159edvolba",
      cloneOf: "Vych\xE1z\xED z",
      reset: "Vr\xE1tit v\xFDchoz\xED",
      custom: "vlastn\xED",
      name: "N\xE1zev",
      delete: "Smazat",
      saved2: "Ulo\u017Eeno",
      nameNeeded: "Zadej n\xE1zev.",
      invalid: "Hodnota je mimo rozsah.",
      comparison: "Jak se osv\u011Bd\u010Dilo",
      comparisonHint: "Pr\u016Fm\u011Brn\xE9 hodnocen\xED v\u016Fn\u011B a vzhledu p\u0159i kontrol\xE1ch podle zp\u016Fsobu ulo\u017Een\xED.",
      comparisonRow: (n, avg2, age) => `${n}\xD7 \xB7 ${avg2}/5 \xB7 typicky po ${age} dnech`,
      lateAvg: (n, avg2) => `po 60+ dnech: ${avg2}/5 (${n}\xD7)`,
      comparisonNone: "Zat\xEDm nem\xE1\u0161 dost kontrol s hodnocen\xEDm.",
      openOverview: "Z\xE1soby po sklizni",
      fromTasks: "Otev\u0159\xEDt z\xE1sobu",
      lowTask: (d) => `P\u0159i sou\u010Dasn\xE9 spot\u0159eb\u011B vydr\u017E\xED asi ${d} dn\xED.`,
      useByTask: "\u010Cerstvost klesla pod nastaven\xFD pr\xE1h.",
      checkTask: "Pod\xEDvej se na v\u016Fni a vzhled.",
      airTask: "Otev\u0159i a nech vyv\u011Btrat."
    },
    ui: {
      today: "Dnes",
      tomorrow: "Z\xEDtra",
      yesterday: "V\u010Dera",
      overdue: "Po term\xEDnu",
      upcoming: "Nadch\xE1zej\xEDc\xED",
      upcomingSection: "Nadch\xE1zej\xEDc\xED",
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
      editHarvest: "Upravit sklize\u0148",
      harvestEdited: "Sklize\u0148 upravena",
      editedTag: "upraveno",
      voidHarvestAsk: "Zru\u0161en\xEDm sklizn\u011B zmiz\xED i jej\xED zpracov\xE1n\xED a kontroly (hodnocen\xED z\u016Fstanou). Opravdu zru\u0161it?",
      voidConfirm: "Zru\u0161it sklize\u0148",
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
      recordedUndo: "Zaznamen\xE1no",
      batchFine: "V po\u0159\xE1dku",
      lastHarvestTag: "posledn\xED sklize\u0148",
      pestClean: "\u010Cisto",
      pestFound: "Nalezeno",
      finalHarvest: "Je to posledn\xED sklize\u0148 t\xE9to rostliny",
      finalHint: "Dal\u0161\xED \xFAkoly p\xE9\u010De skon\u010D\xED a d\xE1vky se d\xE1l zpracov\xE1vaj\xED.",
      estDays: "Odhad doby zpracov\xE1n\xED (dny, nepovinn\xE9)",
      pickMethod: "Vyber zpracov\xE1n\xED.",
      afterHarvest: "Po sklizni",
      batchCheck: "Zkontrolovat",
      batchMove: "P\u0159esunout",
      batchMethod: "Ur\u010Dit zpracov\xE1n\xED",
      batchPending: "Sklize\u0148 \u010Dek\xE1 na ur\u010Den\xED zpracov\xE1n\xED",
      batchesTitle: "D\xE1vky",
      noBatches: "Zat\xEDm \u017E\xE1dn\xE9 d\xE1vky.",
      dryness: "Stupe\u0148 vysu\u0161en\xED",
      batchLook: "Vzhled",
      mold: "Pl\xEDse\u0148",
      moldNone: "Bez pl\xEDsn\u011B",
      moldFound: "Pl\xEDse\u0148",
      scent: "V\u016Fn\u011B",
      movePhase: "P\u0159esunout do",
      dryDone: "D\xE1vka je such\xE1. Co d\xE1l?",
      useAsk: "D\xE1vka je ke spot\u0159eb\u011B. Co s n\xED?",
      stillHave: "Je\u0161t\u011B m\xE1m",
      markUsed: "Pou\u017Eito",
      markDiscarded: "Vy\u0159azeno",
      evalKind: "Druh hodnocen\xED",
      evalBatch: "Co hodnot\xED\u0161",
      evalPart: "Jak\xE1 \u010D\xE1st (nepovinn\xE9)",
      evalPartHint: "Nap\u0159. horn\xED v\u011Btve, prvn\xED zr\xE1n\xED, jedna sklenice.",
      wholePlant: "Cel\xE1 rostlina",
      tasting: "Ochutn\xE1vka",
      tastingHint: "Pr\u016Fb\u011B\u017En\xE9 hodnocen\xED plod\u016F. Nezapo\u010D\xEDt\xE1v\xE1 se do z\xE1v\u011Bre\u010Dn\xE9ho sk\xF3re.",
      finalEval: "Z\xE1v\u011Bre\u010Dn\xE9",
      careKind: "Druh p\xE9\u010De",
      careLabel: "N\xE1zev",
      potVolume: "Objem nov\xE9ho kv\u011Btin\xE1\u010De (l)",
      ready: "k pou\u017Eit\xED",
      phaseSince: "od",
      dayOf: (t, n) => `den ${t} z ~${n}`,
      dryMeasured: (n) => `su\u0161eno ${n} dn\xED`,
      dryLearned: (r, n) => `Nau\u010Den\xFD pom\u011Br su\u0161en\xED: \xD7${r} (z ${n} ${n === 1 ? "d\xE1vky" : "d\xE1vek"})`,
      dryPrior: (r) => `Odhad podle ostatn\xEDch rostlin: \xD7${r}`,
      afterFinalAsk: "Posledn\xED sklize\u0148 zaps\xE1na. P\u0159epnout rostlinu do dal\u0161\xEDho stavu?",
      switchTo: "P\u0159epnout na",
      notYet: "Je\u0161t\u011B ne",
      switched: "Stav zm\u011Bn\u011Bn",
      batchSaved: "D\xE1vka ulo\u017Eena",
      kindFinal: "Z\xE1v\u011Bre\u010Dn\xE9",
      kindTasting: "Ochutn\xE1vky",
      plantArchivedBatches: "Rostlina je archivovan\xE1, d\xE1vky se d\xE1l sleduj\xED.",
      noCareTasks: "Rostlina je po sklizni, p\xE9\u010De se nep\u0159ipom\xEDn\xE1."
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
      seasonLine: (env2, n) => `${n} ${n === 1 ? "rostlina" : n >= 2 && n <= 4 ? "rostliny" : "rostlin"} venku a ve sklen\xEDku \xB7 ${env2}`,
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
    const m2 = mean(a);
    if (m2 === 0) return 0;
    const v = a.reduce((s, x) => s + (x - m2) ** 2, 0) / a.length;
    return Math.sqrt(v) / m2;
  }
  function normalizeKey(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  var MIRROR = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
  function seasonOf(iso, hemisphere = "north") {
    const m2 = new Date(iso).getMonth();
    const north = m2 === 11 || m2 <= 1 ? "winter" : m2 <= 4 ? "spring" : m2 <= 7 ? "summer" : "autumn";
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
      soilDryDays: {},
      confidence: {},
      batches: [],
      cacheRev: null
    };
  }
  function liveEvents(events) {
    const voided = new Set(events.filter((e) => e.type === "void").map((e) => e.payload.targetId));
    const base = events.filter((e) => e.type !== "void" && !voided.has(e.id));
    const edits = /* @__PURE__ */ new Map();
    base.filter((e) => e.type === "harvest_edit").sort((a, b) => a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0).forEach((e) => edits.set(e.payload.harvestId, e));
    const goneBatches = new Set(events.filter((e) => e.type === "harvest" && voided.has(e.id)).map((e) => e.id));
    const goneStock = new Set(events.filter((e) => e.type === "stock_init" && voided.has(e.id)).map((e) => e.id));
    const out = [];
    for (const e of base) {
      if (e.type === "harvest_edit") continue;
      const bid = e.payload?.batchId;
      const isStock = e.type.startsWith("stock_");
      if (isStock && (bid && goneBatches.has(bid) || e.payload?.stockId && goneStock.has(e.payload.stockId))) continue;
      if (bid && goneBatches.has(bid)) {
        if (e.type === "batch_step" || e.type === "batch_check") continue;
        if (e.type === "evaluation") {
          const pl2 = { ...e.payload };
          delete pl2.batchId;
          out.push({ ...e, payload: pl2 });
          continue;
        }
      }
      const ed = e.type === "harvest" ? edits.get(e.id) : null;
      if (ed) {
        const fields = { ...ed.payload };
        const date = fields.date;
        delete fields.harvestId;
        delete fields.date;
        out.push({ ...e, occurredAt: date ?? e.occurredAt, payload: { ...fields, batchId: e.payload.batchId, daysSinceLastHarvest: e.payload.daysSinceLastHarvest, edited: true } });
      } else out.push(e);
    }
    return out.sort(compareEvents);
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
    cache.pestBoostUntil = cache.openProblems.length ? addDays(cache.openProblems.reduce((m2, x) => x.since > m2 ? x.since : m2, ""), PEST_BOOST_DAYS) : null;
    for (const p of projectors) p.finalize?.(ctx2);
    return { ...plant, environment: cache.environment ?? plant.environment, archivedAt, cache };
  }
  function optionalPot(input) {
    const out = {};
    if (Number.isFinite(input?.potVolumeL) && input.potVolumeL > 0) out.potVolumeL = input.potVolumeL;
    if (SUBSTRATES.includes(input?.substrate)) out.substrate = input.substrate;
    if (typeof input?.plannedHarvestAt === "string" && !Number.isNaN(Date.parse(input.plannedHarvestAt))) out.plannedHarvestAt = input.plannedHarvestAt;
    return out;
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
    const pot = optionalPot(input);
    Object.assign(plant, pot);
    if (isPresetKey(input.stockPreset)) plant.stockPreset = input.stockPreset;
    return { plant, stage };
  }
  var isPresetKey = (v) => typeof v === "string" && /^[a-zA-Z0-9]{1,32}$/.test(v);
  var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function clonePlantInput(plant, existingNames = []) {
    const base = plant.name.replace(/\s*#\d+$/, "").trim();
    const re = new RegExp(`^${esc(base)} #(\\d+)$`);
    const nums = [1];
    for (const n of [plant.name, ...existingNames]) {
      if (n === base) nums.push(1);
      const m2 = n.match(re);
      if (m2) nums.push(Number(m2[1]));
    }
    const soil = plant.cache?.soilDryDays ?? plant.cache?.dryingDays;
    const learned = soil && Object.keys(soil).length ? { ...soil } : plant.learnedBase;
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
      learnedBase: learned || null,
      potVolumeL: plant.cache?.pot?.volumeL ?? plant.potVolumeL,
      substrate: plant.substrate,
      stockPreset: plant.stockPreset
    };
  }

  // js/stockcfg.js
  var LABEL_MAX = 40;
  var clean = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, LABEL_MAX);
  var isNum2 = (v) => typeof v === "number" && Number.isFinite(v);
  var METHOD_PARAMS = [
    { key: "tHalfProcessed", min: 1, max: 2e4, unit: "dn\xED" },
    { key: "tHalfFresh", min: 0.5, max: 3650, unit: "dn\xED" },
    { key: "checkDays", min: 1, max: 730, unit: "dn\xED" },
    { key: "moldRisk", min: 0, max: 2, unit: "0\u20132", int: true },
    { key: "airEveryDays", min: 0, max: 30, unit: "dn\xED" },
    { key: "airForDays", min: 0, max: 365, unit: "dn\xED" },
    { key: "maturingDays", min: 0, max: 365, unit: "dn\xED" },
    { key: "openCost", min: 0, max: 0.2, unit: "pod\xEDl", step: 5e-3 }
  ];
  var PARAM = Object.fromEntries(METHOD_PARAMS.map((p) => [p.key, p]));
  var m = (tHalfProcessed, tHalfFresh, checkDays, moldRisk, airEveryDays, airForDays, maturingDays, openCost) => ({ tHalfProcessed, tHalfFresh, checkDays, moldRisk, airEveryDays, airForDays, maturingDays, openCost });
  var BUILTIN_METHODS = {
    freezer: m(1e3, 120, 90, 0, 0, 0, 0, 0.01),
    vacuum: m(365, 7, 30, 0, 0, 0, 0, 0.03),
    jar: m(180, 5, 14, 1, 2, 14, 14, 0.01),
    fridge: m(240, 14, 30, 1, 0, 0, 0, 0.01),
    soil: m(120, 60, 14, 2, 0, 0, 14, 0.01),
    hanging: m(20, 3, 5, 1, 0, 0, 0, 0),
    open: m(45, 4, 7, 1, 0, 0, 0, 0.02),
    light: m(30, 2, 7, 1, 0, 0, 0, 0.02),
    other: m(90, 7, 14, 1, 0, 0, 0, 0.01)
  };
  var METHOD_ORDER = Object.keys(BUILTIN_METHODS);
  var BUILTIN_PRESETS = {
    generic: { method: "jar", maturingDays: null, useByPct: null, checkDays: null, kFactor: 1 },
    tea: { method: "jar", maturingDays: 0, useByPct: 40, checkDays: null, kFactor: 1 },
    cure: { method: "jar", maturingDays: 28, useByPct: 50, checkDays: null, kFactor: 1 },
    fresh: { method: "fridge", maturingDays: 0, useByPct: 40, checkDays: null, kFactor: 1 }
  };
  var PRESET_ORDER = Object.keys(BUILTIN_PRESETS);
  var METHOD_KEY = /^x[a-zA-Z0-9]{1,30}$/;
  var PRESET_KEY = /^p[a-zA-Z0-9]{1,30}$/;
  var VARIETY_KEY = /^[a-z_]+\|.{0,100}$/;
  var validParam = (key, v) => {
    const d = PARAM[key];
    return d && isNum2(v) && v >= d.min && v <= d.max && (!d.int || Number.isInteger(v));
  };
  function cleanStock(raw) {
    const out = { methods: {}, presets: {}, categoryPreset: {}, varietyPreset: {} };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [key, v] of Object.entries(raw.methods || {})) {
      const builtin = key in BUILTIN_METHODS;
      if (!builtin && !METHOD_KEY.test(key)) continue;
      if (!v || typeof v !== "object") continue;
      const o = {};
      const label = clean(v.label);
      if (label) o.label = label;
      if (!builtin && !label) continue;
      for (const p of METHOD_PARAMS) {
        if (v[p.key] == null) continue;
        if (validParam(p.key, v[p.key]) && (!builtin || v[p.key] !== BUILTIN_METHODS[key][p.key])) o[p.key] = v[p.key];
      }
      if (builtin && label && label === S.stock.method[key]) delete o.label;
      if (Object.keys(o).length) out.methods[key] = o;
    }
    const methodKeys = /* @__PURE__ */ new Set([...METHOD_ORDER, ...Object.keys(out.methods).filter((k) => !(k in BUILTIN_METHODS))]);
    for (const [key, v] of Object.entries(raw.presets || {})) {
      const builtin = key in BUILTIN_PRESETS;
      if (!builtin && !PRESET_KEY.test(key)) continue;
      if (!v || typeof v !== "object") continue;
      const o = {};
      const label = clean(v.label);
      if (label && !(builtin && label === S.stock.preset[key])) o.label = label;
      if (!builtin && !label) continue;
      if (typeof v.method === "string" && methodKeys.has(v.method)) o.method = v.method;
      else if (!builtin) continue;
      for (const [f, lo, hi] of [["maturingDays", 0, 365], ["useByPct", 5, 95], ["checkDays", 1, 730], ["kFactor", 0.2, 5]]) {
        if (isNum2(v[f]) && v[f] >= lo && v[f] <= hi) o[f] = v[f];
      }
      if (builtin) {
        for (const f of Object.keys(o)) if (o[f] === BUILTIN_PRESETS[key][f]) delete o[f];
      }
      if (Object.keys(o).length) out.presets[key] = o;
    }
    const presetKeys = /* @__PURE__ */ new Set([...PRESET_ORDER, ...Object.keys(out.presets).filter((k) => !(k in BUILTIN_PRESETS))]);
    for (const [cat, key] of Object.entries(raw.categoryPreset || {})) {
      if (CATEGORIES[cat] && presetKeys.has(key)) out.categoryPreset[cat] = key;
    }
    for (const [vk, key] of Object.entries(raw.varietyPreset || {})) {
      if (VARIETY_KEY.test(vk) && presetKeys.has(key) && Object.keys(out.varietyPreset).length < 500) out.varietyPreset[vk] = key;
    }
    return out;
  }
  function resolveMethods(cfg) {
    const out = {};
    const ov = cfg?.methods || {};
    for (const k of METHOD_ORDER) out[k] = { key: k, label: ov[k]?.label ?? S.stock.method[k], custom: false, ...BUILTIN_METHODS[k], ...pick(ov[k]) };
    for (const [k, v] of Object.entries(ov)) {
      if (k in BUILTIN_METHODS) continue;
      out[k] = { key: k, label: v.label, custom: true, ...BUILTIN_METHODS.other, ...pick(v) };
    }
    return out;
  }
  var pick = (o) => Object.fromEntries(METHOD_PARAMS.filter((p) => o && o[p.key] != null).map((p) => [p.key, o[p.key]]));
  function resolvePresets(cfg) {
    const out = {};
    const ov = cfg?.presets || {};
    for (const k of PRESET_ORDER) out[k] = { key: k, label: ov[k]?.label ?? S.stock.preset[k], custom: false, ...BUILTIN_PRESETS[k], ...ov[k] };
    for (const [k, v] of Object.entries(ov)) {
      if (k in BUILTIN_PRESETS) continue;
      out[k] = { key: k, custom: true, maturingDays: null, useByPct: null, checkDays: null, kFactor: 1, ...v };
    }
    return out;
  }
  var varietyKey = (plant) => `${plant.category}|${(plant.variety || "").trim().toLowerCase()}`;
  var defaultPresetKey = (plant) => FRESH_CATEGORIES.includes(plant.category) ? "fresh" : "generic";
  function presetFor(plant, cfg) {
    const presets = resolvePresets(cfg);
    const key = [plant.stockPreset, plant.variety ? cfg?.varietyPreset?.[varietyKey(plant)] : null, cfg?.categoryPreset?.[plant.category], defaultPresetKey(plant)].find((k) => k && presets[k]);
    return presets[key];
  }
  function newKey(prefix, taken) {
    let key;
    do
      key = prefix + Math.random().toString(36).slice(2, 8);
    while (taken.includes(key));
    return key;
  }

  // js/stock.js
  var STOCK_UNITS = ["g", "kg", "ks"];
  var STOCK_EVENT_TYPES = ["stock_init", "stock_use", "stock_adjust", "stock_move", "stock_check"];
  var MAX_CONTAINERS = 12;
  var EPS = 1e-9;
  var LN2 = Math.LN2;
  var MAX_OPEN_LOSS = 0.3;
  var round3 = (v) => Math.round(v * 1e3) / 1e3;
  var round2 = (v) => Math.round(v * 100) / 100;
  var dayMs = 864e5;
  var findBatch = (c, id) => (c.batches || []).find((b) => b.id === id) ?? null;
  var findContainer = (st, id) => st?.containers.find((k) => k.id === id) ?? null;
  var defaultUnit = (plant) => plant.category === "herb" ? "g" : FRESH_CATEGORIES.includes(plant.category) ? "kg" : "ks";
  function convertAmount(amount, from, to) {
    if (from === to) return amount;
    if (from === "g" && to === "kg") return amount / 1e3;
    if (from === "kg" && to === "g") return amount * 1e3;
    return null;
  }
  var batchMaterial = (b) => b.fresh && (b.method == null || b.method === "none") ? "fresh" : "processed";
  function newContainer(spec, at, source) {
    return {
      id: spec.id,
      label: spec.label ?? "",
      method: spec.method,
      amount: round3(spec.amount),
      initial: round3(spec.amount),
      since: source?.since ?? at,
      segments: source?.segments ? [...source.segments, { method: spec.method, from: at }] : [{ method: spec.method, from: at }],
      opens: 0,
      used: 0,
      discarded: 0,
      lastOpenAt: null,
      lastCheckAt: null,
      lastAirAt: at,
      moldAt: null,
      checks: [],
      status: "open",
      endedAt: null,
      parent: source?.id ?? null
    };
  }
  function closeIfEmpty(k, at, discard) {
    if (k.amount > EPS) return;
    k.amount = 0;
    k.status = discard && k.used <= EPS ? "discarded" : "empty";
    k.endedAt = at;
  }
  function endBatchIfDone(b, at) {
    const st = b.stock;
    if (!st || BATCH_ENDED.includes(b.phase) || st.containers.some((k) => k.status === "open")) return;
    const phase = st.uses.length ? "used" : "discarded";
    b.phase = phase;
    b.phaseSince = at;
    b.endedAt = at;
    b.steps.push({ at, phase });
  }
  function applyStockEvent(c, e) {
    const p = e.payload || {};
    const b = findBatch(c, p.batchId);
    if (!b) return;
    const at = e.occurredAt;
    if (e.type === "stock_init") {
      if (b.stock || !Array.isArray(p.containers)) return;
      const containers = p.containers.map((s) => newContainer(s, at));
      b.stock = {
        id: e.id,
        unit: p.unit,
        source: p.source ?? "weighed",
        at,
        containers,
        uses: [],
        firstUseAt: null,
        initial: round3(containers.reduce((n, k2) => n + k2.initial, 0))
      };
      return;
    }
    const st = b.stock;
    if (!st || st.id !== p.stockId) return;
    const k = findContainer(st, p.containerId);
    if (!k || k.status !== "open") return;
    switch (e.type) {
      case "stock_use": {
        const amt = Math.min(p.amount, k.amount);
        if (!(amt > 0)) return;
        k.amount = round3(k.amount - amt);
        if (p.kind === "discard") k.discarded = round3(k.discarded + amt);
        else {
          st.uses.push({ at, amount: round3(amt), containerId: k.id });
          k.used = round3(k.used + amt);
          k.opens += 1;
          k.lastOpenAt = at;
          k.lastAirAt = at;
          st.firstUseAt = st.firstUseAt ?? at;
        }
        closeIfEmpty(k, at, p.kind === "discard");
        break;
      }
      case "stock_adjust": {
        const diff = k.amount - p.remaining;
        if (diff > EPS) {
          st.uses.push({ at, amount: round3(diff), containerId: k.id, adjust: true });
          k.used = round3(k.used + diff);
          st.firstUseAt = st.firstUseAt ?? at;
        } else if (diff < -EPS) {
          k.initial = round3(k.initial - diff);
          st.initial = round3(st.initial - diff);
        }
        k.amount = round3(p.remaining);
        closeIfEmpty(k, at, false);
        break;
      }
      case "stock_move": {
        if (p.method === k.method && !(p.amount > 0 && p.amount < k.amount - EPS)) return;
        if (p.amount > 0 && p.amount < k.amount - EPS) {
          const part = newContainer({ id: p.newContainerId, label: p.label ?? k.label, method: p.method, amount: p.amount }, at, k);
          part.checks = [];
          k.amount = round3(k.amount - p.amount);
          k.opens += 1;
          k.lastOpenAt = at;
          k.lastAirAt = at;
          st.containers.push(part);
        } else {
          k.segments.push({ method: p.method, from: at });
          k.method = p.method;
          k.opens = 0;
          k.lastAirAt = at;
          if (p.label) k.label = p.label;
        }
        break;
      }
      case "stock_check": {
        const hasRating = isNum(p.scent) || isNum(p.appearance);
        if (hasRating || p.mold != null || p.rh != null || p.note) {
          k.checks.push({
            at,
            scent: p.scent ?? null,
            appearance: p.appearance ?? null,
            mold: !!p.mold,
            rh: p.rh ?? null,
            rated: hasRating,
            method: k.method
          });
          k.lastCheckAt = at;
          if (p.mold) k.moldAt = at;
        }
        if (p.aired) k.lastAirAt = at;
        break;
      }
      default:
        break;
    }
    endBatchIfDone(b, at);
  }
  function maturingFor(seg, preset, M, material) {
    if (material === "fresh") return 0;
    const m2 = M[seg.method] ?? M.other;
    return preset && preset.method === seg.method && isNum(preset.maturingDays) ? preset.maturingDays : m2.maturingDays;
  }
  function modelAge(k, at, M, material, preset) {
    const end = Date.parse(at);
    const kFactor = preset?.kFactor ?? 1;
    let x = 0;
    k.segments.forEach((seg, i) => {
      const from = Date.parse(seg.from);
      const to = i + 1 < k.segments.length ? Date.parse(k.segments[i + 1].from) : end;
      let days = Math.max(0, Math.min(to, end) - from) / dayMs;
      if (i === 0) days = Math.max(0, days - maturingFor(seg, preset, M, material));
      const m2 = M[seg.method] ?? M.other;
      x += days / ((material === "fresh" ? m2.tHalfFresh : m2.tHalfProcessed) * kFactor);
    });
    return x;
  }
  var ratingToQ = (r) => 0.15 + (clamp(r, 1, 5) - 1) * 0.1925;
  function ownRatio(k, M, material, preset) {
    const obs = [];
    for (const ch of k.checks) {
      if (ch.mold) continue;
      const r = [ch.scent, ch.appearance].filter(isNum);
      if (!r.length) continue;
      const x = modelAge(k, ch.at, M, material, preset);
      if (x < 0.12) continue;
      const q = ratingToQ(r.reduce((a, b) => a + b, 0) / r.length);
      obs.push({ r: clamp(LN2 * x / -Math.log(q), 0.25, 4), w: Math.min(x, 1) });
    }
    const recent = obs.slice(-5);
    if (!recent.length) return null;
    const w = recent.reduce((a, o) => a + o.w, 0);
    return { r: round2(recent.reduce((a, o) => a + o.r * o.w, 0) / w), n: recent.length };
  }
  function buildStockPriors(plants, cfg) {
    const M = resolveMethods(cfg);
    const byMethod = {}, byVariety = {};
    const add = (map, key, r) => {
      const m2 = map[key] || (map[key] = { sum: 0, n: 0 });
      m2.sum += r;
      m2.n += 1;
    };
    for (const pl2 of plants) {
      const preset = presetFor(pl2, cfg);
      const vk = (pl2.variety || "").trim() ? varietyKey(pl2) : null;
      for (const b of pl2.cache?.batches || []) {
        for (const k of b.stock?.containers || []) {
          const o = ownRatio(k, M, batchMaterial(b), preset);
          if (!o) continue;
          add(byMethod, k.method, o.r);
          if (vk) add(byVariety, `${k.method}|${vk}`, o.r);
        }
      }
    }
    const fin = (map, min) => Object.fromEntries(Object.entries(map).filter(([, m2]) => m2.n >= min).map(([k, m2]) => [k, { r: round2(m2.sum / m2.n), n: m2.n }]));
    return { method: fin(byMethod, 1), variety: fin(byVariety, 2) };
  }
  function decayRatio(plant, k, own, priors) {
    const vk = (plant.variety || "").trim() ? varietyKey(plant) : null;
    const prior = vk && priors?.variety?.[`${k.method}|${vk}`] || priors?.method?.[k.method] || null;
    const base = prior?.r ?? 1;
    if (!own) return { r: base, source: prior ? "prior" : "default", n: 0 };
    return { r: round2((own.r * own.n + base) / (own.n + 1)), source: "own", n: own.n };
  }
  function containerState(plant, batch, k, now2, env2 = {}) {
    const M = env2.methods ?? resolveMethods(env2.cfg);
    const preset = env2.preset ?? presetFor(plant, env2.cfg);
    const material = batchMaterial(batch);
    const x = modelAge(k, now2, M, material, preset);
    const own = ownRatio(k, M, material, preset);
    const dr = decayRatio(plant, k, own, env2.priors?.stock);
    const cur = M[k.method] ?? M.other;
    const openLoss = Math.min(MAX_OPEN_LOSS, cur.openCost * k.opens);
    const decay = Math.exp(-LN2 * x / dr.r);
    const q = clamp(decay * (1 - openLoss), 0, 1);
    const threshold = (preset?.useByPct ?? rv(env2.rules, "stock.useByPct")) / 100;
    const seg0 = k.segments[0];
    const matureEnd = k.segments.length === 1 ? addDays(seg0.from, maturingFor(seg0, preset, M, material)) : null;
    const maturing = !!matureEnd && matureEnd > now2;
    let useByAt = null, below = false;
    if (q <= threshold + 1e-9) below = true;
    else {
      const needX = -dr.r * Math.log(threshold / (1 - openLoss)) / LN2;
      const th = (material === "fresh" ? cur.tHalfFresh : cur.tHalfProcessed) * (preset?.kFactor ?? 1);
      const days = Math.max(0, needX - x) * th + (maturing ? daysBetween(now2, matureEnd) : 0);
      useByAt = days < 36500 ? addDays(now2, days) : null;
    }
    return { q, pct: Math.round(q * 100), x, ratio: dr, maturing, maturingUntil: maturing ? matureEnd : null, useByAt, below, threshold, method: cur };
  }
  var batchRemaining = (b) => round3((b.stock?.containers || []).filter((k) => k.status === "open").reduce((n, k) => n + k.amount, 0));
  function consumptionRate(plant, now2, rules, unit) {
    const uses = [];
    for (const b of plant.cache?.batches || []) {
      if (!b.stock) continue;
      for (const u of b.stock.uses) {
        const amt = convertAmount(u.amount, b.stock.unit, unit);
        if (amt != null) uses.push({ at: u.at, amount: amt });
      }
    }
    if (!uses.length) return null;
    const first = uses.reduce((a, u) => u.at < a ? u.at : a, uses[0].at);
    const span = daysBetween(first, now2);
    if (span < rv(rules, "stock.minRateDays")) return null;
    const w = Math.min(rv(rules, "stock.rateWindowDays"), span);
    const from = addDays(now2, -w);
    const sum = uses.filter((u) => u.at >= from).reduce((n, u) => n + u.amount, 0);
    return sum > 0 ? { perDay: sum / w, windowDays: w } : null;
  }
  function plantStock(plant, now2, env2 = {}) {
    const batches = (plant.cache?.batches || []).filter((b) => b.stock);
    if (!batches.length) return null;
    const M = resolveMethods(env2.cfg), preset = presetFor(plant, env2.cfg);
    const e = { ...env2, methods: M, preset };
    const unit = batches.at(-1).stock.unit;
    let remaining = 0;
    const list = batches.map((b) => {
      const containers = b.stock.containers.map((k) => ({ k, state: k.status === "open" ? containerState(plant, b, k, now2, e) : null }));
      const left = batchRemaining(b);
      const conv = convertAmount(left, b.stock.unit, unit);
      if (conv != null) remaining += conv;
      return { batch: b, stock: b.stock, containers, remaining: left };
    });
    const rate = consumptionRate(plant, now2, env2.rules, unit);
    const runOutDays = rate && remaining > 0 ? remaining / rate.perDay : null;
    return {
      unit,
      remaining: round3(remaining),
      rate,
      runOutDays,
      runOutAt: runOutDays != null ? addDays(now2, runOutDays) : null,
      batches: list,
      preset,
      methods: M
    };
  }
  function stockTasks(plant, now2, env2 = {}) {
    const ps = plantStock(plant, now2, env2);
    if (!ps) return [];
    const out = [];
    const M = ps.methods;
    for (const { batch, containers } of ps.batches) {
      if (BATCH_ENDED.includes(batch.phase) && !containers.some(({ k }) => k.status === "open")) continue;
      for (const { k, state } of containers) {
        if (k.status !== "open" || !state) continue;
        const m2 = M[k.method] ?? M.other;
        const segFrom = k.segments.at(-1).from;
        const label = k.label || m2.label;
        const base = { batchId: batch.id, containerId: k.id, note: label };
        const lastRef = [segFrom, k.lastCheckAt].filter(Boolean).reduce((a, x) => x > a ? x : a);
        let due = addDays(lastRef, ps.preset.checkDays ?? m2.checkDays);
        const sibling = containers.find(({ k: o }) => o !== k && o.moldAt && (!k.lastCheckAt || k.lastCheckAt < o.moldAt));
        if (sibling) due = sibling.k.moldAt < due ? sibling.k.moldAt : due;
        out.push({ type: "stockCheck", due, snoozeKey: `stockCheck:${k.id}`, ...base });
        const age = daysBetween(segFrom, now2);
        if (m2.airEveryDays > 0 && age < m2.airForDays) {
          out.push({ type: "stockAir", due: addDays(k.lastAirAt ?? segFrom, m2.airEveryDays), snoozeKey: `stockAir:${k.id}`, ...base });
        }
        if (!state.maturing && (state.below || state.useByAt)) {
          out.push({ type: "stockUseBy", due: state.below ? now2 : state.useByAt, snoozeKey: `stockUseBy:${k.id}`, ...base });
        }
      }
    }
    const lowDays = rv(env2.rules, "stock.lowDays");
    if (ps.runOutDays != null && ps.runOutDays < lowDays) {
      out.push({ type: "stockLow", due: now2, snoozeKey: "stockLow", note: `~${Math.max(1, Math.round(ps.runOutDays))}`, batchId: ps.batches.find((x) => x.remaining > 0)?.batch.id });
    }
    return out;
  }
  function suggestInitial(plant, batch) {
    const unit = defaultUnit(plant);
    if (isNum(batch.processedG) && batch.processedG > 0 && unit === "g") return { amount: batch.processedG, unit, basis: "processed" };
    const w = batch.weightG;
    if (!isNum(w) || w <= 0) return { amount: null, unit, basis: "none" };
    if (batchMaterial(batch) === "fresh") return { amount: unit === "kg" ? round3(w / 1e3) : round3(w), unit, basis: "fresh" };
    const done = (plant.cache?.batches || []).filter((x) => x.stock?.source === "weighed" && isNum(x.weightG) && x.weightG > 0 && x.stock.unit === "g" && x.id !== batch.id);
    if (done.length) {
      const r = done.reduce((n, x) => n + x.stock.initial / x.weightG, 0) / done.length;
      return { amount: round3(w * r), unit: "g", basis: "learned", ratio: round2(r) };
    }
    return { amount: unit === "g" ? round3(w * 0.25) : null, unit, basis: "default", ratio: 0.25 };
  }
  function methodComparison(plants) {
    const acc = {};
    for (const pl2 of plants) {
      for (const b of pl2.cache?.batches || []) {
        for (const k of b.stock?.containers || []) {
          for (const ch of k.checks) {
            const r = [ch.scent, ch.appearance].filter(isNum);
            if (!r.length || ch.mold) continue;
            const m2 = acc[ch.method] || (acc[ch.method] = { method: ch.method, n: 0, sum: 0, lateN: 0, lateSum: 0, ageSum: 0 });
            const rating2 = r.reduce((a, x) => a + x, 0) / r.length;
            const age = daysBetween(k.since, ch.at);
            m2.n += 1;
            m2.sum += rating2;
            m2.ageSum += age;
            if (age >= 60) {
              m2.lateN += 1;
              m2.lateSum += rating2;
            }
          }
        }
      }
    }
    return Object.values(acc).map((m2) => ({
      method: m2.method,
      n: m2.n,
      avg: round2(m2.sum / m2.n),
      avgAge: Math.round(m2.ageSum / m2.n),
      lateN: m2.lateN,
      lateAvg: m2.lateN ? round2(m2.lateSum / m2.lateN) : null
    })).sort((a, b) => (b.lateAvg ?? b.avg) - (a.lateAvg ?? a.avg));
  }

  // js/calendar.js
  var stageFactor = (stage) => STAGE_FACTOR[stage] ?? 1;
  var isTerminal = (stage) => !!STAGE_FLAGS[stage]?.terminal;
  var isDormant = (stage) => !!STAGE_FLAGS[stage]?.dormant;
  var isPostHarvest = (stage) => !!STAGE_FLAGS[stage]?.postHarvest;
  var isCaredFor = (stage) => !isTerminal(stage) && !isPostHarvest(stage);
  var asOpts = (o) => typeof o === "string" ? { hemisphere: o } : o || {};
  function potFactor(pot, rules) {
    if (!pot || !isNum(pot.volumeL) && !pot.substrate) return 1;
    const sub = rv(rules, `pot.substrate.${pot.substrate || "soil"}`) ?? 1;
    const vol = isNum(pot.volumeL) ? (pot.volumeL / rv(rules, "pot.refVolumeL")) ** rv(rules, "pot.volumeExponent") : 1;
    return clamp(vol * sub, rv(rules, "pot.minFactor"), rv(rules, "pot.maxFactor"));
  }
  function baseDrying(plant, env2, stage, rules, pot) {
    const cat = plant.baseOverride ?? rv(rules, `cat.${plant.category}.soilDays`) ?? 3;
    const p = pot ?? plant.cache?.pot ?? { volumeL: plant.potVolumeL, substrate: plant.substrate };
    return cat * (ENV_MULTIPLIER[env2] ?? 1) * stageFactor(stage) * potFactor(p, rules);
  }
  function seasonModifier(iso, env2, hemisphere = "north", rules) {
    const o = asOpts(hemisphere);
    const r = o.rules ?? rules;
    return rv(r, `season.on.${env2}`) ? rv(r, `season.${seasonOf(iso, o.hemisphere || "north")}`) : 1;
  }
  function dryingInfo(plant, rules) {
    const c = plant.cache || {};
    const stage = c.stage;
    const base = baseDrying(plant, c.environment ?? plant.environment, stage, rules, c.pot);
    const learnedMap = c.soilDryDays ?? c.dryingDays;
    const learned = learnedMap?.[stage] ?? null;
    return { base, learned, d: learned ?? base, confidence: c.confidence?.[stage] ?? 0 };
  }
  var round22 = (v) => Math.round(v * 100) / 100;
  function harvestWeightG(p) {
    if (isNum(p.freshWeight)) return p.freshWeight;
    if (isNum(p.totalWeight)) return p.totalWeight * 1e3;
    return null;
  }
  function estimateDryingDays(batch, rules, learnedRatio = 1) {
    const ref = rv(rules, "drying.refDays");
    if (isNum(batch.estDays)) return batch.estDays;
    let w = batch.weightG;
    if (!isNum(w) && isNum(batch.heightCm)) w = rv(rules, "drying.refWeightG") * (batch.heightCm / rv(rules, "drying.refHeightCm")) ** 3;
    const size = isNum(w) && w > 0 ? (w / rv(rules, "drying.refWeightG")) ** rv(rules, "drying.sizeExponent") : 1;
    const env2 = rv(rules, `drying.env.${batch.env}`) ?? 1;
    return clamp(ref * size * env2 * learnedRatio, ref * rv(rules, "drying.minFactor"), ref * rv(rules, "drying.maxFactor"));
  }
  var dryingElapsed = (batch, at) => batch.phase === "drying" ? Math.max(0, daysBetween(batch.phaseSince, at)) : null;
  function effectiveDryingDays(batch, rules, ratio = 1) {
    const est = estimateDryingDays(batch, rules, ratio);
    const d = batch.dryLearn;
    if (isNum(batch.estDays) || batch.phase !== "drying" || !d || d.actual || !(d.level >= 3)) return est;
    const w = 0.5 * (d.level / 5);
    return est * (1 - w) + d.days * w;
  }
  function batchRatio(plant, batch, priors) {
    if (isNum(batch.ratio)) return batch.ratio;
    const v = (plant.variety || "").trim().toLowerCase();
    return priors?.variety?.[`${plant.category}|${v}`]?.ratio ?? priors?.category?.[plant.category]?.ratio ?? 1;
  }
  function buildDryingPriors(plants) {
    const cat = {}, variety = {};
    const add = (map, key, r) => {
      const m2 = map[key] || (map[key] = { sum: 0, n: 0 });
      m2.sum += r;
      m2.n += 1;
    };
    for (const p of plants) {
      const v = (p.variety || "").trim().toLowerCase();
      for (const b of p.cache?.batches || []) {
        if (!isNum(b.learnedR)) continue;
        add(cat, p.category, b.learnedR);
        if (v) add(variety, `${p.category}|${v}`, b.learnedR);
      }
    }
    const fin = (map, min) => Object.fromEntries(Object.entries(map).filter(([, m2]) => m2.n >= min).map(([k, m2]) => [k, { ratio: round22(m2.sum / m2.n), n: m2.n }]));
    return { category: fin(cat, 1), variety: fin(variety, 2) };
  }
  var newBatch = (e, p, k, c) => {
    const method = p.processingMethod ?? null;
    const instantlyReady = method === "none";
    return {
      id: p.batchId || e.id,
      harvestedAt: e.occurredAt,
      final: !!p.final,
      fresh: FRESH_CATEGORIES.includes(k.category),
      weightG: harvestWeightG(p),
      processedG: isNum(p.processedWeight) ? p.processedWeight : null,
      estDays: isNum(p.estDays) ? p.estDays : null,
      heightCm: c.lastHeightCm ?? null,
      env: k.env,
      method,
      phase: method == null ? "pending" : instantlyReady ? "ready" : method,
      phaseSince: e.occurredAt,
      readyAt: instantlyReady ? e.occurredAt : null,
      endedAt: null,
      legacy: false,
      checks: [],
      lastCheckAt: null,
      evals: [],
      steps: [],
      stock: null,
      dryLearn: null,
      dryDays: null,
      learnedR: null,
      ratio: null
    };
  };
  var findBatch2 = (c, id) => c.batches.find((b) => b.id === id) ?? null;
  function learnDrying(b, dryness, at) {
    const t = dryingElapsed(b, at);
    if (t == null || t < 0.5 || !isNum(dryness) || dryness < 1 || b.dryLearn?.actual) return;
    b.dryLearn = dryness >= 5 ? { days: t, actual: true, level: 5, at } : { days: t * 5 / dryness, actual: false, level: dryness, at };
    if (dryness >= 5) b.dryDays = round22(t);
  }
  var cal = (ctx2) => ctx2.cal;
  var calendarProjector = {
    init(ctx2) {
      const c = ctx2.cache;
      c.soilDryDays = { ...ctx2.plant.learnedBase || {} };
      c.confidence = {};
      c.learn = {};
      c.recheckAt = null;
      c.lastHarvestAt = null;
      c.harvestDates = [];
      c.finalHarvestAt = null;
      c.evaluations = [];
      c.batches = [];
      c.dryLearn = { ratio: null, n: 0 };
      c.lastHeightCm = null;
      c.pot = { volumeL: isNum(ctx2.plant.potVolumeL) ? ctx2.plant.potVolumeL : null, substrate: ctx2.plant.substrate ?? null };
      ctx2.cal = { stage: null, env: null, water: ctx2.plant.startDate, archived: false, category: ctx2.plant.category };
    },
    apply(e, ctx2) {
      const c = ctx2.cache, k = cal(ctx2), p = e.payload || {};
      const rules = ctx2.opts?.rules;
      switch (e.type) {
        case "created":
          k.env = p.environment;
          break;
        case "stage_change": {
          const prev = k.stage;
          if (prev && c.soilDryDays[prev] != null && c.soilDryDays[p.to] == null) {
            c.soilDryDays[p.to] = round22(c.soilDryDays[prev] * stageFactor(p.to) / stageFactor(prev));
            c.confidence[p.to] = round22((c.confidence[prev] || 0) / 2);
          }
          k.stage = p.to;
          break;
        }
        case "environment_change": {
          const from = k.env;
          if (from && from !== p.environment) {
            const ratio = (ENV_MULTIPLIER[p.environment] ?? 1) / (ENV_MULTIPLIER[from] ?? 1);
            for (const st of Object.keys(c.soilDryDays)) {
              c.soilDryDays[st] = round22(c.soilDryDays[st] * ratio);
              c.confidence[st] = round22((c.confidence[st] || 0) / 2);
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
        case "measurement":
          if (p.kind === "v\xFD\u0161ka" && isNum(p.value) && p.value > 0) c.lastHeightCm = p.value;
          break;
        case "care":
          if (p.kind === "repotting" && isNum(p.potVolumeL)) {
            const before = potFactor(c.pot, rules);
            c.pot = { ...c.pot, volumeL: p.potVolumeL };
            const ratio = potFactor(c.pot, rules) / before;
            if (ratio !== 1) {
              for (const st of Object.keys(c.soilDryDays)) {
                c.soilDryDays[st] = round22(c.soilDryDays[st] * ratio);
                c.confidence[st] = round22((c.confidence[st] || 0) / 2);
              }
            }
          }
          break;
        case "harvest":
          c.lastHarvestAt = e.occurredAt;
          c.harvestDates.push(e.occurredAt);
          if (p.final) c.finalHarvestAt = e.occurredAt;
          c.batches.push(newBatch(e, p, k, c));
          break;
        case "batch_step": {
          const b = findBatch2(c, p.batchId);
          if (!b) break;
          if (b.phase === "drying" && p.phase !== "drying" && p.phase !== "discarded" && !b.dryLearn?.actual) {
            const t = dryingElapsed(b, e.occurredAt);
            if (t >= 0.5) {
              b.dryLearn = { days: t, actual: true, level: 5, at: e.occurredAt };
              b.dryDays = round22(t);
            }
          }
          b.phase = p.phase;
          b.phaseSince = e.occurredAt;
          if (p.method) b.method = p.method;
          else if (PROCESSING_PHASES.includes(p.phase)) b.method = p.phase;
          if (isNum(p.estDays)) b.estDays = p.estDays;
          if (p.phase === "ready") b.readyAt = e.occurredAt;
          if (BATCH_ENDED.includes(p.phase)) b.endedAt = e.occurredAt;
          b.steps.push({ at: e.occurredAt, phase: p.phase });
          break;
        }
        case "batch_check": {
          const b = findBatch2(c, p.batchId);
          if (!b) break;
          b.checks.push({
            at: e.occurredAt,
            phase: b.phase,
            dryness: p.dryness ?? null,
            mold: p.mold ?? null,
            scent: p.scent ?? null,
            appearance: p.appearance ?? null
          });
          b.lastCheckAt = e.occurredAt;
          learnDrying(b, p.dryness, e.occurredAt);
          break;
        }
        case "evaluation": {
          const kind = p.kind ?? "final";
          c.evaluations.push({ at: e.occurredAt, season: p.season ?? null, kind, batchId: p.batchId ?? null });
          const target = p.batchId ? findBatch2(c, p.batchId) : kind === "final" ? c.batches.at(-1) ?? null : null;
          if (target) target.evals.push({ at: e.occurredAt, kind, part: p.part ?? null });
          break;
        }
        case "stock_init":
        case "stock_use":
        case "stock_adjust":
        case "stock_move":
        case "stock_check":
          applyStockEvent(c, e);
          break;
        case "archive":
          k.archived = true;
          break;
        case "unarchive":
          k.archived = false;
          break;
        default:
          break;
      }
    },
    finalize(ctx2) {
      const c = ctx2.cache, k = cal(ctx2);
      const ask = c.stage === "harvested" && !k.archived;
      for (const b of c.batches) {
        if (b.phase === "pending" && !ask) {
          b.phase = "ready";
          b.legacy = true;
          b.readyAt = b.harvestedAt;
        }
      }
      const rules = ctx2.opts?.rules, blendOld = rv(rules, "drying.blendOld");
      let ratio = null, n = 0;
      for (const b of c.batches) {
        b.ratio = ratio;
        if (!b.dryLearn?.actual) continue;
        const model = estimateDryingDays({ ...b, estDays: null }, rules, 1);
        const r = clamp(b.dryLearn.days / model, rv(rules, "drying.minFactor"), rv(rules, "drying.maxFactor"));
        b.learnedR = round22(r);
        const wNew = Math.max(1 - blendOld, 1 / (n + 2));
        ratio = round22((1 - wNew) * (ratio ?? 1) + wNew * r);
        n += 1;
      }
      c.dryLearn = { ratio, n };
    }
  };
  registerProjector(calendarProjector);
  function learn(e, ctx2) {
    const c = ctx2.cache, k = cal(ctx2), answer = e.payload.answer, stage = k.stage;
    const env2 = k.env, rules = ctx2.opts?.rules;
    const base = baseDrying(ctx2.plant, env2, stage, rules, c.pot);
    let d = c.soilDryDays[stage] ?? base;
    const mod = seasonModifier(e.occurredAt, env2, ctx2.opts?.hemisphere, rules);
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
      c.soilDryDays[stage] = round22(d);
      c.confidence[stage] = round22(Math.min(st.n / LEARN.confidenceN, 1) * (1 - Math.min(coefVariation(st.implied), 1)));
    }
    c.recheckAt = answer === "wet" ? addDays(e.occurredAt, Math.max(1, Math.ceil((c.soilDryDays[stage] ?? d) * RULE.recheckFraction))) : null;
  }
  var SNOOZE_KEY = {
    moisture: "watering",
    fertilizing: "fertilizing",
    pestCheck: "pestCheck",
    problemFollowUp: "problemFollowUp",
    evaluation: "evaluation",
    evaluationReview: "evaluation"
  };
  function pestInterval(plant, now2, rules) {
    const c = plant.cache;
    const base = rv(rules, `cat.${plant.category}.pestCheckDays`) ?? CATEGORIES[plant.category].pestCheckDays;
    const boosted = c.pestBoostUntil && now2 < c.pestBoostUntil;
    if (!boosted) return base;
    if (c.openProblems.some((x) => x.problemType === "mold" && x.severity >= 2)) return 2;
    return Math.max(1, Math.round(base / 2));
  }
  function nextMoistureDue(plant, now2, hemisphere = "north") {
    const o = asOpts(hemisphere);
    const c = plant.cache, env2 = c.environment ?? plant.environment;
    if (c.recheckAt) return c.recheckAt;
    const { d } = dryingInfo(plant, o.rules);
    const last = c.lastWateredAt ?? plant.startDate;
    return addDays(last, d * seasonModifier(now2, env2, o.hemisphere, o.rules));
  }
  function nextFertilizingDue(plant, rules) {
    const c = plant.cache;
    if (!isCaredFor(c.stage) || isDormant(c.stage)) return null;
    const planned = plant.plannedHarvestAt;
    const stop = rv(rules, "fertilizing.stopBeforeHarvestDays");
    const factor = c.stage === "fruiting" ? rv(rules, "fertilizing.fruitingFactor") : 1;
    const days = rv(rules, `cat.${plant.category}.fertilizingDays`) * factor;
    const due = c.lastFertilizedAt ? addDays(c.lastFertilizedAt, days) : addDays(plant.startDate, rv(rules, "fertilizing.firstFeedDays"));
    if (stop > 0 && planned && due >= addDays(planned, -stop)) return null;
    return due;
  }
  function batchCheckInterval(batch, rules, now2, ratio = batch.ratio ?? 1) {
    const last = batch.lastCheckAt && batch.lastCheckAt > batch.phaseSince ? batch.lastCheckAt : batch.phaseSince;
    const lastCheck = batch.checks.at(-1);
    let days = null;
    switch (batch.phase) {
      case "drying": {
        const t = daysBetween(batch.phaseSince, last);
        const remaining = Math.max(0, effectiveDryingDays(batch, rules, ratio) - t);
        days = clamp(rv(rules, "batch.drying.fraction") * remaining, rv(rules, "batch.drying.minDays"), rv(rules, "batch.drying.maxDays"));
        if ((lastCheck?.dryness ?? 0) >= 4) days = Math.min(days, rv(rules, "batch.drying.nearDays"));
        break;
      }
      case "curing": {
        const age = daysBetween(batch.phaseSince, last);
        days = age < 7 ? rv(rules, "batch.curing.firstWeekDays") : age < 28 ? rv(rules, "batch.curing.monthDays") : rv(rules, "batch.curing.laterDays");
        break;
      }
      case "fermenting":
        days = rv(rules, "batch.fermenting.days");
        break;
      case "pickling":
        days = rv(rules, "batch.pickling.days");
        break;
      case "storing":
        days = rv(rules, batch.fresh ? "batch.storing.freshDays" : "batch.storing.driedDays");
        break;
      default:
        return null;
    }
    if (lastCheck?.mold && lastCheck.at === batch.lastCheckAt) days = Math.min(days, 1);
    return { days, last };
  }
  var reminderOffsets = (batch, rules) => batch.fresh ? [rv(rules, "eval.freshRemind1Days"), rv(rules, "eval.freshRemind2Days")] : [rv(rules, "eval.remind1Days"), rv(rules, "eval.remind2Days"), rv(rules, "eval.remind3Days")];
  var anchorOf = (b) => b.readyAt ?? (b.phase === "used" ? b.endedAt : null);
  function pickReminder(anchor, offsets, now2) {
    const dates = offsets.map((n) => addDays(anchor, n));
    const passed = dates.filter((x) => x <= now2);
    return passed.length ? passed[passed.length - 1] : dates[0];
  }
  function evaluationDue(plant, now2, rules) {
    const c = plant.cache;
    if (!plant.harvestable || plant.reminders === false) return null;
    const anchored = c.batches.filter((b2) => !b2.legacy || !plant.archivedAt).filter((b2) => b2.phase !== "discarded" && anchorOf(b2));
    if (!anchored.length) return null;
    const finals = c.evaluations.filter((x) => x.kind === "final");
    const lastBatch = (list) => list.reduce((a, b2) => anchorOf(a) >= anchorOf(b2) ? a : b2);
    if (plant.lifecycle === "perennial") {
      const year = (b3) => new Date(b3.harvestedAt).getFullYear();
      const seasonOfEval = (x) => x.season ?? (x.batchId ? year(c.batches.find((b3) => b3.id === x.batchId) ?? { harvestedAt: x.at }) : null);
      const missing = [...new Set(anchored.map(year))].sort().filter((y2) => !finals.some((x) => seasonOfEval(x) === y2));
      if (!missing.length) return null;
      const y = missing.at(-1);
      const b2 = lastBatch(anchored.filter((x) => year(x) === y));
      return { type: "evaluation", due: pickReminder(anchorOf(b2), reminderOffsets(b2, rules), now2), season: y, batchId: b2.id };
    }
    const b = lastBatch(anchored);
    if (!finals.length) return { type: "evaluation", due: pickReminder(anchorOf(b), reminderOffsets(b, rules), now2), season: null, batchId: b.id };
    if (finals.length === 1) {
      const due = addDays(finals[0].at, rv(rules, "eval.reviewDays"));
      if (now2 >= due) return { type: "evaluationReview", due, season: finals[0].season, batchId: finals[0].batchId };
    }
    return null;
  }
  function getPlantTasks(plant, now2, opts = {}) {
    const o = asOpts(opts), rules = o.rules, hemisphere = o.hemisphere || "north";
    const c = plant.cache;
    if (!c) return [];
    const out = [];
    const push = (type, due, extra = {}) => out.push({
      plantId: plant.id,
      plantName: plant.name,
      type,
      snoozeKey: extra.snoozeKey ?? SNOOZE_KEY[type],
      dueAt: due,
      ...extra
    });
    const caring = !plant.archivedAt && isCaredFor(c.stage);
    if (caring) {
      push("moisture", nextMoistureDue(plant, now2, { hemisphere, rules }));
      const fert = nextFertilizingDue(plant, rules);
      if (fert) push("fertilizing", fert);
      push("pestCheck", addDays(c.lastPestCheckAt ?? plant.startDate, pestInterval(plant, now2, rules)));
      for (const pr of c.openProblems) {
        const ref = c.lastPestCheckAt && c.lastPestCheckAt > pr.since ? c.lastPestCheckAt : pr.since;
        const due = addDays(ref, FOLLOWUP_DAYS);
        if (due <= addDays(pr.since, PEST_BOOST_DAYS)) push("problemFollowUp", due, { problemId: pr.id });
      }
    }
    for (const b of c.batches) {
      if (b.legacy || BATCH_ENDED.includes(b.phase) || b.phase === "pending") continue;
      const iv = batchCheckInterval(b, rules, now2, batchRatio(plant, b, o.priors));
      const inStock = b.stock?.containers.some((k) => k.status === "open");
      if (iv && !(inStock && b.phase === "storing")) push("batchCheck", addDays(iv.last, iv.days), { batchId: b.id, phase: b.phase, snoozeKey: `batchCheck:${b.id}` });
      if (b.fresh && !b.stock && ["storing", "ready"].includes(b.phase)) {
        push("useBy", addDays(b.harvestedAt, rv(rules, `useBy.${plant.category}`) ?? 10), { batchId: b.id, snoozeKey: `useBy:${b.id}` });
      }
    }
    for (const t of stockTasks(plant, now2, { rules, cfg: o.stockCfg, priors: o.priors })) {
      const { type, due, ...extra } = t;
      push(type, due, extra);
    }
    const ev = evaluationDue(plant, now2, rules);
    if (ev) push(ev.type, ev.due, { season: ev.season, batchId: ev.batchId });
    return out.filter((t) => {
      const until = c.snoozedUntil?.[t.snoozeKey];
      return !(until && until > now2);
    });
  }
  var ORDER = { overdue: 0, today: 1, upcoming: 2 };
  function computeTasks(plants, now2, opts = {}) {
    const out = [];
    const look = rv(asOpts(opts).rules, "dashboard.lookaheadDays");
    for (const plant of plants) {
      for (const t of getPlantTasks(plant, now2, opts)) {
        const daysUntil = dayDiff(now2, t.dueAt);
        if (daysUntil > look) continue;
        out.push({ ...t, daysUntil, urgency: daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : "upcoming" });
      }
    }
    return out.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency] || (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0));
  }

  // js/criteria.js
  var CRITERIA_MAX = 12;
  var LABEL_MAX2 = 40;
  var KEY = /^[a-z][a-zA-Z0-9_]{0,31}$/;
  var clean2 = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, LABEL_MAX2);
  var defaults = (category) => (CATEGORIES[category]?.criteria || []).map((key) => ({ key, label: S.criterion[key] || key }));
  var same = (a, b) => a.length === b.length && a.every((x, i) => x.key === b[i].key && x.label === b[i].label && !x.removed);
  function cleanCriteria(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [cat, list] of Object.entries(raw)) {
      if (!CATEGORIES[cat] || !Array.isArray(list)) continue;
      const seen = /* @__PURE__ */ new Set(["overall"]);
      const items = [];
      for (const it of list.slice(0, CRITERIA_MAX)) {
        if (!it || typeof it !== "object" || typeof it.key !== "string" || !KEY.test(it.key) || seen.has(it.key)) continue;
        const label = clean2(it.label);
        if (!label) continue;
        seen.add(it.key);
        items.push(it.removed ? { key: it.key, label, removed: true } : { key: it.key, label });
      }
      if (!same(items, defaults(cat))) out[cat] = items;
    }
    return out;
  }
  var criteriaEntries = (category, custom) => custom?.[category] ?? defaults(category);
  var activeCriteria = (category, custom) => criteriaEntries(category, custom).filter((c) => !c.removed);
  function criterionLabel(key, custom, category) {
    if (key === "overall") return S.criterion.overall;
    const pools = category && custom?.[category] ? [custom[category]] : [];
    for (const list of [...pools, ...Object.values(custom || {})]) {
      const hit = list.find((c) => c.key === key);
      if (hit) return hit.label;
    }
    return S.criterion[key] ?? null;
  }
  var slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().split(" ").filter(Boolean).map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join("");
  function newCriterionKey(label, taken) {
    const base = `c${slug(label) ? slug(label)[0].toUpperCase() + slug(label).slice(1) : "X"}`.slice(0, 28);
    let key = base, i = 2;
    while (taken.includes(key) || key === "overall") key = `${base}${i++}`;
    return key;
  }

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
      preselect: { category: "houseplant", environment: "indoor", lifecycle: "perennial", harvestable: false },
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
  var clean3 = (v) => String(v).replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 100);
  function parseAcquisition(search) {
    const q = new URLSearchParams(search || "");
    const profile = isProfile(q.get("profile")) ? q.get("profile") : null;
    const utm = {};
    for (const k of UTM_KEYS) {
      const v = q.get(k);
      if (v != null && clean3(v)) utm[k] = clean3(v);
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
  var ctx = { db: null, hemisphere: "north", profile: null, overrides: {}, rules: resolveRules(), criteria: {}, stockCfg: cleanStock(null), priors: { category: {}, variety: {}, stock: { method: {}, variety: {} } } };
  var now = () => (/* @__PURE__ */ new Date()).toISOString();
  async function initCtx(db) {
    ctx.db = db;
    ctx.hemisphere = await metaGet(db, "hemisphere") === "south" ? "south" : "north";
    ctx.profile = await getProfile(db);
    ctx.overrides = cleanRules(await metaGet(db, "rules"));
    ctx.rules = resolveRules(ctx.overrides);
    ctx.criteria = cleanCriteria(await metaGet(db, "criteria"));
    ctx.stockCfg = cleanStock(await metaGet(db, "stock"));
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
    ctx.priors = buildPriors(plants);
    return { plants, byPlant, events };
  }
  async function refreshPriors() {
    ctx.priors = buildPriors(await listPlants(ctx.db));
    return ctx.priors;
  }
  var buildPriors = (plants) => ({ ...buildDryingPriors(plants), stock: buildStockPriors(plants, ctx.stockCfg) });
  var engineOpts = () => ({ hemisphere: ctx.hemisphere, rules: ctx.rules, priors: ctx.priors, criteria: ctx.criteria, stockCfg: ctx.stockCfg });
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
    ENGINE_REV: () => ENGINE_REV,
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
  var ENGINE_REV = 4;
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
    "void",
    "batch_step",
    "batch_check",
    "care",
    "harvest_edit",
    ...STOCK_EVENT_TYPES
  ];
  var ARCHIVED_OK = ["unarchive", "evaluation", "note", "photo", "void", "batch_step", "batch_check", ...STOCK_EVENT_TYPES];
  var COMPLETES = {
    watering: ["watering"],
    moisture_check: ["watering"],
    fertilizing: ["fertilizing"],
    pest_check: ["pestCheck", "problemFollowUp"],
    evaluation: ["evaluation"]
  };
  var bad = (msg = S.err.invalid) => new PhenoError("invalid", msg);
  var str = (v) => typeof v === "string" && v.trim().length > 0;
  function validatePayload(type, payload, plant, live, cur, opts = {}) {
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
        if (p.estDays != null) {
          if (!isNum(p.estDays) || p.estDays < 0.5 || p.estDays > 120) throw bad();
          out.estDays = p.estDays;
        }
        if (p.note) out.note = String(p.note);
        if (!Object.keys(out).length) throw bad();
        if (p.final) out.final = true;
        return out;
      }
      case "harvest_edit": {
        const target = live.find((e) => e.id === p.harvestId && e.type === "harvest");
        if (!target) throw bad();
        const out = validatePayload("harvest", p, plant, live, cur, opts);
        out.harvestId = target.id;
        if (p.date != null) {
          const t = Date.parse(p.date);
          if (!Number.isFinite(t)) throw bad();
          const first = live.filter((e) => e.payload?.batchId === target.id && e.id !== target.id).map((e) => Date.parse(e.occurredAt));
          if (first.some((x) => t > x)) throw bad(S.err.harvestDate);
          out.date = p.date;
        }
        return out;
      }
      case "batch_step": {
        const b = openBatch(cur, p.batchId);
        if (!BATCH_PHASES.includes(p.phase)) throw bad();
        const out = { batchId: b.id, phase: p.phase };
        if (p.method != null) {
          if (!PROCESSING_METHODS.includes(p.method)) throw bad();
          out.method = p.method;
        }
        if (p.estDays != null) {
          if (!isNum(p.estDays) || p.estDays < 0.5 || p.estDays > 120) throw bad();
          out.estDays = p.estDays;
        }
        if (p.note) out.note = String(p.note);
        return out;
      }
      case "batch_check": {
        const b = openBatch(cur, p.batchId);
        const out = { batchId: b.id };
        if (p.dryness != null) {
          if (!Number.isInteger(p.dryness) || p.dryness < 0 || p.dryness > DRYNESS_MAX) throw bad();
          out.dryness = p.dryness;
        }
        if (p.mold != null) out.mold = !!p.mold;
        for (const k of ["scent", "appearance"]) {
          if (p[k] == null) continue;
          if (!Number.isInteger(p[k]) || p[k] < 1 || p[k] > RATING_MAX) throw bad();
          out[k] = p[k];
        }
        if (p.note) out.note = String(p.note);
        if (p.photoId) out.photoId = String(p.photoId);
        if (Object.keys(out).length < 2) throw bad();
        return out;
      }
      case "stock_init":
      case "stock_use":
      case "stock_adjust":
      case "stock_move":
      case "stock_check":
        return validateStock(type, p, plant, cur, opts);
      case "care": {
        if (!CARE_KINDS.includes(p.kind)) throw bad();
        const out = { kind: p.kind };
        if (p.kind === "custom") {
          if (!str(p.label)) throw bad();
          out.label = p.label.trim().slice(0, 80);
        }
        if (p.potVolumeL != null) {
          if (!isNum(p.potVolumeL) || p.potVolumeL <= 0) throw bad();
          out.potVolumeL = p.potVolumeL;
        }
        if (p.note) out.note = String(p.note);
        return out;
      }
      case "evaluation": {
        if (!plant.harvestable && plant.lifecycle !== "perennial") throw bad(S.err.notHarvestable);
        const scores = p.scores || {};
        const allowed = ["overall", ...activeCriteria(plant.category, opts.criteria).map((c2) => c2.key)];
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
        if (p.batchId != null) {
          const b = (cur?.cache?.batches || []).find((x) => x.id === p.batchId);
          if (!b) throw bad();
          res.batchId = b.id;
        }
        if (p.part) res.part = String(p.part).trim().slice(0, 80);
        const c = cur?.cache;
        const afterHarvest = res.batchId || res.season != null || c?.finalHarvestAt || ["harvested", "done", "dormant"].includes(c?.stage) || (c?.batches || []).some((b) => b.readyAt || b.phase === "used");
        const kind = p.kind ?? (afterHarvest ? "final" : "tasting");
        if (!EVAL_KINDS.includes(kind)) throw bad();
        res.kind = kind;
        return res;
      }
      case "archive":
      case "unarchive":
        return {};
      case "void": {
        const voided = new Set((opts.rawEvents || []).filter((e) => e.type === "void").map((e) => e.payload.targetId));
        const target = live.find((e) => e.id === p.targetId) || (opts.rawEvents || []).find((e) => e.id === p.targetId && e.type === "harvest_edit" && !voided.has(e.id));
        if (!target || target.type === "created") throw bad();
        return { targetId: p.targetId, ...p.reason ? { reason: String(p.reason) } : {} };
      }
      default:
        throw bad();
    }
  }
  var amountOk = (v) => isNum(v) && v > 0 && v < 1e7;
  var idOk = (v) => typeof v === "string" && /^[\w.-]{1,60}$/.test(v);
  function validateStock(type, p, plant, cur, opts) {
    const methods = resolveMethods(opts.stockCfg);
    const b = (cur?.cache?.batches || []).find((x) => x.id === p.batchId);
    if (!plant.harvestable || !b) throw bad();
    if (opts.at && Date.parse(opts.at) < Date.parse(b.stock?.at ?? b.harvestedAt)) throw bad(S.err.stockDate);
    if (type === "stock_init") {
      if (b.stock || b.phase === "pending" || BATCH_ENDED.includes(b.phase)) throw bad(S.err.stockInit);
      if (!STOCK_UNITS.includes(p.unit)) throw bad();
      if (!Array.isArray(p.containers) || !p.containers.length || p.containers.length > MAX_CONTAINERS) throw bad();
      const taken = new Set((cur.cache.batches || []).flatMap((x) => (x.stock?.containers || []).map((k2) => k2.id)));
      const containers = p.containers.map((s) => {
        if (!s || !idOk(s.id) || taken.has(s.id) || !amountOk(s.amount) || !methods[s.method]) throw bad();
        taken.add(s.id);
        return { id: s.id, amount: s.amount, method: s.method, ...s.label ? { label: String(s.label).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) } : {} };
      });
      return { batchId: b.id, unit: p.unit, containers, source: p.source === "estimate" ? "estimate" : "weighed" };
    }
    const st = b.stock;
    if (!st) throw bad(S.err.noStock);
    const k = st.containers.find((x) => x.id === p.containerId);
    if (!k || k.status !== "open") throw bad(S.err.noStock);
    const out = { batchId: b.id, stockId: st.id, containerId: k.id };
    switch (type) {
      case "stock_use":
        if (!amountOk(p.amount) || p.amount > k.amount + 1e-9) throw bad(S.err.stockAmount);
        out.amount = p.amount;
        if (p.kind === "discard") {
          out.kind = "discard";
          if (p.reason) out.reason = String(p.reason).slice(0, 80);
        }
        return out;
      case "stock_adjust":
        if (!isNum(p.remaining) || p.remaining < 0 || p.remaining > 1e7) throw bad();
        out.remaining = p.remaining;
        return out;
      case "stock_move": {
        if (!methods[p.method]) throw bad();
        const partial = p.amount != null && p.amount < k.amount - 1e-9;
        if (p.amount != null && !amountOk(p.amount)) throw bad();
        if (p.amount != null && p.amount > k.amount + 1e-9) throw bad(S.err.stockAmount);
        if (!partial && p.method === k.method) throw bad();
        out.method = p.method;
        if (partial) {
          const taken = new Set((cur.cache.batches || []).flatMap((x) => (x.stock?.containers || []).map((c) => c.id)));
          if (!idOk(p.newContainerId) || taken.has(p.newContainerId)) throw bad();
          out.amount = p.amount;
          out.newContainerId = p.newContainerId;
        }
        if (p.label) out.label = String(p.label).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40);
        return out;
      }
      default: {
        for (const f of ["scent", "appearance"]) {
          if (p[f] == null) continue;
          if (!Number.isInteger(p[f]) || p[f] < 1 || p[f] > RATING_MAX) throw bad();
          out[f] = p[f];
        }
        if (p.mold != null) out.mold = !!p.mold;
        if (p.rh != null) {
          if (!isNum(p.rh) || p.rh < 0 || p.rh > 100) throw bad();
          out.rh = p.rh;
        }
        if (p.aired) out.aired = true;
        if (p.note) out.note = String(p.note).slice(0, 300);
        if (Object.keys(out).length <= 3) throw bad();
        return out;
      }
    }
  }
  function openBatch(cur, id) {
    const b = (cur?.cache?.batches || []).find((x) => x.id === id);
    if (!b || BATCH_ENDED.includes(b.phase)) throw bad();
    return b;
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
      const occurredAt = inp.occurredAt || now2;
      const payload = validatePayload(inp.type, inp.payload, plant, live, cur, { ...opts, rawEvents: all, at: occurredAt });
      const id = uid();
      if (inp.type === "harvest") payload.batchId = id;
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
      const ev = { id, plantId: plant.id, type: inp.type, occurredAt, recordedAt: now2, payload };
      built.push(ev);
      all = all.concat(ev);
    }
    return built;
  }
  async function readOpts(s) {
    const h2 = await idbReq(s.meta.get("hemisphere"));
    const r = await idbReq(s.meta.get("rules"));
    const cr = await idbReq(s.meta.get("criteria"));
    const st = await idbReq(s.meta.get("stock"));
    return { hemisphere: h2?.value === "south" ? "south" : "north", rules: resolveRules(cleanRules(r?.value)), criteria: cleanCriteria(cr?.value), stockCfg: cleanStock(st?.value) };
  }
  function appendEvents(db, plantId, inputs, { now: now2 } = {}) {
    return withTx(db, ["plants", "events", "meta"], "readwrite", async (s) => {
      const plant = await idbReq(s.plants.get(plantId));
      if (!plant) throw bad();
      const opts = await readOpts(s);
      const existing = await idbReq(s.events.index("plantId").getAll(plantId));
      const events = buildEvents(plant, existing, inputs, now2, opts);
      const snoozed = { ...plant.cache?.snoozedUntil || {} };
      for (const e of events) {
        for (const k of COMPLETES[e.type] || []) delete snoozed[k];
        const cid = e.payload?.containerId;
        if (cid && e.type === "stock_check") for (const k of [`stockCheck:${cid}`, `stockAir:${cid}`]) delete snoozed[k];
        if (cid && e.type === "stock_use") delete snoozed[`stockUseBy:${cid}`];
        const bid = e.payload?.batchId;
        if (bid && ["batch_check", "batch_step", "evaluation"].includes(e.type)) {
          for (const k of [`batchCheck:${bid}`, `useBy:${bid}`, `evaluation:${bid}`]) delete snoozed[k];
        }
      }
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
      let ok = 0;
      for (const pl2 of plants) {
        const evs = await idbReq(s.events.index("plantId").getAll(pl2.id));
        try {
          s.plants.put(projectPlant(pl2, evs, opts));
          ok += 1;
        } catch (e) {
          console.error("rebuild failed for", pl2.id, e);
        }
      }
      return ok;
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
      for (const k of ["potVolumeL", "substrate", "plannedHarvestAt"]) {
        if (!(k in patch)) continue;
        if (patch[k] == null || patch[k] === "") delete next[k];
        else {
          const v = optionalPot({ [k]: patch[k] });
          if (!(k in v)) throw bad();
          next[k] = v[k];
        }
      }
      if ("stockPreset" in patch) {
        if (isPresetKey(patch.stockPreset)) next.stockPreset = patch.stockPreset;
        else delete next.stockPreset;
      }
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
      const m2 = path.match(r.re);
      if (!m2) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m2[i + 1])]));
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
  var VERSION = "RCv0.192";

  // js/backup.js
  var SCHEMA_VERSION = 3;
  var PORTABLE_META = ["hemisphere", "profile", "profileSource", "acquisition", "rules", "criteria", "stock"];
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
      ...optionalPot(p),
      ...isPresetKey(p.stockPreset) ? { stockPreset: p.stockPreset } : {},
      archivedAt: null,
      cache: emptyCache()
    };
  }
  function cleanEvent(e) {
    if (!isObj(e) || !isId(e.id) || !isId(e.plantId) || !EVENT_TYPES.includes(e.type)) return null;
    if (!isDate(e.occurredAt) || !isDate(e.recordedAt) || !isObj(e.payload)) return null;
    if (JSON.stringify(e.payload).length > MAX_TEXT) return null;
    if (["batch_step", "batch_check"].includes(e.type) && !isId(e.payload.batchId)) return null;
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
    if ("rules" in meta) {
      meta.rules = cleanRules(meta.rules);
      if (!Object.keys(meta.rules).length) delete meta.rules;
    }
    if ("stock" in meta) {
      meta.stock = cleanStock(meta.stock);
      if (!Object.values(meta.stock).some((v) => Object.keys(v).length)) delete meta.stock;
    }
    if ("criteria" in meta) {
      meta.criteria = cleanCriteria(meta.criteria);
      if (!Object.keys(meta.criteria).length) delete meta.criteria;
    }
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
  var same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
      if (cur.plantId !== e.plantId || cur.type !== e.type || cur.occurredAt !== e.occurredAt || !same2(cur.payload, e.payload)) {
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
    const since = last ?? events.reduce((m2, e) => e.recordedAt < m2 ? e.recordedAt : m2, events[0].recordedAt);
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
  var num3 = (v, digits = 1) => (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString("cs-CZ");
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
        h("h3", {}, S.rules.open),
        h("p", { class: "muted" }, S.rules.openHint),
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-rules", onclick: () => navigate("/settings/rules") }, S.rules.open)
      ),
      h(
        "div",
        { class: "card pad" },
        h("h3", {}, S.stock.settingsTitle),
        h("p", { class: "muted" }, S.stock.settingsIntro),
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-stock-cfg", onclick: () => navigate("/settings/stock") }, S.stock.settingsTitle)
      ),
      h(
        "div",
        { class: "card pad" },
        h("h3", {}, S.crit.open),
        h("p", { class: "muted" }, S.crit.openHint),
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-criteria", onclick: () => navigate("/settings/criteria") }, S.crit.open)
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
  var DONE_TYPES = ["watering", "moisture_check", "fertilizing", "pest_check", "batch_check"];
  function doneToday(events, now2) {
    return liveEvents(events).filter((e) => DONE_TYPES.includes(e.type) && dayDiff(e.occurredAt, now2) === 0).length;
  }
  function latestPhotoId(events) {
    const photos = liveEvents(events).filter((e) => e.type === "photo");
    return photos.length ? photos.at(-1).payload.photoId : null;
  }
  function describeEvent(e, units = {}) {
    const p = e.payload || {};
    const unit = units[p.batchId] ?? "";
    const mlabel = (k) => S.stock.method[k] ?? S.stock.method.other;
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
        return { icon: "thermo", title: `M\u011B\u0159en\xED: ${p.kind}`, detail: `${num3(p.value, 2)}${p.unit ? ` ${p.unit}` : ""}` };
      case "milestone":
        return { icon: "flag", title: p.label, detail: "" };
      case "harvest":
        return { icon: "leaf", title: p.final ? "Posledn\xED sklize\u0148" : "Sklize\u0148", detail: S.processing[p.processingMethod] || "" };
      case "batch_step":
        return { icon: "stage", title: `D\xE1vka: ${S.batchPhase[p.phase] || p.phase}`, detail: p.note || "" };
      case "batch_check": {
        const bits = [
          p.dryness != null ? S.dryness[p.dryness] : null,
          p.mold ? "pl\xEDse\u0148" : p.mold === false ? "bez pl\xEDsn\u011B" : null,
          p.scent ? `v\u016Fn\u011B ${p.scent}/5` : null,
          p.appearance ? `vzhled ${p.appearance}/5` : null,
          p.note || null
        ].filter(Boolean);
        return { icon: "check", title: "Kontrola d\xE1vky", detail: bits.join(" \xB7 ") };
      }
      case "stock_init":
        return {
          icon: "check",
          title: S.stock.saved,
          detail: `${p.containers?.map((c) => `${num3(c.amount, 2)} ${p.unit}${c.label ? ` ${c.label}` : ""} \xB7 ${mlabel(c.method)}`).join("; ")}`
        };
      case "stock_use":
        return p.kind === "discard" ? { icon: "trash", title: S.stock.discarded, detail: `${num3(p.amount, 2)} ${unit}${p.reason ? ` \xB7 ${p.reason}` : ""}` } : { icon: "leaf", title: S.stock.used, detail: `${num3(p.amount, 2)} ${unit}` };
      case "stock_adjust":
        return { icon: "ruler", title: S.stock.adjusted, detail: `${S.stock.left} ${num3(p.remaining, 2)} ${unit}` };
      case "stock_move":
        return { icon: "swap", title: S.stock.moved, detail: `${mlabel(p.method)}${p.amount ? ` \xB7 ${num3(p.amount, 2)} ${unit}` : ""}` };
      case "stock_check": {
        const bits = [
          p.scent ? `v\u016Fn\u011B ${p.scent}/5` : null,
          p.appearance ? `vzhled ${p.appearance}/5` : null,
          p.mold ? "pl\xEDse\u0148" : null,
          p.rh != null ? `${p.rh} %` : null,
          p.aired ? S.stock.aired : null,
          p.note || null
        ].filter(Boolean);
        return { icon: "check", title: S.stock.checkTitle, detail: bits.join(" \xB7 ") };
      }
      case "care":
        return { icon: "leaf", title: p.kind === "custom" ? p.label : S.care[p.kind], detail: [p.potVolumeL ? `${num3(p.potVolumeL, 1)} l` : "", p.note || ""].filter(Boolean).join(" \xB7 ") };
      case "evaluation":
        return {
          icon: "check",
          title: S.evalKind[p.kind ?? "final"],
          detail: [`${p.scores?.overall}/5`, p.part || ""].filter(Boolean).join(" \xB7 ")
        };
      case "archive":
        return { icon: "pot", title: "Archivov\xE1no", detail: "" };
      case "unarchive":
        return { icon: "pot", title: "Obnoveno z archivu", detail: "" };
      default:
        return { icon: "note", title: e.type, detail: "" };
    }
  }
  function diaryRows(events) {
    const live = liveEvents(events);
    const units = Object.fromEntries(live.filter((e) => e.type === "stock_init").map((e) => [e.payload.batchId, e.payload.unit]));
    return live.slice().reverse().map((e) => ({ event: e, ...describeEvent(e, units) }));
  }

  // js/stats.js
  var overallOf = (e) => e.payload?.scores?.overall;
  var validOverall = (e) => Number.isFinite(overallOf(e));
  var isFinalEval = (e) => (e.payload?.kind ?? "final") === "final";
  var evalKey = (e) => `${e.payload.season ?? ""}|${e.payload.batchId ?? ""}|${e.payload.part ?? ""}`;
  var yieldKey = (category) => CATEGORIES[category]?.harvestFields[0]?.key ?? null;
  function currentEvaluations(plant, events) {
    const evs = liveEvents(events).filter((e) => e.type === "evaluation" && validOverall(e) && isFinalEval(e));
    const byKey = /* @__PURE__ */ new Map();
    for (const e of evs) byKey.set(evalKey(e), e);
    return [...byKey.values()].sort((a, b) => a.occurredAt < b.occurredAt ? -1 : 1);
  }
  function latestEvaluation(events, season, batchId) {
    const evs = liveEvents(events).filter((e) => e.type === "evaluation" && validOverall(e) && isFinalEval(e) && (season === void 0 || (e.payload.season ?? null) === season) && (batchId === void 0 || (e.payload.batchId ?? null) === batchId));
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
        kind: e.payload.kind ?? "final",
        part: e.payload.part ?? null,
        batchId: e.payload.batchId ?? null,
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
  var stockOffer = null;
  var setStockOffer = (fn) => {
    stockOffer = fn;
  };
  var OFFER_PHASES = ["ready", "storing", "freezing", "curing"];
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
  function dateField(value) {
    const input = h("input", { type: "datetime-local", value: toLocalInput(value ?? now()) });
    return { el: field(S.ui.date, input), get: () => fromLocalInput(input.value) };
  }
  var buttons = (onSave, label = S.ui.save) => h(
    "div",
    { class: "form-actions" },
    h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel),
    h("button", { type: "button", class: "btn btn-primary", onclick: onSave }, label)
  );
  function moistureSheet(plant, done) {
    const info = dryingInfo(plant, ctx.rules);
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
        save2.disabled = false;
      }
    }, S.moisture[a]));
    const save2 = h("button", { type: "button", class: "btn btn-primary", disabled: true, onclick: () => {
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
      h("p", { class: "muted" }, `Od posledn\xED z\xE1livky uplynulo ${num3(t)} dne. O\u010Dek\xE1van\xE9 schnut\xED: ${num3(info.d)} dne.`),
      h("div", { class: "moisture-row" }, opts),
      h("label", { class: "check-row" }, cb, h("span", {}, S.ui.watered)),
      d.el,
      h("div", { class: "form-actions" }, h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel), save2)
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
    const result = chipGroup([["clean", S.ui.pestClean], ["found", S.ui.pestFound]], "clean");
    result.el.id = "pest-result";
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    openSheet(`${S.ui.pestCheck} \u2013 ${plant.name}`, h(
      "div",
      {},
      field(S.ui.pestCheck, result.el),
      field(S.ui.note, note),
      d.el,
      buttons(() => submit(plant.id, [{ type: "pest_check", occurredAt: d.get(), payload: { found: result.get() === "found", note: note.value } }], "Kontrola zaps\xE1na", done))
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
    const btn2 = (label, cls, fn) => h("button", { type: "button", class: `btn ${cls}`, onclick: fn }, label);
    openSheet(`${S.taskLabel.problemFollowUp} \u2013 ${plant.name}`, h(
      "div",
      { class: "stack" },
      btn2(S.ui.stillProblem, "btn-secondary", () => submit(plant.id, [{ type: "pest_check", payload: { found: true } }], "Kontrola zaps\xE1na", done)),
      btn2(S.ui.resolved, "btn-primary", () => submit(plant.id, [
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
    const chips = chipGroup(MILESTONES.map((m2) => [m2, m2]), null, (v) => {
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
    const env2 = chipGroup(Object.entries(S.environment), plant.cache.environment);
    const d = dateField();
    openSheet(`${S.ui.changeEnv} \u2013 ${plant.name}`, h(
      "div",
      {},
      field(S.ui.environment, env2.el),
      d.el,
      buttons(() => {
        if (env2.get() === plant.cache.environment) return closeSheet();
        submit(plant.id, [{ type: "environment_change", occurredAt: d.get(), payload: { environment: env2.get() } }], "Prost\u0159ed\xED zm\u011Bn\u011Bno", done);
      })
    ));
  }
  var quickWatered = (plant, done) => submit(plant.id, [{ type: "watering", payload: {} }], "Zalito", done);
  async function snoozeSheet(task, done) {
    const btn2 = (n) => h("button", { type: "button", class: "btn btn-secondary", onclick: async () => {
      const d = /* @__PURE__ */ new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + n);
      await snoozeTask(ctx.db, task.plantId, task.snoozeKey, d.toISOString());
      closeSheet();
      toast(`Odlo\u017Eeno do ${relDay(d.toISOString(), now())}`);
      done?.();
    } }, n === 1 ? "Na z\xEDtra" : `Na ${n} dny`);
    openSheet(`${S.ui.snooze} \u2013 ${task.plantName}`, h("div", { class: "stack" }, [1, 2, 3].map(btn2)));
  }
  var terminalStage = (plant) => getStages(plant.category, plant.lifecycle).find((k) => STAGE_FLAGS[k]?.terminal) ?? null;
  var batchLabel = (b) => `${fmtDate(b.harvestedAt)} \xB7 ${S.batchPhase[b.phase] || b.phase}`;
  var btn = (label, cls, fn, id) => h("button", { type: "button", class: `btn ${cls}`, id, onclick: fn }, label);
  function archiveSheet(plant, done) {
    const ps = plantStock(plant, now(), { cfg: ctx.stockCfg, rules: ctx.rules, priors: ctx.priors });
    openSheet(`${S.ui.archive} \u2013 ${plant.name}`, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, S.ui.archiveAsk),
      ps && ps.remaining > 0 ? h("p", { class: "muted", id: "archive-stock-warn" }, S.stock.archiveWarn(`${num3(ps.remaining, 2)} ${ps.unit}`)) : null,
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
  function finalTarget(plant) {
    if (plant.lifecycle === "perennial") return "dormant";
    const stages = getStages(plant.category, plant.lifecycle);
    return stages.includes("harvested") ? "harvested" : terminalStage(plant);
  }
  function afterFinalSheet(plant, target, done) {
    const go = async () => {
      try {
        await appendEvents(ctx.db, plant.id, [{ type: "stage_change", payload: { from: plant.cache.stage, to: target } }]);
        closeSheet();
        toast(S.ui.switched);
        done?.();
      } catch (e) {
        toast(e.message);
      }
    };
    openSheet(S.ui.harvestSaved, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, S.ui.afterFinalAsk),
      btn(`${S.ui.switchTo} \u201E${S.stage[target]}\u201C`, "btn-primary", go, "btn-final-switch"),
      btn(S.ui.notYet, "btn-secondary", () => {
        closeSheet();
        done?.();
      }, "btn-final-keep")
    ));
  }
  var defaultMethod = (plant) => FRESH_CATEGORIES.includes(plant.category) ? "none" : "drying";
  function methodPicker(plant, value = defaultMethod(plant), estValue = null) {
    const est = h("input", { type: "number", step: "0.5", min: "0.5", max: "120", inputmode: "decimal", id: "est-days", value: estValue ?? "" });
    const estField = field(S.ui.estDays, est);
    const toggle = (v) => {
      estField.style.display = v === "drying" ? "" : "none";
    };
    const method = chipGroup(PROCESSING_METHODS.map((m2) => [m2, S.processing[m2]]), value, toggle);
    method.el.id = "processing-method";
    toggle(value);
    return { method, estField, est: () => est.value === "" ? null : Number(est.value) };
  }
  function harvestSheet(plant, done, edit = null) {
    const cfg = CATEGORIES[plant.category];
    const ep = edit?.payload ?? {};
    const inputs = cfg.harvestFields.map((f) => ({ f, el: h("input", { type: "number", step: "any", min: f.min, inputmode: "decimal", dataset: { key: f.key }, value: ep[f.key] ?? "" }) }));
    const mp = methodPicker(plant, ep.processingMethod ?? defaultMethod(plant), ep.estDays ?? null);
    const note = h("textarea", { rows: 2 }, ep.note ?? "");
    const fin = h("input", { type: "checkbox", id: "harvest-final", checked: !!ep.final });
    const d = dateField(edit?.occurredAt);
    const save2 = async () => {
      const payload = {};
      for (const { f, el } of inputs) if (el.value !== "") payload[f.key] = Number(el.value);
      if (!Object.keys(payload).length) return toast(S.ui.fillOne);
      payload.processingMethod = mp.method.get();
      if (payload.processingMethod === "drying" && mp.est() != null) payload.estDays = mp.est();
      if (note.value.trim()) payload.note = note.value.trim();
      if (fin.checked) payload.final = true;
      if (edit) {
        if (ep.processingDays != null) payload.processingDays = ep.processingDays;
        const date = d.get();
        if (toLocalInput(date) !== toLocalInput(edit.occurredAt)) payload.date = date;
        return submit(plant.id, [{ type: "harvest_edit", payload: { harvestId: edit.id, ...payload } }], S.ui.harvestEdited, done);
      }
      const rule = ctx.rules.afterFinalHarvest;
      const target = fin.checked ? finalTarget(plant) : null;
      const move = !!target && target !== plant.cache.stage;
      const events = [{ type: "harvest", occurredAt: d.get(), payload }];
      if (move && rule === "auto") events.push({ type: "stage_change", payload: { from: plant.cache.stage, to: target } });
      const ok = await submit(plant.id, events, S.ui.harvestSaved, done);
      if (ok && move && rule === "ask") afterFinalSheet(plant, target, done);
    };
    openSheet(`${edit ? S.ui.editHarvest : S.ui.recordHarvest} \u2013 ${plant.name}`, h(
      "div",
      {},
      d.el,
      inputs.map(({ f, el }) => field(S.harvestField[f.key] || f.key, el)),
      field(S.ui.processing, mp.method.el),
      mp.estField,
      h("label", { class: "check-row" }, fin, h("span", {}, S.ui.finalHarvest)),
      h("div", { class: "field-hint" }, S.ui.finalHint),
      field(S.ui.note, note),
      buttons(save2)
    ));
  }
  function batchMethodSheet(plant, batch, done) {
    const mp = methodPicker(plant);
    openSheet(`${S.ui.batchMethod} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, `${S.ui.batchPending}: ${fmtDate(batch.harvestedAt)}`),
      field(S.ui.processing, mp.method.el),
      mp.estField,
      buttons(() => {
        const m2 = mp.method.get();
        const payload = { batchId: batch.id, phase: m2 === "none" ? "ready" : m2, method: m2 };
        if (m2 === "drying" && mp.est() != null) payload.estDays = mp.est();
        submit(plant.id, [{ type: "batch_step", payload }], S.ui.batchSaved, done).then((ok) => {
          if (ok && OFFER_PHASES.includes(payload.phase)) stockOffer?.(plant.id, batch.id, done);
        });
      })
    ));
  }
  function batchStepSheet(plant, batch, done, heading) {
    const fresh = FRESH_CATEGORIES.includes(plant.category);
    const order = fresh ? ["storing", "ready", "used", "discarded", ...PROCESSING_PHASES.filter((x) => x !== "storing")] : BATCH_PHASES;
    const options = order.filter((x) => x !== batch.phase);
    const start = batch.phase === "ready" ? "used" : options.includes("ready") ? "ready" : options[0];
    const est = h("input", { type: "number", step: "0.5", min: "0.5", max: "120", inputmode: "decimal", id: "est-days" });
    const estField = field(S.ui.estDays, est);
    const toggle = (v) => {
      estField.style.display = v === "drying" ? "" : "none";
    };
    const phase = chipGroup(options.map((x) => [x, S.batchPhase[x]]), start, toggle);
    phase.el.id = "batch-phase";
    toggle(start);
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    openSheet(`${S.ui.movePhase} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, heading || batchLabel(batch)),
      field(S.ui.movePhase, phase.el),
      estField,
      field(S.ui.note, note),
      d.el,
      buttons(() => {
        const payload = { batchId: batch.id, phase: phase.get() };
        if (payload.phase === "drying" && est.value !== "") payload.estDays = Number(est.value);
        if (note.value.trim()) payload.note = note.value.trim();
        submit(plant.id, [{ type: "batch_step", occurredAt: d.get(), payload }], S.ui.batchSaved, done).then((ok) => {
          if (ok && OFFER_PHASES.includes(payload.phase)) stockOffer?.(plant.id, batch.id, done);
        });
      })
    ));
  }
  function batchCheckSheet(plant, batch, done) {
    const drying = batch.phase === "drying";
    const lastDry = batch.checks.filter((c) => c.dryness != null).at(-1)?.dryness ?? null;
    const dry = chipGroup(Array.from({ length: DRYNESS_MAX + 1 }, (_, i) => [i, `${i} \xB7 ${S.dryness[i]}`]), lastDry);
    dry.el.id = "batch-dryness";
    const mold = chipGroup([["no", S.ui.moldNone], ["yes", S.ui.moldFound]], "no");
    mold.el.id = "batch-mold";
    const scent = starPicker(0), look = starPicker(0);
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    openSheet(`${S.ui.batchCheck} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, batchLabel(batch)),
      drying ? field(S.ui.dryness, dry.el) : null,
      field(S.ui.mold, mold.el),
      field(S.ui.scent, scent.el),
      field(S.ui.batchLook, look.el),
      field(S.ui.note, note),
      d.el,
      buttons(async () => {
        if (drying && dry.get() == null) return toast(S.ui.dryness);
        const payload = { batchId: batch.id, mold: mold.get() === "yes" };
        if (drying) payload.dryness = Number(dry.get());
        if (scent.get()) payload.scent = scent.get();
        if (look.get()) payload.appearance = look.get();
        if (note.value.trim()) payload.note = note.value.trim();
        const ok = await submit(plant.id, [{ type: "batch_check", occurredAt: d.get(), payload }], "Kontrola zaps\xE1na", done);
        if (ok && drying && payload.dryness === DRYNESS_MAX) batchStepSheet(plant, batch, done, S.ui.dryDone);
      })
    ));
  }
  function useBySheet(plant, task, done) {
    const batch = (plant.cache.batches || []).find((b) => b.id === task.batchId);
    if (!batch) return;
    const step = (phase) => () => submit(plant.id, [{ type: "batch_step", payload: { batchId: batch.id, phase } }], S.batchPhase[phase], done);
    openSheet(`${S.taskLabel.useBy} \u2013 ${plant.name}`, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, `${S.ui.useAsk} ${batchLabel(batch)}`),
      btn(S.ui.markUsed, "btn-primary", step("used"), "btn-batch-used"),
      btn(S.ui.markDiscarded, "btn-secondary", step("discarded"), "btn-batch-discarded"),
      btn(S.ui.stillHave, "btn-secondary", async () => {
        const t = /* @__PURE__ */ new Date();
        t.setHours(0, 0, 0, 0);
        t.setDate(t.getDate() + 3);
        await snoozeTask(ctx.db, plant.id, task.snoozeKey, t.toISOString());
        closeSheet();
        done?.();
      }, "btn-batch-keep")
    ));
  }
  var batchEstimate = (batch, plant) => effectiveDryingDays(batch, ctx.rules, plant ? batchRatio(plant, batch, ctx.priors) : batch.ratio ?? 1);
  function careSheet(plant, done) {
    const kind = chipGroup(CARE_KINDS.map((k) => [k, S.care[k]]), "pruning", (v) => {
      label.style.display = v === "custom" ? "" : "none";
      pot.style.display = v === "repotting" ? "" : "none";
    });
    kind.el.id = "care-kind";
    const labelInput = h("input", { type: "text", placeholder: S.ui.careLabel, id: "care-label" });
    const label = field(S.ui.careLabel, labelInput);
    const potInput = h("input", { type: "number", step: "any", min: "0.1", inputmode: "decimal", id: "care-pot", value: plant.cache.pot?.volumeL ?? "" });
    const pot = field(S.ui.potVolume, potInput);
    label.style.display = "none";
    pot.style.display = "none";
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    openSheet(`${S.ui.care} \u2013 ${plant.name}`, h(
      "div",
      {},
      field(S.ui.careKind, kind.el),
      label,
      pot,
      field(S.ui.note, note),
      d.el,
      buttons(() => {
        const payload = { kind: kind.get() };
        if (payload.kind === "custom") payload.label = labelInput.value;
        if (payload.kind === "repotting" && potInput.value !== "") payload.potVolumeL = Number(potInput.value);
        if (note.value.trim()) payload.note = note.value.trim();
        submit(plant.id, [{ type: "care", occurredAt: d.get(), payload }], S.care[payload.kind], done);
      })
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
  async function evaluationSheet(plant, done, opts = {}) {
    const events = await getEvents(ctx.db, plant.id);
    const c = plant.cache;
    const batches = c.batches || [];
    const perennialHarvest = plant.lifecycle === "perennial" && plant.harvestable;
    const afterHarvest = !!c.finalHarvestAt || ["harvested", "done", "dormant"].includes(c.stage) || batches.some((b) => b.readyAt || b.phase === "used");
    let kind = opts.kind ?? (afterHarvest || !plant.harvestable ? "final" : "tasting");
    const kindChips = chipGroup([["tasting", S.ui.tasting], ["final", S.ui.finalEval]], kind, (v) => {
      kind = v;
      hint.style.display = v === "tasting" ? "" : "none";
    });
    kindChips.el.id = "eval-kind";
    const hint = h("div", { class: "field-hint" }, S.ui.tastingHint);
    hint.style.display = kind === "tasting" ? "" : "none";
    let batchId = opts.batchId ?? "";
    const batchChips = batches.length ? chipGroup([["", S.ui.wholePlant], ...batches.map((b) => [b.id, batchLabel(b)])], batchId, (v) => {
      batchId = v;
    }) : null;
    if (batchChips) batchChips.el.id = "eval-batch";
    const part = h("input", { type: "text", id: "eval-part", placeholder: S.ui.evalPartHint });
    const prev = kind === "final" ? latestEvaluation(events, void 0, opts.batchId === void 0 ? void 0 : opts.batchId || null) : null;
    const p = prev?.payload || {};
    if (p.part) part.value = p.part;
    const criteriaList = [{ key: "overall", label: S.criterion.overall }, ...activeCriteria(plant.category, ctx.criteria)];
    const criteria = criteriaList.map((c2) => c2.key);
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
    const save2 = () => {
      if (!pickers.overall.get()) return toast(S.ui.overallRequired);
      const scores = {};
      for (const k of criteria) if (pickers[k].get()) scores[k] = pickers[k].get();
      const payload = { scores, kind };
      if (grow != null) payload.wouldGrowAgain = grow;
      if (note.value.trim()) payload.note = note.value.trim();
      if (perennialHarvest && season.value !== "") payload.season = Number(season.value);
      if (batchId) payload.batchId = batchId;
      if (part.value.trim()) payload.part = part.value.trim();
      submit(plant.id, [{ type: "evaluation", occurredAt: d.get(), payload }], kind === "tasting" ? "Ochutn\xE1vka ulo\u017Eena" : "Hodnocen\xED ulo\u017Eeno", done);
    };
    openSheet(`${S.ui.evaluation} \u2013 ${plant.name}`, h(
      "div",
      {},
      plant.harvestable ? field(S.ui.evalKind, kindChips.el) : null,
      plant.harvestable ? hint : null,
      batchChips ? field(S.ui.evalBatch, batchChips.el) : null,
      plant.harvestable ? field(S.ui.evalPart, part) : null,
      criteriaList.map((c2) => field(c2.label, pickers[c2.key].el)),
      field(S.ui.wouldGrowAgain, growChips.el),
      perennialHarvest ? field(S.ui.season, season) : null,
      field(S.ui.note, note),
      d.el,
      buttons(save2)
    ));
  }

  // js/ui-stock.js
  var T = S.stock;
  var DIGITS = { g: 1, kg: 2, ks: 0 };
  var fmtAmt = (a, unit) => `${num3(a, DIGITS[unit] ?? 1)} ${unit}`;
  var env = () => ({ cfg: ctx.stockCfg, rules: ctx.rules, priors: ctx.priors });
  var methodChips = (value, onChange) => chipGroup(Object.values(resolveMethods(ctx.stockCfg)).map((m2) => [m2.key, m2.label]), value, onChange);
  var methodLabel = (key) => resolveMethods(ctx.stockCfg)[key]?.label ?? T.method.other;
  var qClass = (pct2) => pct2 >= 70 ? "q-ok" : pct2 >= 40 ? "q-mid" : "q-low";
  var tabRequest = { id: null, tab: null };
  var stockEligible = (b) => !b.legacy && !b.stock && !["pending", "drying"].includes(b.phase) && !BATCH_ENDED.includes(b.phase);
  var findContainer2 = (plant, containerId) => {
    for (const b of plant.cache.batches || []) {
      const k = b.stock?.containers.find((x) => x.id === containerId);
      if (k) return { batch: b, k };
    }
    return { batch: null, k: null };
  };
  function stockInitSheet(plant, batch, done) {
    const sug = suggestInitial(plant, batch);
    let unit = sug.unit;
    const preset = presetFor(plant, ctx.stockCfg);
    const rows = [];
    const list = h("div", { class: "stack", id: "stock-rows" });
    const addBtn = h("button", { type: "button", class: "btn btn-secondary btn-sm", id: "btn-add-container", onclick: () => addRow(null) }, icon("plus"), T.addContainer);
    function addRow(amount) {
      if (rows.length >= MAX_CONTAINERS) return toast(T.tooMany);
      const amt = h("input", { type: "number", step: "any", min: "0", inputmode: "decimal", class: "stock-amount", value: amount ?? "" });
      const method = methodChips(preset.method);
      const label = h("input", { type: "text", maxlength: 40, placeholder: T.labelPh });
      const rm = h("button", { type: "button", class: "btn btn-ghost btn-sm", "aria-label": T.removeContainer, onclick: () => {
        rows.splice(rows.indexOf(row2), 1);
        row2.el.remove();
        renumber();
      } }, icon("trash"));
      const title = h("strong", {});
      const row2 = { amt, method, label, title, rm, el: h(
        "div",
        { class: "card pad stock-row" },
        h("div", { class: "stock-row-head" }, title, rm),
        field(T.amount, amt),
        field(T.storedIn, method.el),
        field(T.label, label)
      ) };
      rows.push(row2);
      list.append(row2.el);
      renumber();
    }
    function renumber() {
      rows.forEach((r, i) => {
        r.title.textContent = T.containerN(i + 1);
        r.rm.style.display = rows.length > 1 ? "" : "none";
      });
      addBtn.disabled = rows.length >= MAX_CONTAINERS;
    }
    addRow(sug.amount != null ? Math.round(sug.amount * 1e3) / 1e3 : null);
    const unitChips = chipGroup(STOCK_UNITS.map((u) => [u, u]), unit, (u) => {
      for (const r of rows) {
        const v = Number(r.amt.value);
        const c = r.amt.value !== "" && Number.isFinite(v) ? convertAmount(v, unit, u) : null;
        if (c != null) r.amt.value = String(Math.round(c * 1e3) / 1e3);
      }
      unit = u;
    });
    unitChips.el.id = "stock-unit";
    const est = h("input", { type: "checkbox", id: "stock-estimate", checked: sug.basis === "default" || sug.basis === "none" });
    const d = dateField();
    const hint = sug.basis === "learned" ? T.suggest.learned(num3(sug.ratio, 2)) : T.suggest[sug.basis];
    openSheet(`${T.initTitle} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, `${batchLabel(batch)} \xB7 ${T.initHint}`),
      h("div", { class: "field-hint", id: "stock-suggest" }, hint),
      field(T.unit, unitChips.el),
      list,
      addBtn,
      h("label", { class: "check-row" }, est, h("span", {}, T.estimate)),
      d.el,
      buttons(() => {
        const containers = rows.map((r) => ({ id: uid(), amount: Number(r.amt.value), method: r.method.get(), ...r.label.value.trim() ? { label: r.label.value.trim() } : {} }));
        if (containers.some((c) => !(c.amount > 0))) return toast(T.needAmount);
        submit(plant.id, [{ type: "stock_init", occurredAt: d.get(), payload: { batchId: batch.id, unit, containers, source: est.checked ? "estimate" : "weighed" } }], T.saved, done);
      })
    ));
  }
  var QUICK = { g: [1, 2, 3, 5, 10], kg: [0.1, 0.25, 0.5, 1], ks: [1, 2, 3, 5] };
  function stockUseSheet(plant, batch, k, done) {
    const unit = batch.stock.unit;
    const d = dateField();
    const first = !batch.stock.uses.length && !batch.evals.some((e) => e.kind === "tasting");
    const use = async (amount) => {
      if (!(amount > 0)) return toast(T.needAmount);
      const amt = Math.min(amount, k.amount);
      const ok = await submit(
        plant.id,
        [{ type: "stock_use", occurredAt: d.get(), payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, amount: amt } }],
        amt >= k.amount - 1e-9 ? T.usedAll : T.used,
        done
      );
      if (ok && first && plant.harvestable) tastePrompt(plant, batch, done);
    };
    const custom = h("input", { type: "number", step: "any", min: "0", inputmode: "decimal", id: "use-custom" });
    const quick = (QUICK[unit] || []).filter((a) => a < k.amount - 1e-9);
    openSheet(`${T.useTitle} \u2013 ${plant.name}`, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, `${k.label || methodLabel(k.method)} \xB7 ${T.left} ${fmtAmt(k.amount, unit)}`),
      h(
        "div",
        { class: "quick-row" },
        quick.map((a) => h("button", { type: "button", class: "btn btn-secondary", dataset: { amount: a }, onclick: () => use(a) }, fmtAmt(a, unit))),
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-use-all", onclick: () => use(k.amount) }, T.useAll)
      ),
      field(T.useCustom, custom),
      d.el,
      h(
        "div",
        { class: "form-actions" },
        h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel),
        h("button", { type: "button", class: "btn btn-primary", id: "btn-use-custom", onclick: () => use(Number(custom.value)) }, T.use)
      )
    ));
  }
  function tastePrompt(plant, batch, done) {
    openSheet(T.firstUse, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, T.tasteAsk),
      h("button", { type: "button", class: "btn btn-primary", id: "btn-taste-now", onclick: () => {
        closeSheet();
        evaluationSheet(plant, done, { kind: "tasting", batchId: batch.id });
      } }, T.tasteNow),
      h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, T.tasteSkip)
    ));
  }
  function stockAdjustSheet(plant, batch, k, done) {
    const unit = batch.stock.unit;
    const rem = h("input", { type: "number", step: "any", min: "0", inputmode: "decimal", id: "adjust-remaining", value: k.amount });
    const d = dateField();
    openSheet(`${T.adjustTitle} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, `${k.label || methodLabel(k.method)} \xB7 ${T.adjustHint}`),
      field(`${T.left} (${unit})`, rem),
      d.el,
      buttons(() => {
        const v = Number(rem.value);
        if (rem.value === "" || !(v >= 0)) return toast(T.needAmount);
        submit(plant.id, [{ type: "stock_adjust", occurredAt: d.get(), payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, remaining: v } }], T.adjusted, done);
      })
    ));
  }
  function stockMoveSheet(plant, batch, k, done) {
    const unit = batch.stock.unit;
    let scope = "whole";
    const scopeChips = chipGroup([["whole", T.moveWhole], ["part", T.movePart]], scope, (v) => {
      scope = v;
      amtField.style.display = v === "part" ? "" : "none";
    });
    scopeChips.el.id = "move-scope";
    const amt = h("input", { type: "number", step: "any", min: "0", inputmode: "decimal", id: "move-amount", value: Math.round(k.amount / 2 * 1e3) / 1e3 });
    const amtField = field(`${T.moveAmount} (${unit})`, amt);
    amtField.style.display = "none";
    const method = methodChips(k.method);
    method.el.id = "move-method";
    const label = h("input", { type: "text", maxlength: 40, placeholder: T.labelPh });
    const d = dateField();
    openSheet(`${T.moveTitle} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, `${k.label || methodLabel(k.method)} \xB7 ${T.left} ${fmtAmt(k.amount, unit)}`),
      field(T.scope, scopeChips.el),
      amtField,
      field(T.moveTo, method.el),
      field(T.label, label),
      d.el,
      buttons(() => {
        const payload = { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, method: method.get() };
        const v = Number(amt.value);
        const partial = scope === "part" && v > 0 && v < k.amount - 1e-9;
        if (scope === "part" && !(v > 0)) return toast(T.needAmount);
        if (!partial && payload.method === k.method) return toast(T.moveNeed);
        if (partial) {
          payload.amount = v;
          payload.newContainerId = uid();
        }
        if (label.value.trim()) payload.label = label.value.trim();
        submit(plant.id, [{ type: "stock_move", occurredAt: d.get(), payload }], T.moved, done);
      })
    ));
  }
  function stockCheckSheet(plant, batch, k, done) {
    const m2 = resolveMethods(ctx.stockCfg)[k.method];
    const scent = starPicker(0), look = starPicker(0);
    const mold = chipGroup([["no", T.moldNo], ["yes", T.moldYes]], "no");
    mold.el.id = "stock-mold";
    const rh = h("input", { type: "number", step: "1", min: "0", max: "100", inputmode: "decimal", id: "stock-rh" });
    const aired = h("input", { type: "checkbox", id: "stock-aired" });
    const note = h("textarea", { rows: 2 });
    const d = dateField();
    openSheet(`${T.checkTitle} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, `${k.label || methodLabel(k.method)} \xB7 ${T.checkHint}`),
      field(T.scent, scent.el),
      field(T.look, look.el),
      field(T.mold, mold.el),
      field(T.rh, rh),
      m2?.airEveryDays > 0 ? h("label", { class: "check-row" }, aired, h("span", {}, T.aired)) : null,
      field(S.ui.note, note),
      d.el,
      buttons(async () => {
        const payload = { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, mold: mold.get() === "yes" };
        if (scent.get()) payload.scent = scent.get();
        if (look.get()) payload.appearance = look.get();
        if (rh.value !== "") payload.rh = Number(rh.value);
        if (aired.checked) payload.aired = true;
        if (note.value.trim()) payload.note = note.value.trim();
        const ok = await submit(plant.id, [{ type: "stock_check", occurredAt: d.get(), payload }], T.checked, done);
        if (ok && payload.mold) moldPrompt(plant, batch, k, done);
      })
    ));
  }
  function moldPrompt(plant, batch, k, done) {
    openSheet(T.moldYes, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, T.moldAsk),
      h("button", { type: "button", class: "btn btn-danger", id: "btn-mold-discard", onclick: () => {
        closeSheet();
        stockDiscardSheet(plant, batch, k, done, "mold");
      } }, T.discard),
      h("button", { type: "button", class: "btn btn-secondary", onclick: () => {
        closeSheet();
        done?.();
      } }, T.moldKeep)
    ));
  }
  function stockDiscardSheet(plant, batch, k, done, reason = "") {
    const why = h("input", { type: "text", maxlength: 80, id: "discard-reason", value: reason === "mold" ? T.moldYes : "" });
    const d = dateField();
    openSheet(`${T.discardTitle} \u2013 ${plant.name}`, h(
      "div",
      {},
      h("p", { class: "muted" }, T.discardAsk(fmtAmt(k.amount, batch.stock.unit))),
      field(T.reason, why),
      d.el,
      h(
        "div",
        { class: "form-actions" },
        h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel),
        h("button", { type: "button", class: "btn btn-danger", id: "btn-discard", onclick: () => submit(plant.id, [{
          type: "stock_use",
          occurredAt: d.get(),
          payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, amount: k.amount, kind: "discard", ...why.value.trim() ? { reason: why.value.trim() } : {} }
        }], T.discarded, done) }, T.discard)
      )
    ));
  }
  function runStockTask(task, plant, done) {
    const { batch, k } = findContainer2(plant, task.containerId);
    const snooze = async (days) => {
      const t = /* @__PURE__ */ new Date();
      t.setHours(0, 0, 0, 0);
      t.setDate(t.getDate() + days);
      await snoozeTask(ctx.db, plant.id, task.snoozeKey, t.toISOString());
      closeSheet();
      toast(`Odlo\u017Eeno do ${relDay(t.toISOString(), now())}`);
      done?.();
    };
    const open = () => {
      tabRequest.id = plant.id;
      tabRequest.tab = "stock";
      closeSheet();
      navigate(`/plant/${plant.id}`);
      done?.();
    };
    switch (task.type) {
      case "stockCheck":
        return batch && k ? stockCheckSheet(plant, batch, k, done) : null;
      case "stockAir":
        return batch && k ? submit(plant.id, [{ type: "stock_check", payload: { batchId: batch.id, stockId: batch.stock.id, containerId: k.id, aired: true } }], T.checked, done) : null;
      case "stockUseBy":
        if (!batch || !k) return null;
        return openSheet(`${S.taskLabel.stockUseBy} \u2013 ${plant.name}`, h(
          "div",
          { class: "stack" },
          h("p", { class: "muted" }, `${k.label || methodLabel(k.method)} \xB7 ${T.useByTask}`),
          h("button", { type: "button", class: "btn btn-primary", id: "btn-useby-use", onclick: () => {
            closeSheet();
            stockUseSheet(plant, batch, k, done);
          } }, T.use),
          h("button", { type: "button", class: "btn btn-secondary", id: "btn-useby-check", onclick: () => {
            closeSheet();
            stockCheckSheet(plant, batch, k, done);
          } }, T.check),
          h("button", { type: "button", class: "btn btn-secondary", id: "btn-useby-discard", onclick: () => {
            closeSheet();
            stockDiscardSheet(plant, batch, k, done);
          } }, T.discard),
          h("button", { type: "button", class: "btn btn-secondary", id: "btn-useby-keep", onclick: () => snooze(3) }, S.ui.stillHave)
        ));
      case "stockLow":
        return openSheet(`${S.taskLabel.stockLow} \u2013 ${plant.name}`, h(
          "div",
          { class: "stack" },
          h("p", { class: "muted" }, T.lowTask(task.note ?? "?")),
          h("button", { type: "button", class: "btn btn-primary", id: "btn-low-open", onclick: open }, T.fromTasks),
          h("button", { type: "button", class: "btn btn-secondary", id: "btn-low-snooze", onclick: () => snooze(7) }, S.ui.later)
        ));
      default:
        return null;
    }
  }
  async function offerStock(plantId, batchId, done) {
    const plant = await getPlant(ctx.db, plantId);
    const batch = plant?.cache.batches?.find((b) => b.id === batchId);
    if (!plant?.harvestable || !batch || !stockEligible(batch)) return;
    openSheet(T.init, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, T.weighPrompt),
      h("button", { type: "button", class: "btn btn-primary", id: "btn-weigh-now", onclick: () => {
        closeSheet();
        stockInitSheet(plant, batch, done);
      } }, T.weighNow),
      h("button", { type: "button", class: "btn btn-secondary", id: "btn-weigh-later", onclick: closeSheet }, T.weighLater)
    ));
  }
  setStockOffer(offerStock);
  function stockSummaryNode(ps, nowIso2) {
    const bits = [];
    if (ps.rate) bits.push(T.rate(fmtAmt(ps.rate.perDay, ps.unit), Math.round(ps.rate.windowDays)));
    else if (ps.remaining > 0) bits.push(T.noRate);
    if (ps.runOutDays != null) bits.push(T.runOut(Math.max(1, Math.round(ps.runOutDays)), fmtDate(ps.runOutAt)));
    return h(
      "div",
      { class: "card pad", id: "stock-summary" },
      h("div", { class: "eval-line" }, h("span", {}, T.summary), h("strong", { id: "stock-total" }, fmtAmt(ps.remaining, ps.unit))),
      bits.map((x) => h("div", { class: "muted" }, x)),
      h("div", { class: "muted" }, `${T.presetLabel}: ${ps.preset.label}`)
    );
  }
  function containerRow(plant, batch, entry, done) {
    const { k, state } = entry;
    const unit = batch.stock.unit;
    const m2 = state.method;
    const bits = [
      `${T.left} ${fmtAmt(k.amount, unit)} ${T.of} ${fmtAmt(k.initial, unit)}`,
      state.maturing ? T.maturing(fmtDate(state.maturingUntil)) : `${T.fresh} ${state.pct} %`,
      !state.maturing && state.below ? T.belowUseBy : !state.maturing && state.useByAt ? T.useBy(fmtDate(state.useByAt)) : null,
      k.opens ? T.opened(k.opens) : null,
      state.ratio.source === "own" ? T.learnedTag(num3(state.ratio.r, 2), state.ratio.n) : state.ratio.source === "prior" ? T.priorTag(num3(state.ratio.r, 2)) : null
    ].filter(Boolean);
    const act = (key, label, fn, cls = "btn-secondary") => h("button", { type: "button", class: `btn ${cls} btn-sm`, dataset: { act: key }, onclick: fn }, label);
    return h(
      "div",
      { class: "stock-container", dataset: { container: k.id, method: k.method } },
      h(
        "div",
        { class: "stock-head" },
        h("strong", {}, k.label || m2.label),
        h("span", { class: "tag" }, methodLabel(k.method)),
        k.moldAt ? h("span", { class: "tag q-low" }, T.moldTag) : null,
        state.maturing ? null : h("span", { class: `tag stock-q ${qClass(state.pct)}`, dataset: { q: state.pct } }, `${state.pct} %`)
      ),
      h("div", { class: "stock-bar" }, h("span", { style: `width:${Math.max(2, Math.round(k.amount / Math.max(k.initial, k.amount) * 100))}%` })),
      h("div", { class: "timeline-detail" }, bits.join(" \xB7 ")),
      h("div", { class: "batch-actions" }, [
        act("use", T.use, () => stockUseSheet(plant, batch, k, done), "btn-primary"),
        act("adjust", T.adjust, () => stockAdjustSheet(plant, batch, k, done)),
        act("move", T.move, () => stockMoveSheet(plant, batch, k, done)),
        act("check", T.check, () => stockCheckSheet(plant, batch, k, done)),
        act("discard", T.discard, () => stockDiscardSheet(plant, batch, k, done), "btn-ghost")
      ])
    );
  }
  function stockPanel(plant, done, nowIso2 = now()) {
    const ps = plantStock(plant, nowIso2, env());
    const batches = (plant.cache.batches || []).filter((b) => !b.legacy);
    const eligible = batches.filter(stockEligible);
    const out = [];
    if (ps) out.push(stockSummaryNode(ps, nowIso2));
    for (const entry of ps ? [...ps.batches].reverse() : []) {
      const { batch, containers } = entry;
      const open = containers.filter(({ k }) => k.status === "open");
      const closed = containers.length - open.length;
      out.push(h(
        "div",
        { class: "card pad stock-batch", dataset: { batch: batch.id } },
        h(
          "div",
          { class: "eval-line" },
          h("strong", {}, `${fmtDate(batch.harvestedAt)} \xB7 ${S.batchPhase[batch.phase] || batch.phase}`),
          h("span", { class: "muted" }, `${fmtAmt(entry.remaining, batch.stock.unit)} ${T.of} ${fmtAmt(batch.stock.initial, batch.stock.unit)}`)
        ),
        h("div", { class: "muted" }, `${T.source[batch.stock.source]} \xB7 ${T.since} ${fmtDate(batch.stock.at)}`),
        open.map((c) => containerRow(plant, batch, c, done)),
        closed ? h("div", { class: "muted" }, T.emptied(closed)) : null
      ));
    }
    for (const b of eligible) {
      const sug = suggestInitial(plant, b);
      out.push(h(
        "div",
        { class: "card pad stock-batch", dataset: { batch: b.id } },
        h(
          "div",
          { class: "eval-line" },
          h("strong", {}, batchLabel(b)),
          sug.amount != null ? h("span", { class: "muted" }, `~${fmtAmt(sug.amount, sug.unit)}`) : null
        ),
        h("button", { type: "button", class: "btn btn-primary panel-btn", dataset: { act: "init" }, onclick: () => stockInitSheet(plant, b, done) }, icon("plus"), T.init)
      ));
    }
    if (!out.length) out.push(h("div", { class: "empty-state", id: "stock-empty" }, T.empty));
    return h("div", { id: "stock-panel" }, out);
  }
  var hasStockTab = (plant) => plant.harvestable && (plant.cache.batches || []).some((b) => !b.legacy && (b.stock || b.phase !== "pending"));
  async function renderStockOverview(root2) {
    const alive = guard();
    const { plants } = await loadAll();
    const nowIso2 = now();
    const rows = plants.map((p) => ({ p, ps: plantStock(p, nowIso2, env()) })).filter(({ ps }) => ps && ps.remaining > 0).sort((a, b) => (a.ps.runOutDays ?? 1e9) - (b.ps.runOutDays ?? 1e9));
    const cmp2 = methodComparison(plants);
    if (!alive()) return;
    put(
      clear(root2),
      h(
        "div",
        { class: "top-bar" },
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-back", "aria-label": S.ui.back, onclick: () => navigate("/") }, icon("back")),
        h("h2", { class: "page-title" }, T.overview)
      ),
      h("p", { class: "muted pad" }, T.overviewIntro),
      rows.length ? h("div", { class: "card task-list", id: "stock-overview" }, rows.map(({ p, ps }) => {
        const worst = ps.batches.flatMap((b) => b.containers).filter((c) => c.state).sort((a, b) => a.state.q - b.state.q)[0];
        return h(
          "div",
          { class: "item-row", role: "button", tabindex: 0, dataset: { plant: p.id }, onclick: () => {
            tabRequest.id = p.id;
            tabRequest.tab = "stock";
            navigate(`/plant/${p.id}`);
          } },
          h("span", { class: `badge-dot ${worst && worst.state.pct < 40 ? "expired" : worst && worst.state.pct < 70 ? "missing" : "ok"}` }),
          h(
            "div",
            { class: "item-info" },
            h("div", { class: "item-name" }, `${p.name} \xB7 ${fmtAmt(ps.remaining, ps.unit)}`),
            h("div", { class: "item-detail" }, h(
              "span",
              { class: "item-sub" },
              [
                ps.runOutDays != null ? T.runOut(Math.max(1, Math.round(ps.runOutDays)), fmtDate(ps.runOutAt)) : T.noRate,
                worst ? `${T.fresh} ${worst.state.pct} %` : null
              ].filter(Boolean).join(" \xB7 ")
            ))
          )
        );
      })) : h("div", { class: "empty-state", id: "stock-none" }, T.none),
      h("div", { class: "section-title" }, T.comparison),
      h("p", { class: "muted pad" }, T.comparisonHint),
      cmp2.length ? h("div", { class: "card pad", id: "stock-comparison" }, cmp2.map((c) => h(
        "div",
        { class: "eval-line", dataset: { method: c.method } },
        h("span", {}, methodLabel(c.method)),
        h("span", { class: "muted" }, [T.comparisonRow(c.n, num3(c.avg, 1), c.avgAge), c.lateN ? T.lateAvg(c.lateN, num3(c.lateAvg, 1)) : null].filter(Boolean).join(" \xB7 "))
      ))) : h("div", { class: "empty-state" }, T.comparisonNone),
      h("div", { class: "pad" }, h("button", { type: "button", class: "btn btn-secondary panel-btn", id: "btn-stock-settings", onclick: () => navigate("/settings/stock") }, icon("settings"), T.settingsTitle))
    );
  }

  // js/ui-dashboard.js
  var filters = { location: "all", environment: "all", category: "all" };
  var upcomingOpen = false;
  var CAT_ICON = { herb: "leaf", vegetable: "sprout", fruit: "pot", flower: "sun", tree_shrub: "leaf", houseplant: "sprout", other: "pot" };
  var DOT = { overdue: "expired", today: "missing", upcoming: "needs_check" };
  function runTask(task, plant, done) {
    const batch = task.batchId ? (plant.cache.batches || []).find((b) => b.id === task.batchId) : null;
    switch (task.type) {
      case "moisture":
        return moistureSheet(plant, done);
      case "fertilizing":
        return submit(plant.id, [{ type: "fertilizing", payload: {} }], "P\u0159ihnojeno", done);
      case "pestCheck":
        return submit(plant.id, [{ type: "pest_check", payload: { found: false } }], "Kontrola zaps\xE1na", done);
      case "problemFollowUp":
        return followUpSheet(plant, task, done);
      case "batchCheck":
        return batch ? batchCheckSheet(plant, batch, done) : null;
      case "useBy":
        return useBySheet(plant, task, done);
      case "evaluation":
      case "evaluationReview":
        return evaluationSheet(plant, done, { kind: "final", batchId: task.batchId ?? void 0 });
      default:
        return task.type.startsWith("stock") ? runStockTask(task, plant, done) : null;
    }
  }
  function afterHarvestRows(plants, nowIso2) {
    return plants.flatMap((p) => (p.cache?.batches || []).filter((b) => !b.legacy && !BATCH_ENDED.includes(b.phase)).map((b) => ({
      plant: p,
      batch: b,
      pending: b.phase === "pending",
      progress: b.phase === "drying" ? { t: Math.floor(daysBetween(b.phaseSince, nowIso2)), est: Math.round(batchEstimate(b, p)) } : null
    }))).sort((a, c) => a.batch.harvestedAt < c.batch.harvestedAt ? 1 : -1);
  }
  function afterHarvestSection(plants, nowIso2, rerender) {
    const rows = afterHarvestRows(plants, nowIso2);
    if (!rows.length) return null;
    return h(
      "section",
      { class: "after-harvest", id: "after-harvest" },
      h(
        "div",
        { class: "section-title section-title-row" },
        h("span", {}, S.ui.afterHarvest),
        rows.some(({ batch }) => batch.stock) ? h("button", { type: "button", class: "btn btn-ghost btn-sm", id: "btn-stock-overview", onclick: () => navigate("/stock") }, S.stock.overview) : null
      ),
      h("div", { class: "card task-list" }, rows.map(({ plant, batch, pending, progress }) => h(
        "div",
        {
          class: "item-row batch-row",
          role: "button",
          tabindex: 0,
          dataset: { batch: batch.id, plant: plant.id, phase: batch.phase },
          onclick: () => navigate(`/plant/${plant.id}`)
        },
        h("span", { class: `badge-dot ${pending ? "missing" : "ok"}` }),
        h(
          "div",
          { class: "item-info" },
          h("div", { class: "item-name" }, `${plant.name} \u2013 ${S.batchPhase[batch.phase] || batch.phase}`),
          h("div", { class: "item-detail" }, h(
            "span",
            { class: "item-sub" },
            [
              fmtDate(batch.harvestedAt),
              progress ? S.ui.dayOf(progress.t + 1, progress.est) : null,
              batch.stock ? `${S.stock.left} ${num3(batchRemaining(batch), 2)} ${batch.stock.unit}` : null
            ].filter(Boolean).join(" \xB7 ")
          ))
        ),
        pending ? h(
          "div",
          { class: "item-actions" },
          h("button", {
            type: "button",
            class: "btn btn-secondary btn-sm",
            dataset: { act: "method" },
            onclick: (e) => {
              e.stopPropagation();
              batchMethodSheet(plant, batch, rerender);
            }
          }, S.ui.batchMethod)
        ) : null
      )))
    );
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
        h("div", { class: "item-name" }, `${task.plantName} \u2013 ${S.taskLabel[task.type]}${task.note && task.type.startsWith("stock") && task.type !== "stockLow" ? ` \xB7 ${task.note}` : ""}`),
        h("div", { class: "item-detail" }, h("span", { class: "item-sub" }, task.phase ? `${S.batchPhase[task.phase] || task.phase} \xB7 ${when}` : when))
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
    const nowIso2 = now();
    const opts = engineOpts();
    const remind = active.length ? await backupReminderDue(ctx.db, nowIso2) : false;
    const byIdAll = new Map(plants.map((p) => [p.id, p]));
    const tasks = computeTasks(plants.filter((p) => p.archivedAt ? true : matches(p)), nowIso2, opts);
    const count = (u) => tasks.filter((t) => t.urgency === u).length;
    const done = list.reduce((n, p) => n + doneToday(byPlant.get(p.id) || [], nowIso2), 0);
    const due = tasks.filter((t) => t.urgency !== "upcoming");
    const later = tasks.filter((t) => t.urgency === "upcoming");
    const open = due.length;
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
    const first = due[0];
    if (first) {
      root2.append(h(
        "div",
        {
          class: "next-action",
          role: "button",
          tabindex: 0,
          id: "next-action",
          onclick: () => runTask(first, byIdAll.get(first.plantId), rerender)
        },
        h("div", { class: "next-action-icon" }, icon(first.type === "moisture" ? "drop" : first.type === "fertilizing" ? "leaf" : first.type.startsWith("evaluation") ? "status-ok" : first.type === "batchCheck" || first.type === "useBy" || first.type.startsWith("stock") ? "check" : "bug")),
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
    root2.append(due.length ? h("div", { class: "card task-list", id: "due-list" }, due.map((t) => taskRow(t, byIdAll.get(t.plantId), rerender))) : h("div", { class: "empty-state", id: "no-due" }, S.ui.noTasks));
    if (later.length) {
      const body = h("div", { class: "card task-list", id: "upcoming-list", hidden: !upcomingOpen }, later.map((t) => taskRow(t, byIdAll.get(t.plantId), rerender)));
      const toggle = h(
        "button",
        {
          type: "button",
          class: "upcoming-toggle",
          id: "btn-upcoming",
          "aria-expanded": String(upcomingOpen),
          onclick: () => {
            upcomingOpen = !upcomingOpen;
            body.hidden = !upcomingOpen;
            toggle.setAttribute("aria-expanded", String(upcomingOpen));
            toggle.classList.toggle("open", upcomingOpen);
          }
        },
        icon("chevron"),
        h("span", {}, `${S.ui.upcomingSection} (${later.length})`)
      );
      toggle.classList.toggle("open", upcomingOpen);
      root2.append(toggle, body);
    }
    const after = afterHarvestSection(plants, nowIso2, rerender);
    if (after) root2.append(after);
    for (const key of PROFILES[ctx.profile]?.dashboard || []) {
      const sec = key === "tasks" ? null : profileSection(key, active, plants, byPlant, nowIso2);
      if (sec) root2.append(sec);
    }
    root2.append(h("div", { class: "section-title" }, `${S.ui.myPlants} (${list.length})`));
    if (!list.length) {
      root2.append(h("div", { class: "empty-state" }, S.ui.noPlants));
    } else {
      const cards = await Promise.all(list.map((p) => {
        const next = getPlantTasks(p, nowIso2, opts).filter((t) => dayDiff(nowIso2, t.dueAt) <= 0).sort((a, b) => a.dueAt < b.dueAt ? -1 : 1)[0];
        const withUrg = next ? { ...next, urgency: dayDiff(nowIso2, next.dueAt) < 0 ? "overdue" : "today" } : null;
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
      rows = aggregateVarieties(all, byPlant).slice(0, 3).map((g) => secRow(g.label, [S.category[g.category], g.avgOverall != null ? `${num3(g.avgOverall)} \u2605` : null, `${g.plantCount} ${plantsWord(g.plantCount)}`].filter(Boolean).join(" \xB7 "), `/variety/${g.category}/${encodeURIComponent(g.key)}`));
    } else if (key === "milestones" || key === "measurements") {
      const type = key === "milestones" ? "milestone" : "measurement";
      rows = active.flatMap((p) => liveEvents(byPlant.get(p.id) || []).filter((e) => e.type === type).map((e) => ({ p, e }))).sort((a, b) => a.e.occurredAt < b.e.occurredAt ? 1 : -1).slice(0, 5).map(({ p, e }) => secRow(
        type === "milestone" ? `${p.name} \u2013 ${e.payload.label}` : `${p.name} \u2013 ${e.payload.kind}: ${num3(e.payload.value, 2)}${e.payload.unit ? ` ${e.payload.unit}` : ""}`,
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
    return plants.filter((p) => !p.archivedAt && isCaredFor(p.cache.stage) && !isDormant(p.cache.stage)).sort((a, b) => cmp(a.location, b.location) || cmp(a.name, b.name));
  }
  var WALK_PHASES = ["drying", "curing", "fermenting", "pickling", "storing"];
  function walkBatches(plants) {
    return plants.flatMap((p) => (p.cache?.batches || []).filter((b) => !b.legacy && WALK_PHASES.includes(b.phase)).map((b) => ({ plant: p, batch: b }))).sort((a, c) => cmp(a.plant.name, c.plant.name) || (a.batch.harvestedAt < c.batch.harvestedAt ? -1 : 1));
  }
  async function renderWalk(root2) {
    const alive = guard();
    const { plants, byPlant } = await loadAll();
    const list = [
      ...walkPlants(plants).map((p) => ({ key: p.id, p })),
      ...walkBatches(plants).map(({ plant, batch }) => ({ key: batch.id, p: plant, b: batch }))
    ];
    if (!alive()) return void 0;
    if (!list.length) {
      put(clear(root2), h("div", { class: "top-bar" }, h("h1", {}, S.walk.title)), h("div", { class: "empty-state", id: "walk-empty" }, S.walk.empty));
      return void 0;
    }
    const opts = engineOpts();
    const nowIso2 = now();
    const state = { i: 0, written: 0, answers: /* @__PURE__ */ new Map() };
    const due = new Set(list.filter((it) => !it.b).map((it) => it.p).filter((p) => getPlantTasks(p, nowIso2, opts).some((t) => t.type === "moisture" && t.dueAt <= nowIso2)).map((p) => p.id));
    async function show() {
      if (!alive()) return;
      if (state.i >= list.length) return summary();
      const it = list[state.i];
      if (it.b) return showBatch(it);
      const p = it.p;
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
          h("div", { class: "muted" }, `${S.walk.lastWatered}: ${last ? `${fmtDate(last)} (${num3(daysBetween(last, nowIso2))} d)` : S.walk.never} \xB7 ${S.walk.expected}: ${num3(info.d)} d`),
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
    function shell(it, body, done) {
      const card = h(
        "div",
        { class: "walk-card", id: "walk-card" },
        h("div", { class: "walk-photo" }, icon(CAT_ICON[it.p.category] || "pot", "plant-photo-icon")),
        h("div", { class: "walk-body" }, body),
        h(
          "div",
          { class: "walk-nav" },
          h("button", { type: "button", class: "btn btn-secondary", id: "walk-prev", disabled: state.i === 0, onclick: () => go(-1) }, S.walk.prev),
          h("button", { type: "button", class: "btn btn-secondary", id: "walk-next", onclick: () => go(1) }, done ? S.walk.next : S.walk.skip)
        ),
        h("p", { class: "muted walk-hint" }, S.walk.swipe)
      );
      put(clear(root2), h(
        "div",
        { class: "top-bar" },
        h("h1", {}, S.walk.title),
        h("button", { type: "button", class: "btn btn-ghost", id: "walk-exit", "aria-label": S.ui.back, onclick: () => navigate("/") }, icon("close"))
      ), card);
    }
    function showBatch(it) {
      const { p, b, key } = it;
      const done = state.answers.get(key);
      const nowIso22 = now();
      const mold = h("input", { type: "checkbox", id: "walk-mold" });
      const t = b.phase === "drying" ? Math.floor(daysBetween(b.phaseSince, nowIso22)) : null;
      const btns = b.phase === "drying" ? Array.from({ length: DRYNESS_MAX + 1 }, (_, i) => h("button", {
        type: "button",
        class: `btn btn-secondary walk-dry${done?.dryness === i ? " selected" : ""}`,
        dataset: { dryness: i },
        disabled: !!done,
        onclick: () => writeBatch(it, { dryness: i, mold: mold.checked })
      }, `${i} \xB7 ${S.dryness[i]}`)) : [h("button", {
        type: "button",
        class: "btn btn-primary walk-ok",
        id: "walk-batch-ok",
        disabled: !!done,
        onclick: () => writeBatch(it, { mold: mold.checked })
      }, S.ui.batchFine)];
      shell(it, [
        h("div", { class: "walk-progress" }, S.walk.progress(state.i + 1, list.length), h("span", { class: "tag" }, S.ui.batchesTitle)),
        h("h2", { class: "walk-name" }, `${p.name} \u2013 ${S.batchPhase[b.phase]}`),
        h("div", { class: "plant-sub" }, [fmtDate(b.harvestedAt), t != null ? S.ui.dayOf(t + 1, Math.round(batchEstimate(b, p))) : null].filter(Boolean).join(" \xB7 ")),
        done ? h("div", { class: "banner walk-answered", id: "walk-answered" }, S.walk.answered) : null,
        h("div", { class: "stack walk-dry-row" }, btns),
        done ? null : h("label", { class: "check-row" }, mold, h("span", {}, S.ui.moldFound))
      ], !!done);
    }
    async function writeBatch(it, payload) {
      const { p, b, key } = it;
      try {
        const { events } = await appendEvents(ctx.db, p.id, [{ type: "batch_check", payload: { batchId: b.id, ...payload } }]);
        state.answers.set(key, { ...payload, eventId: events[0].id });
        state.written += 1;
        toast(`${p.name}: ${payload.dryness != null ? S.dryness[payload.dryness] : S.ui.batchFine}${payload.mold ? " \xB7 pl\xEDse\u0148" : ""}`, {
          action: S.ui.undo,
          onAction: async () => {
            await voidEvent(ctx.db, p.id, events[0].id);
            state.answers.delete(key);
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
      const btn2 = h("button", {
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
          ios ? null : btn2,
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
        const pick2 = async (v) => {
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
            h("button", { type: "button", class: "btn btn-primary", dataset: { hemi: "north" }, onclick: () => pick2("north") }, S.ui.north),
            h("button", { type: "button", class: "btn btn-secondary", dataset: { hemi: "south" }, onclick: () => pick2("south") }, S.ui.south)
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
      baseOverride: editing.baseOverride,
      potVolumeL: editing.potVolumeL,
      substrate: editing.substrate,
      plannedHarvestAt: editing.plannedHarvestAt,
      stockPreset: editing.stockPreset
    } : source ? clonePlantInput(source, plants.map((p) => p.name)) : { category: pre.category ?? null, environment: pre.environment ?? null, lifecycle: pre.lifecycle, harvestable: pre.harvestable, source: "seed" };
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
    const env2 = chipGroup(Object.entries(S.environment), st.environment, (v) => {
      st.environment = v;
    });
    env2.el.id = "f-environment";
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
    const potVol = h("input", { type: "number", id: "f-pot", step: "any", min: "0.1", inputmode: "decimal", value: init.potVolumeL ?? "", placeholder: "nepovinn\xE9" });
    let substrate = init.substrate ?? "";
    const subChips = chipGroup([["", S.ui.unspecified], ...SUBSTRATES.map((x) => [x, S.substrate[x]])], substrate, (v) => {
      substrate = v;
    });
    subChips.el.id = "f-substrate";
    const planned = h("input", { type: "date", id: "f-planned", value: init.plannedHarvestAt ? dateOnly(init.plannedHarvestAt) : "" });
    const potValue = () => potVol.value === "" ? null : Number(potVol.value);
    const plannedIso = () => planned.value ? (/* @__PURE__ */ new Date(`${planned.value}T12:00:00`)).toISOString() : null;
    let stockPreset = init.stockPreset ?? "";
    const presetChips = chipGroup([["", S.stock.presetDefault], ...Object.values(resolvePresets(ctx.stockCfg)).map((p) => [p.key, p.label])], stockPreset, (v) => {
      stockPreset = v;
    });
    presetChips.el.id = "f-stockpreset";
    const presetField = field(S.stock.presetPlant, presetChips.el, S.stock.presetPlantHint);
    const syncPreset = () => {
      presetField.style.display = harv.checked ? "" : "none";
    };
    harv.addEventListener("change", syncPreset);
    const rememberPreset = async (category, varietyName) => {
      if (!stockPreset || !varietyName.trim()) return;
      const key = varietyKey({ category, variety: varietyName });
      if (ctx.stockCfg.varietyPreset[key] === stockPreset) return;
      ctx.stockCfg = cleanStock({ ...ctx.stockCfg, varietyPreset: { ...ctx.stockCfg.varietyPreset, [key]: stockPreset } });
      await metaSet(ctx.db, "stock", ctx.stockCfg);
    };
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
      syncPreset();
      fillStages();
    }
    if (st.category) {
      if (!st.lifecycle) st.lifecycle = CATEGORIES[st.category].lifecycle;
      life.set(st.lifecycle);
    }
    fillStages();
    syncPreset();
    const errBox = h("div", { class: "form-error", id: "form-error", role: "alert" });
    const save2 = async () => {
      errBox.textContent = "";
      try {
        if (editing) {
          await updatePlantMeta(ctx.db, id, {
            name: name.value,
            variety: variety.value,
            location: location2.value,
            source: st.source,
            baseOverride: base.value === "" ? null : Number(base.value),
            potVolumeL: potValue(),
            substrate: substrate || null,
            plannedHarvestAt: plannedIso(),
            stockPreset: stockPreset || null
          });
          await rememberPreset(editing.category, variety.value);
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
          learnedBase: init.learnedBase || null,
          potVolumeL: potValue() ?? void 0,
          substrate: substrate || void 0,
          plannedHarvestAt: plannedIso() ?? void 0,
          stockPreset: harv.checked && stockPreset ? stockPreset : void 0
        });
        if (harv.checked) await rememberPreset(st.category, variety.value);
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
          save2();
        } },
        field(`${S.ui.name} *`, name),
        field(S.ui.variety, variety),
        field(`${S.ui.category} *`, cat.el, editing ? "Kategorii nelze m\u011Bnit." : null),
        field(S.ui.lifecycle, life.el),
        field(`${S.ui.environment} *`, env2.el),
        h("label", { class: "check-row" }, harv, h("span", {}, S.ui.harvestable)),
        editing ? null : field(S.ui.stageLabel, stage),
        field(S.ui.location, location2),
        field(S.ui.sourceLabel, src.el),
        editing ? null : field(S.ui.startDate, start),
        field(S.ui.potVolume2, potVol),
        field(S.ui.substrateLabel, subChips.el),
        field(S.ui.plannedHarvest, planned),
        presetField,
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
    await refreshPriors();
    const events = await getEvents(ctx.db, id);
    const refresh = () => renderPlant(root2, id);
    const nowIso2 = now();
    const url = await photoUrl(ctx.db, latestPhotoId(events));
    const stages = getStages(plant.category, plant.lifecycle);
    const info = dryingInfo(plant, ctx.rules);
    const tasks = getPlantTasks(plant, nowIso2, engineOpts()).sort((a, b) => a.dueAt < b.dueAt ? -1 : 1);
    const locked = !!plant.archivedAt;
    const pendingBatches = (plant.cache.batches || []).filter((b) => b.phase === "pending");
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
    const caring = !locked && isCaredFor(plant.cache.stage);
    const feeding = caring && !isDormant(plant.cache.stage);
    const actionList = [
      caring ? act("water", "drop", S.ui.wateredNow, () => quickWatered(plant, refresh)) : null,
      caring ? act("moisture", "drop", S.ui.moistureCheck, () => moistureSheet(plant, refresh)) : null,
      feeding ? act("fertilize", "leaf", S.ui.fertilize, () => fertilizeSheet(plant, refresh)) : null,
      caring ? act("pest", "bug", S.ui.pestCheck, () => pestCheckSheet(plant, refresh)) : null,
      caring ? act("problem", "status-critical", S.ui.problem, () => problemSheet(plant, refresh)) : null,
      act("note", "note", S.ui.addNote, () => noteSheet(plant, refresh)),
      act("photo", "camera", S.ui.addPhoto, () => photoSheet(plant, refresh)),
      act("measure", "thermo", S.ui.measurement, () => measurementSheet(plant, refresh)),
      act("milestone", "flag", S.ui.milestone, () => milestoneSheet(plant, refresh)),
      act("care", "leaf", S.ui.care, () => careSheet(plant, refresh)),
      plant.harvestable ? act("harvest", "leaf", S.ui.harvest, () => harvestSheet(plant, refresh)) : null,
      plant.harvestable ? act("taste", "check", S.ui.tasting, () => evaluationSheet(plant, refresh, { kind: "tasting" })) : null,
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
        h("div", { class: "item-name" }, S.taskLabel[t.type] + (t.note && t.type !== "stockLow" ? ` \u2013 ${t.note}` : "")),
        h("div", { class: "item-detail" }, h("span", { class: "item-sub" }, `${t.phase ? `${S.batchPhase[t.phase] || t.phase} \xB7 ` : ""}${relDay(t.dueAt, nowIso2)}`))
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
      hasStockTab(plant) ? ["stock", S.stock.tab] : null,
      canEval ? ["evaluation", S.ui.evaluation] : null,
      ["care", S.ui.careTab]
    ].filter(Boolean);
    if (tabRequest.id === id && tabs.some(([k]) => k === tabRequest.tab)) {
      tab = tabRequest.tab;
      tabPlant = id;
    }
    tabRequest.id = null;
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
      if (tab === "stock") return stockPanel(plant, refresh, nowIso2);
      if (tab === "milestones") return milestonesPanel();
      if (tab === "evaluation") return evaluationPanel();
      if (tab === "care") return carePanel();
      return diaryPanel();
    }
    async function diaryPanel() {
      const rows = diaryRows(events);
      const items = await Promise.all(rows.map(async (r) => {
        const src = r.photoId ? await photoUrl(ctx.db, r.photoId) : null;
        const canVoid = !locked || ["note", "photo", "evaluation", "batch_step", "batch_check", "stock_init", "stock_use", "stock_adjust", "stock_move", "stock_check"].includes(r.event.type);
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
              const doVoid = async () => {
                try {
                  await voidEvent(ctx.db, id, r.event.id);
                  closeSheet();
                  toast("Z\xE1znam zru\u0161en");
                  refresh();
                } catch (e) {
                  toast(e.message);
                }
              };
              if (r.event.type !== "harvest") return doVoid();
              openSheet(S.ui.voidConfirm, h(
                "div",
                { class: "stack" },
                h("p", { class: "muted" }, S.ui.voidHarvestAsk),
                h("button", { type: "button", class: "btn btn-danger", id: "btn-void-harvest", onclick: doVoid }, S.ui.voidConfirm),
                h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel)
              ));
            }
          }, icon("trash"))
        );
      }));
      return h("div", { class: "card timeline" }, items);
    }
    const batchOf = (e) => (plant.cache.batches || []).find((b) => b.id === (e.payload.batchId ?? e.id)) ?? null;
    function batchBlock(b) {
      if (!b || b.legacy) return null;
      const open = !BATCH_ENDED.includes(b.phase);
      const t = b.phase === "drying" ? Math.floor((Date.parse(nowIso2) - Date.parse(b.phaseSince)) / 864e5) : null;
      const lastCheck = b.checks.at(-1);
      const bits = [
        S.batchPhase[b.phase] || b.phase,
        t != null ? S.ui.dayOf(t + 1, Math.round(batchEstimate(b, plant))) : null,
        b.dryDays != null ? S.ui.dryMeasured(num3(b.dryDays, 1)) : null,
        lastCheck?.dryness != null ? `${S.ui.dryness}: ${lastCheck.dryness}/5` : null,
        lastCheck?.mold ? S.ui.moldFound : null,
        b.evals.length ? `${S.ui.evaluation}: ${b.evals.length}\xD7` : null
      ].filter(Boolean);
      return h(
        "div",
        { class: "batch-block", dataset: { batch: b.id, phase: b.phase } },
        h("div", { class: "timeline-detail batch-state" }, bits.join(" \xB7 ")),
        h(
          "div",
          { class: "batch-actions" },
          b.phase === "pending" ? h("button", { type: "button", class: "btn btn-primary btn-sm", dataset: { act: "method" }, onclick: () => batchMethodSheet(plant, b, refresh) }, S.ui.batchMethod) : null,
          open && b.phase !== "pending" ? h("button", { type: "button", class: "btn btn-secondary btn-sm", dataset: { act: "check" }, onclick: () => batchCheckSheet(plant, b, refresh) }, S.ui.batchCheck) : null,
          open && b.phase !== "pending" ? h("button", { type: "button", class: "btn btn-secondary btn-sm", dataset: { act: "move" }, onclick: () => batchStepSheet(plant, b, refresh) }, S.ui.batchMove) : null,
          stockEligible(b) ? h("button", { type: "button", class: "btn btn-secondary btn-sm", dataset: { act: "stock" }, onclick: () => stockInitSheet(plant, b, refresh) }, S.stock.init) : null,
          plant.harvestable && b.phase !== "discarded" ? h("button", { type: "button", class: "btn btn-secondary btn-sm", dataset: { act: "eval" }, onclick: () => evaluationSheet(plant, refresh, { batchId: b.id }) }, S.ui.evaluate) : null
        )
      );
    }
    function learnNote() {
      const own = plant.cache.dryLearn;
      if (own?.ratio != null) return h("div", { class: "muted drying-learn", id: "drying-learn" }, S.ui.dryLearned(num3(own.ratio, 2), own.n));
      const r = batchRatio(plant, { ratio: null }, ctx.priors);
      return r !== 1 ? h("div", { class: "muted drying-learn", id: "drying-prior" }, S.ui.dryPrior(num3(r, 2))) : null;
    }
    function harvestsPanel() {
      const cfg = CATEGORIES[plant.category];
      const hv = live.filter((e) => e.type === "harvest").reverse();
      const totals = harvestTotals(plant, events);
      const line = (p) => cfg.harvestFields.filter((f) => Number.isFinite(p[f.key])).map((f) => `${S.harvestField[f.key]}: ${num3(p[f.key], 2)}`).join(" \xB7 ");
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
            h("div", { class: "timeline-title" }, `${fmtDate(e.occurredAt)}${e.payload.final ? ` \xB7 ${S.ui.lastHarvestTag}` : ""}${e.payload.edited ? ` \xB7 ${S.ui.editedTag}` : ""}`),
            h("div", { class: "timeline-detail" }, line(e.payload)),
            e.payload.processingDays != null ? h("div", { class: "timeline-detail" }, `${S.ui.processingDays}: ${e.payload.processingDays}`) : null,
            e.payload.note ? h("div", { class: "timeline-detail" }, e.payload.note) : null,
            batchBlock(batchOf(e))
          ),
          locked ? null : h("button", {
            type: "button",
            class: "btn btn-ghost btn-sm",
            dataset: { act: "edit-harvest" },
            "aria-label": S.ui.editHarvest,
            title: S.ui.editHarvest,
            onclick: () => harvestSheet(plant, refresh, e)
          }, icon("edit"))
        ))) : h("div", { class: "empty-state" }, S.ui.noHarvests),
        learnNote(),
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
      const cur = hist.find((r) => r.kind === "final");
      const taste = hist.filter((r) => r.kind === "tasting");
      const current = ["overall", ...activeCriteria(plant.category, ctx.criteria).map((c) => c.key)];
      const stored = Object.keys(cur?.event.payload.scores || {});
      const criteria = [...current, ...stored.filter((k) => !current.includes(k))];
      const rows = (list) => list.map((r) => h(
        "div",
        { class: "timeline-row muted-row", dataset: { kind: r.kind } },
        h(
          "div",
          { class: "timeline-body" },
          h(
            "div",
            { class: "timeline-title" },
            h("span", { class: "stars" }, starsText(r.overall)),
            [r.season ? ` \xB7 ${r.season}` : "", r.part ? ` \xB7 ${r.part}` : ""].join("")
          ),
          r.note ? h("div", { class: "timeline-detail" }, r.note) : null,
          h("div", { class: "timeline-date" }, `${fmtDate(r.at)}${r.daysAfterHarvest != null ? ` \xB7 ${r.daysAfterHarvest} ${S.ui.daysAfter}` : ""}`)
        )
      ));
      return h(
        "div",
        {},
        cur ? h(
          "div",
          { class: "card pad", id: "eval-current" },
          h(
            "div",
            { class: "eval-head" },
            h("strong", {}, S.ui.current),
            cur.season ? h("span", { class: "tag" }, `${S.ui.seasonWord} ${cur.season}`) : null,
            cur.part ? h("span", { class: "tag" }, cur.part) : null
          ),
          criteria.filter((k) => cur.event.payload.scores[k]).map((k) => h(
            "div",
            { class: "eval-line" },
            h("span", {}, criterionLabel(k, ctx.criteria, plant.category) ?? k),
            h("span", { class: "stars" }, starsText(cur.event.payload.scores[k]))
          )),
          cur.event.payload.wouldGrowAgain != null ? h("div", { class: "eval-line" }, h("span", {}, S.ui.wouldGrowAgain), h("strong", {}, cur.event.payload.wouldGrowAgain ? S.ui.yes : S.ui.no)) : null,
          cur.note ? h("div", { class: "muted" }, `\u201E${cur.note}\u201C`) : null
        ) : h("div", { class: "empty-state" }, S.ui.noEval),
        h(
          "button",
          { type: "button", class: "btn btn-primary panel-btn", id: "btn-evaluate", onclick: () => evaluationSheet(plant, refresh, { kind: "final" }) },
          icon("check"),
          cur ? S.ui.updateEval : S.ui.evaluate
        ),
        plant.harvestable ? h(
          "button",
          { type: "button", class: "btn btn-secondary panel-btn", id: "btn-taste", onclick: () => evaluationSheet(plant, refresh, { kind: "tasting" }) },
          icon("check"),
          S.ui.tasting
        ) : null,
        taste.length ? h("div", { class: "section-title flush" }, S.ui.kindTasting) : null,
        taste.length ? h("div", { class: "card timeline", id: "eval-tastings" }, rows(taste)) : null,
        hist.filter((r) => r.kind === "final").length > 1 ? h("div", { class: "section-title flush" }, S.ui.history) : null,
        hist.filter((r) => r.kind === "final").length > 1 ? h("div", { class: "card timeline", id: "eval-history" }, rows(hist.filter((r) => r.kind === "final"))) : null
      );
    }
    function carePanel() {
      return h(
        "div",
        {},
        caring ? h(
          "div",
          { class: "card drying-info", id: "drying-info" },
          h("div", {}, `${S.ui.base}: `, h("strong", {}, `${num3(info.base)} ${S.ui.days}`)),
          h("div", {}, `${S.ui.learned}: `, h("strong", {}, info.learned == null ? "\u2014" : `${num3(info.learned)} ${S.ui.days}`)),
          h("div", {}, `${S.ui.confidence}: `, h("strong", {}, `${Math.round((info.confidence || 0) * 100)} %`)),
          plant.baseOverride ? h("div", {}, `${S.ui.baseOverride}: `, h("strong", {}, num3(plant.baseOverride))) : null
        ) : locked ? null : h("div", { class: "empty-state", id: "no-care-tasks" }, S.ui.noCareTasks),
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
      pendingBatches.length ? h(
        "div",
        { class: "banner pending-banner", id: "pending-banner" },
        h("span", { class: "grow" }, S.ui.batchPending),
        pendingBatches.map((b) => h("button", {
          type: "button",
          class: "btn btn-primary btn-sm",
          dataset: { act: "method" },
          onclick: () => batchMethodSheet(plant, b, refresh)
        }, `${S.ui.batchMethod} ${fmtDate(b.harvestedAt)}`))
      ) : null,
      actions,
      tabBar,
      panel,
      bottom
    );
    return void 0;
  }

  // js/ui-criteria.js
  async function saveCriteria(next) {
    const clean4 = cleanCriteria(next);
    await metaSet(ctx.db, "criteria", clean4);
    ctx.criteria = clean4;
    return clean4;
  }
  var withEntries = (category, list) => ({ ...ctx.criteria, [category]: list });
  function categoryCard(category, refresh) {
    const entries = criteriaEntries(category, ctx.criteria);
    const active = entries.filter((e) => !e.removed);
    const removed = entries.filter((e) => e.removed);
    const commit = async (list) => {
      await saveCriteria(withEntries(category, list));
      toast(S.crit.saved);
      refresh();
    };
    const err = h("div", { class: "form-error" });
    const rowFor = (e) => {
      const input = h("input", {
        type: "text",
        class: "crit-input",
        maxlength: String(LABEL_MAX2),
        value: e.label,
        "aria-label": S.crit.renameHint,
        dataset: { crit: e.key },
        onchange: async (ev) => {
          const label = ev.target.value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
          if (!label) {
            ev.target.value = e.label;
            return;
          }
          await commit(entries.map((x) => x.key === e.key ? { ...x, label } : x));
        }
      });
      return h(
        "div",
        { class: "crit-row", dataset: { key: e.key } },
        input,
        h("button", {
          type: "button",
          class: "btn btn-ghost btn-sm",
          title: S.crit.remove,
          "aria-label": S.crit.remove,
          dataset: { remove: e.key },
          onclick: () => commit(entries.map((x) => x.key === e.key ? { ...x, removed: true } : x))
        }, icon("trash"))
      );
    };
    const addInput = h("input", { type: "text", class: "crit-input", maxlength: String(LABEL_MAX2), placeholder: S.crit.addHint, id: `crit-new-${category}` });
    const add = async () => {
      err.textContent = "";
      const label = addInput.value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
      if (!label) return;
      if (entries.length >= CRITERIA_MAX) {
        err.textContent = S.crit.limit;
        return;
      }
      await commit([...entries, { key: newCriterionKey(label, entries.map((x) => x.key)), label }]);
    };
    addInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        add();
      }
    });
    return h(
      "section",
      { class: "card pad crit-group", dataset: { category } },
      h("h3", {}, S.category[category]),
      h("div", { class: "crit-row crit-fixed" }, h("span", { class: "crit-label" }, S.crit.overall)),
      active.length ? active.map(rowFor) : h("p", { class: "muted" }, S.crit.empty),
      h(
        "div",
        { class: "crit-row crit-add" },
        addInput,
        h("button", { type: "button", class: "btn btn-secondary btn-sm", id: `crit-add-${category}`, onclick: add }, icon("plus"), S.crit.add)
      ),
      err,
      removed.length ? h(
        "div",
        { class: "crit-removed" },
        h("div", { class: "muted" }, S.crit.removed),
        removed.map((e) => h(
          "div",
          { class: "crit-row", dataset: { removed: e.key } },
          h("span", { class: "crit-label muted" }, e.label),
          h("button", {
            type: "button",
            class: "btn btn-ghost btn-sm",
            dataset: { restore: e.key },
            onclick: () => commit(entries.map((x) => x.key === e.key ? { key: x.key, label: x.label } : x))
          }, S.crit.restore)
        ))
      ) : null,
      ctx.criteria[category] ? h("button", {
        type: "button",
        class: "btn btn-ghost btn-sm",
        dataset: { reset: category },
        onclick: async () => {
          const next = { ...ctx.criteria };
          delete next[category];
          await saveCriteria(next);
          toast(S.crit.saved);
          refresh();
        }
      }, icon("swap"), S.crit.reset) : null
    );
  }
  async function renderCriteria(root2) {
    const alive = guard();
    const refresh = () => renderCriteria(root2);
    if (!alive()) return void 0;
    put(
      clear(root2),
      h(
        "div",
        { class: "top-bar" },
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-back", "aria-label": S.ui.back, onclick: () => navigate("/settings") }, icon("back")),
        h("h1", {}, S.crit.title),
        h("span")
      ),
      h("p", { class: "muted rules-intro" }, S.crit.intro),
      Object.keys(CATEGORIES).map((c) => categoryCard(c, refresh))
    );
    return void 0;
  }

  // js/ui-rules.js
  var ORDERED = [
    ["eval.remind1Days", "eval.remind2Days", "eval.remind3Days"],
    ["eval.freshRemind1Days", "eval.freshRemind2Days"],
    ["batch.drying.minDays", "batch.drying.maxDays"],
    ["drying.minFactor", "drying.maxFactor"],
    ["pot.minFactor", "pot.maxFactor"]
  ];
  function orderViolation(rules, key, value) {
    const next = { ...rules, [key]: value };
    return ORDERED.some((grp) => grp.includes(key) && grp.some((k, i) => i > 0 && next[k] < next[grp[i - 1]]));
  }
  async function saveRules(overrides) {
    const clean4 = cleanRules(overrides);
    await metaSet(ctx.db, "rules", clean4);
    ctx.overrides = clean4;
    ctx.rules = resolveRules(clean4);
    await rebuildAll(ctx.db);
    return clean4;
  }
  function ruleLabel(def) {
    const L = S.rules.label[def.key];
    if (L) return L;
    const parts = def.key.split(".");
    if (parts[0] === "cat") return `${S.category[parts[1]]}: ${S.rules.cat[parts[2]]}`;
    if (def.key.startsWith("drying.env.")) return `${S.rules.dryEnv}: ${S.environment[parts[2]]}`;
    if (def.key.startsWith("pot.substrate.")) return `${S.rules.potSub}: ${S.substrate[parts[2]]}`;
    if (def.key.startsWith("season.on.")) return `${S.rules.seasonOn}: ${S.environment[parts[2]]}`;
    if (def.key.startsWith("season.")) return `${S.rules.seasonOf}: ${S.profile[parts[1]]}`;
    return def.key;
  }
  var defText = (def) => {
    if (def.kind === "bool") return def.def ? S.rules.yes : S.rules.no;
    if (def.kind === "choice") return S.rules.afterChoice[def.def];
    return `${num3(def.def, 2)}${def.unit ? ` ${def.unit}` : ""}`;
  };
  function ruleRow(def, refresh) {
    const cur = ctx.rules[def.key];
    const changed = cur !== DEFAULT_RULES[def.key];
    const err = h("div", { class: "form-error rule-error" });
    const apply = async (value) => {
      err.textContent = "";
      if (!validRule(def.key, value)) {
        err.textContent = def.kind === "num" ? S.rules.invalid(def.min, def.max) : S.err.invalid;
        return false;
      }
      if (def.kind === "num" && orderViolation(ctx.rules, def.key, value)) {
        err.textContent = S.rules.order;
        return false;
      }
      const next = { ...ctx.overrides };
      if (value === DEFAULT_RULES[def.key]) delete next[def.key];
      else next[def.key] = value;
      try {
        await saveRules(next);
        toast(S.rules.saved);
      } catch (e) {
        err.textContent = e.message || S.err.invalid;
        return false;
      }
      refresh();
      return true;
    };
    let control;
    if (def.kind === "num") {
      control = h("input", {
        type: "number",
        class: "rule-input",
        id: `rule-${def.key}`,
        step: String(def.step),
        min: String(def.min),
        max: String(def.max),
        inputmode: "decimal",
        value: cur,
        dataset: { rule: def.key },
        onchange: async (e) => {
          if (e.target.value === "") return apply(DEFAULT_RULES[def.key]);
          const ok = await apply(Number(e.target.value));
          if (!ok) e.target.value = cur;
          return ok;
        }
      });
    } else if (def.kind === "bool") {
      const g = chipGroup([[true, S.rules.yes], [false, S.rules.no]], cur, (v) => apply(v));
      g.el.id = `rule-${def.key}`;
      control = g.el;
    } else {
      const g = chipGroup(def.options.map((o) => [o, S.rules.afterChoice[o]]), cur, (v) => apply(v));
      g.el.id = `rule-${def.key}`;
      control = g.el;
    }
    return h(
      "div",
      { class: `rule-row${changed ? " changed" : ""}`, dataset: { rule: def.key } },
      h(
        "div",
        { class: "rule-main" },
        h("div", { class: "rule-label" }, ruleLabel(def)),
        h("div", { class: "rule-meta" }, `${S.rules.def}: ${defText(def)}${changed ? ` \xB7 ${S.rules.changed}` : ""}`)
      ),
      h(
        "div",
        { class: "rule-control" },
        control,
        def.kind === "num" && def.unit ? h("span", { class: "rule-unit" }, def.unit) : null,
        changed ? h("button", {
          type: "button",
          class: "btn btn-ghost btn-sm",
          dataset: { reset: def.key },
          "aria-label": S.rules.reset,
          title: S.rules.reset,
          onclick: () => apply(DEFAULT_RULES[def.key])
        }, icon("swap")) : null
      ),
      err
    );
  }
  async function renderRules(root2) {
    const alive = guard();
    const refresh = () => renderRules(root2);
    const changedCount = RULE_DEFS.filter((d) => ctx.rules[d.key] !== d.def).length;
    if (!alive()) return void 0;
    put(
      clear(root2),
      h(
        "div",
        { class: "top-bar" },
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-back", "aria-label": S.ui.back, onclick: () => navigate("/settings") }, icon("back")),
        h("h1", {}, S.rules.title),
        h("span")
      ),
      h("p", { class: "muted rules-intro" }, S.rules.intro),
      h(
        "div",
        { class: "rules-summary" },
        h("strong", { id: "rules-changed" }, S.rules.changedCount(changedCount)),
        h("button", { type: "button", class: "btn btn-secondary btn-sm", id: "btn-rules-reset", disabled: !changedCount, onclick: () => resetAll(refresh) }, S.rules.resetAll)
      ),
      RULE_GROUPS.map((g) => h(
        "section",
        { class: "card pad rules-group", dataset: { group: g } },
        h("h3", {}, S.rules.group[g]),
        h("p", { class: "muted" }, S.rules.groupHint[g]),
        g === "afterHarvest" ? h("p", { class: "muted" }, S.rules.afterHint) : null,
        RULE_DEFS.filter((d) => d.group === g).map((d) => ruleRow(d, refresh))
      ))
    );
    return void 0;
  }
  function resetAll(refresh) {
    openSheet(S.rules.resetAll, h(
      "div",
      { class: "stack" },
      h("p", { class: "muted" }, S.rules.resetAllAsk),
      h("button", { type: "button", class: "btn btn-primary", id: "btn-rules-reset-go", onclick: async () => {
        try {
          await saveRules({});
          closeSheet();
          toast(S.rules.resetDone);
          refresh();
        } catch (e) {
          toast(e.message);
        }
      } }, S.rules.resetAll),
      h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel)
    ));
  }

  // js/ui-stockcfg.js
  var T2 = S.stock;
  var clone = (o) => JSON.parse(JSON.stringify(o));
  async function save(next) {
    const clean4 = cleanStock(next);
    await metaSet(ctx.db, "stock", clean4);
    ctx.stockCfg = clean4;
    await refreshPriors();
    return clean4;
  }
  var numInput = (value, def, extra = {}) => h("input", { type: "number", inputmode: "decimal", step: "any", value: value ?? "", placeholder: def != null ? String(def) : "", ...extra });
  function methodSheet(key, refresh) {
    const M = resolveMethods(ctx.stockCfg);
    const cur = M[key];
    const builtin = key in BUILTIN_METHODS;
    const label = h("input", { type: "text", maxlength: 40, value: cur.label, id: "method-label" });
    const inputs = Object.fromEntries(METHOD_PARAMS.map((p) => [p.key, numInput(
      cur[p.key],
      builtin ? BUILTIN_METHODS[key][p.key] : null,
      { min: p.min, max: p.max, id: `mp-${p.key}`, step: p.step ?? (p.int ? 1 : "any") }
    )]));
    const err = h("div", { class: "form-error", id: "method-error" });
    const apply = async (reset) => {
      const methods = clone(ctx.stockCfg.methods);
      if (reset) delete methods[key];
      else {
        const o = { label: label.value.trim() };
        if (!o.label) {
          err.textContent = T2.nameNeeded;
          return;
        }
        for (const p of METHOD_PARAMS) {
          const raw = inputs[p.key].value;
          if (raw === "") continue;
          const v = Number(raw);
          if (!Number.isFinite(v) || v < p.min || v > p.max || p.int && !Number.isInteger(v)) {
            err.textContent = `${T2.param[p.key]}: ${T2.invalid}`;
            return;
          }
          o[p.key] = v;
        }
        methods[key] = o;
      }
      await save({ ...ctx.stockCfg, methods });
      closeSheet();
      toast(T2.saved2);
      refresh();
    };
    openSheet(cur.label, h(
      "div",
      {},
      field(T2.name, label),
      METHOD_PARAMS.map((p) => field(T2.param[p.key], inputs[p.key])),
      err,
      h(
        "div",
        { class: "form-actions" },
        builtin ? h("button", { type: "button", class: "btn btn-secondary", id: "btn-method-reset", onclick: () => apply(true) }, T2.reset) : h("button", { type: "button", class: "btn btn-danger", id: "btn-method-delete", onclick: () => apply(true) }, T2.delete),
        h("button", { type: "button", class: "btn btn-primary", id: "btn-method-save", onclick: () => apply(false) }, S.ui.save)
      )
    ));
  }
  function newMethodSheet(refresh) {
    const M = resolveMethods(ctx.stockCfg);
    const name = h("input", { type: "text", maxlength: 40, id: "new-method-name" });
    const from = chipGroup(Object.values(M).map((m2) => [m2.key, m2.label]), "jar");
    const err = h("div", { class: "form-error" });
    openSheet(T2.addMethod, h(
      "div",
      {},
      field(T2.name, name),
      field(T2.cloneOf, from.el),
      err,
      h(
        "div",
        { class: "form-actions" },
        h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel),
        h("button", { type: "button", class: "btn btn-primary", id: "btn-new-method-save", onclick: async () => {
          const label = name.value.trim();
          if (!label) {
            err.textContent = T2.nameNeeded;
            return;
          }
          const src = M[from.get()];
          const key = newKey("x", Object.keys(M));
          const o = { label };
          for (const p of METHOD_PARAMS) o[p.key] = src[p.key];
          await save({ ...ctx.stockCfg, methods: { ...clone(ctx.stockCfg.methods), [key]: o } });
          closeSheet();
          toast(T2.saved2);
          refresh();
        } }, S.ui.save)
      )
    ));
  }
  function presetSheet(key, refresh) {
    const P = resolvePresets(ctx.stockCfg);
    const M = resolveMethods(ctx.stockCfg);
    const cur = key ? P[key] : { method: "jar", maturingDays: null, useByPct: null, checkDays: null, kFactor: 1, label: "" };
    const builtin = key in BUILTIN_PRESETS;
    const label = h("input", { type: "text", maxlength: 40, value: cur.label, id: "preset-label" });
    const method = chipGroup(Object.values(M).map((m2) => [m2.key, m2.label]), cur.method);
    method.el.id = "preset-method";
    const def = builtin ? BUILTIN_PRESETS[key] : {};
    const fields = [["maturingDays", 0, 365], ["useByPct", 5, 95], ["checkDays", 1, 730], ["kFactor", 0.2, 5]];
    const inputs = Object.fromEntries(fields.map(([f, lo, hi]) => [f, numInput(cur[f], def[f] ?? (f === "kFactor" ? 1 : null), { min: lo, max: hi, id: `pp-${f}` })]));
    const err = h("div", { class: "form-error", id: "preset-error" });
    const apply = async (remove) => {
      const presets = clone(ctx.stockCfg.presets);
      const id = key ?? newKey("p", Object.keys(P));
      if (remove) delete presets[id];
      else {
        const o = { label: label.value.trim(), method: method.get() };
        if (!o.label) {
          err.textContent = T2.nameNeeded;
          return;
        }
        for (const [f, lo, hi] of fields) {
          if (inputs[f].value === "") continue;
          const v = Number(inputs[f].value);
          if (!Number.isFinite(v) || v < lo || v > hi) {
            err.textContent = `${T2.presetField[f]}: ${T2.invalid}`;
            return;
          }
          o[f] = v;
        }
        presets[id] = o;
      }
      await save({ ...ctx.stockCfg, presets });
      closeSheet();
      toast(T2.saved2);
      refresh();
    };
    openSheet(key ? cur.label : T2.addPreset, h(
      "div",
      {},
      field(T2.name, label),
      field(T2.presetField.method, method.el),
      fields.map(([f]) => field(T2.presetField[f], inputs[f])),
      err,
      h(
        "div",
        { class: "form-actions" },
        key ? h("button", { type: "button", class: builtin ? "btn btn-secondary" : "btn btn-danger", id: "btn-preset-reset", onclick: () => apply(true) }, builtin ? T2.reset : T2.delete) : h("button", { type: "button", class: "btn btn-secondary", onclick: closeSheet }, S.ui.cancel),
        h("button", { type: "button", class: "btn btn-primary", id: "btn-preset-save", onclick: () => apply(false) }, S.ui.save)
      )
    ));
  }
  var methodSummary = (m2) => [
    `T\xBD ${num3(m2.tHalfProcessed, 0)} / ${num3(m2.tHalfFresh, 0)} d`,
    `kontrola ${m2.checkDays} d`,
    m2.airEveryDays ? `v\u011Btrat ${m2.airEveryDays} d` : null,
    m2.maturingDays ? `zr\xE1n\xED ${m2.maturingDays} d` : null
  ].filter(Boolean).join(" \xB7 ");
  async function renderStockCfg(root2) {
    const alive = guard();
    const refresh = () => renderStockCfg(root2);
    const M = resolveMethods(ctx.stockCfg);
    const P = resolvePresets(ctx.stockCfg);
    const catRows = Object.entries(CATEGORIES).filter(([, c]) => c.harvestable).map(([cat]) => {
      const chips = chipGroup([["", T2.presetDefault], ...Object.values(P).map((p) => [p.key, p.label])], ctx.stockCfg.categoryPreset[cat] ?? "", async (v) => {
        const categoryPreset = { ...ctx.stockCfg.categoryPreset };
        if (v) categoryPreset[cat] = v;
        else delete categoryPreset[cat];
        await save({ ...ctx.stockCfg, categoryPreset });
        toast(T2.saved2);
      });
      chips.el.id = `catpreset-${cat}`;
      return field(S.category[cat], chips.el);
    });
    if (!alive()) return;
    const row2 = (title, sub, id, onclick) => h(
      "div",
      { class: "item-row profile-row", role: "button", tabindex: 0, id, onclick },
      h("div", { class: "item-info" }, h("div", { class: "item-name" }, title), h("div", { class: "item-detail" }, h("span", { class: "item-sub" }, sub)))
    );
    put(
      clear(root2),
      h(
        "div",
        { class: "top-bar" },
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-back", "aria-label": S.ui.back, onclick: () => navigate("/settings") }, icon("back")),
        h("h1", {}, T2.settingsTitle),
        h("span")
      ),
      h("p", { class: "muted rules-intro" }, T2.settingsIntro),
      h(
        "section",
        { class: "card pad", id: "cfg-methods" },
        h("h3", {}, T2.methods),
        Object.values(M).map((m2) => row2(`${m2.label}${m2.custom ? ` (${T2.custom})` : ""}`, methodSummary(m2), `method-${m2.key}`, () => methodSheet(m2.key, refresh))),
        h("button", { type: "button", class: "btn btn-secondary panel-btn", id: "btn-add-method", onclick: () => newMethodSheet(refresh) }, icon("plus"), T2.addMethod)
      ),
      h(
        "section",
        { class: "card pad", id: "cfg-presets" },
        h("h3", {}, T2.presets),
        Object.values(P).map((p) => row2(
          `${p.label}${p.custom ? ` (${T2.custom})` : ""}`,
          [M[p.method]?.label, p.maturingDays != null ? `zr\xE1n\xED ${p.maturingDays} d` : null, p.useByPct != null ? `pr\xE1h ${p.useByPct} %` : null].filter(Boolean).join(" \xB7 "),
          `preset-${p.key}`,
          () => presetSheet(p.key, refresh)
        )),
        h("button", { type: "button", class: "btn btn-secondary panel-btn", id: "btn-add-preset", onclick: () => presetSheet(null, refresh) }, icon("plus"), T2.addPreset)
      ),
      h("section", { class: "card pad", id: "cfg-categories" }, h("h3", {}, T2.categoryDefaults), catRows),
      h("div", { class: "pad" }, h("button", { type: "button", class: "btn btn-secondary panel-btn", id: "btn-open-stock", onclick: () => navigate("/stock") }, T2.openOverview))
    );
  }

  // js/ui-stats.js
  var unitOf = (category) => {
    const key = CATEGORIES[category].harvestFields[0].key;
    return (S.harvestField[key].match(/\(([^)]+)\)/) || [])[1] || "";
  };
  var pct = (v) => v == null ? "\u2014" : `${Math.round(v * 100)} %`;
  var rating = (v) => v == null ? "\u2014" : h("span", { class: "stars" }, starsText(v), ` ${num3(v)}`);
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
        kv(S.ui.yieldTotal, g.totalYield ? `${num3(g.totalYield, 2)} ${unit}` : "\u2014"),
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
        kv(S.ui.yieldTotal, s.yield ? `${num3(s.yield, 2)} ${unit}` : "\u2014"),
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
      h("div", { class: "card pad" }, kv(S.ui.cycles, g.cycles), kv(S.ui.problemsPer, num3(g.problemsPerPlant)))
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
    try {
      if (await metaGet(db, "engineRev") !== ENGINE_REV) {
        await rebuildAll(db);
        await metaSet(db, "engineRev", ENGINE_REV);
      }
    } catch (e) {
      console.error("cache rebuild failed", e);
    }
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
    route("/settings/rules", renderRules, "settings");
    route("/settings/criteria", renderCriteria, "settings");
    route("/stock", renderStockOverview, "overview");
    route("/settings/stock", renderStockCfg, "settings");
    route("/install", renderInstall, "settings");
    await startRouter(document.getElementById("view"));
    window.pheno = { db, ...events_exports, ...model_exports };
  }
  boot().catch((e) => {
    document.getElementById("view").textContent = `Chyba: ${e.message}`;
    console.error(e);
  });
})();
