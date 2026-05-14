import path from 'path';
import fs, { promises as fspromise } from 'fs';
import { app } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import { Readable } from 'stream';
import { isLinux } from './platform';
import { fixPathWhenPackaged } from './util';
import { send } from './main';
import ConfigService from '../config/ConfigService';

/**
 * PlaybackTranscoder is a Linux-only utility that converts HEVC (H265) mp4 sources
 * into H.264 mp4 cache files the renderer can play through the existing
 * vod:// protocol. Electron's bundled Chromium on Linux has no native HEVC
 * decoder in <video>, so without this any HEVC recording (NVENC_H265) would
 * be unplayable.
 *
 * The renderer decides whether a video is HEVC from `RendererVideo.encoder`
 * (set on every recording via `metadata.encoder`) and passes that as the
 * `isHevc` flag.
 *
 * The transcode runs once per cache key; the result is cached on disk in
 * `<userData>/playback-cache/<key>.mp4`. Concurrent requests for the same key
 * dedupe to a single in-flight ffmpeg job. The cache is LRU-evicted to
 * `DEFAULT_MAX_CACHE_BYTES`.
 */

// Channel used to push progress events back to the renderer.
export const TRANSCODE_PROGRESS_CHANNEL = 'videoTranscodeProgress';

// Cache directory name under app.getPath('userData')
const CACHE_DIR_NAME = 'playback-cache';

// LRU file name under the cache dir. Stores a JSON map of
// `{ <cache-file-basename>: lastUsedMs }` so LRU recency survives restarts
// without depending on the filesystem's atime (which `noatime`/`relatime`
// mounts on Linux make unreliable).
const LRU_CACHE_JSON = 'lru.json';

// Fallback if hevcTranscodeCacheSizeGb is missing/invalid. 10 GiB.
const FALLBACK_MAX_CACHE_BYTES = 10 * (1 << 30);

const devMode = process.env.NODE_ENV === 'development';

const ffmpegRel = isLinux
  ? 'node_modules/noobs/dist/bin/linux/ffmpeg'
  : 'node_modules/noobs/dist/bin/win64/ffmpeg.exe';

const resolveBin = (rel: string) => {
  const abs = devMode
    ? path.resolve(__dirname, '../../release/app/', rel)
    : path.resolve(__dirname, '../../', rel);
  return fixPathWhenPackaged(abs);
};

// Set ffmpeg path; this is already set by VideoProcessQueue but we set it
// again defensively in case this module is exercised before that one.
ffmpeg.setFfmpegPath(resolveBin(ffmpegRel));

export interface PrepareResult {
  /** URL/path the renderer should pass to the player. */
  playableSource: string;
}

export interface TranscodeProgressEvent {
  key: string;
  state: 'start' | 'progress' | 'done' | 'error';
  percent?: number;
  timemark?: string;
  fps?: number;
  error?: string;
}

interface InFlight {
  promise: Promise<PrepareResult>;
  cancel: () => void;
}

export default class PlaybackTranscoder {
  private static instance: PlaybackTranscoder;

  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  private cacheDir: string;
  private lruFile: string;
  /**
   * In-memory mirror of the LRU json: cache-file basename -> lastUsedMs.
   * Authoritative recency signal for `enforceCacheCap`. Falls back to the
   * filesystem's atime only for cache files with no entry here (e.g. older
   * caches predating the json file).
   */
  private lru = new Map<string, number>();
  private inFlight = new Map<string, InFlight>();

  // Read cap from config on each call so edits take effect on next eviction.
  private getMaxCacheBytes(): number {
    try {
      const gb = ConfigService.getInstance().get<number>(
        'hevcTranscodeCacheSizeGb',
      );
      if (typeof gb === 'number' && Number.isFinite(gb) && gb >= 1) {
        return Math.floor(gb) * (1 << 30);
      }
    } catch (e) {
      console.warn(
        '[PlaybackTranscoder] Failed to read hevcTranscodeCacheSizeGb, using fallback',
        e,
      );
    }
    return FALLBACK_MAX_CACHE_BYTES;
  }

  private constructor() {
    this.cacheDir = path.join(app.getPath('userData'), CACHE_DIR_NAME);
    this.lruFile = path.join(this.cacheDir, LRU_CACHE_JSON);
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch (e) {
      console.warn('[PlaybackTranscoder] Failed to create cache dir', e);
    }
    this.loadLru();
    console.info('[PlaybackTranscoder] Cache dir:', this.cacheDir);
  }

  /**
   * Prepare a source for playback. Returns a URL ready to
   * hand to `<video src>`:
   *
   *   - https://...  : returned unchanged (cloud direct playback)
   *   - local path   : wrapped as vod://wcr/<path>
   *   - HEVC + Linux : transcoded to a cache file, returned as vod://wcr/<cache>
   *
   * Seek time URL hashs are preserved.
   *
   * @param source    local file path or https:// URL
   * @param cacheKey  stable identifier for the video, typically RendererVideo.uniqueId
   * @param isHevc    whether the video is HEVC, derived by the renderer from
   *                  `RendererVideo.encoder`. Non-HEVC sources bypass the
   *                  transcoder.
   */
  public async prepareForPlayback(
    source: string,
    cacheKey: string,
    isHevc: boolean,
  ): Promise<PrepareResult> {
    // Preserve any #t= seek-resume fragment.
    const [cleanSource, fragment] = splitFragment(source);

    // Fast path: non-Linux platforms have native HEVC playback.
    // Just return whatever URL the renderer already had.
    if (!isLinux) {
      return { playableSource: finalizeUrl(cleanSource, fragment) };
    }

    // Non-HEVC sources (including old recordings whose metadata predates the
    // encoder field) play natively in Chromium and need no transcode.
    if (!isHevc) {
      return { playableSource: finalizeUrl(cleanSource, fragment) };
    }

    // In-flight dedupe.
    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      console.info('[PlaybackTranscoder] Awaiting in-flight job:', cacheKey);
      return existing.promise;
    }

    const cachePath = this.getCachePath(cacheKey);
    if (await this.cacheExists(cachePath)) {
      this.touchCacheFile(cachePath);
      this.bumpLru(cachePath);
      console.info('[PlaybackTranscoder] Cache hit:', cacheKey);
      return { playableSource: finalizeUrl(cachePath, fragment) };
    }

    const job = this.startTranscode(cleanSource, cacheKey, cachePath, fragment);
    this.inFlight.set(cacheKey, job);
    try {
      return await job.promise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  /**
   * Cancel an in-flight transcode for the given cache key and reject the promise.
   */
  public cancel(cacheKey: string) {
    const job = this.inFlight.get(cacheKey);
    if (!job) return;
    console.info('[PlaybackTranscoder] Cancelling:', cacheKey);
    job.cancel();
    this.inFlight.delete(cacheKey);
  }

  // Cancel all in-flight transcodes. Called when the user disables HEVC.
  public cancelAll() {
    if (this.inFlight.size === 0) return;
    console.info(
      '[PlaybackTranscoder] Cancelling all in-flight transcodes:',
      this.inFlight.size,
    );
    for (const [, job] of this.inFlight) {
      try {
        job.cancel();
      } catch (e) {
        console.warn('[PlaybackTranscoder] cancelAll: job cancel failed', e);
      }
    }
    this.inFlight.clear();
  }

  private getCachePath(key: string): string {
    // Strip anything that's not safe for a filename. Keep the slice short
    // enough to avoid hitting PATH_MAX edge cases on weird filesystems.
    const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    return path.join(this.cacheDir, `${safe}.mp4`);
  }

  private async cacheExists(p: string): Promise<boolean> {
    try {
      const st = await fspromise.stat(p);
      return st.isFile() && st.size > 0;
    } catch {
      return false;
    }
  }

  private touchCacheFile(p: string) {
    const now = new Date();
    fspromise.utimes(p, now, now).catch((e) => {
      console.warn('[PlaybackTranscoder] utimes failed:', p, e);
    });
  }

  /**
   * Load the LRU json into. Sync because it runs once from the
   * constructor and the file is tiny. A missing or corrupt json file is fine —
   * we start with an empty map and `enforceCacheCap` will fall back to atime
   * for any cache files lacking an entry.
   */
  private loadLru() {
    try {
      const raw = fs.readFileSync(this.lruFile, 'utf-8');
      const obj = JSON.parse(raw) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'number' && Number.isFinite(v)) this.lru.set(k, v);
      }
      console.info(
        '[PlaybackTranscoder] Loaded LRU json cache:',
        this.lru.size,
        'entries',
      );
    } catch {
      // Missing or corrupt — start empty.
    }
  }

  /**
   * Persist the in-memory LRU map atomically.
   * Fire-and-forget from callers; failures are logged but not propagated.
   */
  private async saveLru() {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.lru) obj[k] = v;
    const tmp = `${this.lruFile}.${process.pid}.${Math.random()
      .toString(36)
      .slice(2)}.tmp`;
    try {
      await fspromise.writeFile(tmp, JSON.stringify(obj));
      await fspromise.rename(tmp, this.lruFile);
    } catch (e) {
      console.warn('[PlaybackTranscoder] saveLru failed:', e);
      fspromise.unlink(tmp).catch(() => {});
    }
  }

  /**
   * Mark a cache file as just used and persist the lru json file. Called on
   * cache hits and on transcode completion.
   */
  private bumpLru(cachePath: string) {
    this.lru.set(path.basename(cachePath), Date.now());
    this.saveLru().catch(() => {});
  }

  private startTranscode(
    source: string,
    cacheKey: string,
    cachePath: string,
    fragment: string,
  ): InFlight {
    const tmpPath = `${cachePath}.tmp`;
    let cancelled = false;
    // fluent-ffmpeg returns a command we can kill.
    let cmd: ReturnType<typeof ffmpeg> | undefined;
    // Inbound HTTPS stream, if any, that needs explicit teardown on cancel.
    let inputStream: Readable | null = null;

    const promise = new Promise<PrepareResult>((resolve, reject) => {
      console.info('[PlaybackTranscoder] Start transcode (hevc):', cacheKey);
      sendProgress({ key: cacheKey, state: 'start', percent: 0 });

      // For HTTPS sources we have to fetch via node and pipe the response body to
      // ffmpeg over stdin. For local paths we hand the path to ffmpeg directly.
      const inputPromise: Promise<string | Readable> = source.startsWith(
        'https://',
      )
        ? axios
            .get(source, {
              responseType: 'stream',
              maxRedirects: 5,
              // No timeout since we can't reliably predict internet speed
              timeout: 0,
              validateStatus: (s) => s >= 200 && s < 300,
            })
            .then((resp) => {
              inputStream = resp.data as Readable;
              return inputStream;
            })
        : Promise.resolve(source);

      inputPromise
        .then((input) => {
          if (cancelled) {
            if (input instanceof Readable) {
              try {
                input.destroy();
              } catch (e) {
                /* ignore */
              }
            }
            return;
          }
          cmd = ffmpeg(input as string | Readable);
          if (typeof input !== 'string') {
            // ffmpeg can't seek stdin; tell it the format up front. mp4 with
            // +faststart can be read sequentially.
            cmd.inputFormat('mp4');
          }
          cmd
            .videoCodec('libx264')
            .outputOptions(['-preset ultrafast', '-crf 23'])
            .audioCodec('copy')
            // explicitly specify mp4 since ffmpeg can't infer from .tmp extension
            // -movflags +faststart: moov atom at the front so the vod://
            // handler can serve Range requests cheaply.
            .outputOptions(['-f mp4', '-movflags +faststart'])
            .on('progress', (p) => {
              sendProgress({
                key: cacheKey,
                state: 'progress',
                percent: typeof p.percent === 'number' ? p.percent : undefined,
                timemark: p.timemark,
                fps: p.currentFps,
              });
            })
            .on('end', async () => {
              if (cancelled) return;
              try {
                await fspromise.rename(tmpPath, cachePath);
                this.bumpLru(cachePath);
                sendProgress({ key: cacheKey, state: 'done', percent: 100 });
                console.info('[PlaybackTranscoder] Transcode done:', cacheKey);
                // Fire-and-forget eviction so we don't block the resolution.
                this.enforceCacheCap().catch((e) =>
                  console.warn('[PlaybackTranscoder] eviction failed', e),
                );
                resolve({
                  playableSource: finalizeUrl(cachePath, fragment),
                });
              } catch (e) {
                reject(e);
              }
            })
            .on('error', (err) => {
              // Always clean the partial file. Ignore failures.
              fspromise.unlink(tmpPath).catch(() => {});
              if (cancelled) {
                console.info('[PlaybackTranscoder] Cancelled:', cacheKey);
                reject(new Error('cancelled'));
                return;
              }
              console.error(
                '[PlaybackTranscoder] Transcode failed:',
                cacheKey,
                err.message,
              );
              sendProgress({
                key: cacheKey,
                state: 'error',
                error: err.message,
              });
              reject(err);
            })
            .save(tmpPath);
        })
        .catch((err) => {
          console.error(
            '[PlaybackTranscoder] Could not open input:',
            cacheKey,
            err.message,
          );
          sendProgress({
            key: cacheKey,
            state: 'error',
            error: err.message,
          });
          reject(err);
        });
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
        try {
          // need a bit more control over this process compared to the video processor
          // since users navigating to another video should stop the work
          cmd?.kill('SIGKILL');
        } catch (e) {
          console.warn('[PlaybackTranscoder] kill failed:', e);
        }
        if (inputStream) {
          try {
            inputStream.destroy();
          } catch (e) {
            // ignore
          }
        }
        fspromise.unlink(tmpPath).catch(() => {});
      },
    };
  }

  private async enforceCacheCap(): Promise<void> {
    let entries: string[];
    try {
      entries = await fspromise.readdir(this.cacheDir);
    } catch (err) {
      console.warn('[PlaybackTranscoder] readdir failed:', err);
      return;
    }

    const stats: {
      p: string;
      basename: string;
      lastUsed: number;
      size: number;
    }[] = [];
    const liveBasenames = new Set<string>();
    for (const e of entries) {
      // Skip the lru json file itself and any in-flight json cache tmp files.
      if (e.startsWith(LRU_CACHE_JSON)) continue;
      // Skip in-flight transcode outputs.
      if (e.endsWith('.tmp')) continue;
      const p = path.join(this.cacheDir, e);
      try {
        const st = await fspromise.stat(p);
        if (!st.isFile()) continue;
        // prefer lru, fallback to atime, but this is filesystem dependent
        // a lot of modern distros will default 'noatime' to reduce disk wear
        const lastUsed = this.lru.get(e) ?? st.atimeMs;
        stats.push({ p, basename: e, lastUsed, size: st.size });
        liveBasenames.add(e);
      } catch {
        // race with eviction or transient stat failure
      }
    }

    // Prune lru json entries whose backing file no longer exists.
    let lruDirty = false;
    for (const k of [...this.lru.keys()]) {
      if (!liveBasenames.has(k)) {
        this.lru.delete(k);
        lruDirty = true;
      }
    }

    let total = stats.reduce((a, b) => a + b.size, 0);
    const maxCacheBytes = this.getMaxCacheBytes();
    if (total > maxCacheBytes) {
      // Oldest lastUsed first.
      stats.sort((a, b) => a.lastUsed - b.lastUsed);
      for (const e of stats) {
        if (total <= maxCacheBytes) break;
        try {
          await fspromise.unlink(e.p);
          if (this.lru.delete(e.basename)) lruDirty = true;
          total -= e.size;
          console.info(
            '[PlaybackTranscoder] Evicted (LRU):',
            e.p,
            'freed=',
            e.size,
          );
        } catch (err) {
          console.warn('[PlaybackTranscoder] Evict failed:', e.p, err);
        }
      }
    }

    if (lruDirty) await this.saveLru();
  }
}

function sendProgress(event: TranscodeProgressEvent) {
  try {
    send(TRANSCODE_PROGRESS_CHANNEL, event);
  } catch (e) {
    // shouldn't ever get here unless electron is misbehaving
    console.warn('[PlaybackTranscoder] send progress failed:', e);
  }
}

function splitFragment(s: string): [string, string] {
  const i = s.indexOf('#');
  if (i < 0) return [s, ''];
  return [s.slice(0, i), s.slice(i)];
}

function finalizeUrl(resource: string, fragment: string): string {
  // The browser percent-encodes invalid URL characters (spaces etc.) when
  // assigning to <video src>, and the vod:// handler in util.ts decodes
  // them. Keeps this in sync with the standard video player that doesn't
  // go throug this call path
  if (resource.startsWith('https://')) return resource + fragment;
  if (resource.startsWith('vod://')) return resource + fragment;
  return `vod://wcr/${resource}${fragment}`;
}
