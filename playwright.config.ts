import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:4173", headless: true },
  webServer: {
    command: "pnpm preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  workers: 1,
});
