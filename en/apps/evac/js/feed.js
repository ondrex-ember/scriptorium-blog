/**
 * feed.js
 * Feed novinek - dočasně jeden pevný zdroj (BBC World News) pro všechny
 * uživatele, dokud nebude hotový vlastní feed engine (custom zdroje na
 * uživatele). Do té doby:
 *  - jediný zdroj je v FEED_SOURCES, snadno vyměnitelný/rozšiřitelný
 *  - BBC RSS přes dvě nezávislé veřejné CORS brány
 *  - výsledek se cachuje do localStorage pro offline zobrazení
 *
 * POZOR: rss2json.com bezplatný tier bez klíče má sdílený rate limit -
 * modul proto vždy padá zpět na poslední cache a UI to jasně říká, místo
 * aby tvářilo prázdný/rozbitý stav. Při vlastním feed enginu odpadne.
 */

const FEED_CACHE_KEY = "evac_feed_cache_v1";
const FEED_RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json?rss_url=";
const FEED_RAW_ENDPOINT = "https://api.allorigins.win/raw?url=";

const FEED_SOURCES = [
  {
    id: "bbc-world",
    name: "BBC World News",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml"
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
    const res = await fetch(endpoint, { method: "GET", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.status !== "ok" || !Array.isArray(data.items) || !data.items.length) throw new Error(data.message || "Neplatná odpověď feedu");
    return data.items.slice(0, 10).map((it) => ({
      source: source.name,
      title: it.title,
      link: it.link,
      pubDate: it.pubDate,
      description: (it.description || "").replace(/<[^>]*>/g, "").slice(0, 240)
    }));
  }

  async function fetchRawSource(source) {
    const res = await fetch(FEED_RAW_ENDPOINT + encodeURIComponent(source.url), {
      method: "GET", signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error("RSS HTTP " + res.status);
    const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("Neplatné RSS");
    const items = Array.from(xml.querySelectorAll("channel > item")).slice(0, 10).map((item) => ({
      source: source.name,
      title: item.querySelector("title")?.textContent?.trim() || "",
      link: item.querySelector("link")?.textContent?.trim() || "",
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
      description: item.querySelector("description")?.textContent?.replace(/<[^>]*>/g, "").slice(0, 240) || ""
    })).filter((item) => item.title && item.link);
    if (!items.length) throw new Error("Prázdné RSS");
    return items;
  }

  async function fetchWithFallback(source) {
    try { return await fetchSource(source); }
    catch (error) { return fetchRawSource(source); }
  }

  /**
   * Fetch all sources; returns { items, fromCache, error, fetched_at }
   * Never throws - always resolves to something the UI can render.
   */
  async function fetchAll() {
    try {
      const results = await Promise.allSettled(FEED_SOURCES.map(fetchWithFallback));
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
