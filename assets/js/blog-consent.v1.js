/**
 * blog-consent.v1.js
 * GDPR consent bar + privacy modal for blog.myscriptorium.cz
 * Google Consent Mode v2 (advanced). The default "denied" state is set by the inline
 * snippet in <head> BEFORE GTM; this file handles UI, storage and consent updates.
 *
 * localStorage key: blog_consent = "granted" | "denied"
 * Language: <html lang="cs|en">
 * Open the privacy modal from anywhere: <a href="#" data-consent-open>
 */
(function () {
  var KEY = "blog_consent";
  var CSS = "\n" +
"#bc-bar{position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:calc(100% - 16px);max-width:600px;z-index:10001;display:none;background:linear-gradient(145deg,#f4e4c1,#e8d5a3 60%,#e2c990);color:#3a2a14;border:2px solid #8b5e34;border-radius:6px;box-shadow:0 6px 28px rgba(0,0,0,.55);font-family:'Crimson Pro','Palatino Linotype','Book Antiqua',Georgia,serif;padding:12px 14px;text-align:left;}\n" +
"#bc-bar.bc-on{display:block;animation:bcIn .3s ease;}\n" +
"@keyframes bcIn{from{opacity:0;transform:translate(-50%,12px);}to{opacity:1;transform:translate(-50%,0);}}\n" +
".bc-inner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}\n" +
".bc-text{flex:1 1 280px;font-size:14px;line-height:1.5;}\n" +
".bc-title{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#8b5e34;font-weight:700;margin-bottom:3px;}\n" +
".bc-text a,.bc-box a{color:#8b5e34;font-weight:700;text-decoration:underline;cursor:pointer;}\n" +
".bc-actions{display:flex;gap:8px;flex:0 0 auto;}\n" +
".bc-btn{min-width:108px;padding:8px 14px;border-radius:4px;border:1px solid #8b5e34;background:linear-gradient(180deg,#f4e4c1,#dcc690);color:#3a2a14;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;}\n" +
".bc-btn:hover{filter:brightness(1.05);}\n" +
".bc-btn.bc-accept{background:linear-gradient(180deg,#8b5e34,#6b4520);color:#f0deb8;border-color:#4a3015;}\n" +
"@media (max-width:520px){.bc-actions{flex:1 1 100%;}.bc-btn{flex:1;min-width:0;}}\n" +
"#bc-modal{position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px;}\n" +
"#bc-modal.bc-on{display:flex;}\n" +
".bc-box{background:linear-gradient(145deg,#f4e4c1,#e8d5a3);color:#3a2a14;border:2px solid #8b5e34;border-radius:6px;max-width:480px;width:100%;max-height:85vh;overflow:auto;padding:18px;text-align:left;font-family:'Crimson Pro','Palatino Linotype','Book Antiqua',Georgia,serif;box-shadow:0 6px 32px rgba(0,0,0,.5);}\n" +
".bc-box h3{font-size:18px;margin:0 0 10px;color:#3a2a14;}\n" +
".bc-box p{font-size:14.5px;line-height:1.55;margin:0 0 8px;}\n" +
".bc-box .bc-actions{margin-top:12px;justify-content:flex-end;flex-wrap:wrap;}\n" +
".bc-status{font-size:13px;color:#8b5e34;font-style:italic;border-top:1px solid rgba(42,26,10,.15);padding-top:8px;margin-top:4px;}\n";

  var TX = {
    cs: {
      title: "📜 Měření návštěvnosti",
      text: "Blog používá Google Analytics a Microsoft Clarity, aby věděl, které články se čtou a jak se na webu pohybujete. Žádné reklamní cookies, žádná osobní data k prodeji.",
      more: "Více info", deny: "Odmítám", accept: "Souhlasím", close: "✕ Zavřít",
      mTitle: "🍪 Soukromí a měření",
      m1: "Blog měří návštěvnost pomocí Google Analytics 4 a Microsoft Clarity (obojí přes Google Tag Manager). Zajímá nás jen to, které články se čtou, odkud čtenáři přicházejí a jak se na stránkách pohybují.",
      m2: "Nepoužíváme reklamní cookies ani remarketing a žádná osobní data neprodáváme ani nesdílíme s dalšími stranami. Google Analytics 4 neukládá IP adresy.",
      m3: "Dokud souhlas nedáte, neukládají se žádné analytické cookies - Google dostává pouze anonymní signály bez cookies (Google Consent Mode v2).",
      m4: "Volbu můžete kdykoli změnit odkazem 🍪 Cookies v patičce kterékoli stránky. Globální odhlášení: <a href=\"https://tools.google.com/dlpage/gaoptout\" target=\"_blank\" rel=\"noopener\">doplněk Google Analytics Opt-out</a>.",
      m5: "Provozovatel: Ember PA · <a href=\"https://ember-pa.cz/\" target=\"_blank\" rel=\"noopener\">ember-pa.cz</a>",
      st: "Aktuální volba", sG: "souhlas udělen", sD: "odmítnuto", sN: "zatím nerozhodnuto"
    },
    en: {
      title: "📜 Analytics",
      text: "This blog uses Google Analytics and Microsoft Clarity to learn which articles are read and how visitors move around the site. No advertising cookies, no personal data sold.",
      more: "More info", deny: "Decline", accept: "Accept", close: "✕ Close",
      mTitle: "🍪 Privacy & analytics",
      m1: "This blog measures traffic with Google Analytics 4 and Microsoft Clarity (both via Google Tag Manager). We only want to know which articles are read, where readers come from and how they move around the site.",
      m2: "We use no advertising cookies or remarketing, and no personal data is sold or shared with third parties. Google Analytics 4 does not store IP addresses.",
      m3: "Until you consent, no analytics cookies are stored - Google only receives anonymous cookieless signals (Google Consent Mode v2).",
      m4: "You can change your choice at any time via the 🍪 Cookies link in the footer of any page. Global opt-out: <a href=\"https://tools.google.com/dlpage/gaoptout\" target=\"_blank\" rel=\"noopener\">Google Analytics Opt-out add-on</a>.",
      m5: "Operator: Ember PA · <a href=\"https://ember-pa.cz/\" target=\"_blank\" rel=\"noopener\">ember-pa.cz</a>",
      st: "Current choice", sG: "accepted", sD: "declined", sN: "not decided yet"
    }
  };
  var bar = null, modal = null, lastFocus = null;

  function curLang() { return (document.documentElement.lang || "cs").toLowerCase().indexOf("en") === 0 ? "en" : "cs"; }
  function getSaved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function decided() { var s = getSaved(); return s === "granted" || s === "denied"; }
  function label(l) { var t = TX[l], s = getSaved(); return s === "granted" ? t.sG : (s === "denied" ? t.sD : t.sN); }

  function clearCookies() {
    try {
      var host = location.hostname, parts = host.split("."), root = parts.length > 1 ? "." + parts.slice(-2).join(".") : host;
      document.cookie.split(";").forEach(function (c) {
        var n = c.split("=")[0].trim();
        if (n.indexOf("_ga") === 0 || n.indexOf("_gid") === 0 || n.indexOf("_gat") === 0 || n === "_clck" || n === "_clsk" || n === "CLID" || n === "SM") {
          var exp = "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = n + exp;
          document.cookie = n + exp + ";domain=" + host;
          document.cookie = n + exp + ";domain=" + root;
        }
      });
    } catch (e) {}
  }
  function pushConsent(granted) {
    var v = granted ? "granted" : "denied";
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") { window.gtag = function () { window.dataLayer.push(arguments); }; }
    window.gtag("consent", "update", { analytics_storage: v, functionality_storage: v });
    window.dataLayer.push({ event: "consent_update", consent_analytics: v });
    try {
      if (typeof window.clarity === "function") {
        window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: v });
        if (!granted) { window.clarity("consent", false); }
      }
    } catch (e) {}
  }
  function injectCss() {
    if (document.getElementById("bc-style")) return;
    var s = document.createElement("style"); s.id = "bc-style"; s.textContent = CSS; document.head.appendChild(s);
  }
  function fillBar() {
    var t = TX[curLang()];
    bar.innerHTML = '<div class="bc-inner"><div class="bc-text"><span class="bc-title">' + t.title + '</span>' + t.text +
      ' <a href="#" class="bc-more">' + t.more + '</a></div><div class="bc-actions">' +
      '<button type="button" class="bc-btn bc-deny">' + t.deny + '</button>' +
      '<button type="button" class="bc-btn bc-accept">' + t.accept + '</button></div></div>';
    bar.querySelector(".bc-more").addEventListener("click", function (e) { e.preventDefault(); openModal(); });
    bar.querySelector(".bc-deny").addEventListener("click", function () { setConsent(false); });
    bar.querySelector(".bc-accept").addEventListener("click", function () { setConsent(true); });
  }
  function fillModal() {
    var t = TX[curLang()];
    modal.innerHTML = '<div class="bc-box" role="dialog" aria-modal="true" aria-labelledby="bc-mt"><h3 id="bc-mt">' + t.mTitle + '</h3>' +
      '<p>' + t.m1 + '</p><p>' + t.m2 + '</p><p>' + t.m3 + '</p><p>' + t.m4 + '</p><p>' + t.m5 + '</p>' +
      '<div class="bc-status">' + t.st + ': <strong>' + label(curLang()) + '</strong></div>' +
      '<div class="bc-actions"><button type="button" class="bc-btn bc-close">' + t.close + '</button>' +
      '<button type="button" class="bc-btn bc-deny">' + t.deny + '</button>' +
      '<button type="button" class="bc-btn bc-accept">' + t.accept + '</button></div></div>';
    modal.querySelector(".bc-close").addEventListener("click", closeModal);
    modal.querySelector(".bc-deny").addEventListener("click", function () { setConsent(false); });
    modal.querySelector(".bc-accept").addEventListener("click", function () { setConsent(true); });
  }
  function openBar() {
    injectCss();
    if (!bar) { bar = document.createElement("div"); bar.id = "bc-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Cookies"); document.body.appendChild(bar); }
    fillBar(); bar.classList.add("bc-on");
  }
  function closeBar() { if (bar) bar.classList.remove("bc-on"); }
  function openModal() {
    injectCss();
    lastFocus = document.activeElement;
    if (!modal) {
      modal = document.createElement("div"); modal.id = "bc-modal";
      modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
      document.body.appendChild(modal);
    }
    fillModal(); modal.classList.add("bc-on");
    var b = modal.querySelector(".bc-accept"); if (b) b.focus();
  }
  function closeModal() {
    if (modal) modal.classList.remove("bc-on");
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function setConsent(granted) {
    try { localStorage.setItem(KEY, granted ? "granted" : "denied"); } catch (e) {}
    pushConsent(granted);
    if (!granted) clearCookies();
    closeBar(); closeModal();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && modal.classList.contains("bc-on")) closeModal();
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("[data-consent-open]") : null;
    if (a) { e.preventDefault(); openModal(); }
  });

  window.BlogConsent = { open: openModal, openBar: openBar, decided: decided, label: label };

  function init() { if (!decided()) openBar(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
