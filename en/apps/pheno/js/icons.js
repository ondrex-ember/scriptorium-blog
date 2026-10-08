// Inline SVG sprite: nav/status symbols copied from Evac (index.html), care pictograms drawn in the same style
// (stroke 1.7, round caps and joins, currentColor).
export const SPRITE = `<symbol id="i-overview" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="m14 17 2 2 5-6"/></symbol>
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
<symbol id="i-groups" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></symbol>
`;

export function injectSprite() {
  const d = document.createElement('div');
  d.innerHTML = '<svg class="ui-icon-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + SPRITE + '</svg>';
  document.body.prepend(d.firstChild);
}
