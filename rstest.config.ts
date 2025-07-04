import { defineConfig } from '@rstest/core'

export default defineConfig({
  include: ['test/**/*.test.js', 'test/**/*.test.ts'],
  testTimeout: 30000,
  globals: true,
  resolve: {
    alias: {
      '@orbitdb/core': './src/index.ts'
    },
    extensions: ['.ts', '.js']
  },
  source: {
    include: ['src/**/*.ts']
  }
})