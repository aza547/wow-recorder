import * as React from 'react';
import { configSchema } from 'config/configSchema';
import { AppState, RecStatus } from 'main/types';
import { useEffect, useRef } from 'react';
import { HardDrive, Info } from 'lucide-react';
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
  appState: AppState;
}

const ipc = window.electron.ipcRenderer;

const GeneralSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, appState } = props;
  const { language } = appState;
  const [config, setConfig] = useSettings();
  const initialRenderVideoConfig = useRef(true);

  useEffect(() => {
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
      <div className="flex flex-col">
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
      <div className="flex flex-col w-1/3 min-w-60 max-w-80">
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

        <div className="flex flex-row items-center justify-start w-1/3 min-w-80 max-w-120 gap-x-2">
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
