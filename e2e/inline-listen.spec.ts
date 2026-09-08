import { test, expect } from "@playwright/test";

test("Listen opens the shared player with sheets, transport and no automatic fullscreen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(page.getByTestId("focused-player")).toBeVisible();
  await expect(page.getByLabel("Active hand: Both hands")).toHaveText("↔ Both");
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("canvas.roll")).toBeVisible();
  await expect.poll(async () => Number(await page.getByLabel("Song position").inputValue())).toBeGreaterThan(.2);
  await page.getByRole("button", { name: "Pause practice" }).click();
  const paused = await page.getByLabel("Song position").inputValue();
  await page.waitForTimeout(200);
  await expect(page.getByLabel("Song position")).toHaveValue(paused);
  await page.getByLabel("Song position").fill("10");
  await page.getByLabel("Song position").press("Tab");
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect.poll(async () => Number(await page.getByLabel("Song position").inputValue())).toBeGreaterThan(10);
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await expect(page.locator(".score-strip")).toBeVisible();
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await expect(page.locator("canvas.roll")).toHaveCount(0);
  await expect(page.locator(".score-strip")).toHaveClass(/score-only/);
  await expect(page.getByLabel("Sheet music zoom")).toBeVisible();
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.getByTestId("focused-player")).toBeVisible();
  await expect(page.locator(".player-title")).toContainText("Wait for notes");
});

test("library Listen directly opens the same player and supports restart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.getByRole("button", { name: "Listen to Pathétique · II. Adagio cantabile", exact: true }).click();
  await expect(page.getByTestId("focused-player")).toBeVisible();
  await expect.poll(async () => Number(await page.getByLabel("Song position").inputValue())).toBeGreaterThan(.2);
  await page.getByRole("button", { name: "Pause practice" }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByLabel("Song position")).toHaveValue("0");
  await expect(page.locator("canvas.roll")).toBeVisible();
});
