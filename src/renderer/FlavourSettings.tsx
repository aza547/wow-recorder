import { ConfigurationSchema, configSchema } from 'config/configSchema';
import React, { Dispatch, FC, SetStateAction, useEffect, useRef } from 'react';
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

const FlavourSettings: FC<IProps> = (props: IProps) => {
  const { recorderStatus, config, setConfig, appState, combatLoggingStatus } =
    props;
  const { language } = appState;

  const initialRender1 = useRef(true);
  const initialRender2 = useRef(true);

  useEffect(() => {
    if (initialRender1.current) {
      // Refresh the combat log status on the initial render of this component.
      // There is no mechanism to refresh that live, unlike the advanced combat
      // logging status because I can't be bothered to implement that.
      ipc.refreshCombatLogStatus();

      // Don't change config on the initial render.
      initialRender1.current = false;
      return;
    }

    setConfigValues({
      validateLogPaths: config.validateLogPaths,
      recordRetail: config.recordRetail,
      retailLogPath: config.retailLogPath,
      recordClassic: config.recordClassic,
      classicLogPath: config.classicLogPath,
      recordForever: config.recordForever,
      foreverLogPath: config.foreverLogPath,
      recordRetailPtr: config.recordRetailPtr,
      retailPtrLogPath: config.retailPtrLogPath,
      recordClassicPtr: config.recordClassicPtr,
      classicPtrLogPath: config.classicPtrLogPath,
      recordEra: config.recordEra,
      eraLogPath: config.eraLogPath,
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
    config.recordForever,
    config.foreverLogPath,
  ]);

  useEffect(() => {
    if (initialRender2.current) {
      initialRender2.current = false;
      return;
    }

    setConfigValues({
      showAllGamesLogPathSettings: config.showAllGamesLogPathSettings,
    });
  }, [config.showAllGamesLogPathSettings]);

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
        language,
        Phrase.LatestCombatLogFileNotFound,
      );
    } else if (ageDays > 31) {
      ageClassName = 'text-warning opacity-80';
      ageHumanReadable = getLocalePhrase(
        language,
        Phrase.LatestCombatLogFileOverAMonthOld,
      );
    } else if (ageDays > 1) {
      ageClassName = 'text-success opacity-80';

      ageHumanReadable = `${ageDays} ${getLocalePhrase(
        language,
        Phrase.LatestCombatLogFileDaysOld,
      )}`;
    } else if (ageDays === 1) {
      ageClassName = 'text-success opacity-80';

      ageHumanReadable = getLocalePhrase(
        language,
        Phrase.LatestCombatLogFileDayOld,
      );
    } else {
      ageClassName = 'text-success opacity-80';
      ageHumanReadable = getLocalePhrase(
        language,
        Phrase.LatestCombatLogFileLessThanADayOld,
      );
    }

    return (
      <>
        {path && (
          <div className="inline-flex ml-2 text-xs font-normal gap-1 text-foreground">
            {getLocalePhrase(language, Phrase.LatestCombatLogFileText)}
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
            {getLocalePhrase(language, Phrase.RecordRetailLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
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
              {getLocalePhrase(language, Phrase.RetailLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  language,
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
                  language,
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
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(language, Phrase.InvalidRetailLogPathText)}
              </span>
            )}
            {!combatLoggingStatus.retail.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  language,
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
            {getLocalePhrase(language, Phrase.RecordClassicLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
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
              {getLocalePhrase(language, Phrase.ClassicLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  language,
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
                  language,
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
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(language, Phrase.InvalidClassicLogPathText)}
              </span>
            )}
            {!combatLoggingStatus.classic.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  language,
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
            {getLocalePhrase(language, Phrase.RecordClassicEraLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
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
              {getLocalePhrase(language, Phrase.ClassicEraLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  language,
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
                  language,
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
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(language, Phrase.InvalidClassicEraLogPathText)}
              </span>
            )}
            {!combatLoggingStatus.era.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  language,
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
            {getLocalePhrase(language, Phrase.RecordRetailPtrLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
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
              {getLocalePhrase(language, Phrase.RetailPtrLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  language,
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
                  language,
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
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(language, Phrase.InvalidRetailPtrLogPathText)}
              </span>
            )}
            {!combatLoggingStatus.retailPtr.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  language,
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
            {getLocalePhrase(language, Phrase.RecordClassicPtrLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
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
              {getLocalePhrase(language, Phrase.ClassicPtrLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  language,
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
                  language,
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
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(language, Phrase.InvalidClassicPtrLogPathText)}
              </span>
            )}
            {!combatLoggingStatus.classicPtr.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  language,
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
            {getLocalePhrase(language, Phrase.ValidateLogPathLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
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

  const setShowAllGamesLogPathSettings = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        showAllGamesLogPathSettings: checked,
      };
    });
  };

  const getShowAllGamesLogPathSettingsSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[160px]">
          <Label
            htmlFor="showAllGamesLogPathSettings"
            className="flex items-center"
          >
            {getLocalePhrase(language, Phrase.ShowAllGamesLogPathSettingsLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
                configSchema.showAllGamesLogPathSettings.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch(
              'showAllGamesLogPathSettings',
              setShowAllGamesLogPathSettings,
            )}
          </div>
        </div>
      </div>
    );
  };

  const setRecordForever = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordForever: checked,
      };
    });
  };

  const setForeverLogPath = async () => {
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
        foreverLogPath: newPath,
      };
    });
  };

  const getForeverSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <div className="flex flex-row gap-x-6">
        <div className="flex flex-col w-[160px]">
          <Label htmlFor="recordForever" className="flex items-center">
            {getLocalePhrase(language, Phrase.RecordForeverLabel)}
            <Tooltip
              content={getLocalePhrase(
                language,
                configSchema.foreverLogPath.description,
              )}
              side="top"
            >
              <Info size={20} className="inline-flex ml-2" />
            </Tooltip>
          </Label>
          <div className="flex h-10 items-center">
            {getSwitch('recordForever', setRecordForever)}
          </div>
        </div>
        {config.recordForever && (
          <div className="flex flex-col w-1/2">
            <Label htmlFor="foreverLogPath" className="flex items-center">
              {getLocalePhrase(language, Phrase.ForeverLogPathLabel)}
              <Tooltip
                content={getLocalePhrase(
                  language,
                  configSchema.foreverLogPath.description,
                )}
                side="top"
              >
                <Info size={20} className="inline-flex ml-2" />
              </Tooltip>
              {getLastLogAgeDisplay(config.foreverLogPath, 'forever')}
            </Label>
            <div className="flex">
              <Input
                value={config.foreverLogPath}
                onClick={setForeverLogPath}
                readOnly
                required
              />
              <Tooltip
                content={getLocalePhrase(
                  language,
                  Phrase.OpenFolderButtonTooltip,
                )}
                side="top"
              >
                <Button
                  variant="ghost"
                  disabled={!config.foreverLogPath}
                  onClick={() => ipc.openSystemExplorer(config.foreverLogPath)}
                >
                  <FolderOpen size={20} />
                </Button>
              </Tooltip>
            </div>
            {config.foreverLogPath === '' && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(language, Phrase.InvalidForeverLogPath)}
              </span>
            )}
            {!combatLoggingStatus.forever.advanced && (
              <span className="text-error text-xs mt-2">
                {getLocalePhrase(
                  language,
                  Phrase.AdvancedCombatLoggingDisabledWarning,
                )}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const getHiddenSettingsWarning = () => {
    const {
      showAllGamesLogPathSettings,
      recordEra,
      recordClassicPtr,
      recordRetailPtr,
    } = config;

    const showWarning =
      !showAllGamesLogPathSettings &&
      (recordEra || recordClassicPtr || recordRetailPtr);

    if (showWarning) {
      return (
        <span className="text-warning opacity-80 text-xs mt-2">
          {getLocalePhrase(language, Phrase.HiddenFlavourSettingsWarning)}
        </span>
      );
    }
  };

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row gap-x-6">
        {getShowAllGamesLogPathSettingsSwitch()}
        {getValidateLogPathSwitch()}
      </div>

      {getDisabledText()}
      {getRetailSettings()}
      {getClassicSettings()}
      {getForeverSettings()}

      {config.showAllGamesLogPathSettings && (
        <>
          {getRetailPtrSettings()}
          {getClassicPtrSettings()}
          {getEraSettings()}
        </>
      )}

      {getHiddenSettingsWarning()}
    </div>
  );
};

export default FlavourSettings;
