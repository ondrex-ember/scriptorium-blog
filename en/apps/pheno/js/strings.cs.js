// Czech UI strings. Neutral wording: no crop-specific terms.
export const S = {
  appName: 'Ember Pheno',
  subtitle: 'Deník pěstitele',
  nav: { overview: 'Přehled', walk: 'Obchůzka', varieties: 'Odrůdy', settings: 'Nastavení' },
  theme: { dark: 'Tmavé', light: 'Světlé' },
  category: {
    herb: 'Bylinka', vegetable: 'Zelenina', fruit: 'Ovoce',
    flower: 'Květina', tree_shrub: 'Strom / keř', houseplant: 'Pokojovka', other: 'Jiné'
  },
  environment: { outdoor: 'Venku', greenhouse: 'Skleník', indoor: 'Uvnitř', controlled: 'Řízené prostředí' },
  lifecycle: { cycle: 'Jednoletý cyklus', perennial: 'Víceletá' },
  stage: {
    seedling: 'Semenáček', planted: 'Zasazeno', growing: 'Růst', vegetative: 'Vegetativní růst',
    budding: 'Poupata', flowering: 'Kvetení', fruiting: 'Plodení', harvested: 'Sklizeno',
    dormant: 'Klid', done: 'Dokončeno'
  },
  substrate: { soil: 'Zemina', coco: 'Kokos', hydro: 'Hydro' },
  crit: {
    title: 'Kritéria hodnocení', open: 'Kritéria hodnocení', openHint: 'Pro každou kategorii přidej, přejmenuj nebo odeber kritéria. Stupnice zůstává 1–5.',
    intro: 'Kritéria se nabízejí v hodnocení rostlin dané kategorie. „Celkově“ je povinné. Odebrané kritérium zmizí z nových hodnocení, ale staré hodnoty zůstanou v historii a do nových průměrů se nepočítají.',
    overall: 'Celkově (povinné)', add: 'Přidat', addHint: 'Nové kritérium, např. Odolnost', removed: 'Odebraná kritéria', restore: 'Vrátit', remove: 'Odebrat',
    reset: 'Výchozí kritéria', saved: 'Uloženo.', empty: 'Zatím jen „Celkově“.', limit: 'Dosažen maximální počet kritérií.', renameHint: 'Přejmenovat'
  },
  rules: {
    title: 'Pravidla a intervaly', open: 'Pravidla a intervaly',
    intro: 'Všechny intervaly a koeficienty, které aplikace používá. Změna se hned propíše do úkolů. Cokoli můžeš vrátit na výchozí hodnotu.',
    openHint: 'Intervaly péče, kontroly dávek po sklizni, odhad sušení, květináče a roční období.',
    def: 'výchozí', changed: 'změněno', reset: 'Výchozí', resetAll: 'Vrátit vše na výchozí', resetAllAsk: 'Všechny změněné hodnoty se vrátí na výchozí. Pokračovat?',
    resetDone: 'Pravidla vrácena na výchozí', saved: 'Pravidla uložena', yes: 'Ano', no: 'Ne', changedCount: (n) => `Změněno: ${n}`,
    invalid: (min, max) => `Zadej číslo od ${min} do ${max}.`, order: 'Hodnoty musí jít od menší k větší.',
    group: {
      category: 'Intervaly podle kategorie', fertilizing: 'Hnojení', batch: 'Dávky po sklizni', eval: 'Hodnocení a připomínky',
      drying: 'Odhad doby sušení', pot: 'Květináč a substrát', season: 'Roční období', afterHarvest: 'Po poslední sklizni',
      dashboard: 'Přehled', stock: 'Zásoby po sklizni'
    },
    groupHint: {
      category: 'Základní doba schnutí substrátu, interval hnojení a kontroly škůdců pro každou kategorii.',
      fertilizing: 'Platí jen pro rostliny, o které se pečuje. Po sklizni se hnojení nepřipomíná.',
      batch: 'Jak často kontrolovat dávky v zpracování a kdy připomenout spotřebu čerstvých plodů.',
      eval: 'Připomínky se počítají od okamžiku „k použití“ (u čerstvých plodů od sklizně).',
      drying: 'Doba sušení = reference × velikost dávky^exponent × prostředí × naučený poměr.',
      pot: 'Větší květináč schne pomaleji, kokos a hydro rychleji.',
      season: 'Násobek intervalu zálivky podle ročního období a prostředí.',
      afterHarvest: 'Co se stane s rostlinou, když zaznamenáš poslední sklizeň.',
      dashboard: 'Hlavní seznam ukazuje jen úkoly po termínu a dnešní. Další jsou v rozbalovací sekci „Nadcházející“.',
      stock: 'Predikce spotřeby a prahy čerstvosti. Poločasy a kontroly jednotlivých způsobů skladování nastavíš v Nastavení → Skladování.'
    },
    afterChoice: { ask: 'Zeptat se', auto: 'Přepnout automaticky', manual: 'Nic neměnit' },
    afterHint: 'Zelenina, bylinky a květiny přejdou do „Sklizeno“, víceleté rostliny do „Klid“.',
    label: {
      'dashboard.lookaheadDays': 'Nadcházející úkoly: kolik dní dopředu',
      'stock.lowDays': 'Upozornit na dochází zásoba, když vydrží méně než',
      'stock.rateWindowDays': 'Spotřeba: okno pro výpočet průměru',
      'stock.useByPct': 'Spotřebovat do: práh čerstvosti',
      'stock.lowQualityPct': 'Varování při čerstvosti pod',
      'stock.minRateDays': 'Predikce až po (dní od prvního odběru)',
      'fertilizing.firstFeedDays': 'První hnojení po založení',
      'fertilizing.fruitingFactor': 'Násobek intervalu hnojení při plodení',
      'fertilizing.stopBeforeHarvestDays': 'Nehnojit před plánovanou sklizní',
      'batch.drying.minDays': 'Sušení: nejkratší interval kontrol',
      'batch.drying.maxDays': 'Sušení: nejdelší interval kontrol',
      'batch.drying.fraction': 'Sušení: kontrola po části zbývající doby',
      'batch.drying.nearDays': 'Sušení: interval u skoro suché dávky',
      'batch.curing.firstWeekDays': 'Zrání: první týden',
      'batch.curing.monthDays': 'Zrání: do 4 týdnů',
      'batch.curing.laterDays': 'Zrání: později',
      'batch.fermenting.days': 'Fermentace: interval kontrol',
      'batch.storing.freshDays': 'Skladování čerstvých plodů: interval kontrol',
      'batch.storing.driedDays': 'Skladování sušených dávek: interval kontrol',
      'batch.pickling.days': 'Nakládání: interval kontrol',
      'useBy.vegetable': 'Spotřebovat zeleninu do',
      'useBy.fruit': 'Spotřebovat ovoce do',
      'useBy.tree_shrub': 'Spotřebovat plody stromů a keřů do',
      'eval.remind1Days': 'Hodnocení: 1. připomínka',
      'eval.remind2Days': 'Hodnocení: 2. připomínka',
      'eval.remind3Days': 'Hodnocení: 3. připomínka',
      'eval.freshRemind1Days': 'Čerstvé plody: 1. připomínka',
      'eval.freshRemind2Days': 'Čerstvé plody: 2. připomínka',
      'eval.reviewDays': 'Připomenout „Změnil se tvůj názor?“ po',
      'drying.refDays': 'Referenční doba sušení',
      'drying.refWeightG': 'Referenční hmotnost dávky',
      'drying.sizeExponent': 'Vliv velikosti dávky (exponent)',
      'drying.minFactor': 'Nejkratší odhad (násobek reference)',
      'drying.maxFactor': 'Nejdelší odhad (násobek reference)',
      'drying.refHeightCm': 'Referenční výška rostliny',
      'drying.blendOld': 'Váha dosavadního odhadu při učení',
      'pot.refVolumeL': 'Referenční objem květináče',
      'pot.volumeExponent': 'Vliv objemu květináče (exponent)',
      'pot.minFactor': 'Nejmenší koeficient květináče',
      'pot.maxFactor': 'Největší koeficient květináče',
      afterFinalHarvest: 'Po poslední sklizni'
    },
    cat: { soilDays: 'schnutí substrátu', fertilizingDays: 'hnojení', pestCheckDays: 'kontrola škůdců' },
    dryEnv: 'Sušení', potSub: 'Substrát', seasonOf: 'Sezóna', seasonOn: 'Sezónnost'
  },
  moisture: { dry: 'Suché', ok: 'Akorát', wet: 'Vlhké' },
  problem: { pest: 'Škůdci', mold: 'Plíseň', wilting: 'Vadnutí', nutrient: 'Živiny', other: 'Jiné' },
  processing: {
    drying: 'Sušení', curing: 'Zrání', fermenting: 'Fermentace', pickling: 'Nakládání',
    freezing: 'Zmrazení', storing: 'Skladování', none: 'Bez zpracování', other: 'Jiné'
  },
  batchPhase: {
    pending: 'Čeká na určení zpracování', drying: 'Sušení', curing: 'Zrání', fermenting: 'Fermentace', pickling: 'Nakládání',
    freezing: 'Zmrazeno', storing: 'Skladování', other: 'Jiné zpracování', ready: 'K použití', used: 'Použito', discarded: 'Vyřazeno'
  },
  dryness: ['Čerstvé', 'Vlhké', 'Napůl suché', 'Skoro suché', 'Suché, dosychá', 'Hotovo, suché'],
  care: { pruning: 'Řez', repotting: 'Přesazení', misting: 'Rosení', rotation: 'Otočení', cleaning: 'Čištění listů', custom: 'Jiná péče' },
  evalKind: { tasting: 'Ochutnávka', final: 'Závěrečné hodnocení' },
  source: { seed: 'Semeno', cutting: 'Řízek', seedling: 'Sazenice', other: 'Jiné' },
  task: { watering: 'Zalít', fertilizing: 'Přihnojit', pestCheck: 'Zkontrolovat škůdce' },
  harvestField: {
    freshWeight: 'Čerstvá hmotnost (g)', processedWeight: 'Zpracovaná hmotnost (g)',
    totalWeight: 'Celková hmotnost (kg)', pieceCount: 'Počet kusů (ks)', avgSize: 'Průměrná velikost (cm)',
    brix: 'Brix (°Bx)', bloomCount: 'Počet květů (ks)', bloomDurationDays: 'Doba kvetení (dny)',
    quantity: 'Množství (ks)', processingMethod: 'Zpracování', processingDays: 'Dní zpracování', note: 'Poznámka'
  },
  criterion: {
    overall: 'Celkově', aroma: 'Aroma', flavor: 'Chuť', usability: 'Využitelnost', taste: 'Chuť',
    texture: 'Textura', yieldSatisfaction: 'Spokojenost s výnosem', sweetness: 'Sladkost',
    juiciness: 'Šťavnatost', growth: 'Růst', health: 'Zdraví', appearance: 'Vzhled', fragrance: 'Vůně', bloomDuration: 'Doba kvetení'
  },
  err: {
    name: 'Zadej název rostliny.',
    category: 'Vyber kategorii.',
    environment: 'Vyber prostředí.',
    notHarvestable: 'Tato rostlina se nesklízí.',
    archived: 'Rostlina je archivovaná.',
    notArchived: 'Rostlina není archivovaná.',
    confirmName: 'Pro trvalé smazání opiš název rostliny.',
    invalid: 'Neplatný záznam.',
    harvestDate: 'Sklizeň nemůže být později než její zpracování a kontroly.',
    stockInit: 'Zásobu lze založit až po určení zpracování a jen jednou.', noStock: 'Zásobník neexistuje nebo už je prázdný.',
    stockAmount: 'Odebíráš víc, než v zásobníku zbývá.', stockDate: 'Záznam nemůže být dřív než sklizeň nebo založení zásoby.'
  },
  taskLabel: {
    moisture: 'Zkontrolovat vlhkost', fertilizing: 'Přihnojit', pestCheck: 'Zkontrolovat škůdce',
    problemFollowUp: 'Zkontrolovat problém', batchCheck: 'Zkontrolovat dávku', useBy: 'Spotřebovat dávku', evaluation: 'Ohodnotit sklizeň', evaluationReview: 'Změnil se tvůj názor?',
    stockCheck: 'Zkontrolovat zásobník', stockAir: 'Vyvětrat zásobník', stockUseBy: 'Spotřebovat zásobník', stockLow: 'Dochází zásoba'
  },
  stock: {
    method: {
      freezer: 'Mrazák', vacuum: 'Vakuum', jar: 'Uzavřená sklenice', fridge: 'Lednice', soil: 'Zakopané v zemi',
      hanging: 'Visí v sušárně', open: 'Tma, pokojová teplota', light: 'Na světle', other: 'Jiný způsob'
    },
    preset: { generic: 'Obecná', tea: 'Čaj a sušené bylinky', cure: 'Zrání (delší vyležení)', fresh: 'Čerstvé plody' },
    param: {
      tHalfProcessed: 'Poločas čerstvosti zpracovaného (dny)', tHalfFresh: 'Poločas čerstvosti nezpracovaného (dny)',
      checkDays: 'Kontrola každých (dny)', moldRisk: 'Riziko plísně (0–2)', airEveryDays: 'Vyvětrat každých (dny, 0 = nikdy)',
      airForDays: 'Větrat prvních (dní)', maturingDays: 'Zrání bez ztráty (dny)', openCost: 'Ztráta za otevření (podíl)'
    },
    presetField: { method: 'Výchozí způsob', maturingDays: 'Zrání bez ztráty (dny)', useByPct: 'Spotřebovat při čerstvosti pod (%)', checkDays: 'Kontrola každých (dny)', kFactor: 'Rychlost stárnutí (×)' },
    tab: 'Zásoba', title: 'Zásoba', overview: 'Zásoby', overviewIntro: 'Co ještě zbývá po sklizni, napříč rostlinami.',
    empty: 'Zatím žádná zásoba. Po určení zpracování ji založ vážením.',
    none: 'Žádné zásoby k zobrazení.',
    init: 'Založit zásobu', initTitle: 'Založit zásobu',
    initHint: 'Kolik opravdu máš po zpracování. Můžeš ji rozdělit do více zásobníků (sklenice, sáčky) s různým uložením.',
    suggest: {
      processed: 'Podle zadané zpracované hmotnosti.', fresh: 'Podle hmotnosti sklizně.', none: 'Množství zadej ručně.',
      learned: (r) => `Odhad podle tvých předchozích dávek (×${r}). Zvaž a přepiš podle vážení.`,
      default: 'Hrubý odhad (čtvrtina čerstvé hmotnosti). Zvaž a přepiš podle vážení.'
    },
    unit: 'Jednotka', source: { weighed: 'Zváženo', estimate: 'Odhad' },
    estimate: 'Jen odhaduji', amount: 'Množství', label: 'Označení (nepovinné)', labelPh: 'např. sklenice A', storedIn: 'Uložení',
    addContainer: 'Přidat zásobník', removeContainer: 'Odebrat řádek', containerN: (n) => `Zásobník ${n}`, tooMany: 'Víc zásobníků už nejde.',
    needAmount: 'Zadej množství u každého zásobníku.', saved: 'Zásoba založena',
    left: 'Zbývá', of: 'z', fresh: 'čerstvost', maturing: (d) => `zraje do ${d}`, useBy: (d) => `spotřebuj do ${d}`,
    belowUseBy: 'pod prahem čerstvosti', moldTag: 'plíseň', opened: (n) => `otevřeno ${n}×`, since: 'od',
    learnedTag: (r, n) => `naučeno ×${r} (${n} ${n === 1 ? 'kontrola' : n >= 2 && n <= 4 ? 'kontroly' : 'kontrol'})`,
    priorTag: (r) => `odhad z ostatních ×${r}`,
    emptied: (n) => `Vyčerpáno nebo vyřazeno: ${n}`, batch: 'Dávka',
    use: 'Odebrat', useTitle: 'Odebrat ze zásoby', useHint: 'Kolik teď bereš.', useAll: 'Vzít vše', useCustom: 'Jiné množství',
    used: 'Odebráno', usedAll: 'Zásobník je prázdný', batchUsedUp: 'Dávka je spotřebovaná', firstUse: 'První odběr',
    tasteAsk: 'Ochutnáno? Zapiš si krátké hodnocení, než ti vyprchá z paměti.', tasteNow: 'Ohodnotit', tasteSkip: 'Teď ne',
    adjust: 'Zbývá cca', adjustTitle: 'Upravit zbývající množství', adjustHint: 'Odhadni nebo zvaž, kolik ve skutečnosti zbývá. Rozdíl se zapíše jako spotřeba.',
    adjusted: 'Množství upraveno',
    move: 'Přesunout', scope: 'Rozsah', moveTitle: 'Přesunout nebo rozdělit', moveWhole: 'Celý zásobník', movePart: 'Jen část', moveAmount: 'Kolik přesunout',
    moveTo: 'Nový způsob uložení', moved: 'Přesunuto', moveNeed: 'Vyber jiný způsob nebo část.',
    check: 'Kontrola', checkTitle: 'Kontrola zásobníku', checkHint: 'Vůně a vzhled stačí. Z nich se učí, jak rychle ti tenhle způsob uložení stárne.',
    scent: 'Vůně', look: 'Vzhled', mold: 'Plíseň', moldNo: 'Bez plísně', moldYes: 'Plíseň', rh: 'Vlhkost vzduchu v nádobě (%)', aired: 'Vyvětráno',
    checked: 'Kontrola zapsána', needCheck: 'Vyplň aspoň vůni, vzhled, plíseň nebo vlhkost.',
    moldAsk: 'Plíseň v zásobníku. Vyřadit ho? Ostatní zásobníky dostanou kontrolu hned.', moldKeep: 'Ponechat',
    discard: 'Vyřadit', discardTitle: 'Vyřadit zbytek', discardAsk: (a) => `Vyřadit zbývajících ${a}?`, discarded: 'Vyřazeno', reason: 'Důvod (nepovinné)',
    summary: 'Celkem zbývá', rate: (a, w) => `spotřeba ${a}/den (posledních ${w} dní)`, noRate: 'Spotřebu odhadnu po pár dnech odběrů.',
    runOut: (days, d) => `vydrží ~${days} dní (do ${d})`, presetLabel: 'Předvolba', presetHint: 'Mění výchozí uložení, zrání a práh čerstvosti.',
    presetDefault: 'Výchozí', presetPlant: 'Předvolba zásoby', presetPlantHint: 'Řídí výchozí uložení a stárnutí zásoby. Pamatuje se i pro odrůdu.',
    weighPrompt: 'Dávka je hotová. Zvážit a založit zásobu?', weighNow: 'Založit zásobu', weighLater: 'Později',
    archiveWarn: (n) => `Zbývá ${n}. Zásoba půjde dál spotřebovávat i po archivaci.`,
    settingsTitle: 'Skladování', settingsIntro: 'Způsoby uložení a předvolby zásoby. Čísla jsou výchozí odhady, přesněji se doladí z tvých kontrol.',
    methods: 'Způsoby uložení', presets: 'Předvolby zásoby', categoryDefaults: 'Výchozí předvolba podle kategorie',
    addMethod: 'Vlastní způsob', addPreset: 'Vlastní předvolba', cloneOf: 'Vychází z', reset: 'Vrátit výchozí', custom: 'vlastní',
    name: 'Název', delete: 'Smazat', saved2: 'Uloženo', nameNeeded: 'Zadej název.', invalid: 'Hodnota je mimo rozsah.',
    comparison: 'Jak se osvědčilo', comparisonHint: 'Průměrné hodnocení vůně a vzhledu při kontrolách podle způsobu uložení.',
    comparisonRow: (n, avg, age) => `${n}× · ${avg}/5 · typicky po ${age} dnech`, lateAvg: (n, avg) => `po 60+ dnech: ${avg}/5 (${n}×)`,
    comparisonNone: 'Zatím nemáš dost kontrol s hodnocením.', openOverview: 'Zásoby po sklizni', fromTasks: 'Otevřít zásobu',
    lowTask: (d) => `Při současné spotřebě vydrží asi ${d} dní.`, useByTask: 'Čerstvost klesla pod nastavený práh.',
    checkTask: 'Podívej se na vůni a vzhled.', airTask: 'Otevři a nech vyvětrat.'
  },
  ui: {
    today: 'Dnes', tomorrow: 'Zítra', yesterday: 'Včera', overdue: 'Po termínu', upcoming: 'Nadcházející', upcomingSection: 'Nadcházející',
    doneToday: 'Hotovo dnes', careToday: 'Dnešní péče', nextStep: 'Nejbližší krok', needsAttention: 'Vyžaduje pozornost',
    myPlants: 'Moje rostliny', newPlant: 'Nová rostlina', all: 'Vše', save: 'Uložit', cancel: 'Zrušit', back: 'Zpět',
    edit: 'Upravit', delete: 'Smazat trvale', snooze: 'Odložit', undo: 'Zpět', done: 'Hotovo',
    noPlants: 'Zatím žádné rostliny. Přidej první.', noTasks: 'Žádné úkoly na dohled.',
    soon: 'Připravujeme v dalším vydání.', appearance: 'Vzhled', hemisphere: 'Polokoule',
    north: 'Severní', south: 'Jižní', version: 'Verze', name: 'Název', variety: 'Odrůda', category: 'Kategorie',
    environment: 'Prostředí', lifecycle: 'Životní cyklus', harvestable: 'Sklízí se', stageLabel: 'Fáze',
    location: 'Místo', sourceLabel: 'Původ', startDate: 'Datum založení', photo: 'Fotka', note: 'Poznámka',
    date: 'Datum a čas', watered: 'Zalito', wateredNow: 'Zalito', moistureCheck: 'Kontrola vlhkosti',
    fertilize: 'Hnojení', pestCheck: 'Kontrola škůdců', problem: 'Problém', addNote: 'Poznámka',
    addPhoto: 'Fotka', measurement: 'Měření', milestone: 'Milník', changeEnv: 'Změna prostředí',
    timeline: 'Deník', care: 'Péče', drying: 'Schnutí', base: 'Základ', learned: 'Naučeno', confidence: 'Jistota',
    baseOverride: 'Vlastní základ (dny)', clone: 'Založit znovu', voidIt: 'Zrušit záznam', days: 'dní',
    foundPests: 'Něco jsem našel', severity: 'Závažnost', sinceWatering: 'od poslední zálivky',
    stillProblem: 'Problém trvá',
    harvest: 'Sklizeň', harvests: 'Sklizně', milestones: 'Milníky', evaluation: 'Hodnocení', careTab: 'Péče',
    recordHarvest: 'Zaznamenat sklizeň', evaluate: 'Ohodnotit', updateEval: 'Upravit hodnocení',
    processing: 'Zpracování po sklizni', processingDays: 'Dní zpracování', wouldGrowAgain: 'Pěstoval bych znovu',
    yes: 'Ano', no: 'Ne', season: 'Sezóna (rok)', current: 'Aktuální', history: 'Historie',
    noHarvests: 'Zatím žádné sklizně.', noMilestones: 'Zatím žádné milníky.', noEval: 'Zatím nehodnoceno.',
    total: 'Celkem', daysAfter: 'dní po sklizni', harvestSaved: 'Sklizeň uložena', editHarvest: 'Upravit sklizeň', harvestEdited: 'Sklizeň upravena', editedTag: 'upraveno',
    voidHarvestAsk: 'Zrušením sklizně zmizí i její zpracování a kontroly (hodnocení zůstanou). Opravdu zrušit?', voidConfirm: 'Zrušit sklizeň',
    nextStage: 'Přesunout do fáze', endCycle: 'Ukončit cyklus', keepGoing: 'Ještě sklízím',
    archive: 'Archivovat', unarchive: 'Obnovit z archivu', archived: 'Archivováno', later: 'Později',
    archiveAsk: 'Archivovat rostlinu? Zůstane v Odrůdách a půjde ji hodnotit dál.',
    archiveTitle: 'Archiv', varietiesTitle: 'Odrůdy', unnamed: 'bez odrůdy', plantsWord: 'rostlin',
    avgRating: 'Průměr hodnocení', growAgainShare: 'Pěstovat znovu', yieldTotal: 'Výnos celkem',
    yieldPerPlant: 'Na rostlinu', avgCycle: 'Délka cyklu', problemsPer: 'Problémů na rostlinu',
    cycles: 'Cyklů / sezón', noVarieties: 'Zatím není z čeho počítat.', overallRequired: 'Zvol celkové hodnocení.',
    plantsOfVariety: 'Rostliny této odrůdy', fillOne: 'Vyplň aspoň jednu hodnotu.', seasonWord: 'Sezóna', resolved: 'Vyřešeno', recordedUndo: 'Zaznamenáno',
    batchFine: 'V pořádku', lastHarvestTag: 'poslední sklizeň', pestClean: 'Čisto', pestFound: 'Nalezeno', finalHarvest: 'Je to poslední sklizeň této rostliny',
    finalHint: 'Další úkoly péče skončí a dávky se dál zpracovávají.', estDays: 'Odhad doby zpracování (dny, nepovinné)',
    pickMethod: 'Vyber zpracování.', afterHarvest: 'Po sklizni', batchCheck: 'Zkontrolovat', batchMove: 'Přesunout', batchMethod: 'Určit zpracování',
    batchPending: 'Sklizeň čeká na určení zpracování', batchesTitle: 'Dávky', noBatches: 'Zatím žádné dávky.',
    dryness: 'Stupeň vysušení', batchLook: 'Vzhled', mold: 'Plíseň', moldNone: 'Bez plísně', moldFound: 'Plíseň', scent: 'Vůně',
    movePhase: 'Přesunout do', dryDone: 'Dávka je suchá. Co dál?', useAsk: 'Dávka je ke spotřebě. Co s ní?', stillHave: 'Ještě mám',
    markUsed: 'Použito', markDiscarded: 'Vyřazeno', evalKind: 'Druh hodnocení', evalBatch: 'Co hodnotíš', evalPart: 'Jaká část (nepovinné)',
    evalPartHint: 'Např. horní větve, první zrání, jedna sklenice.', wholePlant: 'Celá rostlina', tasting: 'Ochutnávka',
    tastingHint: 'Průběžné hodnocení plodů. Nezapočítává se do závěrečného skóre.', finalEval: 'Závěrečné',
    careKind: 'Druh péče', careLabel: 'Název', potVolume: 'Objem nového květináče (l)', ready: 'k použití', phaseSince: 'od',
    dayOf: (t, n) => `den ${t} z ~${n}`, dryMeasured: (n) => `sušeno ${n} dní`,
    dryLearned: (r, n) => `Naučený poměr sušení: ×${r} (z ${n} ${n === 1 ? 'dávky' : 'dávek'})`,
    dryPrior: (r) => `Odhad podle ostatních rostlin: ×${r}`, afterFinalAsk: 'Poslední sklizeň zapsána. Přepnout rostlinu do dalšího stavu?',
    switchTo: 'Přepnout na', notYet: 'Ještě ne', switched: 'Stav změněn', batchSaved: 'Dávka uložena', kindFinal: 'Závěrečné', kindTasting: 'Ochutnávky',
    plantArchivedBatches: 'Rostlina je archivovaná, dávky se dál sledují.', noCareTasks: 'Rostlina je po sklizni, péče se nepřipomíná.'
  },
  persistWarn: 'Prohlížeč nepotvrdil trvalé úložiště. Doporučujeme pravidelně zálohovat.',
  profile: {
    question: 'Co pěstuješ nejčastěji?', intro: 'Jen nastaví výchozí hodnoty a ukázkové texty. Nic se neskrývá a půjde to změnit v Nastavení.',
    garden: 'Zahrada, balkon a skleník', houseplants: 'Pokojovky', controlled: 'Vnitřní pěstování s řízenými podmínkami', mixed: 'Od všeho něco',
    skip: 'Přeskočit', restore: 'Obnovit ze zálohy', label: 'Co pěstuji nejvíc', settingsHint: 'Mění jen výchozí hodnoty a pořadí přehledu.',
    season: 'Sezóna', seasonLine: (env, n) => `${n} ${n === 1 ? 'rostlina' : n >= 2 && n <= 4 ? 'rostliny' : 'rostlin'} venku a ve skleníku · ${env}`,
    spring: 'jaro', summer: 'léto', autumn: 'podzim', winter: 'zima',
    varieties: 'Odrůdy', milestones: 'Poslední milníky', measurements: 'Poslední měření', cycles: 'Běžící cykly',
    none: 'Zatím nic.', dayN: (n) => `den ${n}`, all: 'Všechny rostliny'
  },
  walk: {
    title: 'Obchůzka', empty: 'Není co obcházet. Přidej první rostlinu.', progress: (i, n) => `${i} z ${n}`,
    dueBadge: 'čeká kontrola', answered: 'Zapsáno', prev: 'Zpět', next: 'Dál', skip: 'Přeskočit',
    doneTitle: 'Obchůzka hotová', summary: (w, s) => `Zapsáno ${w}, přeskočeno ${s}.`, backHome: 'Zpět na přehled',
    lastWatered: 'Poslední zálivka', never: 'zatím nezalito', expected: 'Očekávané schnutí', swipe: 'Přejeď prstem pro další rostlinu.'
  },
  backup: {
    title: 'Záloha dat', export: 'Exportovat zálohu (ZIP)', import: 'Obnovit ze zálohy', lastExport: 'Poslední export',
    never: 'nikdy', exporting: 'Připravuji zálohu…', exported: 'Záloha stažena', importing: 'Importuji…',
    importAsk: 'Záloha se sloučí se stávajícími daty. Existující rostliny zůstanou beze změny, chybějící se doplní.',
    importBtn: 'Importovat', pickFile: 'Vyber soubor zálohy (.zip).', importDone: 'Import dokončen',
    plantsAdded: 'Přidáno rostlin', plantsExisting: 'Už existovalo', eventsAdded: 'Přidáno událostí',
    photosAdded: 'Přidáno fotek', skipped: 'Přeskočeno', conflicts: 'Rozdíly u existujících rostlin (nepřepsáno)',
    failed: 'Import se nepodařil', reminder: 'Data nebyla dlouho zálohována.', reminderBtn: 'Zálohovat',
    dismiss: 'Skrýt', hint: 'Data jsou jen v tomto zařízení. Záloha je jediná pojistka proti ztrátě.'
  },
  storage: {
    title: 'Úložiště', persistent: 'Trvalé úložiště', usage: 'Využito', unknown: 'neznámé', yes: 'ano', no: 'ne',
    installed: 'Nainstalováno', installState: 'Instalace', installedYes: 'ano, běží jako aplikace', installedNo: 'ne, běží v prohlížeči',
    installGuide: 'Návod k instalaci', iosWarn: 'V záložce Safari může iOS data po týdnech nepoužívání smazat. Přidej appku na plochu a zálohuj.'
  },
  install: {
    title: 'Instalace', intro: 'Nainstalovaná aplikace se chová stabilněji a iOS jí data nemaže.',
    iosTitle: 'iPhone / iPad (Safari)', ios: ['Otevři stránku v Safari.', 'Klepni na Sdílet.', 'Zvol Přidat na plochu.', 'Otevírej appku z ikony na ploše.'],
    chromeTitle: 'Android / počítač (Chrome, Edge)', chrome: ['Klepni na Nainstalovat níže, nebo v menu prohlížeče zvol Instalovat aplikaci.'],
    btn: 'Nainstalovat', unavailable: 'Prohlížeč teď instalaci nenabízí. Použij menu prohlížeče.', done: 'Aplikace už je nainstalovaná.'
  }
};

export function t(path, fallback = path) {
  let cur = S;
  for (const k of path.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(k in cur)) return fallback;
    cur = cur[k];
  }
  return typeof cur === 'string' ? cur : fallback;
}
