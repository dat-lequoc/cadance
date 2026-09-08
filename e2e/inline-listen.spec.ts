import { test, expect } from "@playwright/test";
test("Listen stays on setup with pause, seek and resume; practice still enters focused player", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(page.locator("h1")).toHaveText(
    "Pathétique · II. Adagio cantabile",
  );
  await expect(page.getByTestId("focused-player")).toHaveCount(0);
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(
    page.getByRole("button", { name: "Pause listening" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Listening position").inputValue()),
    )
    .toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Pause listening" }).click();
  const paused = await page.getByLabel("Listening position").inputValue();
  await page.waitForTimeout(200);
  await expect(page.getByLabel("Listening position")).toHaveValue(paused);
  await page.getByLabel("Listening position").fill("10");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Listening position").inputValue()),
    )
    .toBeGreaterThan(10);
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.getByTestId("focused-player")).toBeVisible();
  await expect(page.locator(".player-title")).toContainText("Wait for notes");
});
test("library Listen stays in setup and Stop listening stops transport", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Listen to Pathétique · II. Adagio cantabile",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("focused-player")).toHaveCount(0);
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Listening position").inputValue()),
    )
    .toBeGreaterThan(0.2);
  await page
    .getByRole("button", { name: "Stop listening", exact: true })
    .click();
  await expect(page.getByLabel("Listening position")).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Listen", exact: true }),
  ).toBeVisible();
});
