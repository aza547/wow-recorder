import fs from 'fs';
import path from 'path';
import { rimrafSync } from 'rimraf';
import webpackPaths from '../configs/webpack.paths';

const linuxAppDir = path.join(webpackPaths.releasePath, 'app-linux');
const sourceDist = webpackPaths.distPath; // release/app/dist
const targetDist = path.join(linuxAppDir, 'dist');

if (!fs.existsSync(sourceDist)) {
  throw new Error(
    `[sync-linux-dist] Expected "${sourceDist}" to exist. Did "npm run build" run successfully?`,
  );
}

rimrafSync(targetDist);
fs.mkdirSync(linuxAppDir, { recursive: true });

fs.cpSync(sourceDist, targetDist, { recursive: true });
console.info('[sync-linux-dist] Copied', sourceDist, '->', targetDist);

