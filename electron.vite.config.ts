import path from 'node:path';
import { defineConfig } from 'electron-vite';
import type { Alias, Plugin } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { dependencies as nativeDependencies } from './release/app/package.json';

const root = __dirname;
const srcPath = path.join(root, 'src').replace(/\\/g, '/');
const distPath = path.join(root, 'release/app/dist');

// Dependencies in release/app/package.json are native modules. They're not
// bundled, and are rebuilt for Electron and packaged by electron-builder.
// Everything else is bundled. Use an array so electron-vite can merge these
// with its builtin externals.
const external = Object.keys(nativeDependencies || {}).flatMap((name) => [
  name,
  new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`),
]);

// The tsconfig baseUrl is ./src, so imports like 'main/types' are resolved
// from there. Mirror that for each top-level source directory.
const alias: Alias[] = [
  {
    find: /^(activitys|config|localisation|main|parsing|renderer|storage|types|upload|utils)\//,
    replacement: `${srcPath}/$1/`,
  },
];

// The renderer CSP only allows 'self' scripts, but in development the React
// Refresh preamble is injected as an inline script. Relax the CSP for the dev
// server only; production builds keep the strict policy.
const devCspPlugin: Plugin = {
  name: 'wcr:dev-csp',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
};

export default defineConfig(({ mode }) => {
  // Main and preload are Node builds, so process.env is left as a runtime
  // lookup. Bake NODE_ENV and DEBUG_PROD in at build time as webpack did.
  const nodeDefine = {
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.DEBUG_PROD': JSON.stringify(process.env.DEBUG_PROD ?? 'false'),
  };

  return {
    main: {
      resolve: { alias },
      define: nodeDefine,
      build: {
        outDir: path.join(distPath, 'main'),
        // The application and OBS logs live in dist/main/logs, don't wipe them
        // on every rebuild. The package script cleans dist before building.
        emptyOutDir: false,
        sourcemap: true,
        externalizeDeps: false,
        rolldownOptions: {
          input: path.join(root, 'src/main/main.ts'),
          external,
          output: { entryFileNames: 'main.js' },
        },
      },
    },
    preload: {
      resolve: { alias },
      define: nodeDefine,
      build: {
        outDir: path.join(distPath, 'preload'),
        sourcemap: true,
        externalizeDeps: false,
        rolldownOptions: {
          input: path.join(root, 'src/main/preload.ts'),
          external,
          output: { entryFileNames: 'preload.js' },
        },
      },
    },
    renderer: {
      root: path.join(root, 'src/renderer'),
      base: './',
      resolve: { alias },
      plugins: [
        devCspPlugin,
        react(),
        babel({ presets: [reactCompilerPreset()] }),
      ],
      server: {
        host: 'localhost',
        port: Number(process.env.PORT || 1212),
        strictPort: true,
      },
      build: {
        outDir: path.join(distPath, 'renderer'),
        emptyOutDir: true,
        minify: true,
        sourcemap: true,
        rolldownOptions: {
          input: path.join(root, 'src/renderer/index.html'),
        },
      },
    },
  };
});
