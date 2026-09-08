import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
let server: Server,
  address: string,
  version = 1;
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url!, "http://localhost").pathname;
    const file = resolve(
      "dist",
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(resolve("dist") + "/")) {
      res.writeHead(403).end();
      return;
    }
    try {
      let body = await readFile(file);
      if (pathname === "/sw.js")
        body = Buffer.from(
          body.toString().replace(/cadence-\d+/, "cadence-test-" + version),
        );
      if (pathname === "/" || pathname === "/index.html")
        body = Buffer.from(
          body
            .toString()
            .replace(
              "</head>",
              `<meta name="test-build" content="${version}"></head>`,
            ),
        );
      const mime: Record<string, string> = {
        ".js": "application/javascript",
        ".html": "text/html",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
      };
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  address = `http://127.0.0.1:${(server.address() as any).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});
test.beforeEach(() => {
  version = 1;
});
test("first offline installation does not advertise an app update", async ({
  page,
}) => {
  await page.goto(address);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await expect(page.getByLabel("App update")).toHaveCount(0);
});
test("update button loads the newest build even when the advertised build is superseded", async ({
  page,
}) => {
  await page.goto(address);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  version = 2;
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update();
  });
  await expect(page.getByLabel("App update")).toBeVisible();
  version = 3;
  await page.getByRole("button", { name: "Update and reload" }).click();
  await expect(page.locator('meta[name="test-build"]')).toHaveAttribute(
    "content",
    "3",
    { timeout: 15000 },
  );
  await expect(page.getByLabel("App update")).toHaveCount(0);
});
test("another tab can activate an update without leaving this tab's reload button stale", async ({
  page,
  context,
}) => {
  await page.goto(address);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const other = await context.newPage();
  await other.goto(address);
  await expect(other.getByRole("button", { name: "Dark mode" })).toBeVisible();
  version = 2;
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update();
  });
  await expect(page.getByLabel("App update")).toBeVisible();
  await page.getByRole("button", { name: "Update and reload" }).click();
  await expect(page.locator('meta[name="test-build"]')).toHaveAttribute(
    "content",
    "2",
  );
  await expect(other.locator('meta[name="test-build"]')).toHaveAttribute(
    "content",
    "1",
  );
  await other.getByRole("button", { name: "Update and reload" }).click();
  await expect(other.locator('meta[name="test-build"]')).toHaveAttribute(
    "content",
    "2",
  );
  await expect(other.getByLabel("App update")).toHaveCount(0);
});
test("a real service-worker update waits for consent and durable results before reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    (window as any).failSaves = false;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === "sessions" && (window as any).failSaves)
        throw new DOMException("Test save failed", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.goto(address);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.getByRole("button", { name: "Free play", exact: true }).click();
  await page.getByRole("button", { name: "Use simulated input" }).click();
  await page.locator(".stage").click({ position: { x: 200, y: 100 } });
  await page.keyboard.press("a");
  version = 2;
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r!.update();
  });
  await expect(page.getByLabel("App update")).toContainText("Update available");
  await expect(page.locator('meta[name="test-build"]')).toHaveAttribute(
    "content",
    "1",
  );
  await expect(
    page.getByRole("button", { name: "Pause practice" }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as any).failSaves = true;
  });
  await page.getByRole("button", { name: "Update and reload" }).click();
  await expect(page.getByRole("alert")).toContainText("Test save failed");
  await expect(page.getByLabel("App update")).toContainText("Finish saving");
  await expect(page.locator('meta[name="test-build"]')).toHaveAttribute(
    "content",
    "1",
  );
  await page.evaluate(() => {
    (window as any).failSaves = false;
  });
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.locator('meta[name="test-build"]')).toHaveAttribute(
    "content",
    "2",
    { timeout: 10000 },
  );
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".history article")).toHaveCount(1);
});
