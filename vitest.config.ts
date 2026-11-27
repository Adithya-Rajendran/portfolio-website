// Vitest configuration of the unit tests, which run in Node.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] } },
    ],
  },
});
