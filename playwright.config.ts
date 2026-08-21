import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const fixtureRoot = path.resolve('.tmp', 'e2e');
const setupWebPort = 41740;
const setupApiPort = 41741;
const libraryWebPort = 41742;
const libraryApiPort = 41743;
const commonServerEnvironment = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  LOG_LEVEL: 'warn',
  KIWI_DATA_DIR: path.join(fixtureRoot, 'data'),
  KIWI_LIBRARY_ROOTS: fixtureRoot,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup-chromium',
      testMatch: /setup\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${setupWebPort}` },
    },
    {
      name: 'setup-mobile',
      testMatch: /setup\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: `http://127.0.0.1:${setupWebPort}` },
    },
    {
      name: 'library-chromium',
      testMatch: /library\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${libraryWebPort}` },
    },
    {
      name: 'library-mobile',
      testMatch: /library\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: `http://127.0.0.1:${libraryWebPort}` },
    },
  ],
  webServer: [
    {
      command: 'node server/dist/index.mjs',
      url: `http://127.0.0.1:${setupApiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...commonServerEnvironment,
        PORT: String(setupApiPort),
        CONFIG_PATH: path.join(fixtureRoot, 'setup-config.json'),
      },
    },
    {
      command: 'node server/dist/index.mjs',
      url: `http://127.0.0.1:${libraryApiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...commonServerEnvironment,
        PORT: String(libraryApiPort),
        CONFIG_PATH: path.join(fixtureRoot, 'existing-config.json'),
      },
    },
    {
      command: 'node scripts/e2e-web-server.mjs',
      url: `http://127.0.0.1:${setupWebPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PORT: String(setupWebPort), API_TARGET: `http://127.0.0.1:${setupApiPort}` },
    },
    {
      command: 'node scripts/e2e-web-server.mjs',
      url: `http://127.0.0.1:${libraryWebPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PORT: String(libraryWebPort), API_TARGET: `http://127.0.0.1:${libraryApiPort}` },
    },
  ],
});
