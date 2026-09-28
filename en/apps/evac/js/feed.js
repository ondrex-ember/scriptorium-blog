/**
 * feed.js
 * Feed novinek - MVP/testovací verze (viz MRD bod 8).
 * Uživatel zatím nedodal finální seznam endpointů, proto:
 *  - zdroje jsou v jednom poli FEED_SOURCES, snadno vyměnitelné
 *  - použit rss2json.com free tier (převádí RSS -> JSON, řeší CORS v prohlížeči/artefaktu)
 *  - ČHMÚ výstrahy jsou zapnuté jako reálný zdroj, druhý je obecný placeholder
 *  - výsledek se cachuje do localStorage pro offline zobrazení
 *
 * POZOR: v sandboxu artefaktu nemusí být odchozí fetch na cizí domény vždy
 * povolen - modul proto vždy padá zpět na poslední cache a UI to jasně říká,
 * místo aby tvářilo prázdný/rozbitý stav.
 */

const FEED_CACHE_KEY = "evac_feed_cache_v1";
const FEED_RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json?rss_url=";

const FEED_SOURCES = [
  {
    id: "chmi",
    name: "ČHMÚ - výstrahy",
    // Výstražná meteorologická RSS/XML ČHMÚ. Ověřit/nahradit finálním zdrojem dle potřeby.
    url: "https://www.chmi.cz/files/portal/docs/meteo/om/vystrahy/XML_CZ.xml"
  },
  {
    id: "placeholder",
    name: "Testovací zdroj (nahradit)",
    url: "https://rss2json.com/api.json?rss_url=https://feeds.bbci.co.uk/news/world/rss.xml"
  }
];

const Feed = (function () {
  function loadCache() {
    try {
      const raw = localStorage.getItem(FEED_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCache(items) {
    try {
      localStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ items, fetched_at: new Date().toISOString() }));
    } catch (e) {
      /* localStorage full or unavailable - ignore, cache is best-effort */
    }
  }

  async function fetchSource(source) {
    const isRss2json = source.url.includes("rss2json.com/api.json");
    const endpoint = isRss2json ? source.url : FEED_RSS2JSON_ENDPOINT + encodeURIComponent(source.url);
    const res = await fetch(endpoint, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.status !== "ok" || !Array.isArray(data.items)) throw new Error("Neplatná odpověď feedu");
    return data.items.slice(0, 10).map((it) => ({
      source: source.name,
      title: it.title,
      link: it.link,
      pubDate: it.pubDate,
      description: (it.description || "").replace(/<[^>]*>/g, "").slice(0, 240)
    }));
  }

  /**
   * Fetch all sources; returns { items, fromCache, error, fetched_at }
   * Never throws - always resolves to something the UI can render.
   */
  async function fetchAll() {
    try {
      const results = await Promise.allSettled(FEED_SOURCES.map(fetchSource));
      const items = [];
      let anySucceeded = false;
      for (const r of results) {
        if (r.status === "fulfilled") {
          anySucceeded = true;
          items.push(...r.value);
        }
      }
      if (!anySucceeded) throw new Error("Žádný zdroj se nepodařilo načíst");
      items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      saveCache(items);
      return { items, fromCache: false, error: null, fetched_at: new Date().toISOString() };
    } catch (err) {
      const cached = loadCache();
      if (cached) {
        return { items: cached.items, fromCache: true, error: err.message, fetched_at: cached.fetched_at };
      }
      return { items: [], fromCache: false, error: err.message, fetched_at: null };
    }
  }

  function getCachedOnly() {
    const cached = loadCache();
    return cached ? { items: cached.items, fromCache: true, fetched_at: cached.fetched_at } : { items: [], fromCache: true, fetched_at: null };
  }

  return { fetchAll, getCachedOnly, sources: FEED_SOURCES };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Feed;
}
