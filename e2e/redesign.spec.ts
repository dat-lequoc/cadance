import { test, expect, type Page } from "@playwright/test";
const importer = 'input[type=file][accept=".mid,.midi,.json"]';
async function free(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Free play", exact: true }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByLabel("Visible keys").selectOption("88");
  await page.getByRole("button", { name: "Close Player tools" }).click();
}
async function keyPoint(page: Page, pitch: number) {
  return page.locator("canvas.roll").evaluate((el, p) => {
    const rect = el.getBoundingClientRect(),
      black = (n: number) => [1, 3, 6, 8, 10].includes(n % 12),
      unit = rect.width / 52;
    let white = 0;
    for (let n = 21; n < p; n++) if (!black(n)) white++;
    const x = black(p) ? white * unit : white * unit + unit / 2;
    const height = Math.max(88, Math.min(132, rect.height * 0.18));
    return {
      x: rect.left + x,
      y: rect.top + rect.height - (black(p) ? height - 14 : 25),
      localX: x,
      localY: rect.height - (black(p) ? height - 14 : 25),
    };
  }, pitch);
}
async function keyPixel(page: Page, pitch: number) {
  const point = await keyPoint(page, pitch);
  return page.locator("canvas.roll").evaluate((el, point) => {
    const c = el as HTMLCanvasElement,
      ratio = c.width / c.getBoundingClientRect().width;
    return Array.from(
      c
        .getContext("2d")!
        .getImageData(
          Math.floor(point.localX * ratio),
          Math.floor(point.localY * ratio),
          1,
          1,
        ).data,
    ).slice(0, 3);
  }, point);
}
test("white and black pointer keys remain accurate after resize; sustain and release feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await free(page);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    for (const pitch of [60, 61]) {
      const point = await keyPoint(page, pitch);
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await expect.poll(() => keyPixel(page, pitch)).toEqual([255, 193, 90]);
      await page.mouse.up();
      await expect
        .poll(() => keyPixel(page, pitch))
        .toEqual(pitch === 60 ? [255, 255, 255] : [12, 21, 34]);
    }
  }
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await page.keyboard.down("a");
  await page.keyboard.down("Shift");
  await page.keyboard.up("a");
  await expect.poll(() => keyPixel(page, 60)).toEqual([177, 153, 255]);
  await page.keyboard.up("Shift");
  await expect.poll(() => keyPixel(page, 60)).toEqual([255, 255, 255]);
  await page.keyboard.down("a");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(() => keyPixel(page, 60)).toEqual([255, 255, 255]);
  await page.keyboard.up("a");
  await page.screenshot({ path: "test-results/player-tablet.png" });
});
test("loop handles preview without replacing active passage; drag and keyboard edits apply deliberately", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Open player", exact: false }).click();
  await page.getByRole("button", { name: "Passages", exact: true }).click();
  await page.getByLabel("Loop start seconds").fill("4");
  await page.getByLabel("Loop end seconds").fill("18");
  await page.getByRole("button", { name: "Apply loop", exact: true }).click();
  await page.getByRole("button", { name: "Close Passages" }).click();
  await page.getByLabel("Drag loop start").focus();
  await page.getByLabel("Drag loop start").press("ArrowRight");
  await expect(page.getByLabel("Drag loop start")).toHaveValue("6.67");
  await expect(page.getByLabel("Song position")).toHaveValue("4");
  const handle = await page.getByLabel("Drag loop end").boundingBox();
  const total = Number(
    await page.getByLabel("Drag loop end").getAttribute("max"),
  );
  const x = handle!.x + 7 + ((handle!.width - 14) * 18) / total;
  await page.mouse.move(x, handle!.y + 12);
  await page.mouse.down();
  await page.mouse.move(
    handle!.x + 7 + ((handle!.width - 14) * 24) / total,
    handle!.y + 12,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Drag loop end").inputValue()),
    )
    .toBeGreaterThan(20);
  await expect(page.getByLabel("Song position")).toHaveValue("4");
  await page.getByRole("button", { name: "Passages", exact: true }).click();
  await page.getByRole("button", { name: "Apply loop", exact: true }).click();
  await page.getByRole("button", { name: "Close Passages" }).click();
  await expect(page.getByLabel("Song position")).toHaveValue("6.67");
  await page.getByLabel("Song position").fill("9");
  await page.getByLabel("Song position").press("Tab");
  await expect(
    page.getByRole("button", { name: "Toggle loop" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByLabel("Song position")).toHaveValue("6.67");
  await page.getByLabel("Song position").fill("40");
  await page.getByLabel("Song position").press("Tab");
  await expect(
    page.getByRole("button", { name: "Toggle loop" }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("loop repetitions stay in player; explicit finish shows one review and preserves real history", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(importer).setInputFiles({
    name: "short.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        title: "Short passage",
        explanation: "Test fixture",
        tempo: 120,
        meter: [4, 4],
        range: [21, 108],
        mode: "rhythm",
        notes: [
          { pitch: 60, beat: 0, duration: 0.5, hand: "right" },
          { pitch: 62, beat: 1, duration: 0.5, hand: "right" },
        ],
      }),
    ),
  });
  await page
    .getByRole("button", { name: "Practice rhythm", exact: false })
    .click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.getByRole("button", { name: "Passages", exact: true }).click();
  await page.getByLabel("Loop start seconds").fill("0");
  await page.getByLabel("Loop end seconds").fill(".7");
  await page.getByRole("button", { name: "Apply loop", exact: true }).click();
  await page.getByRole("button", { name: "Close Passages" }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.waitForTimeout(8000); // Two 0.7-second passes, each with a 3-second lead-in.
  await expect(page.getByTestId("focused-player")).toBeVisible();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.locator(".session-review")).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  expect(await page.locator(".history article").count()).toBeGreaterThanOrEqual(
    2,
  );
  await page.screenshot({
    path: "test-results/history-desktop.png",
    fullPage: true,
  });
});
test("natural listen completion shows no score, while changing a scoring selection retains the prior attempt", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(importer).setInputFiles("public/fixtures/checkpoint.mid");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Open player", exact: false }).click();
  const total = Number(
    await page.getByLabel("Song position").getAttribute("max"),
  );
  await page
    .getByLabel("Song position")
    .fill(String(Math.round((total - 0.1) * 100) / 100));
  await page.getByLabel("Song position").press("Tab");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator(".session-review")).toBeVisible();
  await expect(page.locator(".review-metrics")).toHaveCount(0);
  await page.getByRole("button", { name: "Change setup" }).click();
  await page
    .getByRole("button", { name: "Wait for notes", exact: false })
    .click();
  await page.getByLabel("Practice passage").selectOption("whole");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await expect(page.getByRole("status")).toContainText("Your turn");
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page.getByRole("button", { name: "Left hand", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
});
test("library rename/search, modal focus, settings and MIDI stress piece", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.locator(".item-menu summary").click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Piece title").fill("My Pathétique");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.getByLabel("Search pieces").fill("My Pathétique");
  await expect(page.locator(".piece-row")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/library-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Connect your piano", exact: true })
    .click();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Use simulated input" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Connect your piano", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.screenshot({
    path: "test-results/settings-desktop.png",
    fullPage: true,
  });
  await page
    .locator(importer)
    .setInputFiles("public/fixtures/stress-10000.mid");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Open player", exact: false }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  const start = Number(await page.getByLabel("Song position").inputValue());
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Song position").inputValue()),
    )
    .toBeGreaterThan(start + 0.5);
  await page.getByRole("button", { name: "Pause practice" }).click();
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toBeVisible();
});
test("failed attempt storage remains retryable without creating a duplicate result", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    Object.assign(window, { failSessionWrites: true });
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === "sessions" && (window as any).failSessionWrites)
        throw new DOMException(
          "Storage unavailable for test",
          "QuotaExceededError",
        );
      return put.apply(this, args);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Free play", exact: true }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.getByRole("alert")).toContainText("Storage unavailable");
  await page.evaluate(() => {
    (window as any).failSessionWrites = false;
  });
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
});
