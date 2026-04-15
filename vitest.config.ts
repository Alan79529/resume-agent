import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/main/**/*.test.ts'],
    environment: 'node',
    globals: true,
    restoreMocks: true,
    clearMocks: true
  }
})
