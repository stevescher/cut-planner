import { defineConfig, devices } from '@playwright/test';

// Dedicated port, deliberately outside the 3000/3100 range other projects on
// this machine use for their dev servers. reuseExistingServer is off:
// Playwright only checks that *something* answers the URL, so reusing it
// silently tests whatever happens to hold the port (a neighbouring app served
// 307 -> /login and 3 specs failed against it). With reuse off, an occupied
// port fails immediately with a clear message instead of testing the wrong
// app. Override with PLAYWRIGHT_PORT if 3210 is taken.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3210);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
