import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './browser-tests', use: { headless: true }, workers: 1 });
