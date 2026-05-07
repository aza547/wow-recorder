import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

/**
 * macOS ffmpeg path. Uses the static ffmpeg binary shipped by
 * @ffmpeg-installer/ffmpeg (platform-aware; resolves to
 * release/app/node_modules/@ffmpeg-installer/darwin-{arm64,x64}/ffmpeg).
 *
 * Earlier this pointed at obs-studio-node's bundled ffmpeg, but OSN
 * was removed in Phase 6 of the noobs Mac port. Vanilla libobs ships
 * libav* dylibs + obs-ffmpeg-mux helper but no general-purpose
 * ffmpeg CLI, which VideoProcessQueue needs for cut/remux.
 */
export default class MacFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const ffmpeg = require('@ffmpeg-installer/ffmpeg');
    return fixPathWhenPackaged(ffmpeg.path);
  }
}
