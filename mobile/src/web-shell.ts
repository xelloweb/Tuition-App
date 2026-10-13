/**
 * The phone app shows the Xello Tuition website itself, so every feature and
 * every role works exactly as on the web, and website updates reach the app
 * without a new APK. These rules decide what happens when the website opens
 * an address. Plain TypeScript (no React Native imports) so it can be tested.
 */

export const SITE_URL = "https://xellotuition.com";
const SITE_HOSTS = ["xellotuition.com", "www.xellotuition.com"];

/** load: show in the app · download: fetch the file and offer Save/Share · external: open the phone's own app (WhatsApp, phone, email, browser). */
export type NavDecision = "load" | "download" | "external";

/** Spreadsheets and backup files the website offers to download. */
export function isDownloadUrl(url: URL): boolean {
  return url.pathname.startsWith("/api/") && (/\/export$/.test(url.pathname) || url.searchParams.get("backup") === "1");
}

export function decideNavigation(raw: string, site: string = SITE_URL): NavDecision {
  if (/^(about|data|blob|javascript):/i.test(raw)) return "load";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "load";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "external"; // tel:, mailto:, whatsapp:, intent:
  const siteHost = new URL(site).host;
  const ours = url.host === siteHost || SITE_HOSTS.includes(url.host);
  if (!ours) return "external";
  return isDownloadUrl(url) ? "download" : "load";
}

/** A file name that is safe to save on the phone. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim();
  return (cleaned || "xello-download").slice(0, 120);
}

/** Messages the website page sends to the app. */
export type BridgeMessage =
  | { type: "download-start" }
  | { type: "download"; name: string; mime: string; data: string }
  | { type: "download-error"; message: string };

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const m = JSON.parse(raw);
    if (m?.type === "download-start") return m;
    if (m?.type === "download" && typeof m.name === "string" && typeof m.data === "string") return { type: "download", name: m.name, mime: String(m.mime || "application/octet-stream"), data: m.data };
    if (m?.type === "download-error") return { type: "download-error", message: String(m.message || "The file could not be downloaded.") };
    return null;
  } catch {
    return null;
  }
}

/**
 * Runs inside every website page in the app. A download link or button
 * (spreadsheets, backups) is fetched with the signed-in session and handed to
 * the app as base64, because a phone web view cannot save files by itself.
 * Clicks still reach the website, so its own steps (e.g. "Backup downloaded")
 * carry on as on the web.
 */
export const BRIDGE_SCRIPT = `(function () {
  if (window.__xelloBridge) return;
  window.__xelloBridge = true;
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  function isDownload(href) {
    try {
      var u = new URL(href, location.href);
      return u.origin === location.origin && u.pathname.indexOf("/api/") === 0 &&
        (/\\/export$/.test(u.pathname) || u.searchParams.get("backup") === "1");
    } catch (e) { return false; }
  }
  window.__xelloDownload = function (href) {
    post({ type: "download-start" });
    fetch(href, { credentials: "include" }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = t;
          try { var j = JSON.parse(t); msg = j.error || j.message || t; } catch (e) {}
          throw new Error(msg || ("Download failed (" + res.status + ")"));
        });
      }
      var cd = res.headers.get("content-disposition") || "";
      var m = /filename="?([^";]+)"?/i.exec(cd);
      var name = m ? m[1] : "xello-download";
      var mime = (res.headers.get("content-type") || "application/octet-stream").split(";")[0];
      return res.blob().then(function (blob) {
        return new Promise(function (resolve, reject) {
          var r = new FileReader();
          r.onload = function () { resolve(String(r.result)); };
          r.onerror = function () { reject(new Error("The file could not be read.")); };
          r.readAsDataURL(blob);
        });
      }).then(function (dataUrl) {
        post({ type: "download", name: name, mime: mime, data: dataUrl.slice(dataUrl.indexOf(",") + 1) });
      });
    }).catch(function (err) {
      post({ type: "download-error", message: String((err && err.message) || "The file could not be downloaded.").slice(0, 300) });
    });
  };
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || !isDownload(a.getAttribute("href"))) return;
    e.preventDefault();
    window.__xelloDownload(new URL(a.getAttribute("href"), location.href).href);
  }, true);
})();
true;`;
