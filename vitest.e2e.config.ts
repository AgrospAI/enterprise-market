import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    fileParallelism: false,
    sequence: { concurrent: false, shuffle: false },
    testTimeout: 900_000,
    hookTimeout: 120_000,
    expect: { poll: { timeout: 60_000, interval: 250 } }
  }
})
