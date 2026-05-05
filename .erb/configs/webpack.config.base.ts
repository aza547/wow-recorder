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

// Both platforms now use `noobs` at runtime — Win against the
// upstream noobs package, Mac against our fork's vendored libobs +
// .plugin bundles. Treat noobs as external on both so webpack
// doesn't try to bundle the native module. obs-studio-node is gone
// from the codebase entirely (Phase 6).
const baseExternals = [
  ...Object.keys(externals || {}),
  ...Object.keys(optionalExternals || {}).filter((dep) => {
    if (!isMac && dep === 'obs-studio-node') return false;
    return true;
  }),
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
    // On Windows, redirect `require('obs-studio-node')` to a stub so
    // the bundle still loads even though the package isn't there.
    // (No longer needed for noobs — both platforms use it.)
    ...(isMac
      ? []
      : [
          new webpack.NormalModuleReplacementPlugin(
            /^obs-studio-node$/,
            path.resolve(__dirname, '../stubs/osn-stub.js'),
          ),
        ]),
  ],
};

export default configuration;
