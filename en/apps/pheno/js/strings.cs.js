// Czech UI strings. Neutral wording: no crop-specific terms.
export const S = {
  appName: 'Ember Pheno',
  subtitle: 'Deník pěstitele',
  nav: { overview: 'Přehled', walk: 'Obchůzka', varieties: 'Odrůdy', settings: 'Nastavení' },
  theme: { dark: 'Tmavé', light: 'Světlé' },
  category: {
    herb: 'Bylinka', vegetable: 'Zelenina', fruit: 'Ovoce',
    flower: 'Květina', tree_shrub: 'Strom / keř', other: 'Jiné'
  },
  environment: { outdoor: 'Venku', greenhouse: 'Skleník', indoor: 'Uvnitř', controlled: 'Řízené prostředí' },
  lifecycle: { cycle: 'Jednoletý cyklus', perennial: 'Víceletá' },
  stage: {
    seedling: 'Semenáček', planted: 'Zasazeno', growing: 'Růst', vegetative: 'Vegetativní růst',
    budding: 'Poupata', flowering: 'Kvetení', fruiting: 'Plodení', harvested: 'Sklizeno',
    dormant: 'Klid', done: 'Dokončeno'
  },
  moisture: { dry: 'Suché', ok: 'Akorát', wet: 'Vlhké' },
  problem: { pest: 'Škůdci', mold: 'Plíseň', wilting: 'Vadnutí', nutrient: 'Živiny', other: 'Jiné' },
  processing: {
    drying: 'Sušení', fermenting: 'Fermentace', pickling: 'Nakládání',
    freezing: 'Zmrazení', storing: 'Skladování', none: 'Bez zpracování', other: 'Jiné'
  },
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
    juiciness: 'Šťavnatost', appearance: 'Vzhled', fragrance: 'Vůně', bloomDuration: 'Doba kvetení'
  },
  err: {
    name: 'Zadej název rostliny.',
    category: 'Vyber kategorii.',
    environment: 'Vyber prostředí.',
    notHarvestable: 'Tato rostlina se nesklízí.',
    archived: 'Rostlina je archivovaná.',
    notArchived: 'Rostlina není archivovaná.',
    confirmName: 'Pro trvalé smazání opiš název rostliny.',
    invalid: 'Neplatný záznam.'
  },
  taskLabel: {
    moisture: 'Zkontrolovat vlhkost', fertilizing: 'Přihnojit', pestCheck: 'Zkontrolovat škůdce',
    problemFollowUp: 'Zkontrolovat problém', evaluation: 'Ohodnotit sklizeň', evaluationReview: 'Změnil se tvůj názor?'
  },
  ui: {
    today: 'Dnes', tomorrow: 'Zítra', yesterday: 'Včera', overdue: 'Po termínu', upcoming: 'Nadcházející',
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
    total: 'Celkem', daysAfter: 'dní po sklizni', harvestSaved: 'Sklizeň uložena',
    nextStage: 'Přesunout do fáze', endCycle: 'Ukončit cyklus', keepGoing: 'Ještě sklízím',
    archive: 'Archivovat', unarchive: 'Obnovit z archivu', archived: 'Archivováno', later: 'Později',
    archiveAsk: 'Archivovat rostlinu? Zůstane v Odrůdách a půjde ji hodnotit dál.',
    archiveTitle: 'Archiv', varietiesTitle: 'Odrůdy', unnamed: 'bez odrůdy', plantsWord: 'rostlin',
    avgRating: 'Průměr hodnocení', growAgainShare: 'Pěstovat znovu', yieldTotal: 'Výnos celkem',
    yieldPerPlant: 'Na rostlinu', avgCycle: 'Délka cyklu', problemsPer: 'Problémů na rostlinu',
    cycles: 'Cyklů / sezón', noVarieties: 'Zatím není z čeho počítat.', overallRequired: 'Zvol celkové hodnocení.',
    plantsOfVariety: 'Rostliny této odrůdy', fillOne: 'Vyplň aspoň jednu hodnotu.', seasonWord: 'Sezóna', resolved: 'Vyřešeno', recordedUndo: 'Zaznamenáno'
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
