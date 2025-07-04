import { defineConfig } from '@rstest/core'

export default defineConfig({
  source: {
    entry: ['test/setup.js', 'test/**/*.test.js', 'test/**/*.test.ts']
  },
  output: {
    target: 'node'
  },
  resolve: {
    alias: {
      '@orbitdb/core': './src/index.ts'
    },
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        use: [{
          loader: 'ts-loader',
          options: {
            allowTsInNodeModules: true,
            transpileOnly: true
          }
        }],
        exclude: /node_modules/
      }
    ]
  }
})