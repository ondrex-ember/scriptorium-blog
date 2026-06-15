/**
 * blog-modals.js
 * Consent banner + language switcher pro blog.myscriptorium.cz
 * Standalone — žádná závislost na Game objektu
 *
 * localStorage keys:
 *   blog_consent  : 'granted' | 'denied'
 *   blog_lang     : 'cs' | 'en'
 */

/* ─────────────────────────────────────────────
   GA4 — lazy load po souhlasu
───────────────────────────────────────────── */
const BLOG_GA_ID  = 'G-25YYWRNX2H';
const BLOG_GTM_ID = 'GTM-NZSGNPD8';

function blogLoadGA() {
  if (window._blogGaLoaded) return;
  window._blogGaLoaded = true;
  const s = document.createElement('script');
  s.src   = 'https://www.googletagmanager.com/gtag/js?id=' + BLOG_GA_ID;
  s.async = true;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', BLOG_GA_ID, {
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure'
  });
}

// Načti GA hned pokud souhlas již byl udělen
if (localStorage.getItem('blog_consent') === 'granted') {
  blogLoadGA();
}

/* ─────────────────────────────────────────────
   CONSENT MANAGER
───────────────────────────────────────────── */
const BlogConsent = {
  grant() {
    localStorage.setItem('blog_consent', 'granted');
    blogLoadGA();
    this._hide();
  },
  deny() {
    localStorage.setItem('blog_consent', 'denied');
    this._hide();
  },
  _hide() {
    const el = document.getElementById('blog-consent-banner');
    if (el) el.style.display = 'none';
    // Po consent zobraz lang picker pokud jazyk ještě nebyl zvolen
    if (!localStorage.getItem('blog_lang')) {
      BlogLang.showPicker();
    }
  }
};

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

    // Přesměrování — pouze pokud uživatel není na správné verzi
    const path    = window.location.pathname;
    const isInEn  = path.startsWith('/en/') || path === '/en';
    const isInCs  = !isInEn;

    if (lang === 'en' && isInCs) {
      // Přesměruj na EN homepage nebo EN ekvivalent
      const enPath = BlogLang._csToEn(path);
      window.location.href = enPath;
    } else if (lang === 'cs' && isInEn) {
      const csPath = BlogLang._enToCs(path);
      window.location.href = csPath;
    }
    // Jinak zůstaň — jazyk odpovídá
  },

  /**
   * Mapování CS → EN URL
   * Doplňuj podle nových článků
   */
  _csToEn(path) {
    const map = {
      '/':                                    '/en/',
      '/clanky/gutenberg-fust-zrada':         '/en/articles/gutenberg-fust-betrayal',
      '/clanky/pisari-v-klasterech':          '/en/articles/scribes-in-monasteries',
      '/clanky/knihtisk-praha':               '/en/articles/printing-press-prague',
      '/clanky/sklarska-hut-fajrum':          '/en/articles/glassworks-fajrum',
      '/clanky/scriptorium-hra':              '/en/articles/scriptorium-game',
      '/tag/historie':                        '/en/tag/history',
      '/tag/hry':                             '/en/tag/games',
      '/tag/skripty':                         '/en/tag/scripts',
      '/o-autorovi':                          '/en/about',
    };
    // Ořež trailing slash pro matching
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
      '/en/tag/history':                        '/tag/historie',
      '/en/tag/games':                          '/tag/hry',
      '/en/tag/scripts':                        '/tag/skripty',
      '/en/about':                              '/o-autorovi',
    };
    const clean = path.replace(/\/$/, '') || '/en';
    return map[clean] || '/';
  },

  /**
   * Přímý přepínač v nav (CS/EN tlačítko)
   * Přepne na ekvivalentní stránku v druhém jazyce
   */
  toggle() {
    const path   = window.location.pathname;
    const isInEn = path.startsWith('/en/') || path === '/en';
    if (isInEn) {
      window.location.href = BlogLang._enToCs(path);
    } else {
      window.location.href = BlogLang._csToEn(path);
    }
  }
};

/* ─────────────────────────────────────────────
   INIT — spustí se po načtení DOM
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const consentGiven = localStorage.getItem('blog_consent');
  const langChosen   = localStorage.getItem('blog_lang');

  // 1. Consent banner — zobraz pokud nebyl rozhodnut
  if (!consentGiven) {
    const banner = document.getElementById('blog-consent-banner');
    if (banner) banner.style.display = 'block';
    return; // Lang picker počká na rozhodnutí o consent
  }

  // 2. Lang picker — zobraz pokud jazyk nebyl zvolen
  if (!langChosen) {
    BlogLang.showPicker();
  }
});
