// Browser smoke test for a freshly generated, empty workbench (no --cuts).
// Usage: node scripts/test-score-workbench.mjs /absolute/path/to/workbench/index.html
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

if (!process.argv[2]) throw Error("Pass the path to a generated empty workbench/index.html");
const html = resolve(process.argv[2]);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(html).href);
  const canvas = page.locator("canvas");
  await page.waitForFunction(() => document.querySelector("canvas").width > 300);
  const info = JSON.parse(await readFile(join(dirname(html), "inspection.json"), "utf8"));
  const box = await canvas.boundingBox();
  const click = (x, y) => canvas.click({ position: { x: x * box.width, y: y * box.height } });
  await click(.1, .15);
  await click(.9, .4);
  await page.getByLabel("Tool", { exact: true }).selectOption("edges");
  for (const x of [.2, .5, .8]) await click(x, .25);
  await page.getByLabel("Last MIDI bar").fill("2");
  await page.getByRole("button", { name: "Add system", exact: true }).click();
  const cuts = JSON.parse(await page.getByLabel("Cuts JSON", { exact: true }).inputValue());
  assert.equal(cuts.systems.length, 1);
  assert.equal(cuts.reviewed, false);
  assert.equal(cuts.systems[0].barEdges.length, 3);
  assert.equal(cuts.systems[0].throughBar, 2);
  assert.ok(Math.abs(cuts.systems[0].crop[0] - .1 * info.pageInfo[0].width) < 2);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download cuts JSON" }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.deepEqual(exported, cuts);
  // Scaling/page changes and invalid source hashes must not corrupt the draft.
  if (info.pages > 1) await page.getByLabel("Page", { exact: true }).selectOption("1");
  assert.deepEqual(JSON.parse(await page.getByLabel("Cuts JSON", { exact: true }).inputValue()), cuts);
  await page.getByLabel("Page", { exact: true }).selectOption("0");
  await page.screenshot({ path: join(dirname(html), "workbench-test.png"), fullPage: true });
  cuts.pdfSha256 = "wrong";
  await page.getByLabel("Cuts JSON", { exact: true }).fill(JSON.stringify(cuts));
  await page.getByRole("button", { name: "Apply JSON" }).click();
  assert.match(await page.getByRole("status").textContent(), /Wrong PDF hash/);
  assert.deepEqual(errors, []);
  console.log("Workbench browser checks passed: scaled coordinates, export, page switching, source hash guard.");
} finally {
  await browser.close();
}
