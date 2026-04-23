import NoobsBackend from './recorder/NoobsBackend';
import OsnBackend from './recorder/OsnBackend';

import WinRustPsPoller from './poller/WinRustPsPoller';
import MacPgrepPoller from './poller/MacPgrepPoller';

import WinWowPathResolver from './paths/WinWowPathResolver';
import MacWowPathResolver from './paths/MacWowPathResolver';

import WinFileReveal from './files/WinFileReveal';
import MacFileReveal from './files/MacFileReveal';

import WinFfmpegPathProvider from './ffmpeg/WinFfmpegPathProvider';
import MacFfmpegPathProvider from './ffmpeg/MacFfmpegPathProvider';

import WinPermissionsGate from './permissions/WinPermissionsGate';
import MacTccGate from './permissions/MacTccGate';

import type { IRecorderBackend } from './recorder/IRecorderBackend';
import type { IProcessPoller } from './poller/IProcessPoller';
import type { IWowPathResolver } from './paths/IWowPathResolver';
import type { IFileReveal } from './files/IFileReveal';
import type { IFfmpegPathProvider } from './ffmpeg/IFfmpegPathProvider';
import type { IPermissionsGate } from './permissions/IPermissionsGate';

export type {
  IRecorderBackend,
  IProcessPoller,
  IWowPathResolver,
  IFileReveal,
  IFfmpegPathProvider,
  IPermissionsGate,
};
export type {
  BackendInitOptions,
  RecorderCapabilities,
  SignalCallback,
} from './recorder/IRecorderBackend';
export { CaptureModeCapability } from './recorder/IRecorderBackend';
export type { WowFlavour } from './paths/IWowPathResolver';
export type {
  PermissionStatus,
  PermissionKey,
  PermissionsSnapshot,
} from './permissions/IPermissionsGate';
export type {
  ObsData,
  ObsListItem,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from './recorder/types';

const isMac = process.platform === 'darwin';

let recorderBackend: IRecorderBackend | undefined;
let processPoller: IProcessPoller | undefined;
let wowPathResolver: IWowPathResolver | undefined;
let fileReveal: IFileReveal | undefined;
let ffmpegPathProvider: IFfmpegPathProvider | undefined;
let permissionsGate: IPermissionsGate | undefined;

export function getRecorderBackend(): IRecorderBackend {
  if (!recorderBackend) {
    recorderBackend = isMac ? new OsnBackend() : new NoobsBackend();
  }
  return recorderBackend;
}

export function getProcessPoller(): IProcessPoller {
  if (!processPoller) {
    processPoller = isMac ? new MacPgrepPoller() : new WinRustPsPoller();
  }
  return processPoller;
}

export function getWowPathResolver(): IWowPathResolver {
  if (!wowPathResolver) {
    wowPathResolver = isMac
      ? new MacWowPathResolver()
      : new WinWowPathResolver();
  }
  return wowPathResolver;
}

export function getFileReveal(): IFileReveal {
  if (!fileReveal) {
    fileReveal = isMac ? new MacFileReveal() : new WinFileReveal();
  }
  return fileReveal;
}

export function getFfmpegPathProvider(): IFfmpegPathProvider {
  if (!ffmpegPathProvider) {
    ffmpegPathProvider = isMac
      ? new MacFfmpegPathProvider()
      : new WinFfmpegPathProvider();
  }
  return ffmpegPathProvider;
}

export function getPermissionsGate(): IPermissionsGate {
  if (!permissionsGate) {
    permissionsGate = isMac ? new MacTccGate() : new WinPermissionsGate();
  }
  return permissionsGate;
}
