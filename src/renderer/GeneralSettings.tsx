import * as React from 'react';
import { configSchema } from 'config/configSchema';
import {
  AppState,
  MacOSPermissionState,
  MacOSPermissionTarget,
  MacOSPermissions,
  RecStatus,
} from 'main/types';
import { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  HardDrive,
  Info,
  RefreshCcw,
} from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues, useSettings } from './useSettings';
import { pathSelect } from './rendererutils';
import { Input } from './components/Input/Input';
import Label from './components/Label/Label';
import Switch from './components/Switch/Switch';
import { Tooltip } from './components/Tooltip/Tooltip';
import Progress from './components/Progress/Progress';
import TextBanner from './components/TextBanner/TextBanner';
import { Phrase } from 'localisation/phrases';
import { Button } from './components/Button/Button';

interface IProps {
  recorderStatus: RecStatus;
  appState: AppState;
}

const ipc = window.electron.ipcRenderer;
let debounceTimeout: NodeJS.Timeout | null;

const GeneralSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, appState } = props;
  const { language } = appState;
  const [config, setConfig] = useSettings();
  const [macOSPermissions, setMacOSPermissions] =
    React.useState<MacOSPermissions | null>(null);
  const initialRenderVideoConfig = useRef(true);

  const refreshMacOSPermissions = React.useCallback(async () => {
    const permissions = await ipc.getMacOSPermissions();
    setMacOSPermissions(permissions);
  }, []);

  useEffect(() => {
    refreshMacOSPermissions();
  }, [refreshMacOSPermissions]);

  useEffect(() => {
    if (initialRenderVideoConfig.current) {
      // Drop out if initial render, we don't care about settings
      // changes until the user has had a chance to make some.
      initialRenderVideoConfig.current = false;
      return;
    }

    const toSet: Record<string, unknown> = {
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      separateBufferPath: config.separateBufferPath,
    };

    if (config.maxStorage >= 0) {
      toSet.maxStorage = config.maxStorage;
    }

    setConfigValues(toSet);

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(() => {
      ipc.reconfigureBase();
    }, 500);
  }, [
    config.separateBufferPath,
    config.storagePath,
    config.bufferStoragePath,
    config.maxStorage,
  ]);

  const requestMacOSPermission = async (target: MacOSPermissionTarget) => {
    const permissions = await ipc.requestMacOSPermission(target);
    setMacOSPermissions(permissions);
  };

  const requestMissingMacOSPermissions = async () => {
    if (!macOSPermissions) {
      return;
    }

    let permissions = macOSPermissions;
    const missing: Array<{
      status: MacOSPermissionState | boolean;
      target: MacOSPermissionTarget;
    }> = [
      { status: permissions.screen, target: 'screen' },
      { status: permissions.microphone, target: 'microphone' },
      { status: permissions.accessibility, target: 'accessibility' },
    ];

    for (const permission of missing) {
      if (permissionGranted(permission.status)) {
        continue;
      }

      permissions = await ipc.requestMacOSPermission(permission.target);
    }

    setMacOSPermissions(permissions);
  };

  const openMacOSPermissionSettings = async (target: MacOSPermissionTarget) => {
    await ipc.openMacOSPermissionSettings(target);
    await refreshMacOSPermissions();
  };

  const setSeparateBufferPath = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        bufferStoragePath: '',
        separateBufferPath: checked,
      };
    });
  };

  const isComponentDisabled = () => {
    const isRecording = recorderStatus === RecStatus.Recording;
    const isOverrunning = recorderStatus === RecStatus.Overrunning;
    return isRecording || isOverrunning;
  };

  const getDisabledText = () => {
    if (!isComponentDisabled()) {
      return <></>;
    }

    return (
      <TextBanner>
        {getLocalePhrase(language, Phrase.SettingsDisabledText)}
      </TextBanner>
    );
  };

  const setStoragePath = async () => {
    const newPath = await pathSelect();

    if (newPath === '') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        storagePath: newPath,
      };
    });
  };

  const getStoragePathField = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[500px]">
        <Label htmlFor="storagePath" className="flex items-center">
          {getLocalePhrase(language, Phrase.DiskStorageFolderLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.storagePath.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="storagePath"
          value={config.storagePath}
          onClick={setStoragePath}
          required
          disabled={isComponentDisabled()}
          readOnly
        />
        {config.storagePath === '' && (
          <span className="text-error text-sm">
            {getLocalePhrase(language, Phrase.MustNotBeEmpty)}
          </span>
        )}
      </div>
    );
  };

  const setBufferPath = async () => {
    if (isComponentDisabled()) {
      return;
    }

    const newPath = await pathSelect();

    if (newPath === '') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        bufferStoragePath: newPath,
      };
    });
  };

  const getBufferSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col">
        <Label htmlFor="separateBufferPath" className="flex items-center">
          {getLocalePhrase(language, Phrase.SeparateBufferFolderLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.separateBufferPath.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={Boolean(config.separateBufferPath)}
            name="separateBufferPath"
            onCheckedChange={setSeparateBufferPath}
          />
        </div>
      </div>
    );
  };

  const getBufferPathField = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    if (!config.separateBufferPath) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/3 min-w-60 max-w-80">
        <Label htmlFor="bufferStoragePath" className="flex items-center">
          {getLocalePhrase(language, Phrase.BufferFolderLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.bufferStoragePath.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="bufferStoragePath"
          value={config.bufferStoragePath}
          onClick={setBufferPath}
          required
          disabled={isComponentDisabled()}
          readOnly
        />
      </div>
    );
  };

  const setMaxStorage = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      // Allow setting empty as midpoint.
      setConfig((prev) => ({ ...prev, maxStorage: -1 }));
      return;
    }

    const maxStorage = parseInt(event.target.value, 10);

    if (Number.isNaN(maxStorage) || maxStorage < 0) {
      // Block invalid config.
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        maxStorage,
      };
    });
  };

  const getMaxStorageField = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-40">
        <Label htmlFor="maxDiskStorage" className="flex items-center">
          {getLocalePhrase(language, Phrase.MaxDiskStorageLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.maxStorage.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="maxDiskStorage"
          value={config.maxStorage >= 0 ? config.maxStorage : ''}
          onChange={setMaxStorage}
          required
          type="numeric"
          disabled={isComponentDisabled()}
        />
      </div>
    );
  };

  const getDiskUsageBar = () => {
    const usage = Math.round(appState.diskStatus.usage / 1024 ** 3);
    const max = Math.round(appState.diskStatus.limit / 1024 ** 3);
    let perc = max === 0 ? 100 : (100 * usage) / max;
    if (perc > 100) perc = 100;
    const text = max === 0 ? `${usage}GB / ∞` : `${usage}GB / ${max}GB`;

    return (
      <div className="flex-col">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.DiskUsageDescription)}
        </Label>

        <div className="flex flex-row items-center justify-start w-80 gap-x-2 py-2">
          <Tooltip
            content={getLocalePhrase(language, Phrase.DiskUsageDescription)}
          >
            <HardDrive size={24} className="text-foreground-lighter" />
          </Tooltip>
          <Progress value={perc} className="h-3" />
          <span className="text-[11px] text-foreground font-semibold whitespace-nowrap">
            {text}
          </span>
        </div>
      </div>
    );
  };

  const getPermissionStatusLabel = (status: MacOSPermissionState | boolean) => {
    if (status === true || status === 'granted') return 'Granted';
    if (status === false) return 'Missing';
    if (status === 'not-determined') return 'Not requested';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const permissionGranted = (status: MacOSPermissionState | boolean) =>
    status === true || status === 'granted';

  const getPermissionRow = (
    target: MacOSPermissionTarget,
    label: string,
    detail: string,
    status: MacOSPermissionState | boolean,
  ) => {
    const granted = permissionGranted(status);

    return (
      <div
        key={target}
        className="flex min-h-10 items-center justify-between gap-x-4 border-t border-card py-2 first:border-t-0"
      >
        <div className="flex min-w-0 items-center gap-x-2">
          {granted ? (
            <CheckCircle2 size={18} className="shrink-0 text-success" />
          ) : (
            <AlertTriangle size={18} className="shrink-0 text-error" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground-lighter">
              {label}
            </div>
            <div className="text-xs text-foreground-lighter/80">{detail}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-x-2">
          <span className="min-w-24 text-right text-xs font-semibold text-foreground-lighter">
            {getPermissionStatusLabel(status)}
          </span>
          {!granted && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => requestMacOSPermission(target)}
            >
              <CheckCircle2 size={14} className="mr-1" />
              Request
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => openMacOSPermissionSettings(target)}
          >
            <ExternalLink size={14} className="mr-1" />
            Settings
          </Button>
        </div>
      </div>
    );
  };

  const getMacOSPermissionPanel = () => {
    if (!macOSPermissions?.supported) {
      return <></>;
    }

    return (
      <div className="flex w-full max-w-4xl flex-col rounded-md border border-card p-3">
        <div className="mb-2 flex items-center justify-between gap-x-4">
          <Label className="mb-0 flex items-center">macOS Permissions</Label>
          <div className="flex items-center gap-x-2">
            <Button
              size="xs"
              variant="outline"
              onClick={requestMissingMacOSPermissions}
            >
              <CheckCircle2 size={14} className="mr-1" />
              Request Missing
            </Button>
            <Button size="xs" variant="ghost" onClick={refreshMacOSPermissions}>
              <RefreshCcw size={14} className="mr-1" />
              Refresh
            </Button>
          </div>
        </div>
        {getPermissionRow(
          'screen',
          'Screen Recording',
          'Needed for display and window capture',
          macOSPermissions.screen,
        )}
        {getPermissionRow(
          'microphone',
          'Microphone',
          'Needed for microphone sources and push-to-talk',
          macOSPermissions.microphone,
        )}
        {getPermissionRow(
          'accessibility',
          'Accessibility',
          'Needed for global hotkeys',
          macOSPermissions.accessibility,
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-6">
      {getDisabledText()}
      {getMacOSPermissionPanel()}
      {getStoragePathField()}

      <div className="flex flex-row items-center gap-x-10">
        {getMaxStorageField()}
        {getDiskUsageBar()}
      </div>

      <div className="flex flex-row items-center gap-x-10">
        {getBufferSwitch()}
        {getBufferPathField()}
      </div>
    </div>
  );
};

export default GeneralSettings;
