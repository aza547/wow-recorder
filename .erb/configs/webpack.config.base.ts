/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import {
  dependencies as externals,
  optionalDependencies as optionalExternals,
} from '../../release/app/package.json';

const isMac = process.platform === 'darwin';

// On macOS, exclude `noobs` from externals so the NormalModuleReplacementPlugin
// below can redirect `require('noobs')` to the runtime stub. Other platforms
// still externalise it so webpack doesn't bundle the native module.
const baseExternals = [
  ...Object.keys(externals || {}),
  ...Object.keys(optionalExternals || {}).filter(
    (dep) => !(isMac && dep === 'noobs'),
  ),
];

const configuration: webpack.Configuration = {
  externals: baseExternals,

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
            },
          },
        },
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: { type: 'commonjs2' },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // There is no need to add aliases here, the paths in tsconfig get mirrored
    plugins: [new TsconfigPathsPlugins()],
    fallback: {
      'roughjs/bin/rough': require.resolve('roughjs/bin/rough'),
      'roughjs/bin/generator': require.resolve('roughjs/bin/generator'),
      'roughjs/bin/math': require.resolve('roughjs/bin/math')
    }
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
    new webpack.DefinePlugin({
      'process.env.FLUENTFFMPEG_COV': false,
    }),
    // On macOS, redirect `require('noobs')` to a runtime stub so
    // UMD external resolution at bundle load time doesn't fail.
    // The platform factory never instantiates NoobsBackend on darwin.
    ...(isMac
      ? [
          new webpack.NormalModuleReplacementPlugin(
            /^noobs$/,
            path.resolve(__dirname, '../stubs/noobs-stub.js'),
          ),
        ]
      : []),
  ],
};

export default configuration;
