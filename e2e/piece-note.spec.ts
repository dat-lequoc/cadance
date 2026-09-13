import { test, expect, type Page } from "@playwright/test";

async function expectFullScoreWidth(page: Page) {
  await expect(page.locator(".piece-note")).toHaveCount(0);
  const body = await page.locator(".score-body").boundingBox();
  const viewport = await page.locator(".score-viewport").boundingBox();
  expect(body).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(viewport!.x).toBeCloseTo(body!.x, 0);
  expect(viewport!.width).toBeCloseTo(body!.width, 0);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`sheet PDF has an inline note toggle with no collapsed sidebar at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Pieces", exact: true }).click();
    await page.getByRole("button", { name: "Practice Claude Debussy · Arabesque No. 1", exact: true }).click();
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await page.getByRole("button", { name: "Sheet music", exact: true }).click();

    const toggle = page.locator(".score-toolbar .piece-note-toggle");
    const pdf = page.locator(".score-toolbar").getByRole("link", { name: "PDF ↗" });
    const note = page.getByRole("complementary", { name: "Piece note", exact: true });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expectFullScoreWidth(page);
    const pdfBox = await pdf.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(toggleBox!.x).toBeGreaterThanOrEqual(pdfBox!.x + pdfBox!.width);
    expect(toggleBox!.y + toggleBox!.height / 2).toBeCloseTo(pdfBox!.y + pdfBox!.height / 2, 0);
    const pdfUrl = await pdf.getAttribute("href");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(note).toContainText("E major");
    await expect(note).toHaveAttribute("id", (await toggle.getAttribute("aria-controls"))!);
    const noteBox = await note.boundingBox();
    const scoreBox = await page.locator(".score-viewport").boundingBox();
    expect(noteBox!.x + noteBox!.width).toBeLessThanOrEqual(scoreBox!.x);
    await expect(page.locator(".score-note-overlay line")).toHaveCount(1);

    await toggle.click();
    await expectFullScoreWidth(page);
    await page.getByRole("button", { name: "Sheet only", exact: true }).click();
    await expectFullScoreWidth(page);

    // Enter activates toolbar controls; Space remains the player transport shortcut.
    await toggle.focus();
    await toggle.press("Enter");
    await expect(note).toBeVisible();
    await expect(note).toContainText("E major");
    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expectFullScoreWidth(page);
    await expect(pdf).toHaveAttribute("href", pdfUrl!);
  });
}

test("sheet-only can pan upward after moving to a later system", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await page.getByLabel("Sheet music zoom").fill("200");
  const viewport = page.getByLabel("Score image; scroll to pan");
  const scrollRange = await viewport.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(scrollRange).toBeGreaterThan(0);
  await viewport.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const before = await viewport.evaluate((el) => el.scrollTop);
  await viewport.hover({ position: { x: 300, y: 180 } });
  await page.mouse.wheel(0, -500);
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeLessThan(before);
});

test("combined score can pan vertically without the playhead reclaiming the scroll", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  const viewport = page.getByLabel("Score image; scroll to pan");
  await page.getByLabel("Sheet music zoom").fill("200");
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  await viewport.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const before = await viewport.evaluate((el) => el.scrollTop);
  await viewport.hover({ position: { x: 300, y: 180 } });
  await page.mouse.wheel(0, -500);
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeLessThan(before);
  await expect(page.locator(".score-position")).toContainText("Bars");
  const moved = await viewport.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(400);
  await expect(viewport).toHaveJSProperty("scrollTop", moved);
});

test("Pathétique combined PDF can move upward at the screenshot's zoom", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await page.getByLabel("Sheet music zoom").fill("110");
  await page.getByRole("button", { name: "Next score system" }).click();
  const viewport = page.getByLabel("Score image; scroll to pan");
  const metrics = await viewport.evaluate((el) => ({ range: el.scrollHeight - el.clientHeight, top: el.scrollTop }));
  expect(metrics.range).toBeGreaterThan(0);
  await viewport.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const before = await viewport.evaluate((el) => el.scrollTop);
  await viewport.hover({ position: { x: 300, y: 180 } });
  await page.mouse.wheel(0, -200);
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeLessThan(before);
});
