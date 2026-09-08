import { defineConfig } from "@playwright/test";
const port = Number(process.env.CADANCE_TEST_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("Invalid CADANCE_TEST_PORT");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "e2e",
  use: { baseURL, headless: true },
  webServer: {
    command: `pnpm preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CADANCE_TEST_PORT,
  },
  workers: 1,
});
