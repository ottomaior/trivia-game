import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build: `pnpm build && pnpm e2e`.
// CHROMIUM_PATH lets environments with a preinstalled Chromium skip the download.
const executablePath = process.env.CHROMIUM_PATH;
const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node apps/server/dist/index.js',
    url: `http://localhost:${port}/healthz`,
    // Phases run at 15% of real length so a whole game fits in a test.
    env: { PORT: String(port), DATABASE_URL: process.env.E2E_DATABASE_URL ?? '', TIMING_SCALE: '0.15' },
    reuseExistingServer: false,
  },
});
