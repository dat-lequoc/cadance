import { test, expect } from "@playwright/test";
const importer = 'input[type=file][accept=".mid,.midi,.json"]';
const piece = {
  version: 1,
  title: "Practice polish",
  explanation: "Fixture",
  tempo: 60,
  meter: [4, 4],
  range: [21, 108],
  mode: "wait",
  notes: [
    { pitch: 60, beat: 0, duration: 0.2, hand: "right" },
    { pitch: 62, beat: 2, duration: 0.2, hand: "right" },
  ],
};
test("resume preserves the playhead and keyboard restart clears a scroll preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(importer).setInputFiles({
    name: "polish.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(piece)),
  });
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await page.locator(".stage").click({ position: { x: 200, y: 100 } });
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Pause practice" }).click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  expect(Number(await page.getByLabel("Song position").inputValue())).toBeCloseTo(2, 2);
  await page
    .getByLabel("Falling notes and interactive piano keyboard")
    .hover({ position: { x: 200, y: 100 } });
  await page.mouse.wheel(0, 120);
  await expect(
    page.getByRole("button", { name: "Back to playhead" }),
  ).toBeVisible();
  await page.locator(".stage").click({ position: { x: 200, y: 100 } });
  await page.keyboard.press("r");
  await expect(
    page.getByRole("button", { name: "Back to playhead" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Song position")).toHaveValue("0");
  await expect(page.locator(".stage-feedback")).toContainText(
    "Ready when you are",
  );
});
test("sound and preparation preferences survive reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();

  await page.getByRole("button", { name: "Tools", exact: false }).click();
  await expect(page.getByLabel("Live piano sound")).toHaveValue("piano");
  await page.getByLabel("Live piano sound").selectOption("computer");
  await page.getByLabel("Auto accompaniment").uncheck();
  await page.getByLabel("Metronome", { exact: true }).check();
  await page.getByLabel("Preparation time").selectOption("5");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page
    .locator("summary")
    .filter({ hasText: "More practice settings" })
    .click();
  await page.getByLabel("One-bar count-in").check();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Visual offset (ms)").fill("120");
  await page.getByLabel("Audio offset (ms)").fill("70");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Live piano sound")).toHaveValue("computer");
  await expect(page.getByLabel("Visual offset (ms)")).toHaveValue("120");
  await expect(page.getByLabel("Audio offset (ms)")).toHaveValue("70");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = await (await downloaded).path();
  await page.getByLabel("Live piano sound").selectOption("piano");
  await page.locator(".file-label input").setInputFiles(backup!);
  await expect(page.getByLabel("Live piano sound")).toHaveValue("computer");
  await page.getByRole("button", { name: "cadance", exact: false }).click();
  await page
    .getByRole("button", { name: /^Practice / })
    .first()
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "More practice settings" })
    .click();
  await expect(page.getByLabel("One-bar count-in")).toBeChecked();
  await page.getByRole("button", { name: "Listen", exact: true }).click();

  await page.getByRole("button", { name: "Tools", exact: false }).click();
  await expect(page.getByLabel("Preparation time")).toHaveValue("5");
  await expect(page.getByLabel("Auto accompaniment")).not.toBeChecked();
  await expect(page.getByLabel("Metronome", { exact: true })).toBeChecked();
  await page.getByLabel("Live piano sound").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/practice-preferences.png", animations: "disabled" });
});
test("leaving while audio unlock is pending cannot start music later", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      return new Promise<void>((resolve) => {
        (window as any).releaseUnlock = () => resume.call(this).then(resolve);
      });
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.evaluate(() => (window as any).releaseUnlock());
  await expect(
    page.getByRole("heading", { name: "Your pieces." }),
  ).toBeVisible();
  await expect(page.getByTestId("focused-player")).toHaveCount(0);
});

test("hardware live audio is silent in My piano mode and sounds once in Computer mode", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const port = {
      id: "fake-piano",
      name: "Test piano",
      state: "connected",
      onmidimessage: null,
    };
    const access = { inputs: new Map([[port.id, port]]), onstatechange: null };
    Object.assign(window, { fakePort: port, liveTones: 0 });
    Object.defineProperty(navigator, "requestMIDIAccess", {
      value: async () => access,
    });
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      (window as any).liveTones++;
      return create.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Free play", exact: true }).click();
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await page.getByLabel("MIDI input").selectOption("fake-piano");
  await page.getByRole("button", { name: "Return to practice" }).click();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  const send = async (data: number[]) =>
    page.evaluate(
      (data) =>
        (window as any).fakePort.onmidimessage({
          data: new Uint8Array(data),
          timeStamp: performance.now(),
        }),
      data,
    );
  await send([144, 60, 100]);
  await send([128, 60, 0]);
  expect(await page.evaluate(() => (window as any).liveTones)).toBe(0);
  await page.getByRole("button", { name: "Tools", exact: false }).click();
  await page.getByLabel("Live piano sound").selectOption("computer");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await send([144, 60, 100]);
  await send([144, 60, 100]);
  await send([128, 60, 0]);
  expect(await page.evaluate(() => (window as any).liveTones)).toBe(1);
});

test("resuming after scrolling the roll starts at a note onset", async ({ page }) => {
  await page.goto("/");
  await page.locator(importer).setInputFiles({ name: "polish.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(piece)) });
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await page.locator(".stage").click({ position: { x: 200, y: 100 } });
  await page.keyboard.press("a");
  await expect(page.getByLabel("Song position")).toHaveValue("2");
  await page.getByLabel("Falling notes and interactive piano keyboard").hover({ position: { x: 200, y: 100 } });
  await page.mouse.wheel(0, -90);
  await expect(page.locator(".roll-preview")).toBeVisible();
  const preview = Number(await page.getByLabel("Song position").inputValue());
  expect(preview).toBeGreaterThan(0);
  expect(preview).toBeLessThan(2);
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await expect(page.getByLabel("Song position")).toHaveValue("0");
  await expect(page.locator(".stage-feedback")).toContainText("C4");
});
