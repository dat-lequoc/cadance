import { test, expect } from "@playwright/test";
import midiPackage from "@tonejs/midi";
const { Midi } = midiPackage;

test("a frontend MIDI upload gets sessions immediately and persists across reload", async ({ page }) => {
  const midi = new Midi();
  midi.header.setTempo(120);
  for (const [name, pitch] of [["Left hand", 48], ["Right hand", 60]] as const) {
    const track = midi.addTrack();
    track.name = name;
    for (let bar = 0; bar < 12; bar++) track.addNote({ midi: pitch, time: bar * 2, duration: 0.5 });
  }
  await page.goto("/");
  await page.locator('input[type=file][accept=".mid,.midi,.json"]').setInputFiles({
    name: "My new piece.mid", mimeType: "audio/midi", buffer: Buffer.from(midi.toArray()),
  });
  await expect(page.locator(".next-quest")).toContainText("Automatically grouped from MIDI bars");
  await page.locator(".quest-map summary").click();
  await expect(page.locator(".quest-session-divider")).toHaveCount(2);
  const last = page.locator(".quest-map button").last();
  await expect(last).toBeEnabled();
  await last.click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await expect(page.locator(".quest-dock")).toBeVisible();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("review-9-12-both");
  await page.locator(".quest-counter").click();
  await page.getByRole("button", { name: "Mark complete & next" }).click();
  await expect(page.getByLabel("Choose checkpoint")).toHaveValue("passage-1-2-right");
  await page.reload();
  await expect(page.locator(".next-quest")).toContainText("Automatically grouped from MIDI bars");
  await expect(page.locator(".quest-overall")).toContainText("1 / 20");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await expect(page.getByRole("button", { name: /Practice My new piece/ })).toBeVisible();
});

test("renamed prepared MIDI uploads recover their reviewed plan and study score", async ({ page }) => {
  const { readFileSync } = await import("node:fs");
  await page.goto("/");
  await page.locator('input[type=file][accept=".mid,.midi,.json"]').setInputFiles({
    name: "renamed.mid", mimeType: "audio/midi", buffer: readFileSync("public/pieces/chopin-ballade-1.mid"),
  });
  await expect(page.locator(".quest-overall")).toContainText("0 / 596");
  await expect(page.getByRole("link", { name: /Paul Barton/ })).toBeVisible();
});

test("prepared scanned scores show a moving bar cursor without note anchors", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pieces", exact: true }).click();
  await page.getByRole("button", { name: "Practice Claude Debussy · Arabesque No. 1", exact: true }).click();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await page.getByRole("button", { name: "Sheet music", exact: true }).click();
  await expect(page.locator(".score-note-overlay line")).toHaveCount(1);
  const x = await page.locator(".score-note-overlay line").getAttribute("x1");
  expect(Number(x)).toBeGreaterThan(0);
  expect(Number(x)).toBeLessThan(1);
});
