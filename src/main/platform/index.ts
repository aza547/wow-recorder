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

/**
 * Platform impls are lazy-required so the wrong-platform file never loads.
 * NoobsBackend on mac would trigger a runtime `require('noobs')` — which
 * resolves to an unbuilt native module there. OsnBackend on Windows would
 * similarly try to pull in `obs-studio-node`. Keeping the imports conditional
 * means only the correct backend module is ever evaluated.
 */

export function getRecorderBackend(): IRecorderBackend {
  if (!recorderBackend) {
    if (isMac) {
      const MacNoobsBackend = require('./recorder/MacNoobsBackend').default;
      recorderBackend = new MacNoobsBackend();
    } else {
      const NoobsBackend = require('./recorder/NoobsBackend').default;
      recorderBackend = new NoobsBackend();
    }
  }
  return recorderBackend as IRecorderBackend;
}

export function getProcessPoller(): IProcessPoller {
  if (!processPoller) {
    if (isMac) {
      const MacPgrepPoller = require('./poller/MacPgrepPoller').default;
      processPoller = new MacPgrepPoller();
    } else {
      const WinRustPsPoller = require('./poller/WinRustPsPoller').default;
      processPoller = new WinRustPsPoller();
    }
  }
  return processPoller as IProcessPoller;
}

export function getWowPathResolver(): IWowPathResolver {
  if (!wowPathResolver) {
    if (isMac) {
      const MacWowPathResolver = require('./paths/MacWowPathResolver').default;
      wowPathResolver = new MacWowPathResolver();
    } else {
      const WinWowPathResolver = require('./paths/WinWowPathResolver').default;
      wowPathResolver = new WinWowPathResolver();
    }
  }
  return wowPathResolver as IWowPathResolver;
}

export function getFileReveal(): IFileReveal {
  if (!fileReveal) {
    if (isMac) {
      const MacFileReveal = require('./files/MacFileReveal').default;
      fileReveal = new MacFileReveal();
    } else {
      const WinFileReveal = require('./files/WinFileReveal').default;
      fileReveal = new WinFileReveal();
    }
  }
  return fileReveal as IFileReveal;
}

export function getFfmpegPathProvider(): IFfmpegPathProvider {
  if (!ffmpegPathProvider) {
    if (isMac) {
      const MacFfmpegPathProvider =
        require('./ffmpeg/MacFfmpegPathProvider').default;
      ffmpegPathProvider = new MacFfmpegPathProvider();
    } else {
      const WinFfmpegPathProvider =
        require('./ffmpeg/WinFfmpegPathProvider').default;
      ffmpegPathProvider = new WinFfmpegPathProvider();
    }
  }
  return ffmpegPathProvider as IFfmpegPathProvider;
}

export function getPermissionsGate(): IPermissionsGate {
  if (!permissionsGate) {
    if (isMac) {
      const MacTccGate = require('./permissions/MacTccGate').default;
      permissionsGate = new MacTccGate();
    } else {
      const WinPermissionsGate =
        require('./permissions/WinPermissionsGate').default;
      permissionsGate = new WinPermissionsGate();
    }
  }
  return permissionsGate as IPermissionsGate;
}
