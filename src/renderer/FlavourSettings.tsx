import { ConfigurationSchema, configSchema } from 'config/configSchema';
import React, { Dispatch, SetStateAction } from 'react';
import { AppState, RecStatus } from 'main/types';
import { Info } from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues } from './useSettings';
import { pathSelect } from './rendererutils';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Input } from './components/Input/Input';
import { Tooltip } from './components/Tooltip/Tooltip';
import TextBanner from './components/TextBanner/TextBanner';
import { Phrase } from 'localisation/phrases';

interface IProps {
  recorderStatus: RecStatus;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
  appState: AppState;
}

const ipc = window.electron.ipcRenderer;

const FlavourSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, config, setConfig, appState } = props;
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      recordRetail: config.recordRetail,
      retailLogPath: config.retailLogPath,
      recordClassic: config.recordClassic,
      classicLogPath: config.classicLogPath,
      recordEra: config.recordEra,
      eraLogPath: config.eraLogPath,
      recordRetailPtr: config.recordRetailPtr,
      retailPtrLogPath: config.retailPtrLogPath,
    });

    ipc.reconfigureBase();
  }, [
    config.recordRetail,
    config.recordClassic,
    config.retailLogPath,
    config.classicLogPath,
    config.recordEra,
    config.eraLogPath,
    config.recordRetailPtr,
    config.retailPtrLogPath,
  ]);

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
        {getLocalePhrase(appState.language, Phrase.SettingsDisabledText)}
      </TextBanner>
    );
  };

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (checked: boolean) => void,
  ) => (
    <Switch
      checked={Boolean(config[preference])}
      name={preference}
      onCheckedChange={changeFn}
    />
  );

  const setRecordRetail = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordRetail: checked,
      };
    });
  };

  const setRecordClassic = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordClassic: checked,
      };
    });
  };

  const setRetailLogPath = async () => {
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
        retailLogPath: newPath,
      };
    });
  };

  const getRetailSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[140px]">
          <Label htmlFor="recordRetail" className="flex items-center">
            {getLocalePhrase(appState.language, Phrase.RecordRetailLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.recordRetail.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordRetail', setRecordRetail)}
          </div>
        </div>
        {config.recordRetail && (
          <div className="flex flex-col w-1/2">
            <Label htmlFor="retailLogPath" className="flex items-center">
              {getLocalePhrase(appState.language, Phrase.RetailLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  configSchema.retailLogPath.description,
                )}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              value={config.retailLogPath}
              onClick={setRetailLogPath}
              readOnly
              required
            />
            {config.retailLogPath === '' && (
              <span className="text-error text-sm">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidRetailLogPathText,
                )}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const setClassicLogPath = async () => {
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
        classicLogPath: newPath,
      };
    });
  };

  const getClassicSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[140px]">
          <Label htmlFor="recordClassic" className="flex items-center">
            {getLocalePhrase(appState.language, Phrase.RecordClassicLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.recordClassic.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordClassic', setRecordClassic)}
          </div>
        </div>
        {config.recordClassic && (
          <div className="flex flex-col w-1/2">
            <Label htmlFor="classicLogPath" className="flex items-center">
              {getLocalePhrase(appState.language, Phrase.ClassicLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  configSchema.classicLogPath.description,
                )}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              value={config.classicLogPath}
              onClick={setClassicLogPath}
              readOnly
              required
            />
            {config.classicLogPath === '' && (
              <span className="text-error text-sm">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidClassicLogPathText,
                )}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const setRecordEra = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordEra: checked,
      };
    });
  };

  const setEraLogPath = async () => {
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
        eraLogPath: newPath,
      };
    });
  };

  const getEraSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[140px]">
          <Label htmlFor="recordEra" className="flex items-center">
            {getLocalePhrase(appState.language, Phrase.RecordClassicEraLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.recordEra.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordEra', setRecordEra)}
          </div>
        </div>
        {config.recordEra && (
          <div className="flex flex-col w-1/2">
            <Label htmlFor="eraLogPath" className="flex items-center">
              {getLocalePhrase(
                appState.language,
                Phrase.ClassicEraLogPathLabel,
              )}
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  configSchema.eraLogPath.description,
                )}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              value={config.eraLogPath}
              onClick={setEraLogPath}
              readOnly
              required
            />
            {config.eraLogPath === '' && (
              <span className="text-error text-xs font-semibold mt-1">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidClassicEraLogPathText,
                )}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const setRecordRetailPtr = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordRetailPtr: checked,
      };
    });
  };

  const setRetailPtrLogPath = async () => {
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
        retailPtrLogPath: newPath,
      };
    });
  };

  const getRetailPtrSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[140px]">
          <Label htmlFor="recordRetailPtr" className="flex items-center">
            {getLocalePhrase(appState.language, Phrase.RecordRetailPtrLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.recordRetailPtr.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordRetailPtr', setRecordRetailPtr)}
          </div>
        </div>
        {config.recordRetailPtr && (
          <div className="flex flex-col w-1/2">
            <Label htmlFor="retailPtrLogPath" className="flex items-center">
              {getLocalePhrase(appState.language, Phrase.RetailPtrLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  configSchema.retailPtrLogPath.description,
                )}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              value={config.retailPtrLogPath}
              onClick={setRetailPtrLogPath}
              readOnly
              required
            />
            {config.retailPtrLogPath === '' && (
              <span className="text-error text-xs font-semibold mt-1">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidRetailPtrLogPathText,
                )}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-2">
      {getDisabledText()}
      {getRetailSettings()}
      {getClassicSettings()}
      {getEraSettings()}
      {getRetailPtrSettings()}
    </div>
  );
};

export default FlavourSettings;
