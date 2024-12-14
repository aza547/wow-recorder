import * as React from 'react';
import { configSchema } from 'main/configSchema';
import { AppState, DiskStatus, RecStatus } from 'main/types';
import { useEffect, useRef, useState } from 'react';
import { HardDrive, Info } from 'lucide-react';
import { getLocalePhrase, Phrase } from 'localisation/translations';
import { setConfigValues, useSettings } from './useSettings';
import { pathSelect } from './rendererutils';
import { Input } from './components/Input/Input';
import Label from './components/Label/Label';
import Switch from './components/Switch/Switch';
import { Tooltip } from './components/Tooltip/Tooltip';
import Progress from './components/Progress/Progress';
import TextBanner from './components/TextBanner/TextBanner';

interface IProps {
  recorderStatus: RecStatus;
  appState: AppState;
}

const ipc = window.electron.ipcRenderer;

const GeneralSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, appState } = props;
  const [config, setConfig] = useSettings();
  const initialRenderVideoConfig = useRef(true);

  const [diskStatus, setDiskStatus] = useState<DiskStatus>({
    usageGB: 0,
    maxUsageGB: 0,
  });

  React.useEffect(() => {
    ipc.on('updateDiskStatus', (status) => {
      setDiskStatus(status as DiskStatus);
    });
  }, []);

  useEffect(() => {
    // Populate the progress bar on initial mount, and also on config
    // change; the user could change cloud accounts.
    ipc.sendMessage('getDiskStatus', []);

    if (initialRenderVideoConfig.current) {
      // Drop out if initial render, we don't care about settings
      // changes until the user has had a chance to make some.
      initialRenderVideoConfig.current = false;
      return;
    }

    setConfigValues({
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      separateBufferPath: config.separateBufferPath,
      maxStorage: config.maxStorage,
    });

    // Inform the backend of a settings change so we can update config
    // and validate it's good.
    ipc.sendMessage('settingsChange', []);
  }, [
    config.separateBufferPath,
    config.storagePath,
    config.bufferStoragePath,
    config.maxStorage,
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
        These settings cannot be modified while a recording is active.
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
      <div className="flex flex-col">
        <Label htmlFor="storagePath" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.DiskStorageFolderLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.storagePath.description
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
          <span className="text-error text-sm">Must not be empty</span>
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
          {getLocalePhrase(appState.language, Phrase.SeparateBufferFolderLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.separateBufferPath.description
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
          {getLocalePhrase(appState.language, Phrase.BufferFolderLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.bufferStoragePath.description
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
    const inputValue = event.target.value;
    const parsedValue = parseInt(inputValue, 10);

    setConfig((prevState) => {
      return {
        ...prevState,
        maxStorage: Number.isNaN(parsedValue) ? 0 : parsedValue,
      };
    });
  };

  const getMaxStorageField = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/3 min-w-60 max-w-80">
        <Label htmlFor="maxDiskStorage" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.MaxDiskStorageLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.maxStorage.description
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="maxDiskStorage"
          value={config.maxStorage}
          onChange={setMaxStorage}
          required
          type="numeric"
          disabled={isComponentDisabled()}
        />
      </div>
    );
  };

  const getDiskUsageBar = () => {
    const usage = Math.round(diskStatus.usageGB);
    const max = Math.round(diskStatus.maxUsageGB);
    let perc = max === 0 ? 100 : (100 * usage) / max;
    if (perc > 100) perc = 100;
    const text =
      max === 0 ? `${usage}GB of Unlimited` : `${usage}GB of ${max}GB`;

    return (
      <div className="flex flex-row items-center justify-start w-1/3 min-w-80 max-w-120 gap-x-2">
        <Tooltip content="Disk usage">
          <HardDrive />
        </Tooltip>
        <Progress value={perc} className="h-3" />
        <span className="text-[11px] text-foreground font-semibold whitespace-nowrap">
          {text}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-6">
      {getDisabledText()}
      <div className="flex flex-row gap-x-6">
        {getStoragePathField()}
        {getBufferSwitch()}
      </div>
      {getBufferPathField()}
      {getMaxStorageField()}
      {getDiskUsageBar()}
    </div>
  );
};

export default GeneralSettings;
