/**
 * Phone app (the website inside the app): which addresses stay in the app,
 * which are files to save, and which open the phone's own apps.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { decideNavigation, parseBridgeMessage, safeFileName } from "../mobile/src/web-shell";

describe("phone app navigation", () => {
  test("website pages stay in the app", () => {
    for (const url of ["https://xellotuition.com/", "https://xellotuition.com/students/abc?tab=packages", "https://www.xellotuition.com/login", "https://xellotuition.com/api/auth/csrf", "about:blank"]) {
      assert.equal(decideNavigation(url), "load", url);
    }
  });

  test("spreadsheets and backups are files to save", () => {
    for (const url of [
      "https://xellotuition.com/api/accounts/export?from=2026-10-01&to=2026-10-13&basis=CASH",
      "https://xellotuition.com/api/reports/export?type=payouts&startDate=2026-10-01&endDate=2026-10-13",
      "https://xellotuition.com/api/students/abc/purge?backup=1",
      "https://xellotuition.com/api/packages/auto-created?backup=1",
    ]) {
      assert.equal(decideNavigation(url), "download", url);
    }
    assert.equal(decideNavigation("https://xellotuition.com/api/students/abc/purge"), "load", "the preview is not a file");
  });

  test("WhatsApp, phone, email and other websites open outside the app", () => {
    for (const url of ["https://wa.me/971501234567?text=Hello", "tel:+971501234567", "mailto:parent@example.test", "whatsapp://send?phone=1", "https://expo.dev", "https://xellotuition.com.evil.example/"]) {
      assert.equal(decideNavigation(url), "external", url);
    }
  });

  test("file names are safe and messages from the page are checked", () => {
    assert.equal(safeFileName("xello_profit_loss_2026-10-01_to_2026-10-13.csv"), "xello_profit_loss_2026-10-01_to_2026-10-13.csv");
    assert.equal(safeFileName("../../etc/passwd"), "-..-etc-passwd");
    assert.equal(safeFileName(""), "xello-download");
    assert.equal(parseBridgeMessage("not json"), null);
    assert.equal(parseBridgeMessage(JSON.stringify({ type: "other" })), null);
    assert.deepEqual(parseBridgeMessage(JSON.stringify({ type: "download", name: "a.csv", mime: "text/csv", data: "YQ==" })), { type: "download", name: "a.csv", mime: "text/csv", data: "YQ==" });
  });
});
