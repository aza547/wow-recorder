/**
 * Base webpack config used across other specific configs
 */

import webpack from 'webpack';
import path from 'path';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import { dependencies as releaseAppDependencies } from '../../release/app/package.json';

const isWin = process.platform === 'win32';

const externals = Object.keys(releaseAppDependencies || {}).filter((dep) => {
  if (isWin) return true;
  // Linux MVP: bundle stubs for Windows-only native deps.
  return dep !== 'noobs' && dep !== 'uiohook-napi';
});

const linuxStubsAliases = isWin
  ? {}
  : {
      noobs: path.join(webpackPaths.srcPath, 'stubs', 'noobs'),
      'uiohook-napi': path.join(webpackPaths.srcPath, 'stubs', 'uiohook-napi'),
    };

const configuration: webpack.Configuration = {
  externals: [...externals],

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
    alias: linuxStubsAliases,
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
  ],
};

export default configuration;
