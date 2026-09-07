import { test, expect } from "@playwright/test";
test("piece-first interface, audible schedule, real hand and harmony selections", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    Object.assign(window, { scheduledPitches: [] });
    AudioContext.prototype.createOscillator = function () {
      const osc = original.call(this);
      const start = osc.start.bind(osc);
      osc.start = (when?: number) => {
        (
          window as unknown as { scheduledPitches: number[] }
        ).scheduledPitches.push(
          Math.round(69 + 12 * Math.log2(osc.frequency.value / 440)),
        );
        start(when);
      };
      return osc;
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Pathétique · II. Adagio cantabile",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Lesson library", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Your pieces", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Right hand", exact: true }).click();
  await page.getByRole("button", { name: "Melody line", exact: true }).click();
  await expect(
    page.getByText("331 target notes", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Play the other parts for me").uncheck();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { scheduledPitches: number[] })
            .scheduledPitches,
      ),
    )
    .toContain(60);
  await page.getByRole("button", { name: "Pause practice" }).click();
  await page.getByRole("button", { name: "Harmonies", exact: true }).click();
  await expect(
    page.getByText("711 target notes", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Left hand", exact: true }).click();
  await expect(
    page.getByText("587 target notes", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice melody" }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(
    page.getByText("Your turn — play the highlighted notes."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mark A and B, save named loop, edit and restore it, restart keeps boundaries", async ({
  page,
}) => {
  await page.goto("/");
  const seek = async (value: number) =>
    page.getByLabel("Song position").fill(String(value));
  await seek(4);
  await page.getByRole("button", { name: "A Mark A", exact: true }).click();
  await seek(11);
  await page.getByRole("button", { name: "B Mark B", exact: true }).click();
  await expect(page.getByLabel("Loop start seconds")).toHaveValue("3.333");
  await expect(page.getByLabel("Loop end seconds")).toHaveValue("13.333");
  await page.getByLabel("Loop name").fill("Opening phrase");
  await page.getByRole("button", { name: "Create loop", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "↻ Loop on · turn off" }),
  ).toBeVisible();
  await expect(page.locator(".saved-loop")).toHaveCount(1);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "↻ Loop on · turn off" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rename loop Opening phrase" })
    .click();
  await page.getByLabel("Loop name").fill("Bars 2–4");
  await page.getByRole("button", { name: "Save loop changes" }).click();
  await expect(page.locator(".saved-loop")).toHaveCount(1);
  await expect(page.locator(".saved-loop").getByText("Bars 2–4")).toBeVisible();
  await page.reload();
  await expect(page.locator(".saved-loop").getByText("Bars 2–4")).toBeVisible();
  await page
    .locator(".saved-loop")
    .getByRole("button", { name: /Bars 2–4 0:/ })
    .click();
  await expect(page.getByLabel("Loop start seconds")).toHaveValue("3.333");
  await expect(
    page.getByRole("button", { name: "↻ Loop on · turn off" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Listen" }).click();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause practice" }).click();
  await page.getByRole("button", { name: "Delete loop Bars 2–4" }).click();
  await expect(page.locator(".saved-loop")).toHaveCount(0);
});
test("invalid loop is blocked; saved loops are per piece; high contrast responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Loop start seconds").fill("12");
  await page.getByLabel("Loop end seconds").fill("3");
  await expect(
    page.getByRole("button", { name: "Create loop", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Loop end seconds").fill("15");
  await page.getByLabel("Loop name").fill("Test passage");
  await page.getByRole("button", { name: "Create loop", exact: true }).click();
  await page
    .locator('input[type=file][accept=".mid,.midi,.json"]')
    .setInputFiles("public/fixtures/checkpoint.mid");
  await expect(page.locator(".saved-loop")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText("checkpoint");
  await page
    .getByLabel("Current piece")
    .selectOption("beethoven-pathetique-ii");
  await expect(page.locator(".saved-loop")).toHaveCount(1);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/piece-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/piece-mobile.png",
    fullPage: true,
  });
});

test("keyboard colors playback by hand and clears when paused", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(
    "Pathétique · II. Adagio cantabile",
  );
  const keyColors = () =>
    page.locator("canvas.roll").evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const ratio = canvas.height / canvas.getBoundingClientRect().height;
      // Sample inside the white keys, below black keys and above labels.
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
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect.poll(keyColors).toContain("255,193,90");
  await expect.poll(keyColors).toContain("89,179,255");
  await page.getByRole("button", { name: "Pause practice" }).click();
  await expect.poll(keyColors).not.toContain("255,193,90");
  await expect.poll(keyColors).not.toContain("89,179,255");
  await page.getByRole("button", { name: "Connect your piano" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.locator("h1").click();
  await page.keyboard.down("a");
  await expect.poll(keyColors).toContain("255,193,90");
  await page.keyboard.up("a");
  await expect.poll(keyColors).not.toContain("255,193,90");
});
