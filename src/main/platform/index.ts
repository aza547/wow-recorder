import NoobsBackend from './recorder/NoobsBackend';
import WinRustPsPoller from './poller/WinRustPsPoller';
import WinWowPathResolver from './paths/WinWowPathResolver';
import WinFileReveal from './files/WinFileReveal';
import WinFfmpegPathProvider from './ffmpeg/WinFfmpegPathProvider';

import type { IRecorderBackend } from './recorder/IRecorderBackend';
import type { IProcessPoller } from './poller/IProcessPoller';
import type { IWowPathResolver } from './paths/IWowPathResolver';
import type { IFileReveal } from './files/IFileReveal';
import type { IFfmpegPathProvider } from './ffmpeg/IFfmpegPathProvider';

export type {
  IRecorderBackend,
  IProcessPoller,
  IWowPathResolver,
  IFileReveal,
  IFfmpegPathProvider,
};
export type { RecorderCapabilities, SignalCallback } from './recorder/IRecorderBackend';
export type { WowFlavour } from './paths/IWowPathResolver';
export type {
  ObsData,
  ObsListItem,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from './recorder/types';

let recorderBackend: IRecorderBackend | undefined;
let processPoller: IProcessPoller | undefined;
let wowPathResolver: IWowPathResolver | undefined;
let fileReveal: IFileReveal | undefined;
let ffmpegPathProvider: IFfmpegPathProvider | undefined;

export function getRecorderBackend(): IRecorderBackend {
  if (!recorderBackend) recorderBackend = new NoobsBackend();
  return recorderBackend;
}

export function getProcessPoller(): IProcessPoller {
  if (!processPoller) processPoller = new WinRustPsPoller();
  return processPoller;
}

export function getWowPathResolver(): IWowPathResolver {
  if (!wowPathResolver) wowPathResolver = new WinWowPathResolver();
  return wowPathResolver;
}

export function getFileReveal(): IFileReveal {
  if (!fileReveal) fileReveal = new WinFileReveal();
  return fileReveal;
}

export function getFfmpegPathProvider(): IFfmpegPathProvider {
  if (!ffmpegPathProvider) ffmpegPathProvider = new WinFfmpegPathProvider();
  return ffmpegPathProvider;
}
