import { ConfigurationSchema, configSchema } from 'config/configSchema';
import React, { Dispatch, SetStateAction } from 'react';
import { AppState, CombatLoggingStatus, RecStatus } from 'main/types';
import { FolderOpen, Info } from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValues } from './useSettings';
import { pathSelect } from './rendererutils';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Input } from './components/Input/Input';
import { Tooltip } from './components/Tooltip/Tooltip';
import TextBanner from './components/TextBanner/TextBanner';
import { Phrase } from 'localisation/phrases';
import { Button } from './components/Button/Button';

interface IProps {
  recorderStatus: RecStatus;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
  appState: AppState;
  combatLoggingStatus: CombatLoggingStatus;
}

const ipc = window.electron.ipcRenderer;

const FlavourSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus, config, setConfig, appState, combatLoggingStatus } =
    props;
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    if (initialRender.current) {
      // Refresh the combat log status on the initial render of this component.
      // There is no mechanism to refresh that live, unlike the advanced combat
      // logging status because I can't be bothered to implement that.
      ipc.refreshCombatLogStatus();
      initialRender.current = false;
      return;
    }

    setConfigValues({
      recordRetail: config.recordRetail,
      retailLogPath: config.retailLogPath,
      recordRetailPtr: config.recordRetailPtr,
      retailPtrLogPath: config.retailPtrLogPath,
      recordClassic: config.recordClassic,
      classicLogPath: config.classicLogPath,
      recordClassicPtr: config.recordClassicPtr,
      classicPtrLogPath: config.classicPtrLogPath,
      recordEra: config.recordEra,
      eraLogPath: config.eraLogPath,
      validateLogPaths: config.validateLogPaths,
    });

    ipc.reconfigureBase();
  }, [
    config.recordRetail,
    config.recordClassic,
    config.recordClassicPtr,
    config.retailLogPath,
    config.classicLogPath,
    config.classicPtrLogPath,
    config.recordEra,
    config.eraLogPath,
    config.recordRetailPtr,
    config.retailPtrLogPath,
    config.validateLogPaths,
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

  const getLastLogAgeDisplay = (
    path: string,
    key: keyof CombatLoggingStatus,
  ) => {
    if (!path) {
      return <></>;
    }

    let ageDays;

    if (combatLoggingStatus[key].latestLogAgeMs === -1) {
      ageDays = -1;
    } else {
      ageDays = Math.floor(
        (Date.now() - combatLoggingStatus[key].latestLogAgeMs) /
          (1000 * 60 * 60 * 24),
      );
    }

    let ageHumanReadable;
    let ageClassName;

    if (ageDays === -1) {
      ageClassName = 'text-warning opacity-80';
      ageHumanReadable = getLocalePhrase(
        appState.language,
        Phrase.LatestCombatLogFileNotFound,
      );
    } else if (ageDays > 31) {
      ageClassName = 'text-warning opacity-80';
      ageHumanReadable = getLocalePhrase(
        appState.language,
        Phrase.LatestCombatLogFileOverAMonthOld,
      );
    } else if (ageDays >= 1) {
      ageClassName = 'text-success opacity-80';

      ageHumanReadable = `${ageDays} ${getLocalePhrase(
        appState.language,
        Phrase.LatestCombatLogFileDaysOld,
      )}`;
    } else {
      ageClassName = 'text-success opacity-80';
      ageHumanReadable = getLocalePhrase(
        appState.language,
        Phrase.LatestCombatLogFileLessThanADayOld,
      );
    }

    return (
      <>
        {path && (
          <div className="inline-flex ml-2 text-xs font-normal gap-1 text-foreground">
            {getLocalePhrase(appState.language, Phrase.LatestCombatLogFileText)}
            <div className={ageClassName}>{ageHumanReadable}</div>
          </div>
        )}
      </>
    );
  };

  const getRetailSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[160px]">
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
              {getLastLogAgeDisplay(config.retailLogPath, 'retail')}
            </Label>
            <div className="flex">
              <Input
                value={config.retailLogPath}
                onClick={setRetailLogPath}
                readOnly
                required
              />
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  Phrase.OpenFolderButtonTooltip,
                )}
                side="top"
              >
                <Button
                  variant="ghost"
                  disabled={!config.retailLogPath}
                  onClick={() => ipc.openSystemExplorer(config.retailLogPath)}
                >
                  <FolderOpen size={20} />
                </Button>
              </Tooltip>
            </div>
            {config.retailLogPath === '' && (
              <span className="text-error text-sm">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidRetailLogPathText,
                )}
              </span>
            )}
            {!combatLoggingStatus.retail.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  appState.language,
                  Phrase.AdvancedCombatLoggingDisabledWarning,
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
        <div className="flex flex-col w-[160px]">
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
              {getLastLogAgeDisplay(config.classicLogPath, 'classic')}
            </Label>
            <div className="flex">
              <Input
                value={config.classicLogPath}
                onClick={setClassicLogPath}
                readOnly
                required
              />
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  Phrase.OpenFolderButtonTooltip,
                )}
                side="top"
              >
                <Button
                  variant="ghost"
                  disabled={!config.classicLogPath}
                  onClick={() => ipc.openSystemExplorer(config.classicLogPath)}
                >
                  <FolderOpen size={20} />
                </Button>
              </Tooltip>
            </div>
            {config.classicLogPath === '' && (
              <span className="text-error text-sm">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidClassicLogPathText,
                )}
              </span>
            )}
            {!combatLoggingStatus.classic.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  appState.language,
                  Phrase.AdvancedCombatLoggingDisabledWarning,
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
        <div className="flex flex-col w-[160px]">
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
              {getLastLogAgeDisplay(config.eraLogPath, 'era')}
            </Label>
            <div className="flex">
              <Input
                value={config.eraLogPath}
                onClick={setEraLogPath}
                readOnly
                required
              />
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  Phrase.OpenFolderButtonTooltip,
                )}
                side="top"
              >
                <Button
                  variant="ghost"
                  disabled={!config.eraLogPath}
                  onClick={() => ipc.openSystemExplorer(config.eraLogPath)}
                >
                  <FolderOpen size={20} />
                </Button>
              </Tooltip>
            </div>
            {config.eraLogPath === '' && (
              <span className="text-error text-xs font-semibold mt-1">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidClassicEraLogPathText,
                )}
              </span>
            )}
            {!combatLoggingStatus.era.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  appState.language,
                  Phrase.AdvancedCombatLoggingDisabledWarning,
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
        <div className="flex flex-col w-[160px]">
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
              {getLastLogAgeDisplay(config.retailPtrLogPath, 'retailPtr')}
            </Label>
            <div className="flex">
              <Input
                value={config.retailPtrLogPath}
                onClick={setRetailPtrLogPath}
                readOnly
                required
              />
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  Phrase.OpenFolderButtonTooltip,
                )}
                side="top"
              >
                <Button
                  variant="ghost"
                  disabled={!config.retailPtrLogPath}
                  onClick={() =>
                    ipc.openSystemExplorer(config.retailPtrLogPath)
                  }
                >
                  <FolderOpen size={20} />
                </Button>
              </Tooltip>
            </div>
            {config.retailPtrLogPath === '' && (
              <span className="text-error text-xs font-semibold mt-1">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidRetailPtrLogPathText,
                )}
              </span>
            )}
            {!combatLoggingStatus.retailPtr.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  appState.language,
                  Phrase.AdvancedCombatLoggingDisabledWarning,
                )}
              </span>
            )}
          </div>
        )}
      </div>
    );

    //classic ptr
  };

  const setRecordClassicPtr = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordClassicPtr: checked,
      };
    });
  };

  const setClassicPtrLogPath = async () => {
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
        classicPtrLogPath: newPath,
      };
    });
  };

  const getClassicPtrSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[160px]">
          <Label htmlFor="recordClassicPtr" className="flex items-center">
            {getLocalePhrase(appState.language, Phrase.RecordClassicPtrLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.recordClassicPtr.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordClassicPtr', setRecordClassicPtr)}
          </div>
        </div>
        {config.recordClassicPtr && (
          <div className="flex flex-col w-1/2">
            <Label htmlFor="classicPtrLogPath" className="flex items-center">
              {getLocalePhrase(
                appState.language,
                Phrase.ClassicPtrLogPathLabel,
              )}
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  configSchema.classicPtrLogPath.description,
                )}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
              {getLastLogAgeDisplay(config.classicPtrLogPath, 'classicPtr')}
            </Label>
            <div className="flex">
              <Input
                value={config.classicPtrLogPath}
                onClick={setClassicPtrLogPath}
                readOnly
                required
              />
              <Tooltip
                content={getLocalePhrase(
                  appState.language,
                  Phrase.OpenFolderButtonTooltip,
                )}
                side="top"
              >
                <Button
                  variant="ghost"
                  disabled={!config.classicPtrLogPath}
                  onClick={() =>
                    ipc.openSystemExplorer(config.classicPtrLogPath)
                  }
                >
                  <FolderOpen size={20} />
                </Button>
              </Tooltip>
            </div>
            {config.classicPtrLogPath === '' && (
              <span className="text-error text-xs font-semibold mt-1">
                {getLocalePhrase(
                  appState.language,
                  Phrase.InvalidClassicPtrLogPathText,
                )}
              </span>
            )}
            {!combatLoggingStatus.classicPtr.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  appState.language,
                  Phrase.AdvancedCombatLoggingDisabledWarning,
                )}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const setValidateLogPaths = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        validateLogPaths: checked,
      };
    });
  };

  const getValidateLogPathSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[160px]">
          <Label htmlFor="validateLogPath" className="flex items-center">
            {getLocalePhrase(appState.language, Phrase.ValidateLogPathLabel)}
            <Tooltip
              content={getLocalePhrase(
                appState.language,
                configSchema.validateLogPaths.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('validateLogPaths', setValidateLogPaths)}
          </div>
        </div>
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
      {getClassicPtrSettings()}
      {getValidateLogPathSwitch()}
    </div>
  );
};

export default FlavourSettings;
