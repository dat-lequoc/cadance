import { test, expect, type Page } from "@playwright/test";
const importer = 'input[type=file][accept=".mid,.midi,.json"]';
async function seek(page: Page, seconds: number) {
  await page.getByLabel("Song position").fill(String(seconds));
  await page.getByLabel("Song position").press("Tab");
}
async function startListen(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();

  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
}
async function keyColors(page: Page) {
  return page.locator("canvas.roll").evaluate((el) => {
    const canvas = el as HTMLCanvasElement,
      ratio = canvas.height / canvas.getBoundingClientRect().height;
    const data = canvas
      .getContext("2d")!
      .getImageData(
        0,
        Math.round(canvas.height - 25 * ratio),
        canvas.width,
        1,
      ).data;
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 4)
      colors.add(Array.from(data.slice(i, i + 3)).join(","));
    return [...colors];
  });
}
test("piece-first interface, audible schedule, real hand and harmony selections", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    Object.assign(window, { scheduledPitches: [] });
    AudioContext.prototype.createOscillator = function () {
      const osc = original.call(this),
        start = osc.start.bind(osc);
      osc.start = (when?: number) => {
        (window as any).scheduledPitches.push(
          Math.round(69 + 12 * Math.log2(osc.frequency.value / 440)),
        );
        start(when);
      };
      return osc;
    };
  });
  await page.goto("/");
  await expect(page.getByText("Lesson library", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Right hand", exact: true }).click();
  await page.getByRole("button", { name: "Melody line", exact: true }).click();
  await expect(page.locator(".target-count")).toContainText("331 target notes");
  await page.getByLabel("Play the other parts for me").uncheck();
  await page.getByRole("button", { name: "Listen", exact: true }).click();

  await expect
    .poll(() => page.evaluate(() => (window as any).scheduledPitches))
    .toContain(60);
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page.getByRole("button", { name: "Harmonies", exact: true }).click();
  await expect(page.locator(".target-count")).toContainText("711 target notes");
  await page.getByRole("button", { name: "Left hand", exact: true }).click();
  await expect(page.locator(".target-count")).toContainText("587 target notes");
  await page
    .getByRole("button", { name: "Wait for notes", exact: false })
    .click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  expect(errors).toEqual([]);
});
test("mark A/B, activate without saving, save and edit passage; restart retains boundaries", async ({
  page,
}) => {
  await startListen(page);
  await seek(page, 4);
  await page.getByRole("button", { name: "Mark A", exact: true }).click();
  await seek(page, 11);
  await page.getByRole("button", { name: "Mark B", exact: true }).click();
  await page.getByRole("button", { name: "Toggle loop" }).click();
  await expect(
    page.getByRole("button", { name: "Toggle loop" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Passages", exact: true }).click();
  await expect(page.getByLabel("Loop start seconds")).toHaveValue("3.333");
  await expect(page.getByLabel("Loop end seconds")).toHaveValue("13.333");
  await expect(page.locator(".saved-loop")).toHaveCount(0);
  await page.getByLabel("Loop name").fill("Opening phrase");
  await page.getByRole("button", { name: "Create loop", exact: true }).click();
  await expect(page.locator(".saved-loop")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Rename loop Opening phrase" })
    .click();
  await page.getByLabel("Loop name").fill("Bars 2–4");
  await page.getByRole("button", { name: "Save loop changes" }).click();
  await expect(page.locator(".saved-loop")).toContainText("Bars 2–4");
  await page.getByRole("button", { name: "Close Passages" }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByLabel("Song position")).toHaveValue("3.33");
  await expect(
    page.getByRole("button", { name: "Toggle loop" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page
    .getByLabel("Practice passage")
    .selectOption({ label: "Bars 2–4 · 0:03–0:13" });
  await page.getByRole("button", { name: "Listen", exact: true }).click();

  await page.getByRole("button", { name: "Passages", exact: true }).click();
  await expect(page.getByLabel("Loop start seconds")).toHaveValue("3.333");
  await page.getByRole("button", { name: "Delete loop Bars 2–4" }).click();
  await expect(page.locator(".saved-loop")).toHaveCount(0);
});
test("invalid loop blocked, saved loops per piece, responsive screenshots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startListen(page);
  await page.getByRole("button", { name: "Passages", exact: true }).click();
  await page.getByLabel("Loop start seconds").fill("12");
  await page.getByLabel("Loop end seconds").fill("3");
  await expect(
    page.getByRole("button", { name: "Create loop", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Loop end seconds").fill("15");
  await page.getByLabel("Loop name").fill("Test passage");
  await page.getByRole("button", { name: "Create loop", exact: true }).click();
  await expect(page.locator(".saved-loop")).toHaveCount(1);
  await page.getByRole("button", { name: "Close Passages" }).click();
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page.locator(importer).setInputFiles("public/fixtures/checkpoint.mid");
  await expect(
    page.getByLabel("Practice passage").locator("option"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Practice Pathétique · II. Adagio cantabile",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Practice passage")).toContainText(
    "Test passage",
  );
  await page.screenshot({
    path: "test-results/piece-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Listen", exact: true }).click();

  await page.screenshot({ path: "test-results/player-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/player-mobile.png" });
  await page.getByRole("button", { name: "←", exact: true }).click();
  await page.screenshot({
    path: "test-results/piece-mobile.png",
    fullPage: true,
  });
});
test("keyboard colors playback by hand and clears on pause or release", async ({
  page,
}) => {
  await startListen(page);
  await expect.poll(() => keyColors(page)).toContain("255,193,90");
  await expect.poll(() => keyColors(page)).toContain("89,179,255");
  await page.getByRole("button", { name: "Pause practice" }).click();
  await expect.poll(() => keyColors(page)).not.toContain("255,193,90");
  await expect.poll(() => keyColors(page)).not.toContain("89,179,255");
  await page
    .getByRole("button", { name: "Connect your piano", exact: true })
    .click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await page.keyboard.down("a");
  await expect.poll(() => keyColors(page)).toContain("255,193,90");
  await page.keyboard.up("a");
  await expect.poll(() => keyColors(page)).not.toContain("255,193,90");
});
test("player fills viewport, tools pause without losing position, display preferences persist", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await startListen(page);
  const box = await page.locator(".stage").boundingBox();
  expect(box!.height / 768).toBeGreaterThanOrEqual(0.75);
  expect(box!.width).toBe(1366);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  const position = Number(await page.getByLabel("Song position").inputValue());
  await page.getByLabel("Visible keys").selectOption("88");
  await page.getByLabel("Note labels").selectOption("none");
  await page.getByLabel("Note zoom").fill("135");
  await page.getByRole("button", { name: "Close Player tools" }).click();
  expect(
    Number(await page.getByLabel("Song position").inputValue()),
  ).toBeCloseTo(position, 1);
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toContainText("Resume");
  await page.keyboard.press("p");
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toContainText("Start practice");
  await page.reload();
  await page
    .locator(".setup-tools summary")
    .filter({ hasText: "Display" })
    .click();
  await expect(page.getByLabel("Visible keys")).toHaveValue("88");
  await expect(page.getByLabel("Note labels")).toHaveValue("none");
  await expect(page.getByLabel("Note zoom")).toHaveValue("135");
});
test("tab and window changes keep music playing; background schedules continue", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    Object.assign(window, { tones: 0 });
    AudioContext.prototype.createOscillator = function () {
      (window as any).tones++;
      return original.call(this);
    };
  });
  await startListen(page);
  const initial = Number(await page.getByLabel("Song position").inputValue());
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Song position").inputValue()),
    )
    .toBeGreaterThan(initial + 1.5);
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).tones)).toBeGreaterThan(3);
  await other.close();
  await page.bringToFront();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
});
test("fullscreen entry and exit retain playback; rejected fullscreen fallback", async ({
  page,
}) => {
  await startListen(page);
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await page.evaluate(() => {
    HTMLElement.prototype.requestFullscreen = async () => {
      throw Error("denied");
    };
  });
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(
    page.getByText("Fullscreen is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
});
test("practice navigation saves exactly once; restarting review starts a fresh attempt", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(importer).setInputFiles("public/fixtures/checkpoint.mid");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await expect(page.getByRole("status")).toContainText("Your turn");
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: "Close Player tools" }).click();
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.locator(".review-metrics")).toContainText("1/6");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page
    .getByRole("button", { name: "Practice checkpoint", exact: true })
    .click();
  await page.getByRole("button", { name: "Right hand", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
});
