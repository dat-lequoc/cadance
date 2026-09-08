import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:4187", headless: true },
  webServer: {
    command: "pnpm preview --port 4187",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: true,
  },
  workers: 1,
});
