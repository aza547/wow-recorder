import path from 'path';
import { app } from 'electron';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

/**
 * macOS ffmpeg path. Points at the universal static binary shipped
 * under `extraResources/binaries/ffmpeg` (added in Plan 2b/3).
 * Packaged builds resolve via `process.resourcesPath`; dev builds
 * resolve relative to the repo-root `binaries/` (same convention as
 * the Windows rust-ps path).
 */
export default class MacFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    const abs = app.isPackaged
      ? path.join(process.resourcesPath, 'binaries', 'ffmpeg')
      : path.join(__dirname, '../../binaries', 'ffmpeg');
    return fixPathWhenPackaged(abs);
  }
}
