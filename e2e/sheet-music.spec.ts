import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const score = JSON.parse(
  readFileSync("public/scores/pathetique-ii/score.json", "utf8"),
);

test("a later checkpoint shows its starting score during preparation and waiting", async ({
  page,
}) => {
  await page.goto("/");
  const plan = {
    version: 1,
    id: "score-late-checkpoint",
    title: "Score alignment check",
    song: { title: "Pathétique", fingerprint: score.fingerprint },
    repetitions: 10,
    counting: "total",
    quests: [
      {
        id: "bar-42",
        title: "Bar 42",
        section: "Dense passage",
        instruction: "Play the melody.",
        fromBar: 42,
        throughBar: 42,
        hand: "right",
        focus: "melody",
        mode: "wait",
        speed: 0.6,
      },
    ],
  };
  await page.getByLabel("Import practice plan").setInputFiles({
    name: "score.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("```cadance-plan\n" + JSON.stringify(plan) + "\n```\n"),
  });
  await page.getByRole("button", { name: /Start first quest/ }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Get ready");
  await expect(
    page.getByLabel("Highlighted bar 42", { exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText("Score page 3, bars 42–43")).toBeVisible();
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await expect(page.locator(".stage")).toHaveCount(0);
  await expect(page.locator(".score-position")).toContainText("Following bar");
  await expect(page.locator(".score-note-overlay")).toHaveCount(0);
  await expect(page.getByAltText("Score page 3, bars 42–43")).toBeInViewport();
  await page.screenshot({ path: "test-results/sheet-only-bar-fallback.png" });
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await page.getByLabel("Score image; scroll to pan").focus();
  await page.keyboard.down("a");
  await expect(page.getByLabel("Played note mismatch")).toContainText("C4");
  await expect(page.locator(".score-wrong-overlay")).toHaveCount(0);
  await page.keyboard.up("a");
  await expect(page.getByLabel("Played note mismatch")).toHaveCount(0);
  await page.getByRole("button", { name: "Pause practice" }).click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await expect(
    page.getByLabel("Highlighted bar 42", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(
    page.getByLabel("Highlighted bar 42", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quest-dock strong")).toHaveText(
    "0 / 10 completed runs",
  );
});

test("a one-bar loop follows its score through a repeat at changed speed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Open player", exact: false }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await page.getByLabel("Playback speed").selectOption("150");
  await page.getByRole("button", { name: "Passages", exact: true }).click();
  await page.getByLabel("Loop last bar").selectOption("5");
  await page.getByLabel("Loop first bar").selectOption("5");
  await page.getByRole("button", { name: "Apply loop", exact: true }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await expect(
    page.getByLabel("Highlighted bar 5", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(2700);
  await expect(
    page.getByLabel("Highlighted bar 5", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
});

test("sheet follows the practice preview and survives reload with its zoom", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.locator(".score-strip")).toHaveCount(0);
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await expect(
    page.getByLabel("Highlighted bar 1", { exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText("Score page 1, bars 1–4")).toBeVisible();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  const roll = page.getByLabel("Falling notes and interactive piano keyboard");
  const before = await page.getByLabel("Song position").inputValue();
  await roll.hover({ position: { x: 200, y: 100 } });
  await page.mouse.wheel(0, 1600);
  await expect(page.locator(".score-position")).toContainText("Resume here");
  await expect(page.getByAltText("Score page 1, bars 5–8")).toBeVisible();
  await page
    .getByRole("button", { name: "Back to playhead", exact: true })
    .click();
  await expect(page.getByLabel("Song position")).toHaveValue(before);
  await expect(
    page.getByLabel("Highlighted bar 1", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Sheet music zoom").fill("150");
  await page.getByRole("button", { name: "Next score system" }).click();
  await expect(page.locator(".score-position")).toContainText("Browsing score");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(
    page.getByLabel("Highlighted bar 1", { exact: true }),
  ).toBeVisible();
  const stage = await page.locator(".stage").boundingBox();
  const strip = await page.locator(".score-strip").boundingBox();
  expect(stage!.height).toBeGreaterThan(250);
  expect(strip!.y + strip!.height).toBeLessThanOrEqual(stage!.y + 1);
  await page.screenshot({ path: "test-results/sheet-music.png" });
  await page.reload();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Open player", exact: false }).click();
  await expect(page.getByLabel("Sheet music zoom")).toHaveValue("150");
  await page.getByRole("button", { name: "Hide sheet music" }).click();
  await expect(page.locator(".score-strip")).toHaveCount(0);
});

test("score browsing and panning keep Listen playing, including offline images", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Open player", exact: false }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await page.getByLabel("Sheet music zoom").fill("200");
  await page.getByLabel("Score image; scroll to pan").hover();
  await page.mouse.wheel(0, 100);
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await expect(page.locator(".roll-preview")).toHaveCount(0);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Next score system" }).click();
  const image = page.getByAltText("Score page 1, bars 5–8");
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("sheet-only follows required notes, waits for the whole chord and remembers its view", async ({ page }) => {
  await page.addInitScript(() => {
    const port = { id: "sheet-piano", name: "Sheet piano", state: "connected", onmidimessage: null };
    Object.assign(window, { sheetPort: port });
    Object.defineProperty(navigator, "requestMIDIAccess", { value: async () => ({ inputs: new Map([[port.id, port]]), onstatechange: null }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await page.getByLabel("MIDI input").selectOption("sheet-piano");
  await page.getByRole("button", { name: "Return to practice" }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await expect(page.locator(".stage")).toHaveCount(0);
  await expect(page.locator(".score-strip")).toHaveClass(/score-only/);
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await expect(page.locator(".score-note-overlay ellipse")).toHaveCount(0);
  const line = page.locator(".score-note-overlay line");
  const firstX = await line.getAttribute("x1");
  const send = (pitch: number) => page.evaluate((pitch) => (window as any).sheetPort.onmidimessage({ data: new Uint8Array([144, pitch, 100]), timeStamp: performance.now() }), pitch);
  await send(61);
  await expect(page.locator('.score-wrong-overlay [data-pitch="61"]')).toBeVisible();
  await expect(page.getByLabel("Played note mismatch")).toContainText("D♭4");
  const wrongToggle = page.getByRole("button", { name: "Show wrong notes", exact: true });
  await expect(wrongToggle).toHaveAttribute("aria-pressed", "true");
  await wrongToggle.click();
  await expect(page.locator(".score-wrong-overlay")).toHaveCount(0);
  await expect(page.getByLabel("Played note mismatch")).toHaveCount(0);
  await expect(page.locator(".score-note-overlay ellipse")).toHaveCount(0);
  await wrongToggle.click();
  await expect(page.locator('.score-wrong-overlay [data-pitch="61"]')).toBeVisible();
  await expect(page.locator(".score-note-overlay ellipse")).toHaveCount(0);
  await expect(line).toHaveAttribute("x1", firstX!);
  await send(62);
  await send(60);
  await expect(page.locator(".stage-feedback")).toContainText("1 of 3 keys held");
  await expect(page.locator('.score-wrong-overlay g')).toHaveCount(2);
  await page.screenshot({ path: "test-results/sheet-wrong-notes.png" });
  await page.evaluate(() => {
    for (const pitch of [61, 62]) (window as any).sheetPort.onmidimessage({ data: new Uint8Array([144, pitch, 0]), timeStamp: performance.now() });
  });
  await expect(page.locator('.score-wrong-overlay')).toHaveCount(0);
  await expect(page.getByLabel("Played note mismatch")).toHaveCount(0);
  await expect(line).toHaveAttribute("x1", firstX!);
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await send(56);
  await send(44);
  await expect(line).not.toHaveAttribute("x1", firstX!);
  await expect(page.locator(".stage-feedback")).toContainText("D♯3");
  await page.getByLabel("Sheet music zoom").fill("200");
  await expect(line).toBeInViewport();
  await page.getByRole("button", { name: "Fit sheet music" }).click();
  await page.screenshot({ path: "test-results/sheet-only-notes.png" });
  const header = await page.locator(".player-header").boundingBox();
  const journey = await page.locator(".quest-journey").boundingBox();
  expect(journey!.y).toBeGreaterThanOrEqual(header!.y);

  const sheet = await page.locator(".score-strip").boundingBox();
  const dock = await page.locator(".player-dock").boundingBox();
  expect(sheet!.height).toBeGreaterThan(400);
  expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(dock!.y + 1);
  await wrongToggle.click();
  await page.reload();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Open player", exact: false }).click();
  await expect(page.getByRole("button", { name: "Sheet only", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(wrongToggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".stage")).toHaveCount(0);
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await expect(page.locator(".stage")).toBeVisible();
});

test("scrolling back in sheet-only pauses and resume starts on the selected note", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await page.getByRole("button", { name: "Sheet only", exact: true }).click();
  await page.getByRole("button", { name: "Next score system" }).click();
  await expect(page.locator(".roll-preview")).toContainText("Resume here");
  await page.getByLabel("Score image; scroll to pan").hover({ position: { x: 300, y: 200 } });
  await page.mouse.wheel(0, -450);
  await expect(page.locator(".score-position")).toContainText("Resume here");
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeVisible();
  const preview = Number(await page.getByLabel("Song position").inputValue());
  expect(preview).toBeLessThan(score.bars[4].tick / 384 * (60 / 36));
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator(".roll-preview")).toHaveCount(0);
  await expect(page.locator(".stage-feedback")).toContainText("Get ready");
  await expect.poll(async () => Number(await page.getByLabel("Song position").inputValue())).toBeCloseTo(preview, 4);
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  expect(Number(await page.getByLabel("Song position").inputValue())).toBeCloseTo(preview, 4);
  const image = page.getByAltText("Score page 1, bars 1–4");
  const box = (await image.boundingBox())!;
  const note = score.bars[0].anchors[0].notes[0];
  await image.click({ position: { x: box.width * note.x, y: box.height * note.y } });
  await expect(page.getByLabel("Song position")).toHaveValue("0");
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Get ready");
  await expect(page.getByLabel("Song position")).toHaveValue("0");
});
