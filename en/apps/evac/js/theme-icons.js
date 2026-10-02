/**
 * theme-icons.js
 * Jeden jednoduchý plochý SVG symbol pro každé téma (viz css/themes.css).
 * Hodnoty jsou POUZE vnitřní obsah <svg> (path/circle/...), bez obalového
 * tagu - ten si přidává volající (app.js renderThemeSwatches / renderThemeEmblem)
 * s viewBox="0 0 24 24" fill="currentColor", takže barvu řídí CSS `color`.
 * Obecné geometrické motivy (slunce, měsíc, raketa, klíčová dírka, ...) -
 * žádná konkrétní chráněná značka/postava/logo.
 */

const THEME_ICONS = {
  // Slunce
  light: `
    <circle cx="12" cy="12" r="4.2"/>
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6"/>
    </g>`,

  // Srpek měsíce
  dark: `
    <path d="M20 14.8A8.5 8.5 0 1 1 9.4 4.2a7 7 0 0 0 10.6 10.6z"/>`,

  // Duha
  colorful: `
    <g fill="none" stroke="currentColor" stroke-linecap="round">
      <path d="M3 18a9 9 0 0 1 18 0" stroke-width="2.4"/>
      <path d="M6.4 18a5.6 5.6 0 0 1 11.2 0" stroke-width="2.4" opacity="0.65"/>
    </g>
    <circle cx="3" cy="18.6" r="1.1"/><circle cx="21" cy="18.6" r="1.1"/>`,

  // Půlkruh vysokého kontrastu
  contrast: `
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M12 3a9 9 0 0 1 0 18z"/>`,

  // Raketa
  scifi: `
    <path d="M12 2c3 2.6 4.6 6.4 4.6 10.2 0 1.9-.34 3.6-.94 5l-1.6-1.1c.3-.8.48-1.7.54-2.6H9.4c.06.9.24 1.8.54 2.6L8.34 17.2c-.6-1.4-.94-3.1-.94-5C7.4 8.4 9 4.6 12 2z"/>
    <circle cx="12" cy="10.6" r="1.4" fill="none" stroke="currentColor" stroke-width="1.1"/>
    <path d="M9.1 21 10.3 16.6h3.4L15 21l-2.9-1.3z"/>
    <path d="M7.6 15.4 5 19l2.9-.9.7-2.2M16.4 15.4 19 19l-2.9-.9-.7-2.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,

  // Krystal / drahokam
  fantasy: `
    <path d="M12 2 3 9l9 13 9-13z"/>
    <path d="M7 9h10M9.6 9 12 22M14.4 9 12 22M3 9l4-6h10l4 6" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.55"/>`,

  // Pětihranná hvězda
  ddr: `
    <path d="M12 2.3l2.7 6.5 7 .55-5.35 4.6 1.65 6.85L12 17.2l-6 3.6 1.65-6.85-5.35-4.6 7-.55z"/>`,

  // Brk (husí pero)
  scriptorium: `
    <path d="M20 3c-4.6.5-9.2 3-12.3 7.7C6.2 13.3 4.7 16.4 3.7 20.4c3.1-1 6.4-2.6 9-5.4C17 10.8 19.4 6.9 20 3z"/>
    <path d="M3.7 20.4l3.4-3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,

  // Francouzský klíč
  dirty: `
    <path d="M21.3 6.7a4.6 4.6 0 0 1-6.2 4.3L7 19.1a1.85 1.85 0 0 1-2.6-2.6l8-8.1A4.6 4.6 0 0 1 18.5 3l-3 3 1.6 1.6 3-3c.6.5 1 1.3 1.2 2.1z"/>`,

  // Klíčová dírka
  secret: `
    <circle cx="12" cy="8.6" r="4"/>
    <path d="M9.5 11.6h5l1.7 8.4H7.8z"/>`,

  // Tužka
  handwritten: `
    <path d="M4 20.2 4.8 16 15.4 5.4l3.3 3.3L8.1 19.3z"/>
    <path d="M13.7 7l3.3 3.3" fill="none" stroke="currentColor" stroke-width="1.3"/>
    <path d="M17.1 2.6l4.3 4.3-2.1 2.1-4.3-4.3z"/>`,

  // Terminálový prompt
  terminal: `
    <rect x="2.4" y="4.2" width="19.2" height="15.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M6 9.4l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12.6 15.4h5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,

  // Radiační trojlístek (obecný bezpečnostní symbol) - tři shodné výseče
  // pootočené o 120°, aby byla zaručená souměrnost.
  fallout: `
    <circle cx="12" cy="12" r="2"/>
    <path d="M12 12 8.75 5.02A7.7 7.7 0 0 1 15.25 5.02z"/>
    <path d="M12 12 8.75 5.02A7.7 7.7 0 0 1 15.25 5.02z" transform="rotate(120 12 12)"/>
    <path d="M12 12 8.75 5.02A7.7 7.7 0 0 1 15.25 5.02z" transform="rotate(240 12 12)"/>`,

  // Jehličnatý strom
  intothewild: `
    <path d="M12 2 7.2 9h2.5L6 15h3.1L5.6 20h12.8L15 15h3.1l-3.7-6h2.5z"/>
    <rect x="11" y="20" width="2" height="2"/>`,

  // Jiskra / třpyt
  aesthetic: `
    <path d="M12 2c.6 4.3 2.9 6.6 7.2 7.2-4.3.6-6.6 2.9-7.2 7.2-.6-4.3-2.9-6.6-7.2-7.2C9.1 8.6 11.4 6.3 12 2z"/>
    <path d="M19.2 15c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8z"/>`
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = THEME_ICONS;
}
