import path from 'path'
import { fileURLToPath } from 'url'

export default (env, argv) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  return {
    mode: 'production',
    entry: './src/index.ts',
    experiments: {
      outputModule: true
    },
    output: {
      filename: '../dist/orbitdb.esm.js',
      library: {
        type: 'module'
      }
    },
    target: 'web',
    externals: {
      fs: '{ existsSync: () => true }',
      mkdirp: '{}'
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      modules: [
        'node_modules',
        path.resolve(__dirname, '../node_modules')
      ]
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webpack.json'
            }
          },
          exclude: /node_modules/
        }
      ]
    },
    resolveLoader: {
      modules: [
        'node_modules',
        path.resolve(__dirname, '../node_modules')
      ],
      extensions: ['.js', '.json'],
      mainFields: ['loader', 'main']
    }
  }
}
