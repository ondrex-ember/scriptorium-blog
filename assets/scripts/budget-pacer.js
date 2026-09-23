/**
 * ============================================================================
 *  E-comBar Budget Pacer — Google Ads Script (single account)
 * ============================================================================
 *
 *  Rewrite of the legacy "Budget Pacer V.2" (Nov 2020) template. The original
 *  pulled data through an internal ScriptyApp/AWQL shim (CAMPAIGN_PERFORMANCE_REPORT,
 *  fields like Amount / HasRecommendedBudget) that no longer works — Google
 *  retired AWQL-style legacy reports; the only supported path today is GAQL
 *  via AdsApp.search(). This script has no dependency on ScriptyApp at all.
 *
 *  This is the SINGLE-ACCOUNT variant: it's created inside the one Google Ads
 *  account it reports on (Bulk actions → Scripts), not at MCC/manager level.
 *  There's a separate BudgetPacer.gs (MCC-level) if you ever need to cover
 *  more than one account from one script — the two aren't interchangeable,
 *  see the deployment guide for which one to use where.
 *
 *  DEPLOYMENT
 *  ----------
 *  1. Create the script inside the Google Ads account itself: Tools & Settings
 *     → Bulk Actions → Scripts → "+". Paste this file in, Authorize, Save.
 *  2. Leave SPREADSHEET_URL blank to have the script build its own
 *     spreadsheet on first run (recommended), or paste an existing sheet's
 *     URL in if you want to reuse one.
 *  3. Preview, then run main() once. On a blank SPREADSHEET_URL this creates
 *     the spreadsheet, fully labels Configure Report with working defaults,
 *     and does the first data pull in the same run — its URL is printed to
 *     the run's log.
 *  4. Set this script's Frequency to Hourly in the Scripts list (pencil icon)
 *     — that's the only schedule Ads Scripts have; main() self-gates
 *     internally so the once-a-day parts (7/14-day reports) don't actually
 *     redo their work on every hourly firing. See the note below.
 *  Full walkthrough in the accompanying guide.
 *
 *  DESIGN NOTES / DECISIONS (flagged so nothing is a silent surprise)
 *  --------------------------------------------------------------------------
 *  - Google Ads Scripts have no "active spreadsheet" — unlike a script bound
 *    to a Sheet, there's no ambient spreadsheet context here at all. Every
 *    sheet access goes through getSpreadsheet() → SpreadsheetApp.openByUrl();
 *    a plain SpreadsheetApp.getActiveSpreadsheet() call would just throw.
 *  - Ads Scripts also have no in-script trigger API — ScriptApp isn't
 *    available here at all (that's an earlier mistake in a prior version of
 *    this file, now removed). Scheduling is entirely the Frequency setting
 *    in the Scripts list UI; hourly is its finest grain. main() is the one
 *    function you schedule, and it decides each run what actually needs to
 *    happen — see dailyReportsAlreadyRanToday(): the 7/14-day reports run
 *    once per calendar day, whichever run (scheduled or manual) gets there
 *    first, tracked via PropertiesService — not a fixed hour, so a manual
 *    test run right after deploying doesn't come up empty on those tabs.
 *  - No SPREADSHEET_URL and nothing yet in PropertiesService → main()'s
 *    first run creates a new spreadsheet via createBudgetPacerSpreadsheet()
 *    and remembers its URL in PropertiesService (getScriptProperties()) for
 *    every run after that — no manual sheet setup required.
 *  - "HasRecommendedBudget" / "RecommendedBudgetAmount" have no GAQL
 *    equivalent. Recommended Budget is computed with a heuristic:
 *        recommendedBudget = currentBudget * (1 + budgetLostImpressionShare)
 *    i.e. "what budget would have captured the impressions you lost to
 *    budget caps yesterday" — but only when Budget Lost IS is actually known
 *    for that campaign; see the null-handling note below.
 *  - "AveragePosition" is gone from the API entirely — dropped, nothing
 *    replaces it in modern Ads metrics.
 *  - Budget is fetched by its own unsegmented query (budgetQuery /
 *    fetchBudgetMap) and joined onto performance rows in script
 *    (attachBudget). campaign_budget fields cannot sit in the same
 *    query/report as search-impression-share metrics — Google Ads' own
 *    Report Editor rejects that combination outright, and budget doesn't
 *    vary by hour/day anyway, so there was no reason to keep asking for it
 *    24× per campaign per day in the first place.
 *  - Search IS / Lost IS are only ever queried at day or window grain, never
 *    segmented by hour — hour-level impression-share metrics are widely
 *    reported as unreliable/zero in the Ads API. The hourly depletion curve
 *    only needs Cost, so this cost nothing.
 *  - "Conv. Rate" = metrics.conversions_from_interactions_rate (conversions
 *    per interaction), the standard UI definition.
 *  - Null handling matches the original template's convention: when a
 *    campaign has no spend in the KPI window (so Search IS / Budget Lost IS
 *    are genuinely unknown, not "0%"), those cells — and Recommended Budget,
 *    which depends on Budget Lost IS — show the literal text "--" rather
 *    than a fabricated 0/no-change value. Every other KPI (Conversions, CPA,
 *    ROAS, Ctr, Conv.Rate, Lost Conversions, Lost Revenue) still defaults to
 *    0 when absent, same as the original.
 *  - Matching rows between hidden data sheets and report sheets is done on
 *    Campaign ID (not Campaign Name) — more robust than the original's
 *    name-matching.
 *  - Hidden *BudgetData / *KPIData sheets are now a plain data dump (raw
 *    values, no formula chains) — the visible sheets are computed directly
 *    in script and written as values. This removes the fragile
 *    IFERROR(INDEX(MATCH(...))) formula webs from the original, which is a
 *    deliberate simplification: same output, far less breakage surface.
 *  - Impression-share metrics come back as fractions (0.6667), not the
 *    "< 10%" placeholder strings the old UI export used.
 *  - Previous 7/14 Days columns run newest-first (left to right), matching
 *    the original exactly, with a two-row date header (day-of-week name,
 *    then the date itself as a real date value) rather than one merged label.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// SPREADSHEET ACCESS — auto-creates on first run if left blank
// ---------------------------------------------------------------------------

// Optional: paste an existing "Budget Pacer" sheet's URL here to use it.
// Leave blank and the script builds a new one on its first run, then
// remembers it (via PropertiesService) for every run after that.
var SPREADSHEET_URL = '';

var SPREADSHEET_PROP_KEY = 'BUDGET_PACER_SHEET_URL';

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var url = SPREADSHEET_URL && SPREADSHEET_URL.indexOf('http') === 0
    ? SPREADSHEET_URL
    : props.getProperty(SPREADSHEET_PROP_KEY);

  if (url) {
    try {
      return SpreadsheetApp.openByUrl(url);
    } catch (e) {
      Logger.log('Stored spreadsheet URL no longer opens (' + e + ') — creating a new one.');
    }
  }

  var ss = createBudgetPacerSpreadsheet();
  props.setProperty(SPREADSHEET_PROP_KEY, ss.getUrl());
  Logger.log('Created a new Budget Pacer spreadsheet: ' + ss.getUrl());
  return ss;
}

// ---------------------------------------------------------------------------
// CONFIG SHEET CELL MAP
// ---------------------------------------------------------------------------

var CONFIG_SHEET_NAME = 'Configure Report';

var CFG = {
  RUN_HOURLY: 'F7',      // checkbox: Today + Yesterday hourly pacing
  RUN_7_DAYS: 'F8',      // checkbox: Previous 7 Days
  RUN_14_DAYS: 'F9',     // checkbox: Previous 14 Days
  BUDGET_FILTER: 'F12',  // minimum daily budget to include, in account currency
  STATS_RANGE: 'F13',    // "1 Day" / "7 Days" / "14 Days" / "30 Days"
  KPI_RANGE_TOP: 16,     // F16:F22, 7 rows, checkboxes
  KPI_RANGE_BOTTOM: 22,
  EMAIL_TOGGLE: 'J11',   // "On" / "Off"
  EMAIL_BUDGET_THRESHOLD: 'J12',  // fraction, e.g. 0.5
  EMAIL_HOUR_THRESHOLD: 'J13',    // hour of day, e.g. 20
  EMAIL_RECIPIENTS_TOP: 14,       // H14:H18
  EMAIL_RECIPIENTS_BOTTOM: 18
};

var KPI_DEFS = [
  { key: 'conversions', label: 'Conversions', format: '0.##' },
  { key: 'cpa', label: 'CPA', format: '#,##0.00' },
  { key: 'roas', label: 'ROAS', format: '0.##%' },
  { key: 'ctr', label: 'Ctr', format: '0.##%' },
  { key: 'convRate', label: 'Conv.Rate', format: '0.##%' },
  { key: 'lostConversions', label: 'Lost Conversions', format: '0.##' },
  { key: 'lostRevenue', label: 'Lost Revenue', format: '#,##0.00' }
];

var SHEETS = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  PREV_7: 'Previous 7 Days',
  PREV_14: 'Previous 14 Days',
  SUMMARY: 'Summary',
  TODAY_DATA: 'TodayBudgetData',
  YEST_DATA: 'YesterdayBudgetData',
  DATA_7: '7DaysBudgetData',
  DATA_14: '14DaysBudgetData',
  TODAY_KPI: 'TodayKPIData',
  YEST_KPI: 'YesterdayKPIData',
  KPI_7: '7DaysKPIData',
  KPI_14: '14DaysKPIData'
};

// ---------------------------------------------------------------------------
// ENTRY POINT — schedule this ONE function ("main") at Hourly frequency in
// the Google Ads Scripts UI (Tools & Settings > Bulk Actions > Scripts >
// pencil icon under Frequency). Ads Scripts have no in-script trigger API
// (ScriptApp isn't available here) — the UI's Frequency setting is the only
// schedule there is, hourly is its finest grain, so main() self-gates
// internally to give the 7/14-day reports a once-a-day cadence within that.
//
// That gate is "once per calendar day, whichever run gets there first" —
// tracked in PropertiesService, not a fixed hour. A fixed hour (e.g. "only
// at 1am") silently skips the daily reports on every run that isn't exactly
// that hour, including a manual test run right after deploying, which looks
// like the script only half-works. This way the very first run of any given
// day — scheduled or manual — always refreshes Previous 7/14 Days.
// ---------------------------------------------------------------------------

var LAST_DAILY_RUN_PROP_KEY = 'BUDGET_PACER_LAST_DAILY_RUN_DATE';

function dailyReportsAlreadyRanToday() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty(LAST_DAILY_RUN_PROP_KEY) === formatDate(new Date());
}

function markDailyReportsRanToday() {
  PropertiesService.getScriptProperties().setProperty(LAST_DAILY_RUN_PROP_KEY, formatDate(new Date()));
}

function main() {
  var config = getConfig();

  runHourly(config); // Today + Yesterday, if enabled — every run, since this IS the hourly run

  if (!dailyReportsAlreadyRanToday()) {
    run7DayReport(config);  // if enabled
    run14DayReport(config); // if enabled
    markDailyReportsRanToday();
  } else {
    Logger.log('Previous 7/14 Days already refreshed today — skipping until tomorrow.');
  }

  checkBudgetAlerts(config); // self-gates by the configured hour threshold

  Logger.log('Budget Pacer run complete. Spreadsheet: ' + getSpreadsheet().getUrl());
}

// Manual/debug helpers — not scheduled themselves, just handy from the
// Apps Script function dropdown while testing one part in isolation.
function previewHourlyOnly() {
  runHourly(getConfig());
}

function preview7DaysOnly() {
  run7DayReport(getConfig());
}

function preview14DaysOnly() {
  run14DayReport(getConfig());
}

function previewAlertsOnly() {
  checkBudgetAlerts(getConfig());
}

// ---------------------------------------------------------------------------
// CONFIG READING
// ---------------------------------------------------------------------------

function getConfig() {
  var ss = getSpreadsheet();
  var cfgSheet = ss.getSheetByName(CONFIG_SHEET_NAME);

  var statsLabel = String(cfgSheet.getRange(CFG.STATS_RANGE).getValue() || '30 Days');
  var statsDays = { '1 Day': 1, '7 Days': 7, '14 Days': 14, '30 Days': 30 }[statsLabel] || 30;

  var kpiFlags = {};
  var kpiValues = cfgSheet.getRange('F' + CFG.KPI_RANGE_TOP + ':F' + CFG.KPI_RANGE_BOTTOM).getValues();
  KPI_DEFS.forEach(function (def, i) {
    kpiFlags[def.key] = kpiValues[i][0] === true;
  });

  var emails = [];
  var emailValues = cfgSheet.getRange('H' + CFG.EMAIL_RECIPIENTS_TOP + ':H' + CFG.EMAIL_RECIPIENTS_BOTTOM).getValues();
  emailValues.forEach(function (row) {
    var v = String(row[0] || '').trim();
    if (v) emails.push(v);
  });

  return {
    budgetFilterMicros: Math.round(Number(cfgSheet.getRange(CFG.BUDGET_FILTER).getValue() || 0) * 1e6),
    statsDays: statsDays,
    kpiFlags: kpiFlags,
    reportFlags: {
      hourly: cfgSheet.getRange(CFG.RUN_HOURLY).getValue() === true,
      d7: cfgSheet.getRange(CFG.RUN_7_DAYS).getValue() === true,
      d14: cfgSheet.getRange(CFG.RUN_14_DAYS).getValue() === true
    },
    email: {
      enabled: String(cfgSheet.getRange(CFG.EMAIL_TOGGLE).getValue() || '').toLowerCase() === 'on',
      budgetThreshold: Number(cfgSheet.getRange(CFG.EMAIL_BUDGET_THRESHOLD).getValue() || 0.5),
      hourThreshold: Number(cfgSheet.getRange(CFG.EMAIL_HOUR_THRESHOLD).getValue() || 20),
      recipients: emails
    }
  };
}

/**
 * Fully populates Configure Report — labels, defaults, checkboxes, and
 * dropdown validation for every cell the script reads (CFG). Used both by
 * createBudgetPacerSpreadsheet() for a brand-new sheet and available to run
 * by hand (setupConfigSheet()) to retrofit an existing/hand-built sheet.
 * Safe to re-run: only fills a cell if it doesn't already look configured.
 */
function buildConfigSheetContent(cfgSheet) {
  cfgSheet.getRange('A1').setValue('Budget Pacer — Configure Report')
    .setFontSize(16).setFontWeight('bold');
  cfgSheet.getRange('A2').setValue(
    'Fill in the settings below, then run main() once (or wait for its next scheduled hourly run).'
  ).setFontStyle('italic').setFontColor('#666666');

  cfgSheet.getRange('D6').setValue('Select Reports to Run').setFontWeight('bold');
  cfgSheet.getRange('D7').setValue('Hourly (Today + Yesterday)');
  cfgSheet.getRange('D8').setValue('Previous 7 Days');
  cfgSheet.getRange('D9').setValue('Previous 14 Days');
  [CFG.RUN_HOURLY, CFG.RUN_7_DAYS, CFG.RUN_14_DAYS].forEach(function (cell) {
    var range = cfgSheet.getRange(cell);
    if (range.getValue() !== true && range.getValue() !== false) range.setValue(true);
    range.insertCheckboxes();
  });

  cfgSheet.getRange('D12').setValue('Minimum Daily Budget To Include (0 = no filter)');
  if (cfgSheet.getRange(CFG.BUDGET_FILTER).getValue() === '') cfgSheet.getRange(CFG.BUDGET_FILTER).setValue(0);

  cfgSheet.getRange('D13').setValue('KPI Trailing Window');
  var statsRange = cfgSheet.getRange(CFG.STATS_RANGE);
  if (statsRange.getValue() === '') statsRange.setValue('30 Days');
  statsRange.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['1 Day', '7 Days', '14 Days', '30 Days'], true).build()
  );

  cfgSheet.getRange('D15').setValue('KPI Columns To Show').setFontWeight('bold');
  KPI_DEFS.forEach(function (def, i) {
    cfgSheet.getRange('D' + (CFG.KPI_RANGE_TOP + i)).setValue(def.label);
  });
  var kpiCells = cfgSheet.getRange('F' + CFG.KPI_RANGE_TOP + ':F' + CFG.KPI_RANGE_BOTTOM);
  var kpiValues = kpiCells.getValues();
  var kpiNeedsDefault = kpiValues.every(function (row) { return row[0] !== true && row[0] !== false; });
  if (kpiNeedsDefault) kpiCells.setValue(true);
  kpiCells.insertCheckboxes();

  cfgSheet.getRange('I11').setValue('Email Alerts');
  var emailToggle = cfgSheet.getRange(CFG.EMAIL_TOGGLE);
  if (emailToggle.getValue() === '') emailToggle.setValue('Off');
  emailToggle.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['On', 'Off'], true).build()
  );
  cfgSheet.getRange('I12').setValue('...when daily budget usage exceeds (fraction, e.g. 0.5)');
  if (cfgSheet.getRange(CFG.EMAIL_BUDGET_THRESHOLD).getValue() === '') cfgSheet.getRange(CFG.EMAIL_BUDGET_THRESHOLD).setValue(0.5);
  cfgSheet.getRange('I13').setValue('...and only up to this hour of day (account timezone)');
  if (cfgSheet.getRange(CFG.EMAIL_HOUR_THRESHOLD).getValue() === '') cfgSheet.getRange(CFG.EMAIL_HOUR_THRESHOLD).setValue(20);
  cfgSheet.getRange('G14').setValue('Recipients ↓');

  cfgSheet.setColumnWidth(1, 60);
  cfgSheet.setColumnWidth(4, 260);
  cfgSheet.setColumnWidth(9, 300);
  cfgSheet.autoResizeColumn(6);
}

/**
 * One-time helper: fully (re)builds Configure Report — labels, defaults,
 * checkboxes, dropdowns. Safe to re-run. Use this to retrofit an existing
 * hand-built sheet; a freshly auto-created spreadsheet already has this
 * applied by createBudgetPacerSpreadsheet().
 */
function setupConfigSheet() {
  var ss = getSpreadsheet();
  var cfgSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  buildConfigSheetContent(cfgSheet);
  Logger.log('Configure Report is set up.');
}

/**
 * Builds a brand-new Budget Pacer spreadsheet from scratch: every tab the
 * script reads or writes to, Configure Report fully labeled with defaults,
 * and the hidden *BudgetData/*KPIData sheets. Called by getSpreadsheet()
 * the first time it finds no usable SPREADSHEET_URL and nothing already
 * remembered in PropertiesService.
 */
function createBudgetPacerSpreadsheet() {
  var accountName = AdsApp.currentAccount().getName() || AdsApp.currentAccount().getCustomerId();
  var ss = SpreadsheetApp.create('Budget Pacer — ' + accountName);

  try {
    ss.setSpreadsheetTimeZone(AdsApp.currentAccount().getTimeZone());
  } catch (e) {
    Logger.log('Could not set spreadsheet timezone: ' + e);
  }

  var configSheet = ss.getSheets()[0];
  configSheet.setName(CONFIG_SHEET_NAME);
  buildConfigSheetContent(configSheet);

  [SHEETS.TODAY, SHEETS.YESTERDAY, SHEETS.PREV_7, SHEETS.PREV_14, SHEETS.SUMMARY].forEach(function (name) {
    ss.insertSheet(name);
  });

  [SHEETS.TODAY_DATA, SHEETS.YEST_DATA, SHEETS.DATA_7, SHEETS.DATA_14,
    SHEETS.TODAY_KPI, SHEETS.YEST_KPI, SHEETS.KPI_7, SHEETS.KPI_14].forEach(function (name) {
    ss.insertSheet(name).hideSheet();
  });

  return ss;
}

// ---------------------------------------------------------------------------
// GAQL QUERY BUILDERS
// ---------------------------------------------------------------------------

/**
 * Budget is a static campaign attribute — it doesn't vary by hour or day, and
 * the Google Ads API/UI reporting layer rejects combining campaign_budget
 * fields with search-impression-share metrics in the same query/report
 * (confirmed directly against the Report Editor's own compatibility check).
 * So budget is fetched once, unsegmented, and joined in client-side — see
 * attachBudget() / filterMapByBudget() below.
 */
function budgetQuery(budgetFilterMicros) {
  return [
    'SELECT',
    '  customer.id, customer.descriptive_name, customer.currency_code,',
    '  campaign.id, campaign.name, campaign.status,',
    '  campaign.advertising_channel_type, campaign.bidding_strategy_type,',
    '  campaign_budget.amount_micros',
    'FROM campaign',
    "WHERE campaign.status = 'ENABLED'",
    '  AND campaign_budget.amount_micros >= ' + budgetFilterMicros
  ].join('\n');
}

/**
 * Cost only — deliberately excludes impression-share metrics too. Those are
 * widely reported as unreliable (returning 0) when segmented by hour; the
 * depletion curve only ever needed Cost anyway. Search IS / Lost IS are
 * pulled at day/window granularity instead (dailyQuery / kpiWindowQuery),
 * where they're reliable.
 */
function hourlyQuery(dateRangeKeyword) {
  return [
    'SELECT',
    '  customer.id, campaign.id, campaign.name,',
    '  segments.hour,',
    '  metrics.cost_micros',
    'FROM campaign',
    "WHERE campaign.status = 'ENABLED'",
    '  AND segments.date DURING ' + dateRangeKeyword
  ].join('\n');
}

function dailyQuery(startDate, endDate) {
  return [
    'SELECT',
    '  customer.id, campaign.id, campaign.name,',
    '  segments.date,',
    '  metrics.cost_micros, metrics.search_impression_share,',
    '  metrics.search_budget_lost_impression_share,',
    '  metrics.search_rank_lost_impression_share',
    'FROM campaign',
    "WHERE campaign.status = 'ENABLED'",
    "  AND segments.date BETWEEN '" + startDate + "' AND '" + endDate + "'"
  ].join('\n');
}

function kpiWindowQuery(startDate, endDate) {
  return [
    'SELECT',
    '  customer.id, customer.descriptive_name,',
    '  campaign.id, campaign.name,',
    '  metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros,',
    '  metrics.conversions, metrics.cost_per_conversion, metrics.conversions_value,',
    '  metrics.conversions_from_interactions_rate,',
    '  metrics.search_impression_share, metrics.search_budget_lost_impression_share,',
    '  metrics.search_rank_lost_impression_share',
    'FROM campaign',
    "WHERE campaign.status = 'ENABLED'",
    '  AND metrics.cost_micros > 0',
    "  AND segments.date BETWEEN '" + startDate + "' AND '" + endDate + "'"
  ].join('\n');
}

// ---------------------------------------------------------------------------
// DATA FETCH
// ---------------------------------------------------------------------------

function campaignKey(customerId, campaignId) {
  return customerId + ':' + campaignId;
}

function microsToUnits(micros) {
  return (micros || 0) / 1e6;
}

/**
 * Pulls the current budget (+ static attributes) for every qualifying
 * campaign, unsegmented. This is the single source of truth for Budget —
 * see the note above budgetQuery().
 */
function fetchBudgetMap(budgetFilterMicros) {
  var map = {};
  var query = budgetQuery(budgetFilterMicros);
  var result = AdsApp.search(query);
  while (result.hasNext()) {
    var r = result.next();
    var key = campaignKey(String(r.customer.id), String(r.campaign.id));
    map[key] = {
      customerId: String(r.customer.id),
      accountName: r.customer.descriptiveName,
      currency: r.customer.currencyCode,
      campaignId: String(r.campaign.id),
      campaignName: r.campaign.name,
      status: r.campaign.status,
      channelType: r.campaign.advertisingChannelType,
      biddingStrategy: r.campaign.biddingStrategyType,
      budget: microsToUnits(r.campaignBudget.amountMicros)
    };
  }
  return map;
}

/** Joins budget/attribute data onto performance rows; drops rows for
 *  campaigns that didn't clear the budget filter (or aren't in budgetMap
 *  for any other reason) — same effect the old inline WHERE clause had. */
function attachBudget(rows, budgetMap) {
  var out = [];
  rows.forEach(function (r) {
    var info = budgetMap[campaignKey(r.customerId, r.campaignId)];
    if (!info) return;
    r.accountName = info.accountName;
    r.currency = info.currency;
    r.status = info.status;
    r.channelType = info.channelType;
    r.biddingStrategy = info.biddingStrategy;
    r.budget = info.budget;
    out.push(r);
  });
  return out;
}

/** Same idea as attachBudget(), for the keyed KPI map. */
function filterMapByBudget(map, budgetMap) {
  var out = {};
  Object.keys(map).forEach(function (key) {
    if (budgetMap[key]) out[key] = map[key];
  });
  return out;
}

/**
 * Pulls hour-segmented data for TODAY or YESTERDAY and returns a flat array
 * of raw rows.
 */
function fetchHourlyRows(dateRangeKeyword) {
  var rows = [];
  var query = hourlyQuery(dateRangeKeyword);
  var result = AdsApp.search(query);
  while (result.hasNext()) {
    var r = result.next();
    rows.push({
      customerId: String(r.customer.id),
      campaignId: String(r.campaign.id),
      campaignName: r.campaign.name,
      hour: r.segments.hour,
      cost: microsToUnits(r.metrics.costMicros)
    });
  }
  return rows;
}

/**
 * Pulls day-segmented data across a date range (used for 7/14 day reports).
 */
function fetchDailyRows(startDate, endDate) {
  var rows = [];
  var query = dailyQuery(startDate, endDate);
  var result = AdsApp.search(query);
  while (result.hasNext()) {
    var r = result.next();
    rows.push({
      customerId: String(r.customer.id),
      campaignId: String(r.campaign.id),
      campaignName: r.campaign.name,
      date: r.segments.date,
      cost: microsToUnits(r.metrics.costMicros),
      searchIS: r.metrics.searchImpressionShare || 0,
      budgetLostIS: r.metrics.searchBudgetLostImpressionShare || 0,
      rankLostIS: r.metrics.searchRankLostImpressionShare || 0
    });
  }
  return rows;
}

/**
 * Pulls one aggregated row per campaign over [startDate, endDate] for the
 * KPI columns (Conversions / CPA / ROAS / Ctr / Conv.Rate / Lost Conversions
 * / Lost Revenue). Keyed by campaignKey(). Campaigns with no spend in the
 * window simply have no entry here — that absence is the "no data" signal
 * writeHourlySheet/writeDailySheet/writeSummary use to show "--".
 */
function fetchKpiWindow(startDate, endDate) {
  var kpiMap = {};
  var query = kpiWindowQuery(startDate, endDate);
  var result = AdsApp.search(query);
  while (result.hasNext()) {
    var r = result.next();
    var cost = microsToUnits(r.metrics.costMicros);
    var conversions = r.metrics.conversions || 0;
    var convValue = r.metrics.conversionsValue || 0;
    var searchIS = r.metrics.searchImpressionShare || 0;
    var budgetLostIS = r.metrics.searchBudgetLostImpressionShare || 0;

    var lostConversions = 0;
    if (budgetLostIS > 0 && searchIS > 0) {
      lostConversions = (budgetLostIS / searchIS) * conversions;
    }
    var lostRevenue = 0;
    if (conversions > 0) {
      lostRevenue = (convValue / conversions) * lostConversions;
    }

    kpiMap[campaignKey(String(r.customer.id), String(r.campaign.id))] = {
      customerId: String(r.customer.id),
      accountName: r.customer.descriptiveName,
      campaignId: String(r.campaign.id),
      campaignName: r.campaign.name,
      conversions: conversions,
      cpa: conversions > 0 ? cost / conversions : 0,
      roas: cost > 0 ? convValue / cost : 0,
      ctr: r.metrics.ctr || 0,
      convRate: r.metrics.conversionsFromInteractionsRate || 0,
      lostConversions: lostConversions,
      lostRevenue: lostRevenue,
      searchIS: searchIS,
      budgetLostIS: budgetLostIS
    };
  }
  return kpiMap;
}

// ---------------------------------------------------------------------------
// DATE HELPERS
// ---------------------------------------------------------------------------

/** Session isn't available in Google Ads Scripts either (only in regular
 *  Apps Script) — the account's own timezone is the correct stand-in for
 *  "script timezone" here, and it's what every date/hour calculation in
 *  this file is anchored to. */
function getAccountTimeZone() {
  return AdsApp.currentAccount().getTimeZone();
}

function formatDate(date) {
  return Utilities.formatDate(date, getAccountTimeZone(), 'yyyy-MM-dd');
}

/** Returns [startDate, endDate] as 'yyyy-MM-dd' strings, `days` days ending TODAY (inclusive). */
function dailyWindow(days) {
  var end = new Date();
  var start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return [formatDate(start), formatDate(end)];
}

// ---------------------------------------------------------------------------
// PACING CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Groups hourly rows by campaign and computes a cumulative-spend-as-%-of-
 * budget array for hours 0..currentHour. Hours with no returned row carry
 * forward the previous cumulative value (mirrors the original's IFERROR /
 * carry-forward formula behaviour for the modern API, which only returns
 * rows for hours that actually accrued stats).
 */
function computeHourlyPacing(rows, maxHour) {
  var byCampaign = {};
  rows.forEach(function (row) {
    var key = campaignKey(row.customerId, row.campaignId);
    if (!byCampaign[key]) {
      byCampaign[key] = {
        meta: row,
        hourCost: {}
      };
    }
    byCampaign[key].hourCost[row.hour] = row.cost;
    // Keep the latest-seen budget/IS snapshot (attributes are stable per day).
    byCampaign[key].meta = row;
  });

  var result = {};
  Object.keys(byCampaign).forEach(function (key) {
    var entry = byCampaign[key];
    var cumCost = 0;
    var pacing = [];
    var lastValue = '';
    for (var h = 0; h <= maxHour; h++) {
      if (entry.hourCost.hasOwnProperty(h)) {
        cumCost += entry.hourCost[h];
        lastValue = entry.meta.budget > 0 ? cumCost / entry.meta.budget : '';
      }
      pacing[h] = lastValue;
    }
    result[key] = { meta: entry.meta, pacing: pacing };
  });
  return result;
}

/** Groups daily rows by campaign, one pacing value (cost/budget) per date. */
function computeDailyPacing(rows, dateList) {
  var byCampaign = {};
  rows.forEach(function (row) {
    var key = campaignKey(row.customerId, row.campaignId);
    if (!byCampaign[key]) {
      byCampaign[key] = { meta: row, dayCost: {} };
    }
    byCampaign[key].dayCost[row.date] = row.cost;
    byCampaign[key].meta = row;
  });

  var result = {};
  Object.keys(byCampaign).forEach(function (key) {
    var entry = byCampaign[key];
    var pacing = dateList.map(function (date) {
      var cost = entry.dayCost[date];
      if (cost === undefined) return '';
      return entry.meta.budget > 0 ? cost / entry.meta.budget : '';
    });
    result[key] = { meta: entry.meta, pacing: pacing };
  });
  return result;
}

// ---------------------------------------------------------------------------
// REPORT RUNNERS
// ---------------------------------------------------------------------------

function runHourly(config) {
  if (!config.reportFlags.hourly) return;

  var currentHour = Number(Utilities.formatDate(new Date(), getAccountTimeZone(), 'H'));
  var budgetMap = fetchBudgetMap(config.budgetFilterMicros);

  var todayRows = attachBudget(fetchHourlyRows('TODAY'), budgetMap);
  var yesterdayRows = attachBudget(fetchHourlyRows('YESTERDAY'), budgetMap);

  // Two separate trailing windows, matching the original: the Today tab's KPI
  // window ends today (includes the partial day), the Yesterday tab's (and
  // Summary's) window ends yesterday — so a live "today" doesn't leak into
  // the clean N-day trend used for capped/underspending decisions.
  var todayWindow = dailyWindow(config.statsDays);
  var yesterdayWindowEnd = new Date();
  yesterdayWindowEnd.setDate(yesterdayWindowEnd.getDate() - 1);
  var yesterdayWindowStart = new Date();
  yesterdayWindowStart.setDate(yesterdayWindowStart.getDate() - config.statsDays);
  var yWindow = [formatDate(yesterdayWindowStart), formatDate(yesterdayWindowEnd)];

  var todayKpiMap = filterMapByBudget(fetchKpiWindow(todayWindow[0], todayWindow[1]), budgetMap);
  var yesterdayKpiMap = filterMapByBudget(fetchKpiWindow(yWindow[0], yWindow[1]), budgetMap);

  var todayPacing = computeHourlyPacing(todayRows, currentHour);
  var yesterdayPacing = computeHourlyPacing(yesterdayRows, 23);

  dumpRawSheet(SHEETS.TODAY_DATA, todayRows);
  dumpRawSheet(SHEETS.YEST_DATA, yesterdayRows);
  dumpKpiSheet(SHEETS.TODAY_KPI, todayKpiMap);
  dumpKpiSheet(SHEETS.YEST_KPI, yesterdayKpiMap);

  writeHourlySheet(SHEETS.TODAY, todayPacing, todayKpiMap, config.kpiFlags, currentHour, config.statsDays);
  writeHourlySheet(SHEETS.YESTERDAY, yesterdayPacing, yesterdayKpiMap, config.kpiFlags, 23, config.statsDays);

  writeSummary(yesterdayPacing, yesterdayKpiMap);
}

function run7DayReport(config) {
  if (!config.reportFlags.d7) return;
  runDailyReport(config, 7, SHEETS.PREV_7, SHEETS.DATA_7, SHEETS.KPI_7);
}

function run14DayReport(config) {
  if (!config.reportFlags.d14) return;
  runDailyReport(config, 14, SHEETS.PREV_14, SHEETS.DATA_14, SHEETS.KPI_14);
}

function runDailyReport(config, days, reportSheetName, dataSheetName, kpiSheetName) {
  var [startDate, endDate] = dailyWindow(days);
  // Newest-first (today's date leftmost), matching the original template.
  var dateList = [];
  for (var i = 0; i < days; i++) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    dateList.push(formatDate(d));
  }

  var budgetMap = fetchBudgetMap(config.budgetFilterMicros);
  var rows = attachBudget(fetchDailyRows(startDate, endDate), budgetMap);
  var kpiMap = filterMapByBudget(fetchKpiWindow(startDate, endDate), budgetMap);
  var pacing = computeDailyPacing(rows, dateList);

  dumpRawSheet(dataSheetName, rows);
  dumpKpiSheet(kpiSheetName, kpiMap);

  writeDailySheet(reportSheetName, pacing, kpiMap, config.kpiFlags, dateList, config.statsDays);
}

// ---------------------------------------------------------------------------
// SHEET WRITERS — HOURLY (Today / Yesterday)
// ---------------------------------------------------------------------------

function activeKpiDefs(kpiFlags) {
  return KPI_DEFS.filter(function (def) { return kpiFlags[def.key]; });
}

function writeHourlySheet(sheetName, pacingMap, kpiMap, kpiFlags, maxHour, statsDays) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  sheet.clear();
  sheet.clearConditionalFormatRules();

  var kpis = activeKpiDefs(kpiFlags);
  var baseHeaders = ['Customer ID', 'Account', 'Campaign', 'Campaign Status', 'Budget', 'Search IS', 'Budget Lost IS'];
  var kpiHeaders = kpis.map(function (k) { return k.label; });
  var hourHeaders = [];
  for (var h = 0; h <= 23; h++) hourHeaders.push(h);

  sheet.getRange(3, 1, 1, baseHeaders.length).setValues([baseHeaders])
    .setBackground('#444').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');

  var kpiStartCol = baseHeaders.length + 1;
  if (kpis.length > 0) {
    sheet.getRange(3, kpiStartCol, 1, kpiHeaders.length).setValues([kpiHeaders])
      .setBackground('#444').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(2, kpiStartCol, 1, kpiHeaders.length).merge()
      .setValue('KPI Shown For ' + statsDays + ' Days')
      .setFontStyle('italic').setFontColor('white').setBackground('#9989bd').setHorizontalAlignment('center');
  }

  var hourStartCol = kpiStartCol + kpiHeaders.length;
  sheet.getRange(3, hourStartCol, 1, 24).setValues([hourHeaders])
    .setBackground('#6495ED').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(2, hourStartCol, 1, 24).merge()
    .setValue('Total Budget Depletion').setFontWeight('bold').setFontColor('white')
    .setBackground('#7B68EE').setHorizontalAlignment('center');

  var keys = Object.keys(pacingMap).sort(function (a, b) {
    return pacingMap[a].meta.campaignName.localeCompare(pacingMap[b].meta.campaignName);
  });

  var dataRows = keys.map(function (key) {
    var entry = pacingMap[key];
    var m = entry.meta;
    var kpiRow = kpiMap[key];
    var row = [
      m.customerId, m.accountName, m.campaignName, m.status, m.budget,
      kpiRow ? kpiRow.searchIS : '--',
      kpiRow ? kpiRow.budgetLostIS : '--'
    ];
    kpis.forEach(function (def) { row.push(kpiRow ? kpiRow[def.key] : 0); });
    for (var h = 0; h <= 23; h++) row.push(entry.pacing[h] === undefined ? '' : entry.pacing[h]);
    return row;
  });

  if (dataRows.length === 0) return;

  sheet.getRange(4, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
  sheet.getRange(4, 5, dataRows.length, 1).setNumberFormat('#,##0.00');
  sheet.getRange(4, 6, dataRows.length, 2).setNumberFormat('0.##%');
  kpis.forEach(function (def, i) {
    sheet.getRange(4, kpiStartCol + i, dataRows.length, 1).setNumberFormat(def.format);
  });
  sheet.getRange(4, hourStartCol, dataRows.length, 24).setNumberFormat('0.##%').setHorizontalAlignment('center');

  applyDepletionGradient(sheet, 4, hourStartCol, dataRows.length, 24);
  applyBudgetLostGradient(sheet, 4, 7, dataRows.length);

  sheet.autoResizeColumns(1, hourStartCol + 24 - 1);
}

// ---------------------------------------------------------------------------
// SHEET WRITERS — DAILY (Previous 7 / 14 Days)
// ---------------------------------------------------------------------------

function writeDailySheet(sheetName, pacingMap, kpiMap, kpiFlags, dateList, statsDays) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  sheet.clear();
  sheet.clearConditionalFormatRules();

  var kpis = activeKpiDefs(kpiFlags);
  var baseHeaders = ['Customer ID', 'Account', 'Campaign', 'Campaign Status', 'Budget', 'Search IS', 'Budget Lost IS'];
  var kpiHeaders = kpis.map(function (k) { return k.label; });

  sheet.getRange(3, 1, 1, baseHeaders.length).setValues([baseHeaders])
    .setBackground('#444').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');

  var kpiStartCol = baseHeaders.length + 1;
  if (kpis.length > 0) {
    sheet.getRange(3, kpiStartCol, 1, kpiHeaders.length).setValues([kpiHeaders])
      .setBackground('#444').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(2, kpiStartCol, 1, kpiHeaders.length).merge()
      .setValue('KPI Shown For ' + statsDays + ' Days')
      .setFontStyle('italic').setFontColor('white').setBackground('#9989bd').setHorizontalAlignment('center');
  }

  // Two-row date header, matching the original: row 1 = title spanning every
  // day column, row 2 = day-of-week name per column, row 3 = the date itself
  // as a real date value (not a concatenated string) so it sorts/filters
  // like a date if the user works with the sheet directly.
  var dayStartCol = kpiStartCol + kpiHeaders.length;
  var tz = getAccountTimeZone();
  var dayNameRow = dateList.map(function (d) {
    return Utilities.formatDate(new Date(d + 'T00:00:00'), tz, 'EEEE');
  });
  var dateRow = dateList.map(function (d) { return new Date(d + 'T00:00:00'); });

  sheet.getRange(1, dayStartCol, 1, dateList.length).merge()
    .setValue('Daily Budget Pacing').setFontWeight('bold').setFontColor('white')
    .setBackground('#7B68EE').setHorizontalAlignment('center');
  sheet.getRange(2, dayStartCol, 1, dateList.length).setValues([dayNameRow])
    .setBackground('#6495ED').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(3, dayStartCol, 1, dateList.length).setValues([dateRow])
    .setNumberFormat('yyyy-mm-dd').setBackground('#6495ED').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center');

  var keys = Object.keys(pacingMap).sort(function (a, b) {
    return pacingMap[a].meta.campaignName.localeCompare(pacingMap[b].meta.campaignName);
  });

  var dataRows = keys.map(function (key) {
    var entry = pacingMap[key];
    var m = entry.meta;
    var kpiRow = kpiMap[key];
    var row = [
      m.customerId, m.accountName, m.campaignName, m.status, m.budget,
      kpiRow ? kpiRow.searchIS : '--',
      kpiRow ? kpiRow.budgetLostIS : '--'
    ];
    kpis.forEach(function (def) { row.push(kpiRow ? kpiRow[def.key] : 0); });
    entry.pacing.forEach(function (v) { row.push(v); });
    return row;
  });

  if (dataRows.length === 0) return;

  sheet.getRange(4, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
  sheet.getRange(4, 5, dataRows.length, 1).setNumberFormat('#,##0.00');
  sheet.getRange(4, 6, dataRows.length, 2).setNumberFormat('0.##%');
  kpis.forEach(function (def, i) {
    sheet.getRange(4, kpiStartCol + i, dataRows.length, 1).setNumberFormat(def.format);
  });
  sheet.getRange(4, dayStartCol, dataRows.length, dateList.length).setNumberFormat('0.##%').setHorizontalAlignment('center');

  applyDepletionGradient(sheet, 4, dayStartCol, dataRows.length, dateList.length);
  applyBudgetLostGradient(sheet, 4, 7, dataRows.length);

  sheet.autoResizeColumns(1, dayStartCol + dateList.length - 1);
}

// ---------------------------------------------------------------------------
// SHEET WRITER — SUMMARY
// ---------------------------------------------------------------------------

function writeSummary(yesterdayPacing, kpiMap) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SUMMARY);
  sheet.clear();

  var now = new Date();
  sheet.getRange(1, 5, 1, 2).merge().setValue('Last Updated').setFontStyle('italic').setFontSize(10);
  sheet.getRange(1, 7).setValue(Utilities.formatDate(now, getAccountTimeZone(), 'yyyy-MM-dd HH:mm'))
    .setFontStyle('italic').setFontSize(10);
  sheet.getRange(1, 1, 1, 4).merge()
    .setValue('Source: Google Ads; Recommended Budgets are estimations based on lost impression share.')
    .setFontSize(9).setFontStyle('italic');

  var headers = ['Customer ID', 'Account', 'Campaign', 'Campaign Status', 'Budget', 'Budget Lost IS',
    'Budget Usage', 'CPA', 'ROAS', 'Hour At Which Budget Depletes', 'Recommended Budget'];

  var capped = [];
  var underspending = [];

  Object.keys(yesterdayPacing).forEach(function (key) {
    var entry = yesterdayPacing[key];
    var m = entry.meta;
    var kpiRow = kpiMap[key];
    var finalPacing = entry.pacing[23];
    if (finalPacing === '' || finalPacing === undefined) finalPacing = 0;

    var budgetLostIsKnown = !!kpiRow;
    var budgetLostIsCell = budgetLostIsKnown ? kpiRow.budgetLostIS : '--';
    var recommendedBudget = budgetLostIsKnown ? m.budget * (1 + kpiRow.budgetLostIS) : '--';

    if (finalPacing >= 1) {
      var depletionHour = '';
      for (var h = 0; h <= 23; h++) {
        if (entry.pacing[h] !== '' && entry.pacing[h] >= 1) { depletionHour = h; break; }
      }
      capped.push([m.customerId, m.accountName, m.campaignName, m.status, m.budget, budgetLostIsCell,
        finalPacing, kpiRow ? kpiRow.cpa : 0, kpiRow ? kpiRow.roas : 0, depletionHour, recommendedBudget]);
    } else {
      underspending.push([m.customerId, m.accountName, m.campaignName, m.status, m.budget, budgetLostIsCell,
        finalPacing, kpiRow ? kpiRow.cpa : 0, kpiRow ? kpiRow.roas : 0, recommendedBudget]);
    }
  });

  capped.sort(function (a, b) { return b[6] - a[6]; });
  underspending.sort(function (a, b) { return a[6] - b[6]; });

  var row = 2;
  sheet.getRange(row, 1, 1, 11).merge().setValue('Campaigns Capped By Budget')
    .setFontWeight('bold').setHorizontalAlignment('center').setBackground('#1e90ff').setFontColor('white');
  row++;
  sheet.getRange(row, 1, 1, 11).setValues([headers])
    .setHorizontalAlignment('center').setBackground('#6495ED').setFontColor('white');
  row++;
  if (capped.length > 0) {
    sheet.getRange(row, 1, capped.length, 11).setValues(capped);
    sheet.getRange(row, 5, capped.length, 1).setNumberFormat('#,##0.00');
    sheet.getRange(row, 6, capped.length, 2).setNumberFormat('0.##%');
    sheet.getRange(row, 9, capped.length, 1).setNumberFormat('0.##%');
    sheet.getRange(row, 11, capped.length, 1).setNumberFormat('#,##0.00');
    row += capped.length;
  }

  row += 1;
  sheet.getRange(row, 1, 1, 10).merge().setValue('Campaigns Underspending')
    .setFontWeight('bold').setHorizontalAlignment('center').setBackground('#3cb371').setFontColor('white');
  row++;
  sheet.getRange(row, 1, 1, 10).setValues([['Customer ID', 'Account', 'Campaign', 'Campaign Status', 'Budget',
    'Budget Lost IS', 'Budget Usage', 'CPA', 'ROAS', 'Recommended Budget']])
    .setHorizontalAlignment('center').setBackground('#8fbc8f').setFontColor('white');
  row++;
  if (underspending.length > 0) {
    sheet.getRange(row, 1, underspending.length, 10).setValues(underspending);
    sheet.getRange(row, 5, underspending.length, 1).setNumberFormat('#,##0.00');
    sheet.getRange(row, 6, underspending.length, 2).setNumberFormat('0.##%');
    sheet.getRange(row, 9, underspending.length, 1).setNumberFormat('0.##%');
    sheet.getRange(row, 10, underspending.length, 1).setNumberFormat('#,##0.00');
  }

  sheet.setColumnWidths(1, 2, 100);
  sheet.setColumnWidth(3, 250);
  sheet.setColumnWidths(4, 8, 110);

  // "Google Ads Editor Friendly" mini table — top campaigns by recommended
  // budget. numericSortValue() pushes "--" (unknown) entries to the bottom
  // instead of leaving their sort position undefined.
  function numericSortValue(v) { return typeof v === 'number' ? v : -Infinity; }
  var allRecommended = capped.map(function (r) { return [r[0], r[2], r[10]]; })
    .concat(underspending.map(function (r) { return [r[0], r[2], r[9]]; }));
  allRecommended.sort(function (a, b) { return numericSortValue(b[2]) - numericSortValue(a[2]); });

  sheet.getRange(2, 13, 1, 3).merge().setValue('Google Ads Editor Friendly Report')
    .setHorizontalAlignment('center').setBackground('#1e90ff').setFontColor('white');
  sheet.getRange(3, 13, 1, 3).setValues([['Customer ID', 'Campaign', 'Budget']]).setHorizontalAlignment('center')
    .setBackground('#6496C8').setFontColor('white');
  if (allRecommended.length > 0) {
    sheet.getRange(4, 13, allRecommended.length, 3).setValues(allRecommended);
    sheet.getRange(4, 15, allRecommended.length, 1).setNumberFormat('#,##0.00');
  }
  sheet.setColumnWidths(13, 3, 150);
}

// ---------------------------------------------------------------------------
// CONDITIONAL FORMATTING HELPERS
// ---------------------------------------------------------------------------

function applyDepletionGradient(sheet, row, col, numRows, numCols) {
  if (numRows === 0) return;
  var range = sheet.getRange(row, col, numRows, numCols);
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#FFFFFF', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue('#6fc362', SpreadsheetApp.InterpolationType.NUMBER, '0.5')
    .setGradientMaxpointWithValue('#e77e63', SpreadsheetApp.InterpolationType.NUMBER, '1')
    .setRanges([range])
    .build();
  var rules = sheet.getConditionalFormatRules();
  rules.push(rule);
  sheet.setConditionalFormatRules(rules);
}

function applyBudgetLostGradient(sheet, row, col, numRows) {
  if (numRows === 0) return;
  var range = sheet.getRange(row, col, numRows, 1);
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#6fc362', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMaxpointWithValue('#e77e63', SpreadsheetApp.InterpolationType.NUMBER, '0.5')
    .setRanges([range])
    .build();
  var rules = sheet.getConditionalFormatRules();
  rules.push(rule);
  sheet.setConditionalFormatRules(rules);
}

// ---------------------------------------------------------------------------
// HIDDEN DATA SHEETS (raw audit trail — plain values, no formulas)
// ---------------------------------------------------------------------------

function dumpRawSheet(sheetName, rows) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  sheet.clear();
  if (rows.length === 0) return;

  var headers = Object.keys(rows[0]);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var values = rows.map(function (r) { return headers.map(function (h) { return r[h]; }); });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function dumpKpiSheet(sheetName, kpiMap) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  sheet.clear();
  var keys = Object.keys(kpiMap);
  if (keys.length === 0) return;

  var headers = Object.keys(kpiMap[keys[0]]);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var values = keys.map(function (k) {
    var row = kpiMap[k];
    return headers.map(function (h) { return row[h]; });
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

// ---------------------------------------------------------------------------
// EMAIL ALERTS
// ---------------------------------------------------------------------------

function checkBudgetAlerts(config) {
  if (!config.email.enabled) return;

  var now = new Date();
  var hour = Number(Utilities.formatDate(now, getAccountTimeZone(), 'H'));
  if (hour > config.email.hourThreshold) return;
  if ((24 - hour) <= 2) return;

  var budgetMap = fetchBudgetMap(config.budgetFilterMicros);
  var todayRows = attachBudget(fetchHourlyRows('TODAY'), budgetMap);
  var pacing = computeHourlyPacing(todayRows, hour);

  var alerts = [];
  Object.keys(pacing).forEach(function (key) {
    var entry = pacing[key];
    var latest = entry.pacing[entry.pacing.length - 1];
    if (latest !== '' && latest >= config.email.budgetThreshold) {
      alerts.push({ customerId: entry.meta.customerId, campaign: entry.meta.campaignName, pct: latest });
    }
  });

  if (alerts.length === 0 || config.email.recipients.length === 0) return;

  var message = '<div>Hi there,&nbsp;</div><div>&nbsp;</div>' +
    '<div>The following Google Ads campaigns have reached, or are nearing, their budget for the day ' +
    'and may no longer be showing impressions:</div>';
  alerts.forEach(function (a) {
    message += '<div style="margin-left:40px;"><ul><li>Customer ID: ' + a.customerId +
      ', Campaign: ' + a.campaign + ' <em>{{Percentage Spent: ' + (a.pct * 100).toFixed(2) + '%}}</em></li></ul></div>';
  });
  message += '<div>&nbsp;</div><div>Check the Summary tab for recommended budget increases.</div>';

  config.email.recipients.slice(0, 5).forEach(function (recipient) {
    try {
      MailApp.sendEmail(recipient, 'Budget Pacer Alert: possible missed revenue opportunity', '', { htmlBody: message });
    } catch (err) {
      Logger.log('Failed to send alert to ' + recipient + ': ' + err);
    }
  });
}
