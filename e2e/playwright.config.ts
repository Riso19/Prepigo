import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    headless: true,
  },
  reporter: [['list']],
});
