import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import type {
  BaseConfig,
  ObsAudioConfig,
  ObsOverlayConfig,
  ObsVideoConfig,
} from '../types';
import { MicStatus } from '../types';
import { ERecordingState } from '../obsEnums';
import ConfigService from '../../config/ConfigService';
import { FileSortDirection } from '../types';
import {
  exists,
  fixPathWhenPackaged,
  getSortedFiles,
  tryUnlink,
} from '../util';
import { emitErrorReport } from '../errorReporting';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegInstallerPath = fixPathWhenPackaged(ffmpegInstaller.path);
ffmpeg.setFfmpegPath(ffmpegInstallerPath);

type GsrSavedType = 'regular' | 'replay' | 'screenshot';

type GsrEvent = {
  ts: number;
  type: GsrSavedType;
  path: string;
};

class GsrEventLog {
  private offset = 0;
  private pending: GsrEvent[] = [];
  private watching = false;
  private watcher: fs.FSWatcher | null = null;

  constructor(private filePath: string) {}

  public async start() {
    if (this.watching) return;
    this.watching = true;

    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.promises.appendFile(this.filePath, '');

    this.watcher = fs.watch(this.filePath, { persistent: false }, () => {
      void this.readNew();
    });

    await this.readNew();
  }

  public stop() {
    this.watching = false;
    this.watcher?.close();
    this.watcher = null;
  }

  public async waitFor(
    type: GsrSavedType,
    afterMs: number,
    timeoutMs: number,
  ): Promise<GsrEvent> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await this.readNew();
      const idx = this.pending.findIndex(
        (e) => e.type === type && e.ts >= afterMs,
      );
      if (idx >= 0) {
        const [match] = this.pending.splice(idx, 1);
        return match;
      }

      await new Promise((r) => setTimeout(r, 50));
    }

    throw new Error(`[LinuxRecorder] Timed out waiting for GSR ${type} event`);
  }

  private async readNew() {
    try {
      const stat = await fs.promises.stat(this.filePath);
      if (stat.size <= this.offset) return;

      const fh = await fs.promises.open(this.filePath, 'r');
      try {
        const toRead = stat.size - this.offset;
        const buf = Buffer.alloc(toRead);
        await fh.read(buf, 0, toRead, this.offset);
        this.offset = stat.size;

        const text = buf.toString('utf-8');
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          const [tsStr, type, ...pathParts] = line.split('\t');
          const savedPath = pathParts.join('\t');
          const ts = Number(tsStr);
          if (!Number.isFinite(ts) || !savedPath) continue;
          if (type !== 'regular' && type !== 'replay' && type !== 'screenshot')
            continue;
          this.pending.push({ ts, type, path: savedPath });
        }
      } finally {
        await fh.close();
      }
    } catch {
      // Ignore.
    }
  }
}

export default class LinuxRecorder extends EventEmitter {
  private static instance: LinuxRecorder;

  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  private cfg = ConfigService.getInstance();
  private process: ChildProcessWithoutNullStreams | null = null;
  private eventLog: GsrEventLog | null = null;
  private desiredRunning = false;
  private restartAttempts = 0;
  private restartTimer: NodeJS.Timeout | null = null;

  public obsState = ERecordingState.None;
  public obsMicState: MicStatus = MicStatus.NONE;
  public lastFile: string | null = null;

  private baseConfig: BaseConfig | null = null;
  private pendingReplay: Promise<GsrEvent | null> | null = null;
  private pendingReplayOffsetSec = 0;
  private sigRtMin: number | null = null;

  private constructor() {
    super();
    console.info('[LinuxRecorder] Using gpu-screen-recorder backend');
  }

  public initializeObs() {
    // Intentionally lazy: we only check deps when starting capture.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async configureBase(config: BaseConfig, _startup: boolean) {
    this.baseConfig = config;
    await fs.promises.mkdir(config.obsPath, { recursive: true });
    await fs.promises.mkdir(path.join(config.obsPath, 'replay'), {
      recursive: true,
    });
    await fs.promises.mkdir(path.join(config.obsPath, 'regular'), {
      recursive: true,
    });
    await fs.promises.mkdir(path.join(config.obsPath, 'staging'), {
      recursive: true,
    });

    // Mark the buffer directory as managed so validateBaseConfig doesn't try to
    // "take ownership" later (which is Windows/OBS-shaped and doesn't match the
    // Linux GSR subdirectory layout).
    const managedFile = path.join(config.obsPath, 'managed.txt');
    if (!(await exists(managedFile))) {
      const content =
        'This folder is managed by Warcraft Recorder, files in it may be automatically created, modified or deleted.';
      await fs.promises.writeFile(managedFile, content);
    }
  }

  public configureVideoSources(_config: ObsVideoConfig) {}
  public configureAudioSources(_config: ObsAudioConfig) {}
  public configureOverlayImageSource(_config: ObsOverlayConfig) {}
  public attachCaptureSource() {}
  public clearFindWindowInterval() {}
  public removeAudioSources() {}

  public async startBuffer() {
    if (!this.baseConfig) {
      throw new Error('[LinuxRecorder] Base config not set');
    }

    if (this.obsState === ERecordingState.Recording) {
      this.desiredRunning = true;
      return;
    }

    this.desiredRunning = true;
    this.restartAttempts = 0;
    await this.ensureGsrAvailable();
    await this.spawnGsrReplay();
    this.obsState = ERecordingState.Recording;
    this.emit('state-change');
  }

  public async startRecording(offset: number) {
    if (!this.process || !this.process.pid) {
      throw new Error(
        '[LinuxRecorder] Capture not started. Start Capture first.',
      );
    }

    const now = Date.now();
    this.pendingReplayOffsetSec = offset;
    this.pendingReplay =
      this.eventLog
        ?.waitFor('replay', now, 20_000)
        .catch((error) => {
          console.warn(
            '[LinuxRecorder] Failed to observe replay save event',
            String(error),
          );
          return null;
        }) ?? null;

    // Save replay pre-roll, then start regular recording.
    process.kill(this.process.pid, 'SIGUSR1');
    this.sendSigRtMin();
  }

  public async stop() {
    if (!this.process || !this.process.pid) {
      throw new Error('[LinuxRecorder] No active GSR process');
    }

    const now = Date.now();
    const regularPromise =
      this.eventLog
        ?.waitFor('regular', now, 30_000)
        .catch((error) => {
          console.warn(
            '[LinuxRecorder] Failed to observe regular recording save event',
            String(error),
          );
          return null;
        }) ?? null;

    // Stop regular recording (replay continues).
    this.sendSigRtMin();

    const regular = regularPromise ? await regularPromise : null;
    const replay = this.pendingReplay ? await this.pendingReplay : null;

    this.pendingReplay = null;
    this.pendingReplayOffsetSec = 0;

    if (!regular?.path) {
      throw new Error('[LinuxRecorder] No regular recording produced');
    }

    const combined = await this.buildCombinedActivityFile(
      replay?.path ?? null,
      regular.path,
    );

    this.lastFile = combined;

    // Clean up intermediate GSR outputs. The combined file will be cleaned by
    // the normal buffer cleanup after it is processed by VideoProcessQueue.
    await Promise.all([
      tryUnlink(regular.path),
      replay?.path ? tryUnlink(replay.path) : Promise.resolve(),
    ]);
  }

  public async forceStop(_timeout: boolean) {
    // For Linux MVP, treat "force stop" as "stop capture session". This matches
    // how the app uses forceStop for reconfiguration and suspend/resume.
    this.shutdownOBS();
  }

  public shutdownOBS() {
    this.desiredRunning = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.process?.pid) {
      try {
        this.process.kill('SIGINT');
      } catch {
        // Ignore.
      }
    }
    this.process = null;
    this.eventLog?.stop();
    this.eventLog = null;
    this.obsState = ERecordingState.None;
    this.emit('state-change');
  }

  public async cleanup(obsPath: string) {
    const cleanDir = async (dir: string) => {
      if (!(await exists(dir))) return;
      const videos = await getSortedFiles(
        dir,
        '.*\\.(mp4|mkv)',
        FileSortDirection.NewestFirst,
      );
      await Promise.all(videos.map((f) => tryUnlink(f.name)));
    };

    await Promise.all([
      cleanDir(obsPath),
      cleanDir(path.join(obsPath, 'replay')),
      cleanDir(path.join(obsPath, 'regular')),
      cleanDir(path.join(obsPath, 'staging')),
    ]);
  }

  public getSensibleEncoderDefault() {
    return 'obs_x264';
  }

  public getAndClearLastFile() {
    const file = this.lastFile;
    this.lastFile = null;
    return file;
  }

  public async saveReplayNow() {
    if (!this.process?.pid) {
      throw new Error('[LinuxRecorder] Capture not started. Start Capture first.');
    }

    const now = Date.now();
    const replayPromise = this.eventLog
      ?.waitFor('replay', now, 20_000)
      .catch((error) => {
        console.warn(
          '[LinuxRecorder] Failed to observe replay save event',
          String(error),
        );
        return null;
      });
    process.kill(this.process.pid, 'SIGUSR1');

    const replay = replayPromise ? await replayPromise : null;
    if (!replay?.path) {
      throw new Error('[LinuxRecorder] No replay file produced');
    }

    return replay.path;
  }

  private async ensureGsrAvailable() {
    try {
      const { spawnSync } = await import('child_process');
      const res = spawnSync('gpu-screen-recorder', ['--version'], {
        encoding: 'utf-8',
      });

      if (res.error) throw res.error;
      if (res.status !== 0) throw new Error(res.stderr || 'unknown error');
    } catch (error) {
      const msg =
        '[LinuxRecorder] gpu-screen-recorder not available in PATH: ' +
        String(error);
      emitErrorReport(msg);
      throw new Error(msg);
    }
  }

  private async spawnGsrReplay() {
    if (!this.baseConfig) throw new Error('[LinuxRecorder] Base config not set');
    const { obsPath, obsFPS } = this.baseConfig;
    const captureCursor = this.cfg.get<boolean>('captureCursor');

    const userData = (await import('electron')).app.getPath('userData');
    const tokenFile = path.join(userData, 'gsr-portal.token');
    const eventsFile = path.join(userData, 'gsr-events.tsv');
    const hookPath = path.join(userData, 'gsr-hook.sh');

    await this.writeHookScript(hookPath, eventsFile);

    this.eventLog = new GsrEventLog(eventsFile);
    await this.eventLog.start();

    const replayDir = path.join(obsPath, 'replay');
    const regularDir = path.join(obsPath, 'regular');

    const bufferSeconds = this.cfg.get<number>('linuxGsrBufferSeconds') ?? 180;
    const codec = this.cfg.get<string>('linuxGsrCodec') ?? 'h264';
    const bitrateKbps = this.cfg.get<number>('linuxGsrBitrateKbps') ?? 20000;
    const replayStorage = this.cfg.get<string>('linuxGsrReplayStorage') ?? 'ram';

    const args = [
      '-w',
      'portal',
      '-restore-portal-session',
      'yes',
      '-portal-session-token-filepath',
      tokenFile,
      '-r',
      String(bufferSeconds),
      '-replay-storage',
      replayStorage,
      '-restart-replay-on-save',
      'no',
      '-c',
      'mkv',
      '-f',
      String(obsFPS),
      '-bm',
      'cbr',
      '-q',
      String(bitrateKbps),
      '-k',
      codec,
      '-ac',
      'aac',
      '-cursor',
      captureCursor ? 'yes' : 'no',
      '-o',
      replayDir,
      '-ro',
      regularDir,
      '-sc',
      hookPath,
      '-v',
      'no',
    ];

    const outputAudio = this.cfg.has('linuxGsrAudioOutput')
      ? (this.cfg.get<string>('linuxGsrAudioOutput') ?? '')
      : (this.cfg.get<string>('linuxGsrAudio') ?? 'default_output');

    const inputAudio = this.cfg.has('linuxGsrAudioInput')
      ? (this.cfg.get<string>('linuxGsrAudioInput') ?? '')
      : '';

    const audioSources = [outputAudio, inputAudio].filter(Boolean);
    const uniqueAudioSources = Array.from(new Set(audioSources));

    if (uniqueAudioSources.length) {
      args.push('-a', uniqueAudioSources.join('|'));
    }

    console.info('[LinuxRecorder] Spawning gpu-screen-recorder', { args });

    const child = spawn('gpu-screen-recorder', args, {
      stdio: 'pipe',
      env: process.env,
    });

    child.stdout.on('data', (d) =>
      console.info('[LinuxRecorder] gsr stdout', String(d).trim()),
    );
    child.stderr.on('data', (d) =>
      console.warn('[LinuxRecorder] gsr stderr', String(d).trim()),
    );
    child.on('exit', (code, signal) => {
      console.warn('[LinuxRecorder] gsr exited', { code, signal });
      this.process = null;
      this.obsState = ERecordingState.None;
      this.emit('state-change');
      if (this.desiredRunning) {
        this.scheduleRestart();
      }
    });

    // Wait briefly for it to stay alive.
    // Avoid a Promise.race here: the losing promise can reject later and become
    // an unhandled rejection.
    await new Promise((r) => setTimeout(r, 500));

    if (child.exitCode !== null) {
      throw new Error(
        `[LinuxRecorder] gsr exited immediately with code ${child.exitCode}`,
      );
    }

    if (!child.pid) {
      throw new Error('[LinuxRecorder] Failed to start gsr (no pid)');
    }

    this.process = child;
  }

  private scheduleRestart() {
    if (this.restartTimer) return;
    if (!this.baseConfig) return;

    this.restartAttempts += 1;
    const delayMs = Math.min(30_000, 1000 * 2 ** Math.min(this.restartAttempts, 4));

    console.warn('[LinuxRecorder] Scheduling gsr restart', {
      attempt: this.restartAttempts,
      delayMs,
    });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      void this.restartCapture().catch((e) => {
        const msg = `[LinuxRecorder] Failed to restart capture: ${String(e)}`;
        console.error(msg);
        emitErrorReport(msg);
        if (this.desiredRunning) {
          this.scheduleRestart();
        }
      });
    }, delayMs);
  }

  private async restartCapture() {
    if (!this.desiredRunning) return;
    if (!this.baseConfig) return;
    if (this.obsState === ERecordingState.Recording) return;

    await this.ensureGsrAvailable();
    await this.spawnGsrReplay();
    this.obsState = ERecordingState.Recording;
    this.emit('state-change');
  }

  private async writeHookScript(hookPath: string, eventsFile: string) {
    const script = `#!/usr/bin/env bash
set -euo pipefail
filepath=\"$1\"
kind=\"$2\"
ts=$(date +%s%3N)
printf '%s\\t%s\\t%s\\n' \"$ts\" \"$kind\" \"$filepath\" >> \"${eventsFile}\"
`;

    await fs.promises.writeFile(hookPath, script, { encoding: 'utf-8' });
    await fs.promises.chmod(hookPath, 0o755);
  }

  private sendSigRtMin() {
    if (!this.process?.pid) {
      throw new Error('[LinuxRecorder] No GSR pid');
    }

    // Electron/Node does not always expose SIGRTMIN in `os.constants`, and may
    // not accept the string 'SIGRTMIN'. Resolve the numeric value from the OS.
    const sig = this.getSigRtMin();
    process.kill(this.process.pid, sig);
  }

  private getSigRtMin() {
    if (this.sigRtMin !== null) return this.sigRtMin;

    const res = spawnSync('bash', ['-lc', 'kill -l SIGRTMIN'], {
      encoding: 'utf-8',
    });

    const out = (res.stdout || '').trim();
    const parsed = Number(out);

    if (!Number.isFinite(parsed)) {
      throw new Error(
        `[LinuxRecorder] Failed to resolve SIGRTMIN (stdout="${out}", stderr="${String(
          res.stderr || '',
        ).trim()}")`,
      );
    }

    this.sigRtMin = parsed;
    return this.sigRtMin;
  }

  private async buildCombinedActivityFile(
    replayFile: string | null,
    regularFile: string,
  ) {
    if (!this.baseConfig) throw new Error('[LinuxRecorder] Base config not set');
    const staging = path.join(this.baseConfig.obsPath, 'staging');
    const combined = path.join(
      this.baseConfig.obsPath,
      `activity-${Date.now()}-${Math.random().toString(16).slice(2)}.mkv`,
    );

    if (!replayFile) {
      await fs.promises.copyFile(regularFile, combined);
      return combined;
    }

    const offset = Math.max(0, this.pendingReplayOffsetSec);
    const trimmedReplay = path.join(
      staging,
      `replay-trim-${Date.now()}-${Math.random().toString(16).slice(2)}.mkv`,
    );

    // Extract the last <offset> seconds of the replay without needing its duration.
    const leadSec = this.cfg.get<number>('linuxGsrLeadInSeconds') ?? 0;
    const wanted = Math.max(1, Math.round(offset + leadSec));

    const trimCmd = ffmpeg(replayFile)
      .inputOptions(['-sseof', `-${wanted}`])
      .withVideoCodec('copy')
      .withAudioCodec('copy')
      .outputOption('-avoid_negative_ts make_zero')
      .output(trimmedReplay);

    await this.ffmpegRun(trimCmd, 'Trim replay');

    const listFile = path.join(
      staging,
      `concat-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`,
    );

    const listContent = `file '${trimmedReplay.replace(/'/g, "'\\''")}'\nfile '${regularFile.replace(/'/g, "'\\''")}'\n`;
    await fs.promises.writeFile(listFile, listContent, { encoding: 'utf-8' });

    const concatCmd = ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .withVideoCodec('copy')
      .withAudioCodec('copy')
      .outputOption('-avoid_negative_ts make_zero')
      .output(combined);

    await this.ffmpegRun(concatCmd, 'Concat replay+regular');

    await Promise.all([tryUnlink(listFile), tryUnlink(trimmedReplay)]);

    return combined;
  }

  private async ffmpegRun(cmd: ffmpeg.FfmpegCommand, descr: string) {
    return new Promise<void>((resolve, reject) => {
      cmd
        .on('start', (c) => console.info('[LinuxRecorder] ffmpeg', descr, c))
        .on('error', (err) => {
          const msg = `[LinuxRecorder] ffmpeg failed (${descr}): ${String(err)}`;
          emitErrorReport(msg);
          reject(new Error(msg));
        })
        .on('end', () => resolve())
        .run();
    });
  }
}
