/**
 * Provides the absolute path to the ffmpeg binary to use for
 * post-processing (cutting, remuxing) of recorded files.
 */
export interface IFfmpegPathProvider {
  getPath(): string;
}
