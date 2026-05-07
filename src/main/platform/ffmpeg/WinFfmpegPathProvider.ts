import path from 'path';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

const devMode = process.env.NODE_ENV === 'development';
const REL = 'node_modules/noobs/dist/bin/ffmpeg.exe';

/**
 * Windows ffmpeg path. Reuses the ffmpeg.exe dynamically linked by the
 * noobs bundle so we don't ship a duplicate ~60 MB binary.
 */
export default class WinFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    const abs = devMode
      ? path.resolve(__dirname, '../../release/app/', REL)
      : path.resolve(__dirname, '../../', REL);
    return fixPathWhenPackaged(abs);
  }
}
