import path from 'path';
import { app } from 'electron';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

/**
 * macOS ffmpeg path. Points at the universal-binary ffmpeg that
 * obs-studio-node ships inside its Frameworks/ folder. Same approach
 * as the Windows side which reuses the ffmpeg.exe bundled by noobs —
 * no need to ship a duplicate static binary.
 *
 * The OSN-bundled ffmpeg is built with VideoToolbox + libx264 + libopus
 * + libsrt enabled (verified via `ffmpeg -version`); plenty for our
 * post-processing cut/remux step in VideoProcessQueue.
 */
export default class MacFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    // OSN root resolution mirrors OsnBackend.osnRoot().
    const osnRoot = app.isPackaged
      ? path.join(
          process.resourcesPath,
          'app',
          'node_modules',
          'obs-studio-node',
        )
      : path.resolve(
          __dirname,
          '../../release/app/node_modules/obs-studio-node',
        );
    const abs = path.join(osnRoot, 'Frameworks', 'ffmpeg');
    return fixPathWhenPackaged(abs);
  }
}
