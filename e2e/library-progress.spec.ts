import { test, expect } from "@playwright/test";

test("Pieces library shows game progress for each prepared piece", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  const bars = page.locator(".piece-progress");
  await expect(bars.first()).toBeVisible();
  await expect(bars).toHaveCount(6);
  await expect(bars.first()).toContainText("0%");
  await expect(bars.first().locator("progress")).toHaveAttribute("max", /[1-9]/);
});
