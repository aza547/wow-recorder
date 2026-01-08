import { EventEmitter } from 'events';
import type { RecorderImpl } from './types';

export default class Recorder extends EventEmitter {
  private static instance: Recorder;

  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  private impl: RecorderImpl;

  private constructor() {
    super();
    this.impl =
      process.platform === 'linux'
        ? // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('./LinuxRecorder').default.getInstance()
        : // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('../Recorder').default.getInstance();

    this.impl.on?.('state-change', (...args: unknown[]) => {
      this.emit('state-change', ...args);
    });
  }

  public get obsState() {
    return this.impl.obsState;
  }

  public get obsMicState() {
    return this.impl.obsMicState;
  }

  public get lastFile() {
    return this.impl.lastFile;
  }

  public initializeObs() {
    return this.impl.initializeObs();
  }

  public shutdownOBS() {
    return this.impl.shutdownOBS();
  }

  public configureBase(...args: Parameters<RecorderImpl['configureBase']>) {
    return this.impl.configureBase(...args);
  }

  public configureVideoSources(
    ...args: Parameters<RecorderImpl['configureVideoSources']>
  ) {
    return this.impl.configureVideoSources(...args);
  }

  public configureAudioSources(
    ...args: Parameters<RecorderImpl['configureAudioSources']>
  ) {
    return this.impl.configureAudioSources(...args);
  }

  public configureOverlayImageSource(
    ...args: Parameters<RecorderImpl['configureOverlayImageSource']>
  ) {
    return this.impl.configureOverlayImageSource(...args);
  }

  public attachCaptureSource() {
    return this.impl.attachCaptureSource();
  }

  public clearFindWindowInterval() {
    return this.impl.clearFindWindowInterval();
  }

  public removeAudioSources() {
    return this.impl.removeAudioSources();
  }

  public startBuffer() {
    return this.impl.startBuffer();
  }

  public startRecording(offset: number) {
    return this.impl.startRecording(offset);
  }

  public stop() {
    return this.impl.stop();
  }

  public forceStop(timeout: boolean) {
    return this.impl.forceStop(timeout);
  }

  public cleanup(obsPath: string) {
    return this.impl.cleanup(obsPath);
  }

  public getSensibleEncoderDefault() {
    return this.impl.getSensibleEncoderDefault();
  }

  public getAndClearLastFile() {
    return this.impl.getAndClearLastFile();
  }

  public async saveReplayNow() {
    if (!this.impl.saveReplayNow) {
      throw new Error('Replay save is not supported on this platform.');
    }
    return this.impl.saveReplayNow();
  }
}
