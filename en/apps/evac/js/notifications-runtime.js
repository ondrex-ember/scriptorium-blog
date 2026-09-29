/**
 * notifications-runtime.js
 * Browser-facing half of local notifications: permission, service worker
 * registration, best-effort periodic background sync, and the reliable
 * "check every time the app is opened/focused" path. Pure status math stays
 * in notifications.js - this file only deals with browser APIs and side effects.
 */

const NotificationsRuntime = (function () {
  let swRegistration = null;
  let foregroundCheckPromise = null;

  function getPermissionStatus() {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission; // "default" | "granted" | "denied"
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      // Production redirects the trailing-slash URL to the no-slash path;
      // local HTTP previews keep their own directory scope.
      const production = location.hostname === "blog.myscriptorium.cz";
      swRegistration = await navigator.serviceWorker.register("service-worker.js", {
        scope: production ? "/en/apps/evac" : new URL("./", document.baseURI).pathname
      });
      return swRegistration;
    } catch (e) {
      return null; // e.g. running from file:// - service workers require http(s)
    }
  }

  /** Best-effort - silently does nothing where unsupported (most browsers today, notably iOS Safari). */
  async function tryRegisterPeriodicSync() {
    if (!swRegistration || !("periodicSync" in swRegistration)) return false;
    try {
      const status = await navigator.permissions.query({ name: "periodic-background-sync" });
      if (status.state !== "granted") return false;
      await swRegistration.periodicSync.register("evac-daily-check", {
        minInterval: 24 * 60 * 60 * 1000
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function requestPermission() {
    if (typeof Notification === "undefined") return "unsupported";
    const result = await Notification.requestPermission();
    if (result === "granted") await tryRegisterPeriodicSync();
    return result;
  }

  async function showNotification(title, options) {
    if (getPermissionStatus() !== "granted") return;
    if (swRegistration && swRegistration.showNotification) {
      await swRegistration.showNotification(title, options);
    } else if (typeof Notification !== "undefined") {
      new Notification(title, options);
    }
  }

  /**
   * Reliable path: called once per app load/focus. Notifies at most once a
   * day (shared dedup key with the service worker's background check) and
   * only about time-sensitive states, not the standing "missing" gap.
   */
  function runForegroundCheck(items, profile) {
    if (foregroundCheckPromise) return foregroundCheckPromise;
    foregroundCheckPromise = (async () => {
      if (getPermissionStatus() !== "granted") return;
      const attention = getTimeSensitiveItems(items, profile);
      if (!attention.length) return;

      const today = todayISO();
      const lastNotifiedDate = await Storage.getMeta("last_notification_date");
      if (lastNotifiedDate === today) return;

      await showNotification(I18n.t("app.title"), {
        body: I18n.t("notif.summaryBody", { count: attention.length }),
        icon: "assets/icons/icon-192.png",
        tag: "evac-attention"
      });
      await Storage.setMeta("last_notification_date", today);
    })();
    return foregroundCheckPromise.finally(() => { foregroundCheckPromise = null; });
  }

  /** Ask an already-registered SW to run its own background check right away (fallback for browsers without periodicSync). */
  function pokeServiceWorker() {
    if (swRegistration && swRegistration.active) {
      swRegistration.active.postMessage({ type: "RUN_CHECK" });
    }
  }

  return { getPermissionStatus, registerServiceWorker, requestPermission, runForegroundCheck, pokeServiceWorker };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = NotificationsRuntime;
}
