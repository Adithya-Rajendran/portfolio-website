import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const E2E_DIR = import.meta.dirname;
const ROOT = path.resolve(E2E_DIR, '../..');
const port = process.env.PORT || '8080';
const origin = process.env.ORIGIN || `http://127.0.0.1:${port}`;
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || path.join(ROOT, 'test-results');
const reportDir = process.env.PLAYWRIGHT_HTML_REPORT || path.join(ROOT, 'playwright-report');

const GPU_ARGS = ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'];
const DESKTOP_ONLY_SPECS = /.*(errs|endpoints|page|plaincheck|plainpage|view)\.spec\.ts/;

export default defineConfig({
  testDir: './specs',
  outputDir,
  timeout: 240_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: reportDir, open: 'never' }],
  ],
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        permissions: ['clipboard-read', 'clipboard-write'],
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'phone',
      testIgnore: DESKTOP_ONLY_SPECS,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        permissions: ['clipboard-read', 'clipboard-write'],
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'reduced',
      testIgnore: DESKTOP_ONLY_SPECS,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        reducedMotion: 'reduce',
        permissions: ['clipboard-read', 'clipboard-write'],
        launchOptions: { args: GPU_ARGS },
      },
    },
    {
      name: 'smoke-firefox',
      testMatch: /.*view\.spec\.ts/,
      use: {
        browserName: 'firefox',
        viewport: { width: 960, height: 540 },
      },
    },
    {
      name: 'smoke-webkit',
      testMatch: /.*view\.spec\.ts/,
      use: {
        browserName: 'webkit',
        viewport: { width: 960, height: 540 },
      },
    },
  ],
  webServer: process.env.ORIGIN
    ? undefined
    : {
        command: `node ${path.join(E2E_DIR, 'serve.mjs')}`,
        url: `${origin}/content.json`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
