import * as React from 'react';
import { configSchema } from 'config/configSchema';
import { AppState, RecStatus } from 'main/types';
import { useEffect, useRef, useState } from 'react';
import { HardDrive, History, Info } from 'lucide-react';
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

interface IProps {
  recorderStatus: RecStatus;
  replayBufferSeconds: number;
  appState: AppState;
}

const ipc = window.electron.ipcRenderer;
let debounceTimeout: NodeJS.Timeout | null;

const minReplayBufferSecs = configSchema.customReplayBufferLength.minimum;
const maxReplayBufferSecs = configSchema.customReplayBufferLength.maximum;

const GeneralSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, replayBufferSeconds, appState } = props;
  const { language } = appState;
  const [config, setConfig] = useSettings();

  const initialRender = useRef(true);

  // Local string state so the user can freely edit the field (e.g. clear it
  // to retype), only committed to the config on blur.
  const [innerMaxStorage, setInnerMaxStorage] = useState<string>(
    String(config.maxStorage),
  );

  const [innerBufferSecs, setInnerBufferSecs] = useState<string>(
    String(config.customReplayBufferLength),
  );

  useEffect(() => {
    if (initialRender.current) {
      // Drop out if initial render, we don't care about settings
      // changes until the user has had a chance to make some.
      initialRender.current = false;
      return;
    }

    setConfigValues({
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      separateBufferPath: config.separateBufferPath,
      maxStorage: config.maxStorage,
      storageLimit: config.storageLimit,
      customReplayBuffer: config.customReplayBuffer,
      customReplayBufferLength: config.customReplayBufferLength,
    });

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
    config.storageLimit,
    config.customReplayBuffer,
    config.customReplayBufferLength,
  ]);

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

  const parseBufferSecs = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = parseInt(trimmed, 10);
    const valid =
      parsed >= minReplayBufferSecs && parsed <= maxReplayBufferSecs;
    return valid ? parsed : null;
  };

  const onBlurBufferSecs = () => {
    const secs = parseBufferSecs(innerBufferSecs);

    if (secs === null) {
      setInnerBufferSecs(String(config.customReplayBufferLength));
      return;
    }

    setInnerBufferSecs(String(secs));

    setConfig((prevState) => {
      return { ...prevState, customReplayBufferLength: secs };
    });
  };

  const onKeyDownBufferSecs = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const getReplayBufferField = () => {
    if (isComponentDisabled() || !config.customReplayBuffer) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-40">
        <Label htmlFor="replayBufferSecs" className="flex items-center">
          {getLocalePhrase(language, Phrase.ReplayBufferLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.customReplayBufferLength.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="replayBufferSecs"
          value={innerBufferSecs}
          onChange={(e) => setInnerBufferSecs(e.target.value)}
          onBlur={onBlurBufferSecs}
          onKeyDown={onKeyDownBufferSecs}
          inputMode="numeric"
          required
          disabled={isComponentDisabled()}
        />
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

  const parseMaxStorage = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = parseInt(trimmed, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const setMaxStorage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInnerMaxStorage(event.target.value);
  };

  const onBlurMaxStorage = () => {
    const maxStorage = parseMaxStorage(innerMaxStorage);

    if (maxStorage === null) {
      // Invalid input, revert to the last committed value.
      setInnerMaxStorage(String(config.maxStorage));
      return;
    }

    setConfig((prevState) => {
      return { ...prevState, maxStorage };
    });
  };

  const onKeyDownMaxStorage = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const getMaxStorageField = () => {
    if (isComponentDisabled() || !config.storageLimit) {
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
          value={innerMaxStorage}
          onChange={setMaxStorage}
          onBlur={onBlurMaxStorage}
          onKeyDown={onKeyDownMaxStorage}
          inputMode="numeric"
          required
          disabled={isComponentDisabled()}
        />
      </div>
    );
  };

  const setCustomReplayBuffer = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        customReplayBuffer: checked,
      };
    });
  };

  const getCustomReplayBufferSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col">
        <Label htmlFor="customReplayBuffer" className="flex items-center">
          {getLocalePhrase(language, Phrase.CustomReplayBufferLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.customReplayBuffer.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={Boolean(config.customReplayBuffer)}
            id="customReplayBuffer"
            name="customReplayBuffer"
            onCheckedChange={setCustomReplayBuffer}
          />
        </div>
      </div>
    );
  };

  const getReplayBufferUsageBar = () => {
    const max = config.customReplayBuffer
      ? config.customReplayBufferLength
      : configSchema.customReplayBufferLength.default;

    const usage = Math.min(replayBufferSeconds, max);
    const perc = max > 0 ? (100 * usage) / max : 0;
    const text = `${usage}s / ${max}s`;

    return (
      <div className="flex-col">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.ActiveReplayBufferLabel)}
        </Label>

        <div className="flex flex-row items-center justify-start w-80 gap-x-2 py-2">
          <History size={24} className="text-foreground-lighter" />

          <Progress value={perc} className="h-3" />
          <span className="text-[11px] text-foreground font-semibold whitespace-nowrap">
            {text}
          </span>
        </div>
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
          <HardDrive size={24} className="text-foreground-lighter" />
          <Progress value={perc} className="h-3" />
          <span className="text-[11px] text-foreground font-semibold whitespace-nowrap">
            {text}
          </span>
        </div>
      </div>
    );
  };

  const setStorageLimit = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        storageLimit: checked,
      };
    });
  };

  const getStorageLimitSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col">
        <Label htmlFor="storageLimit" className="flex items-center">
          {getLocalePhrase(language, Phrase.StorageLimitLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.storageLimit.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch
            checked={Boolean(config.storageLimit)}
            id="storageLimit"
            name="storageLimit"
            onCheckedChange={setStorageLimit}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-6">
      {getDisabledText()}
      {getStoragePathField()}

      <div className="flex flex-row items-center gap-x-10">
        {getStorageLimitSwitch()}
        {getMaxStorageField()}
        {getDiskUsageBar()}
      </div>

      <div className="flex flex-row items-center gap-x-10">
        {getCustomReplayBufferSwitch()}
        {getReplayBufferField()}
        {getReplayBufferUsageBar()}
      </div>

      <div className="flex flex-row items-center gap-x-10">
        {getBufferSwitch()}
        {getBufferPathField()}
      </div>
    </div>
  );
};

export default GeneralSettings;
