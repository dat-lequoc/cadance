import { test, expect, type Page } from "@playwright/test";
import { fromExercise, type Exercise } from "../src/core/lessons";
import { songFingerprint, type PracticePlan } from "../src/core/quests";
test.setTimeout(90000);
const exercise: Exercise = {
  version: 1,
  title: "Quest MIDI test",
  explanation: "A short fixture for real input matching.",
  tempo: 240,
  meter: [1, 4],
  range: [21, 108],
  mode: "wait",
  notes: [
    { pitch: 60, beat: 0, duration: 0.2, hand: "right" },
    { pitch: 62, beat: 1, duration: 0.2, hand: "right" },
  ],
};
async function loadFixture(page: Page, repetitions = 10) {
  await page.goto("/");
  await page
    .locator('input[type=file][accept=".mid,.midi,.json"]')
    .setInputFiles({
      name: "quest.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exercise)),
    });
  const song = fromExercise(exercise),
    plan: PracticePlan = {
      version: 1,
      id: "test-route",
      title: "Two checkpoints",
      song: { title: song.title, fingerprint: await songFingerprint(song) },
      repetitions,
      counting: "total",
      quests: [1, 2].map((bar) => ({
        id: `bar-${bar}`,
        title: `Checkpoint ${bar}`,
        section: "Test section",
        instruction: "Play the indicated note with no errors.",
        fromBar: bar,
        throughBar: bar,
        mode: "wait",
        hand: "right",
        focus: "all",
        speed: 1,
      })),
    };
  const md =
    "# My quest\n\n```cadance-plan\n" + JSON.stringify(plan) + "\n```\n";
  await page.getByLabel("Import practice plan").setInputFiles({
    name: "practice.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(md),
  });
  await expect(
    page.getByRole("button", { name: "Start first quest", exact: false }),
  ).toBeEnabled();
  return { plan, md };
}
async function start(page: Page) {
  await page
    .getByRole("button", { name: /Start first quest|Continue quest/ })
    .click();
  const simulated = page.getByRole("button", { name: "Use simulated input" });
  if (await simulated.isVisible()) await simulated.click();
  await expect(page.locator(".quest-dock")).toBeVisible();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
}
async function clean(page: Page, number: number, repetitions = 10, key = "a") {
  await expect(
    page.getByText("Your turn — play the highlighted notes.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press(key);
  if (number < repetitions) {
  await expect(page.locator(".quest-dock strong")).toHaveText(
    `${number} / ${repetitions} completed runs`,
  );
  await expect(
    page.getByRole("progressbar", {
      name: "Completed runs toward checkpoint",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", String(number));
  }
  await expect(page.locator(".quest-reward")).toContainText(
    number === repetitions ? "Checkpoint cleared!" : "+1 run completed!",
  );
}
test("bundled route has section dividers and every quest is available immediately", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".quest-overall")).toContainText("0 / 161");
  await page.locator(".quest-map summary").click();
  await expect(
    page.getByRole("button", { name: "Start quest 2:", exact: false }),
  ).toBeEnabled();
  await expect(page.locator(".quest-session-divider").first()).toHaveText("Opening theme");
  await expect(page.locator(".quest-map button:disabled")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download plan", exact: false })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/quest-setup.png",
    fullPage: true,
  });
});
test("can jump to an unfinished later checkpoint and back without earning runs", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".quest-map summary").click();
  await page.getByRole("button", { name: "Start quest 2:", exact: false }).click();
  const simulated = page.getByRole("button", { name: "Use simulated input" });
  if (await simulated.isVisible()) await simulated.click();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await expect(page.locator('select[aria-label="Choose checkpoint"] optgroup')).toHaveAttribute("label", "Test section");
  await expect(page.locator(".quest-run-label strong")).toHaveText("0 / 10 completed runs");
  await page.getByLabel("Choose checkpoint").selectOption("bar-1");
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-1");
  await page.reload();
  await expect(page.locator(".quest-overall")).toContainText("0 / 2");
  await expect(page.locator(".next-quest h3")).toHaveText("Checkpoint 1");
  await expect(page.getByRole("button", { name: /Start first quest|Continue quest/ })).toContainText("Start first quest");
});

test("completed runs light the repetition track and clearing the checkpoint turns it gold", async ({
  page,
}) => {
  await loadFixture(page, 2);
  await start(page);
  await page.getByRole("button", { name: "Tools", exact: false }).click();
  await page.getByLabel("Preparation time").selectOption("0");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toHaveCount(0);
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await expect(page.getByRole("progressbar", { name: "Overall quest journey" })).toHaveAttribute("aria-valuenow", "0");
  await clean(page, 1, 2);
  await expect(page.getByRole("progressbar", { name: "Overall quest journey" })).toHaveAttribute("aria-valuenow", "25");
  await expect(page.locator(".quest-transition-cue")).toContainText("Continue");
  await expect(page.locator(".quest-transition-cue")).toContainText("Run 2 of 2");
  await expect(page.locator(".quest-reps i.earned")).toHaveCount(1);
  await page.screenshot({ path: "test-results/quest-clean-reward.png" });
  await clean(page, 2, 2);
  await expect(page.getByRole("progressbar", { name: "Overall quest journey" })).toHaveAttribute("aria-valuenow", "50");
  await expect(page.locator(".quest-transition-cue")).toContainText("New quest");
  await expect(page.locator(".quest-transition-cue")).toContainText("Bar 2 · Right hand");
  await expect(page.locator(".quest-journey-label > span").first()).toHaveText("50%");
  await expect(page.locator(".quest-run-progress")).toHaveClass(/mastered/);
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await expect(
    page.getByRole("button", { name: "Next quest", exact: false }),
  ).not.toBeVisible();
  await clean(page, 1, 2, "s");
  await expect(page.locator(".quest-transition-cue")).not.toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: "test-results/quest-gold-reward.png" });
});
test("ten real completed runs advance to the next checkpoint; failures and reload preserve earned totals", async ({
  page,
}) => {
  await loadFixture(page);
  await start(page);
  await page.getByRole("button", { name: "Tools", exact: false }).click();
  await expect(page.getByLabel("Visible keys")).toHaveValue("88");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toHaveCount(0);
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await expect(page.getByLabel("Song position")).toBeVisible();
  await expect(page.getByLabel("Playback speed")).toBeVisible();
  for (let i = 1; i <= 3; i++) await clean(page, i);
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await page.keyboard.press("w");
  await page.keyboard.press("a");
  await expect(page.locator(".quest-reward")).toContainText("+1 run completed!");
  await expect(page.locator(".quest-dock strong")).toHaveText(
    "4 / 10 completed runs",
  );
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page.reload();
  await expect(page.locator(".next-quest > strong")).toHaveText(
    "4 / 10 completed runs",
  );
  await start(page);
  for (let i = 5; i <= 10; i++) await clean(page, i);
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await expect(page.locator(".quest-dock > span")).toHaveText("Checkpoint 2");
  await expect(page.locator(".quest-dock strong")).toHaveText(
    "0 / 10 completed runs",
  );
});
test("listening never earns quest credit; another MIDI plan and malformed Markdown are rejected", async ({
  page,
}) => {
  const { plan } = await loadFixture(page);
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await expect(page.locator(".next-quest > strong")).toHaveText(
    "0 / 10 completed runs",
  );
  const bad = { ...plan, song: { ...plan.song, fingerprint: "0".repeat(64) } };
  await page.getByLabel("Import practice plan").setInputFiles({
    name: "wrong.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("```cadance-plan\n" + JSON.stringify(bad) + "\n```\n"),
  });
  await expect(page.getByRole("alert")).toContainText("different MIDI");
  await expect(page.locator(".next-quest h3")).toHaveText("Checkpoint 1");
  await page.getByLabel("Import practice plan").setInputFiles({
    name: "bad.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# No machine-readable plan"),
  });
  await expect(page.getByRole("alert")).toContainText("cadance-plan");
});
test("quest completion saves atomically and a failed save can be retried without double credit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    Object.assign(window, { failQuest: true });
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (
        this.name === "settings" &&
        (args[0] as { key?: string })?.key?.startsWith("quest-progress:") &&
        (window as any).failQuest
      )
        throw new DOMException("Quest storage failed", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await loadFixture(page, 1);
  await start(page);
  await page.keyboard.press("a");
  await expect(
    page.getByRole("button", { name: "Retry quest save", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quest-dock strong")).toHaveText(
    "0 / 1 completed runs",
  );
  await page.evaluate(() => {
    (window as any).failQuest = false;
  });
  await page
    .getByRole("button", { name: "Retry quest save", exact: true })
    .click();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await expect(page.locator(".quest-dock strong")).toHaveText(
    "0 / 1 completed runs",
  );
  await page.getByRole("button", { name: "Setup", exact: false }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
});

test("editing quests updates the setup list after saving", async ({ page }) => {
  await loadFixture(page);
  await expect(page.locator(".quest-overall")).toContainText("0 / 2");
  await page.getByRole("button", { name: "Customize quests", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Customize quests" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Select quest 1: Checkpoint 1").check();
  await editor.getByLabel("Select quest 2: Checkpoint 2").check();
  await editor.getByRole("button", { name: "Merge selected", exact: true }).click();
  await expect(editor.locator(".quest-editor-row")).toHaveCount(1);
  await editor.getByRole("button", { name: "Save my plan", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.locator(".quest-overall")).toContainText("0 / 1");
  await page.locator(".quest-map summary").click();
  await expect(page.locator(".quest-map button")).toHaveCount(1);
  await page.getByRole("button", { name: "Start first quest", exact: false }).click();
  const simulated = page.getByRole("button", { name: "Use simulated input" });
  if (await simulated.isVisible()) await simulated.click();
  await expect(page.getByLabel("Choose checkpoint").locator("option")).toHaveCount(2);
});

test("shared player exposes checkpoint range, switching, speed and wheel browsing", async ({
  page,
}) => {
  await loadFixture(page);
  await start(page);
  await expect(page.locator(".player-header .quest-header")).toBeVisible();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-1");
  await expect(page.getByLabel("Checkpoint bars 1–1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark A", exact: true }),
  ).toBeVisible();
  const roll = page.getByLabel("Falling notes and interactive piano keyboard");
  await roll.hover({ position: { x: 200, y: 100 } });
  await page.mouse.wheel(0, 30);
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Song position").inputValue()),
    )
    .toBeGreaterThan(0.2);
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Back to playhead" })).toHaveCount(0);
  await page.getByLabel("Playback speed").selectOption("75");
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("");
  await page.getByLabel("Choose checkpoint").selectOption("bar-1");
  await expect(page.getByLabel("Playback speed")).toHaveValue("75");
  await page.reload();
  await start(page);
  await expect(page.getByLabel("Playback speed")).toHaveValue("75");
  await clean(page, 1);
  await page.screenshot({ path: "test-results/quest-shared-player.png" });
});

test("playing after a preview keeps the active checkpoint attached", async ({ page }) => {
  await loadFixture(page, 1);
  await page.locator(".quest-map summary").click();
  await page.getByRole("button", { name: "Start quest 2:", exact: false }).click();
  const simulated = page.getByRole("button", { name: "Use simulated input" });
  if (await simulated.isVisible()) await simulated.click();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await expect(page.getByText("Your turn — play the highlighted notes.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Tools", exact: false }).click();
  await page.getByLabel("Preparation time").selectOption("0");
  await page.keyboard.press("Escape");

  const roll = page.getByLabel("Falling notes and interactive piano keyboard");
  await roll.hover({ position: { x: 200, y: 100 } });
  await page.mouse.wheel(0, -1000);
  await expect(page.getByRole("button", { name: "Listen forward from here", exact: true })).toBeVisible();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toHaveCount(0);
  await expect(page.locator(".quest-dock strong")).toHaveText("0 / 1 completed runs");

  await page.keyboard.press("Space");
  await expect(page.getByText("Your turn — play the highlighted notes.", { exact: false })).toBeVisible();
  await page.locator(".stage").click({ position: { x: 10, y: 80 } });
  await page.keyboard.press("a");
  await expect(page.getByText("Your turn — play the highlighted notes.", { exact: false })).toBeVisible();
  await page.keyboard.press("s");
  await expect(page.locator(".quest-reward")).toContainText("Checkpoint cleared!");
});

test("practice starts immediately, ignores hand placement and shows section boundaries on the roll", async ({
  page,
}) => {
  await loadFixture(page);
  await page.getByRole("button", { name: /Start first quest/ }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await expect(page.getByLabel("Falling notes section")).toContainText(
    "Checkpoint · bars 1–1",
  );
  await expect(page.getByRole("button", { name: "Pause practice", exact: true })).toHaveCount(0);
  await expect(page.locator(".wait-ready-label")).toContainText("Ready");
  await page.screenshot({ path: "test-results/preparation-section.png" });
  await page.locator(".stage").click({ position: { x: 200, y: 100 } });
  await clean(page, 1);
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await page.getByRole("button", { name: "Tools", exact: false }).click();
  await page.getByLabel("Preparation time").selectOption("0");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
});

test("manual completion advances without played runs and survives reload", async ({ page }) => {
  await loadFixture(page);
  await start(page);
  await page.getByRole("button", { name: "0 / 10 completed runs", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Skip checkpoint?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep practicing" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "0 / 10 completed runs", exact: true }).click();
  await page.getByRole("button", { name: "Mark complete & next" }).click();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await expect(page.locator(".quest-reward")).toContainText("Checkpoint cleared");
  await expect(page.locator(".stage-feedback")).toContainText("Your turn");
  await page.reload();
  await expect(page.locator(".quest-overall")).toContainText("1 / 2");
  await start(page);
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await page.getByRole("button", { name: "0 / 10 completed runs", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Skip checkpoint?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep practicing" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "0 / 10 completed runs", exact: true }).click();
  await page.getByRole("button", { name: "Mark complete & next" }).click();
  await expect(page.locator(".quest-run-label strong")).toHaveText("Marked complete ✓");
  await expect(page.getByRole("progressbar", { name: "Completed runs toward checkpoint", exact: true })).toHaveAttribute("aria-valuenow", "10");
  await expect(page.locator(".quest-reps .earned")).toHaveCount(10);
  await expect(page.locator(".stage")).toBeVisible();
  await page.getByLabel("Choose checkpoint").selectOption("bar-1");
  await page.getByRole("button", { name: "Marked complete ✓", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Reset checkpoint?" })).toBeVisible();
  await page.getByRole("button", { name: "Reset quest", exact: true }).click();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-1");
  await expect(page.locator(".quest-run-label strong")).toHaveText("0 / 10 completed runs");
  await expect(page.locator(".quest-reps .earned")).toHaveCount(0);
  await expect(page.locator('select[aria-label="Choose checkpoint"] option[value="bar-2"]')).toBeEnabled();
  await page.getByLabel("Choose checkpoint").selectOption("bar-2");
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("bar-2");
  await page.reload();
  await expect(page.locator(".quest-overall")).toContainText("1 / 2");
  await expect(page.locator(".next-quest h3")).toHaveText("Checkpoint 2");
});

test("bundled review upgrade retains old passage runs and leaves added reviews unfinished", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".quest-overall")).toContainText("0 / 161");
  await page.evaluate(async () => {
    const md = await (await fetch("/plans/pathetique-ii.md")).text();
    const plan = JSON.parse(md.split("```cadance-plan\n")[1].split("```")[0]);
    plan.id = "pathetique-ii-hands-v2";
    plan.quests = plan.quests.filter((q: { id: string }) => !q.id.startsWith("review-"));
    const signature = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(plan))))).map(b => b.toString(16).padStart(2, "0")).join("");
    const passes = Object.fromEntries(plan.quests.slice(0, 9).map((q: { id: string }) => [q.id, { attempts: 10, successes: 10, streak: 10, completed: true }]));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("cadence-piano");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ key: "quest-progress:" + signature, value: { version: 1, passes, processed: [] } });
        tx.objectStore("settings").put({ key: "quest-plan:beethoven-pathetique-ii", value: "```cadance-plan\n" + JSON.stringify(plan) + "\n```\n" });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.locator(".quest-overall")).toContainText("9 / 161");
  await expect(page.locator(".next-quest h3")).toHaveText("Bars 1–4 · Build-up review");
  await expect(page.locator(".next-quest > strong")).toHaveText("0 / 5 completed runs");
});

test("five-run review upgrade preserves completed and partial review progress", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".quest-overall")).toContainText("0 / 161");
  await page.evaluate(async () => {
    const md = await (await fetch("/plans/pathetique-ii.md")).text();
    const plan = JSON.parse(md.split("```cadance-plan\n")[1].split("```")[0]);
    plan.id = "pathetique-ii-reviews-v3";
    for (const q of plan.quests) delete q.repetitions;
    const signature = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(plan))))).map(b => b.toString(16).padStart(2, "0")).join("");
    const passes = Object.fromEntries(plan.quests.slice(0, 10).map((q: { id: string }) => [q.id, { attempts: 10, successes: 10, streak: 10, completed: true }]));
    passes["review-1-4"] = { attempts: 7, successes: 5, streak: 5, completed: false };
    passes["review-1-6"] = { attempts: 4, successes: 3, streak: 3, completed: false };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("cadence-piano");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ key: "quest-progress:" + signature, value: { version: 1, passes, processed: [] } });
        tx.objectStore("settings").put({ key: "quest-plan:beethoven-pathetique-ii", value: "```cadance-plan\n" + JSON.stringify(plan) + "\n```\n" });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.locator(".quest-overall")).toContainText("10 / 161");
  await expect(page.locator(".next-quest h3")).toHaveText("Bars 1–6 · Build-up review");
  await expect(page.locator(".next-quest > strong")).toHaveText("3 / 5 completed runs");
  await page.getByRole("button", { name: /Continue quest/ }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.locator(".quest-run-progress")).toContainText("3 / 5 completed runs");
});
