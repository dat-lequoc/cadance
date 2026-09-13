import { test, expect, type Page } from "@playwright/test";
import { keyGeometry, keyboardHeight } from "../src/ui/Roll";
import { black } from "../src/core/model";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const title = "Practice Chopin · Ballade No. 1 (Paul Barton Edition)";

async function openBartonPiece(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
}

test("Barton edition supports simulated note input, both score views, and offline assets", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await openBartonPiece(page);
  await expect(
    page.getByRole("heading", { name: /Ballade No. 1 \(Paul Barton Edition\)/ })
  ).toBeVisible();
  await expect(page.locator(".quest-overall")).toContainText("0 / 595");

  // Verify primary score link points to Barton PDF
  await expect(page.getByRole("link", { name: /Mutopia/ })).toHaveAttribute(
    "href",
    "/pieces/chopin-ballade-1-mutopia.pdf"
  );

  // Start first quest and verify Barton sheet music
  await page.getByRole("button", { name: /Start first quest/ }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await expect(page.getByLabel("Highlighted bar 1", { exact: true })).toBeVisible();
  await expect(page.getByAltText("Score page 1, bars 1–3")).toBeVisible();

  // Play opening Largo notes (C D Eb F G Eb Ab G F Eb D C)
  for (const pitch of [48, 51, 56, 58, 60, 56, 63, 70, 72, 68, 75, 82]) {
    await expect(page.locator(".stage-feedback")).toContainText("Your turn", {
      timeout: 15000,
    });
    const box = (await page.locator("canvas.roll").boundingBox())!;
    const key = keyGeometry(21, 108, box.width).get(pitch)!;
    const y = black(pitch)
      ? box.height - keyboardHeight(box.height) + 15
      : box.height - 10;
    await page.locator("canvas.roll").click({ position: { x: key.x + key.width / 2, y } });
    await page.waitForTimeout(250);
  }

  await expect(page.locator(".quest-run-label strong")).toHaveText(
    "1 / 10 completed runs",
    { timeout: 15000 }
  );

  // Test Sheet only mode with Barton score
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await expect(page.locator(".stage")).toHaveCount(0);
  await expect(page.getByAltText("Score page 1, bars 1–3")).toBeVisible();

  // Verify service worker offline caching of Barton score assets
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  const cached = await page.evaluate(async () => {
    const responses = await Promise.all(
      [
        "/scores/ballade-1-barton/system-01.png",
        "/scores/ballade-1-barton/system-89.png",
        "/pieces/chopin-ballade-1-barton.pdf",
      ].map((url) => fetch(url))
    );
    return responses.every((r) => r.ok);
  });
  expect(cached).toBe(true);
  expect(errors).toEqual([]);
});

test("renaming either edition keeps its plan, score and saved progress", async ({ page }) => {
  await page.goto("/");
  for (const [name, count, renamed] of [
    ["Chopin · Ballade No. 1 (Op. 23)", 596, "My original Ballade"],
    ["Chopin · Ballade No. 1 (Paul Barton Edition)", 595, "My annotated Ballade"],
  ] as const) {
    await page.getByRole("button", { name: "Pieces", exact: true }).click();
    const row = page.locator("article").filter({ has: page.getByRole("heading", { name: new RegExp(name.replace(/[()·]/g, "\\$&")) }) });
    await row.getByRole("button", { name: /Options for/ }).click();
    await row.getByRole("button", { name: "Rename", exact: true }).click();
    await row.locator("input").fill(renamed);
    await row.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Practice " + renamed, exact: true }).click();
    await expect(page.locator(".quest-overall")).toContainText(`0 / ${count}`);
    await page.getByRole("button", { name: /Start first quest/ }).click();
    await page.getByRole("button", { name: "Use simulated input" }).click();
    await page.getByRole("button", { name: "Sheet music", exact: true }).click();
    await expect(page.locator(".score-image img").first()).toHaveAttribute("src", new RegExp(count === 595 ? "ballade-1-barton/" : "ballade-1/"));
    await page.reload();
    await expect(page.locator(".quest-overall")).toContainText(`0 / ${count}`);
  }
});

test("Barton label-only plan revision preserves earned runs and the old record", async ({ page }) => {
  const oldMarkdown = readFileSync("public/plans/history/ballade-1-barton-v1.md", "utf8");
  const planFrom = (md: string) => JSON.parse(md.match(/```cadance-plan\n([\s\S]*?)```/)![1]);
  const signature = (md: string) => createHash("sha256").update(JSON.stringify(planFrom(md))).digest("hex");
  const oldSignature = signature(oldMarkdown);
  const newSignature = signature(readFileSync("public/plans/ballade-1-barton.md", "utf8"));
  const questId = planFrom(oldMarkdown).quests[0].id;
  await openBartonPiece(page);
  await expect(page.locator(".quest-overall")).toContainText("0 / 595");
  await page.evaluate(async ({ oldMarkdown, oldSignature, questId }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("cadence-piano");
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("settings", "readwrite"), settings = tx.objectStore("settings");
      settings.put({ key: "quest-plan:chopin-ballade-1-barton", value: oldMarkdown });
      settings.put({ key: "quest-progress:" + oldSignature, value: { version: 1, passes: { [questId]: { attempts: 4, successes: 3, streak: 2, completed: false } }, processed: ["old-earned-session"] } });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }), { oldMarkdown, oldSignature, questId });
  await page.reload();
  await expect(page.locator(".next-quest > strong")).toContainText("3 / 10");
  const records = await page.evaluate(async ({ oldSignature, newSignature }) => new Promise<any[]>((resolve, reject) => {
    const request = indexedDB.open("cadence-piano");
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("settings"), store = tx.objectStore("settings");
      const old = store.get("quest-progress:" + oldSignature), current = store.get("quest-progress:" + newSignature);
      tx.oncomplete = () => { db.close(); resolve([old.result, current.result]); };
      tx.onerror = () => reject(tx.error);
    };
  }), { oldSignature, newSignature });
  expect(records[0].value).toEqual(records[1].value);
  expect(records[1].value.passes[questId].successes).toBe(3);
});

test("Barton cadenza and ending use the recounted systems in both views", async ({ page }) => {
  await openBartonPiece(page);
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  for (const [bar, range, pageNumber] of [[246,"246–247",21],[248,"248–249",21],[250,"250–254",21],[255,"255–257",21],[258,"258–264",22]] as const) {
    await page.getByRole("button", { name: "Passages", exact: true }).click();
    await page.getByLabel("Loop last bar").selectOption("264");
    await page.getByLabel("Loop first bar").selectOption(String(bar));
    await page.getByLabel("Loop last bar").selectOption(String(bar));
    await page.getByRole("button", { name: "Apply loop", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByAltText(`Score page ${pageNumber}, bars ${range}`)).toBeVisible();
    await expect(page.getByLabel(`Highlighted bar ${bar}`, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await expect(page.getByAltText("Score page 22, bars 258–264")).toBeInViewport();
  await page.screenshot({ path: "test-results/barton-corrected-ending.png" });
});
