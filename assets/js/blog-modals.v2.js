/**
 * blog-modals.v2.js
 * Language switcher pro blog.myscriptorium.cz
 * Standalone - žádná závislost na Game objektu
 *
 * localStorage keys:
 *   blog_lang     : 'cs' | 'en'
 */

/* ─────────────────────────────────────────────
   LANGUAGE SWITCHER
───────────────────────────────────────────── */
const BlogLang = {
  /**
   * Zobraz lang picker modal
   */
  showPicker() {
    const el = document.getElementById('blog-lang-modal');
    if (el) el.style.display = 'flex';
  },

  /**
   * Uživatel vybral jazyk.
   * Přesměruje na správnou verzi stránky.
   */
  pick(lang) {
    localStorage.setItem('blog_lang', lang);
    const el = document.getElementById('blog-lang-modal');
    if (el) el.style.display = 'none';

    const path   = window.location.pathname;
    const isInEn = path.startsWith('/en/') || path === '/en';
    if ((lang === 'en' && !isInEn) || (lang === 'cs' && isInEn)) {
      window.location.href = BlogLang._target(lang, path, isInEn);
    }
  },

  /**
   * Cíl přepnutí: primárně <link rel="alternate" hreflang="..."> aktuální stránky,
   * záložně ruční mapa níže.
   */
  _target(lang, path, isInEn) {
    const alt = document.querySelector('link[rel="alternate"][hreflang="' + lang + '"]');
    if (alt && alt.href) {
      try { return new URL(alt.href, window.location.origin).pathname; } catch (e) {}
    }
    return isInEn ? BlogLang._enToCs(path) : BlogLang._csToEn(path);
  },

  /**
   * Přímý přepínač v nav (CS/EN tlačítko)
   * Přepne na ekvivalentní stránku v druhém jazyce
   */
  toggle() {
    const path   = window.location.pathname;
    const isInEn = path.startsWith('/en/') || path === '/en';
    const lang   = isInEn ? 'cs' : 'en';
    localStorage.setItem('blog_lang', lang);
    window.location.href = BlogLang._target(lang, path, isInEn);
  },

  /**
   * Mapování CS → EN URL
   */
  _csToEn(path) {
    const map = {
      '/':                                         '/en/',
      '/clanky/gutenberg-fust-zrada':              '/en/articles/gutenberg-fust-betrayal',
      '/clanky/pisari-v-klasterech':               '/en/articles/scribes-in-monasteries',
      '/clanky/knihtisk-praha':                    '/en/articles/printing-press-prague',
      '/clanky/sklarska-hut-fajrum':               '/en/articles/glassworks-fajrum',
      '/clanky/scriptorium-hra':                   '/en/articles/scriptorium-game',
      '/clanky/app-ember-chime-android':           '/en/articles/ember-chime-guide',
      '/clanky/ember-chime-app-android-released':  '/en/articles/ember-chime-released',
      '/clanky/budget-pacer-script-google-ads':    '/en/articles/budget-pacer-google-ads',
      '/tag/historie':                             '/en/tag/history',
      '/tag/hry':                                  '/en/tag/games',
      '/tag/aplikace':                             '/en/tag/applications',
      '/tag/skripty':                              '/en/tag/scripts',
      '/o-autorovi':                               '/en/about',
    };
    const clean = path.replace(/\/$/, '') || '/';
    return map[clean] || '/en/';
  },

  /**
   * Mapování EN → CS URL
   */
  _enToCs(path) {
    const map = {
      '/en/':                                   '/',
      '/en':                                    '/',
      '/en/articles/gutenberg-fust-betrayal':   '/clanky/gutenberg-fust-zrada',
      '/en/articles/scribes-in-monasteries':    '/clanky/pisari-v-klasterech',
      '/en/articles/printing-press-prague':     '/clanky/knihtisk-praha',
      '/en/articles/glassworks-fajrum':         '/clanky/sklarska-hut-fajrum',
      '/en/articles/scriptorium-game':          '/clanky/scriptorium-hra',
      '/en/articles/ember-chime-guide':         '/clanky/app-ember-chime-android',
      '/en/articles/ember-chime-released':      '/clanky/ember-chime-app-android-released',
      '/en/articles/budget-pacer-google-ads':   '/clanky/budget-pacer-script-google-ads',
      '/en/tag/history':                        '/tag/historie',
      '/en/tag/games':                          '/tag/hry',
      '/en/tag/applications':                   '/tag/aplikace',
      '/en/tag/scripts':                        '/tag/skripty',
      '/en/about':                              '/o-autorovi',
    };
    const clean = path.replace(/\/$/, '') || '/en';
    return map[clean] || '/';
  }
};

/* ─────────────────────────────────────────────
   INIT - zapamatuje jazyk podle aktuální stránky
   (souhlas se cookies řeší blog-consent.v1.js)
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const isInEn = path.startsWith('/en/') || path === '/en';
  try { localStorage.setItem('blog_lang', isInEn ? 'en' : 'cs'); } catch (e) {}
});
