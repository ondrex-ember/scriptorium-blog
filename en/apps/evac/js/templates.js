/**
 * templates.js
 * Seed data - výchozí šablony kategorií a položek.
 * Zdroj: seed_data.json (Project docs), doplněno o:
 *  - `coefficients` (chybělo v MRD vzorci - viz poznámka níže)
 *  - `conditional` na úrovni položky (sjednoceno se stávajícím "conditional" na kategorii "pets")
 *  - `key` u každé kategorie/položky - stabilní, jazykově neutrální identifikátor
 *    použitý pro lokalizaci (viz js/i18n.js). `name`/`note` zůstávají jako český
 *    zdrojový text a zároveň fallback, pokud by pro daný jazyk chyběl překlad.
 *  - `unit` je jazykově neutrální kód (pcs, l, kg, g, pack, roll, pair, set,
 *    tablet, sachet, czk, eur) - zobrazovaný popisek řeší UNIT_LABELS v i18n.js,
 *    číselné výpočty (data-model.js) na kódu nezávisí.
 *
 * POZNÁMKA K DOPLNĚNÝM KOEFICIENTŮM:
 * MRD definuje vzorec:
 *   požadované_množství = spotřeba_na_osobu_na_den × dny × (dospělí + děti×koef + senioři×koef)
 * ale hodnotu koef nikde nezadává. Použity jsou obecně doporučované orientační
 * hodnoty pro plánování zásob (dítě ~0,75 spotřeby dospělého, senior ~0,9),
 * jsou to VÝCHOZÍ hodnoty - uživatel je může v Nastavení kdykoliv změnit.
 * Aplikují se pouze na položky se `consumption_per_person_per_day`
 * (denní spotřeba). Položky s `per_person` (napr. kopie dokladů, píšťalka -
 * každá osoba potřebuje svůj vlastní kus) se počítají prostým součtem osob,
 * bez koeficientu.
 */

const TEMPLATE_DATA = {
  "template_version": "1.1",
  "coefficients": {
    "children": 0.75,
    "seniors": 0.9
  },
  "base_profile": {
    "days": 10,
    "adults": 1,
    "children": 0,
    "seniors": 0,
    "pets": 0
  },
  "categories": [

    {
      "id": "documents",
      "key": "documents",
      "name": "Doklady a finance",
      "items": [
        {
          "key": "doc_photos",
          "name": "Foto dokladů v mobilu (OP, řidičák, kartička pojišťovny, pojistky)",
          "type": "ukon",
          "unit": "pcs",
          "scalable": false,
          "base_quantity": 1,
          "interval_check_days": 180,
          "note": "Aktualizovat po každé výměně dokladu"
        },
        {
          "key": "birth_cert_copies",
          "name": "Kopie rodných listů",
          "type": "dokument",
          "unit": "pcs",
          "scalable": true,
          "per_person": 1
        },
        {
          "key": "cash_czk",
          "name": "Hotovost CZK",
          "type": "trvala",
          "unit": "czk",
          "scalable": false,
          "base_quantity": 2000
        },
        {
          "key": "cash_eur",
          "name": "Hotovost EUR",
          "type": "trvala",
          "unit": "eur",
          "scalable": false,
          "base_quantity": 100
        },
        {
          "key": "contacts_list",
          "name": "Seznam důležitých kontaktů (papírově)",
          "type": "dokument",
          "unit": "pcs",
          "scalable": false,
          "base_quantity": 1
        }
      ]
    },

    {
      "id": "water",
      "key": "water",
      "name": "Voda",
      "items": [
        {
          "key": "water_bottled",
          "name": "Balená pitná voda",
          "type": "spotrebni",
          "unit": "l",
          "scalable": true,
          "consumption_per_person_per_day": 3,
          "expiration_tracked": true,
          "notification_days_before": 30
        },
        {
          "key": "water_canister",
          "name": "Kanystr na užitkovou vodu",
          "type": "trvala",
          "unit": "pcs",
          "scalable": false,
          "base_quantity": 2
        },
        {
          "key": "water_purification_tablets",
          "name": "Tablety na nouzové čištění vody",
          "type": "spotrebni",
          "unit": "tablet",
          "scalable": true,
          "consumption_per_person_per_day": 1,
          "expiration_tracked": true,
          "notification_days_before": 60
        }
      ]
    },

    {
      "id": "food",
      "key": "food",
      "name": "Trvanlivé jídlo",
      "items": [
        { "key": "food_uht_milk", "name": "Trvanlivé mléko", "type": "spotrebni", "unit": "l", "scalable": true, "consumption_per_person_per_day": 0.2, "expiration_tracked": true, "notification_days_before": 30 },
        { "key": "food_durable_bread", "name": "Trvanlivé pečivo", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 1, "expiration_tracked": true, "notification_days_before": 14 },
        { "key": "food_cereal", "name": "Cereálie / müsli", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 50, "expiration_tracked": true, "notification_days_before": 30 },
        { "key": "food_oats", "name": "Ovesné vločky", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 50, "expiration_tracked": true, "notification_days_before": 30 },
        { "key": "food_nuts", "name": "Oříšky", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 30, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_canned_meat", "name": "Konzervy - maso", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 0.5, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_canned_veg", "name": "Konzervy - zelenina", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 0.5, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_canned_legumes", "name": "Konzervy - luštěniny", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 0.3, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_canned_fruit", "name": "Konzervy - ovoce", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 0.3, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_honey_preserves", "name": "Med a zavařeniny", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 20, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_dried_fruit", "name": "Sušené ovoce", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 30, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_dried_meat", "name": "Sušené maso", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 20, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_energy_bars", "name": "Energetické/proteinové tyčinky", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 1, "expiration_tracked": true, "notification_days_before": 30 },
        { "key": "food_biscuits", "name": "Sušenky", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 30, "expiration_tracked": true, "notification_days_before": 30 },
        { "key": "food_chocolate", "name": "Čokoláda", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 20, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "food_glucose_sugar", "name": "Hroznový cukr", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 10, "expiration_tracked": true, "notification_days_before": 90 },
        { "key": "food_salt", "name": "Sůl", "type": "spotrebni", "unit": "g", "scalable": true, "consumption_per_person_per_day": 5, "expiration_tracked": false },
        { "key": "food_instant_meals", "name": "Instantní polévky/jídla", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 0.5, "expiration_tracked": true, "notification_days_before": 60 }
      ]
    },

    {
      "id": "medical",
      "key": "medical",
      "name": "Lékárnička",
      "items": [
        { "key": "med_regular_medication", "name": "Pravidelně užívané léky (na 2 týdny)", "type": "spotrebni", "unit": "pack", "scalable": true, "per_person": 1, "expiration_tracked": true, "notification_days_before": 30, "note": "Doplnit vlastní seznam dle diagnózy" },
        { "key": "med_allergy_card", "name": "Voděodolný seznam alergií/krevní skupiny/dávkování", "type": "dokument", "unit": "pcs", "scalable": true, "per_person": 1 },
        { "key": "med_inhaler_spare", "name": "Inhalátor (náhradní)", "type": "spotrebni", "unit": "pcs", "scalable": false, "base_quantity": 1, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "med_glasses_spare", "name": "Náhradní brýle", "type": "trvala", "unit": "pcs", "scalable": true, "per_person": 1 },
        { "key": "med_pressure_bandage", "name": "Obvazy tlakové", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 2 },
        { "key": "med_bandage", "name": "Obvazy normální", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 4 },
        { "key": "med_waterproof_plasters", "name": "Voděodolné náplasti (cívka + sada)", "type": "trvala", "unit": "set", "scalable": false, "base_quantity": 1 },
        { "key": "med_elastic_bandage", "name": "Elastické obinadlo", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 2 },
        { "key": "med_triangular_bandage", "name": "Trojcípý šátek", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 2 },
        { "key": "med_tourniquet", "name": "Pryžové škrtidlo", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "med_thermal_blanket", "name": "Izotermická fólie", "type": "trvala", "unit": "pcs", "scalable": true, "per_person": 1 },
        { "key": "med_scissors", "name": "Ostré nůžky", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "med_tweezers", "name": "Pinzeta", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "med_safety_pins", "name": "Spínací špendlíky", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 5 },
        { "key": "med_latex_gloves", "name": "Latexové rukavice", "type": "spotrebni", "unit": "pair", "scalable": false, "base_quantity": 10, "expiration_tracked": true, "notification_days_before": 180 },
        { "key": "med_cpr_mask", "name": "Resuscitační rouška", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "med_disinfectant_spray", "name": "Dezinfekční sprej", "type": "spotrebni", "unit": "pcs", "scalable": false, "base_quantity": 1, "expiration_tracked": true, "notification_days_before": 90 },
        { "key": "med_painkillers", "name": "Analgetika", "type": "spotrebni", "unit": "pack", "scalable": false, "base_quantity": 2, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "med_activated_charcoal", "name": "Živočišné uhlí", "type": "spotrebni", "unit": "pack", "scalable": false, "base_quantity": 1, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "med_antidiarrheal", "name": "Léky proti průjmu", "type": "spotrebni", "unit": "pack", "scalable": false, "base_quantity": 1, "expiration_tracked": true, "notification_days_before": 60 },
        { "key": "med_rehydration_salts", "name": "Rehydratační roztok (prášek)", "type": "spotrebni", "unit": "sachet", "scalable": true, "per_person": 3, "expiration_tracked": true, "notification_days_before": 90 },
        { "key": "med_hand_sanitizer", "name": "Dezinfekční gel na ruce", "type": "spotrebni", "unit": "pcs", "scalable": false, "base_quantity": 1, "expiration_tracked": true, "notification_days_before": 90 }
      ]
    },

    {
      "id": "equipment",
      "key": "equipment",
      "name": "Technika a nářadí",
      "items": [
        { "key": "eq_smoke_gas_detector", "name": "Autonomní detektor kouře a plynu", "type": "ukon", "unit": "pcs", "scalable": false, "base_quantity": 1, "interval_check_days": 90, "note": "Kontrola baterie" },
        { "key": "eq_battery_radio", "name": "Rádio na baterie", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "eq_flashlight", "name": "Svítilna na baterie", "type": "trvala", "unit": "pcs", "scalable": true, "per_person": 1 },
        { "key": "eq_spare_batteries", "name": "Náhradní baterie", "type": "spotrebni", "unit": "pcs", "scalable": false, "base_quantity": 8 },
        { "key": "eq_gas_stove", "name": "Propan-butanový vařič + náhradní náplň", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "eq_multitool", "name": "Multifunkční nůž", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "eq_fire_blanket", "name": "Hasicí deka", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "eq_duct_tape", "name": "Pevná lepicí páska", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1 },
        { "key": "eq_power_bank", "name": "Power banka", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 2 },
        { "key": "eq_cables_chargers", "name": "Kabely/nabíječky", "type": "trvala", "unit": "set", "scalable": false, "base_quantity": 1 },
        { "key": "eq_newspapers", "name": "Staré noviny", "type": "trvala", "unit": "kg", "scalable": false, "base_quantity": 1, "note": "podpal, izolace, hygiena" },
        { "key": "eq_full_car_tank", "name": "Plná nádrž v autě", "type": "ukon", "unit": "", "scalable": false, "interval_check_days": 7 },
        { "key": "eq_paper_map", "name": "Mapa oblasti (papírová)", "type": "dokument", "unit": "pcs", "scalable": false, "base_quantity": 1 }
      ]
    },

    {
      "id": "hygiene",
      "key": "hygiene",
      "name": "Hygiena",
      "items": [
        { "key": "hyg_toilet_paper", "name": "Toaletní papír", "type": "spotrebni", "unit": "roll", "scalable": true, "consumption_per_person_per_day": 0.3, "expiration_tracked": false },
        { "key": "hyg_sanitary_pads", "name": "Hygienické vložky", "type": "spotrebni", "unit": "pcs", "scalable": true, "per_person": 20, "expiration_tracked": false },
        { "key": "hyg_trash_bags", "name": "Pytle na odpadky", "type": "spotrebni", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 1, "expiration_tracked": false },
        { "key": "hyg_wet_wipes", "name": "Vlhčené ubrousky", "type": "spotrebni", "unit": "pack", "scalable": true, "per_person": 2, "expiration_tracked": true, "notification_days_before": 180 },
        { "key": "hyg_paper_towels", "name": "Papírové kuchyňské utěrky", "type": "spotrebni", "unit": "roll", "scalable": false, "base_quantity": 2 },
        { "key": "hyg_disposable_dishes", "name": "Trvanlivé nádobí (jednorázové)", "type": "trvala", "unit": "set", "scalable": true, "per_person": 1 },
        { "key": "hyg_soap_shampoo", "name": "Mýdlo / šampon", "type": "spotrebni", "unit": "pcs", "scalable": true, "per_person": 1, "expiration_tracked": true, "notification_days_before": 180 },
        { "key": "hyg_toothbrush_paste", "name": "Zubní kartáček + pasta", "type": "trvala", "unit": "set", "scalable": true, "per_person": 1 }
      ]
    },

    {
      "id": "clothing",
      "key": "clothing",
      "name": "Oblečení",
      "items": [
        { "key": "cloth_underwear", "name": "Zásoba spodního prádla na 10 dní", "type": "trvala", "unit": "pcs", "scalable": true, "consumption_per_person_per_day": 1 },
        { "key": "cloth_socks", "name": "Ponožky", "type": "trvala", "unit": "pair", "scalable": true, "consumption_per_person_per_day": 1 },
        { "key": "cloth_raincoat", "name": "Pláštěnka / nepromokavé oblečení", "type": "trvala", "unit": "pcs", "scalable": true, "per_person": 1 },
        { "key": "cloth_sturdy_shoes", "name": "Pevná obuv (náhradní)", "type": "trvala", "unit": "pair", "scalable": true, "per_person": 1 },
        { "key": "cloth_sleeping_bag", "name": "Spací pytel / deka", "type": "trvala", "unit": "pcs", "scalable": true, "per_person": 1 },
        { "key": "cloth_warm_layer", "name": "Teplá vrstva oblečení", "type": "trvala", "unit": "pcs", "scalable": true, "per_person": 1 }
      ]
    },

    {
      "id": "misc",
      "key": "misc",
      "name": "Ostatní",
      "items": [
        { "key": "misc_kids_games", "name": "Karty / hry pro děti", "type": "trvala", "unit": "pcs", "scalable": false, "base_quantity": 1, "conditional": "children > 0", "note": "jen pokud jsou v profilu děti" },
        { "key": "misc_stationery", "name": "Psací potřeby + papír", "type": "trvala", "unit": "set", "scalable": false, "base_quantity": 1 },
        { "key": "misc_whistle", "name": "Píšťalka (signalizace)", "type": "trvala", "unit": "pcs", "scalable": true, "per_person": 1 }
      ]
    },

    {
      "id": "pets",
      "key": "pets",
      "name": "Domácí mazlíčci",
      "conditional": "pets > 0",
      "items": [
        { "key": "pet_food", "name": "Krmivo pro zvíře", "type": "spotrebni", "unit": "kg", "scalable": true, "consumption_per_pet_per_day": 0.3, "expiration_tracked": true, "notification_days_before": 30 },
        { "key": "pet_water", "name": "Voda pro zvíře", "type": "spotrebni", "unit": "l", "scalable": true, "consumption_per_pet_per_day": 0.5, "expiration_tracked": false },
        { "key": "pet_leash_carrier", "name": "Vodítko/přepravka", "type": "trvala", "unit": "pcs", "scalable": true, "per_pet": 1 },
        { "key": "pet_vaccination_docs", "name": "Doklady o očkování", "type": "dokument", "unit": "pcs", "scalable": true, "per_pet": 1 },
        { "key": "pet_medication", "name": "Léky pro zvíře", "type": "spotrebni", "unit": "pack", "scalable": true, "per_pet": 1, "expiration_tracked": true, "notification_days_before": 30 }
      ]
    }

  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = TEMPLATE_DATA;
}
