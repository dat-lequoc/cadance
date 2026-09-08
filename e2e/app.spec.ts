import { test, expect } from "@playwright/test";
const importer = 'input[type=file][accept=".mid,.midi,.json"]';
test("imported piece, simulated wait gating and retained persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(
    "Pathétique · II. Adagio cantabile",
  );
  await page.locator(importer).setInputFiles("public/fixtures/checkpoint.mid");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.getByTestId("focused-player")).toBeVisible();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await expect(page.getByRole("status")).toContainText("Your turn", {
    timeout: 6000,
  });
  await page.keyboard.press("w");
  await expect(page.getByRole("status")).toContainText("different note");
  await page.keyboard.press("a");
  await expect(page.getByRole("status")).toContainText("Your turn", {
    timeout: 6000,
  });
  await page.keyboard.down("a");
  await page.keyboard.down("d");
  await expect(page.getByRole("status")).toContainText("2 of 3 keys held");
  await page.keyboard.down("g");
  await page.keyboard.up("a");
  await page.keyboard.up("d");
  await page.keyboard.up("g");
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.locator(".review-metrics")).toContainText("4/6");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("production permission rejection and no-device flows", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => {
        throw Error("Permission denied by browser");
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect your piano", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Permission denied",
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => ({ inputs: new Map(), onstatechange: null }),
    }),
  );
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await expect(
    page.getByText("No MIDI inputs found.", { exact: false }),
  ).toBeVisible();
});
test("fake hardware selection, monitor and disconnect pause through production adapter", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const port = {
      id: "fake-piano",
      name: "Test piano",
      state: "connected",
      onmidimessage: null as null | ((e: unknown) => void),
    };
    const access = {
      inputs: new Map([["fake-piano", port]]),
      onstatechange: null as null | (() => void),
    };
    Object.assign(window, { fakePort: port, fakeAccess: access });
    Object.defineProperty(navigator, "requestMIDIAccess", {
      value: async () => access,
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await page.getByLabel("MIDI input").selectOption("fake-piano");
  await page.evaluate(() => {
    const p = (window as any).fakePort;
    p.onmidimessage({
      data: new Uint8Array([144, 60, 100]),
      timeStamp: performance.now(),
    });
  });
  await expect(page.getByText("✓ Middle C received")).toBeVisible();
  await page.getByRole("button", { name: "Return to practice" }).click();
  await expect(page.getByTestId("focused-player")).toBeVisible();
  await page.evaluate(() => {
    (window as any).fakePort.state = "disconnected";
    (window as any).fakeAccess.onstatechange();
  });
  await expect(page.locator(".stage-feedback")).toContainText("Piano disconnected");
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toContainText("Resume");
});
test("MIDI and JSON import, malformed rejection, responsive setup", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(importer).setInputFiles("public/fixtures/checkpoint.mid");
  await expect(page.locator("h1")).toHaveText("checkpoint");
  await page.locator(importer).setInputFiles({
    name: "bad.mid",
    mimeType: "audio/midi",
    buffer: Buffer.from("garbage"),
  });
  await expect(page.getByRole("alert")).toContainText("Invalid MIDI header");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await expect(page.locator("h1")).toHaveText("checkpoint");
  await page.locator(importer).setInputFiles("public/fixtures/c-major.json");
  await expect(page.locator("h1")).toHaveText("Five-finger walk");
  await page.screenshot({
    path: "test-results/studio-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/studio-mobile.png",
    fullPage: true,
  });
});
test("cached production app loads and imports offline", async ({
  page,
  context,
}) => {
  await page.goto("/?piece=pathetique");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1")).toHaveText(
    "Pathétique · II. Adagio cantabile",
  );
  await page.locator(importer).setInputFiles("public/fixtures/checkpoint.mid");
  await expect(page.locator("h1")).toHaveText("checkpoint");
  await page.getByRole("button", { name: "Listen", exact: true }).click();

  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
});
test("free-play recording backup round trip, deletion and notation without remote requests", async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      r.url().startsWith("http") &&
      new URL(r.url()).origin !== new URL(baseURL!).origin
    )
      external.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Free play", exact: true }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Finish practice" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const path = await (await download).path();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Delete all local data", { exact: true }).click();
  await page
    .getByRole("button", { name: "Delete all songs, sessions and settings" })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator(".file-label input").setInputFiles(path!);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page
    .locator(".piece-row")
    .getByRole("button", { name: /^Practice / })
    .first()
    .click();
  await page.getByText("More practice settings", { exact: false }).click();
  await page.getByLabel("Pitch-reading staff").check();
  await expect(page.locator(".staff svg")).toBeVisible();
  expect(external).toEqual([]);
});
