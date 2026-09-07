import { test, expect } from "@playwright/test";
test("imported piece, simulated wait gating and retained persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Pathétique · II. Adagio cantabile",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Connect your piano" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page
    .locator('input[type=file][accept=".mid,.midi,.json"]')
    .setInputFiles("public/fixtures/checkpoint.mid");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.locator("h1").click();
  await expect(
    page.getByText("Your turn — play the highlighted notes."),
  ).toBeVisible({ timeout: 6000 });
  await page.keyboard.press("w");
  await expect(
    page.getByText("That’s a different note. Try the highlighted key."),
  ).toBeVisible();
  await page.keyboard.press("a");
  await expect(
    page.getByText("Nicely done. On to the next note."),
  ).toBeVisible();
  await expect(
    page.getByText("Your turn — play the highlighted notes."),
  ).toBeVisible({ timeout: 5000 });
  await page.keyboard.down("a");
  await page.keyboard.down("d");
  await expect(page.getByText("2 of 3 keys held")).toBeVisible();
  await page.keyboard.down("g");
  await expect(
    page.getByText("Nicely done. On to the next note."),
  ).toBeVisible();
  await page.keyboard.up("a");
  await page.keyboard.up("d");
  await page.keyboard.up("g");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByText("Last saved attempt: 4/6 notes")).toBeVisible();
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "checkpoint", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "checkpoint", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("production permission rejection and no-device flows", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => {
        throw Error("Permission denied by browser");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect your piano" }).click();
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Permission denied",
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => ({ inputs: new Map(), onstatechange: null }),
    });
  });
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await expect(page.getByText("No MIDI inputs found.")).toBeVisible();
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
  await page.getByRole("button", { name: "Connect your piano" }).click();
  await page.getByRole("button", { name: "Connect MIDI piano" }).click();
  await page.getByLabel("MIDI input").selectOption("fake-piano");
  await page.evaluate(() => {
    const p = (
      window as unknown as { fakePort: { onmidimessage: (e: unknown) => void } }
    ).fakePort;
    p.onmidimessage({
      data: new Uint8Array([144, 60, 100]),
      timeStamp: performance.now(),
    });
  });
  await expect(page.getByText("✓ Middle C received")).toBeVisible();
  await page.getByRole("button", { name: "Return to practice" }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.evaluate(() => {
    const w = window as unknown as {
      fakePort: { state: string };
      fakeAccess: { onstatechange: () => void };
    };
    w.fakePort.state = "disconnected";
    w.fakeAccess.onstatechange();
  });
  await expect(
    page.getByText(
      "Piano disconnected. Reconnect, select an input, then resume.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toContainText("Resume");
});
test("valid MIDI and JSON imports, malformed rejection, responsive screenshot", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type=file][accept=".mid,.midi,.json"]')
    .setInputFiles("public/fixtures/checkpoint.mid");
  await expect(page.locator(".lesson-copy .eyebrow")).toHaveText("YOUR MUSIC");
  await page
    .locator('input[type=file][accept=".mid,.midi,.json"]')
    .setInputFiles({
      name: "bad.mid",
      mimeType: "audio/midi",
      buffer: Buffer.from("garbage"),
    });
  await expect(page.getByRole("alert")).toContainText("Invalid MIDI header");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page
    .locator('input[type=file][accept=".mid,.midi,.json"]')
    .setInputFiles("public/fixtures/c-major.json");
  await expect(page.getByLabel("Current piece")).toContainText(
    "Five-finger walk",
  );
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
  await expect(
    page.getByRole("heading", {
      name: "Pathétique · II. Adagio cantabile",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator('input[type=file][accept=".mid,.midi,.json"]')
    .setInputFiles("public/fixtures/checkpoint.mid");
  await expect(page.locator(".lesson-copy .eyebrow")).toHaveText("YOUR MUSIC");
});

test("free-play recording backup round trip, deletion and notation without remote requests", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      r.url().startsWith("http") &&
      !r.url().startsWith("http://127.0.0.1:4173")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect your piano" }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.getByRole("button", { name: "Free play", exact: true }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.locator("h1").click();
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await expect(page.locator(".history article")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = await download;
  const path = await backup.path();
  await page
    .getByRole("button", { name: "Settings & help", exact: true })
    .click();
  await page.getByText("Delete all local data", { exact: true }).click();
  await page
    .getByRole("button", { name: "Delete all songs, sessions and settings" })
    .click();
  await page
    .getByRole("button", { name: "Settings & help", exact: true })
    .click();
  await page.locator(".file-label input").setInputFiles(path!);
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await expect(page.locator(".history article")).toHaveCount(1);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page
    .getByText("More practice settings", { exact: false })
    .first()
    .click();
  await page.getByLabel("Pitch-reading staff").check();
  await expect(page.locator(".staff svg")).toBeVisible();
  expect(external).toEqual([]);
});
