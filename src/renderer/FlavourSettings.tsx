import { ConfigurationSchema, configSchema } from 'main/configSchema';
import React from 'react';
import { RecStatus } from 'main/types';
import { Info } from 'lucide-react';
import { setConfigValues, useSettings } from './useSettings';
import { pathSelect } from './rendererutils';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Input } from './components/Input/Input';
import { Tooltip } from './components/Tooltip/Tooltip';
import TextBanner from './components/TextBanner/TextBanner';

interface IProps {
  recorderStatus: RecStatus;
}

const ipc = window.electron.ipcRenderer;

const FlavourSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;
  const [config, setConfig] = useSettings();
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
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.recordRetail,
    config.recordClassic,
    config.retailLogPath,
    config.classicLogPath,
    config.recordEra,
    config.eraLogPath,
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
        These settings cannot be modified while a recording is active.
      </TextBanner>
    );
  };

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (checked: boolean) => void
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
            Record Retail
            <Tooltip content={configSchema.recordRetail.description} side="top">
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordRetail', setRecordRetail)}
          </div>
        </div>
        {config.recordRetail && (
          <div className="flex flex-col w-1/4 min-w-60 max-w-80">
            <Label htmlFor="retailLogPath" className="flex items-center">
              Retail Log Path
              <Tooltip
                content={configSchema.retailLogPath.description}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              value={config.retailLogPath}
              disabled={!config.recordRetail || isComponentDisabled()}
              onClick={setRetailLogPath}
              readOnly
              required
            />
            {config.retailLogPath === '' && (
              <span className="text-error text-sm">
                Invalid retail log path
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
            Record Classic
            <Tooltip
              content={configSchema.recordClassic.description}
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
          <div className="flex flex-col w-1/4 min-w-60 max-w-80">
            <Label htmlFor="classicLogPath" className="flex items-center">
              Classic Log Path
              <Tooltip
                content={configSchema.classicLogPath.description}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              value={config.classicLogPath}
              disabled={!config.recordClassic || isComponentDisabled()}
              onClick={setClassicLogPath}
              readOnly
              required
            />
            {config.classicLogPath === '' && (
              <span className="text-error text-sm">
                Invalid classic log path
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
            Record Classic Era
            <Tooltip content={configSchema.recordEra.description} side="top">
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordEra', setRecordEra)}
          </div>
        </div>
        {config.recordEra && (
          <div className="flex flex-col w-1/4 min-w-60 max-w-80">
            <Label htmlFor="eraLogPath" className="flex items-center">
              Classic Era Log Path
              <Tooltip content={configSchema.eraLogPath.description} side="top">
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
            </Label>
            <Input
              value={config.eraLogPath}
              disabled={!config.recordEra || isComponentDisabled()}
              onClick={setEraLogPath}
              readOnly
              required
            />
            {config.eraLogPath === '' && (
              <span className="text-error text-xs font-semibold mt-1">
                Invalid Classic Era log path
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-8">
      {getDisabledText()}
      {getRetailSettings()}
      {getClassicSettings()}
      {getEraSettings()}
    </div>
  );
};

export default FlavourSettings;
