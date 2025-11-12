import * as React from 'react';
import { configSchema, ConfigurationSchema } from 'config/configSchema';
import { AppState } from 'main/types';
import {
  Check,
  Cloud,
  Info,
  MonitorPlay,
  Pencil,
  RefreshCcw,
  Trash,
  X,
} from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { setConfigValue, setConfigValues } from './useSettings';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Input } from './components/Input/Input';
import Progress from './components/Progress/Progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';
import Separator from './components/Separator/Separator';
import { Phrase } from 'localisation/phrases';
import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { Button } from './components/Button/Button';
import TextBanner from './components/TextBanner/TextBanner';

const ipc = window.electron.ipcRenderer;

const raidDifficultyOptions = [
  { name: 'LFR', phrase: Phrase.LFR },
  { name: 'Normal', phrase: Phrase.Normal },
  { name: 'Heroic', phrase: Phrase.Heroic },
  { name: 'Mythic', phrase: Phrase.Mythic },
];

let debounceTimer: NodeJS.Timeout | undefined;

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
}

const CloudSettings = (props: IProps) => {
  const { appState, config, setConfig } = props;
  const { language, queuedUploads, queuedDownloads } = appState;
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      setConfigValues({
        cloudStorage: config.cloudStorage,
        cloudAccountName: config.cloudAccountName,
        cloudAccountPassword: config.cloudAccountPassword,
        cloudGuildName: config.cloudGuildName,
        cloudUpload: config.cloudUpload,
      });

      ipc.reconfigureCloud();

      if (!config.cloudStorage) {
        // If the user has disabled cloud storage, also
        // disable custom image overlays and reconfigure it.
        setConfig((prev) => ({ ...prev, chatOverlayOwnImage: false }));
        setConfigValues({ chatOverlayOwnImage: false });
        ipc.reconfigureOverlay();
      }
    }, 2000); // Want to be long enough that it doesn't trigger mid-typing.
  }, [
    config.cloudStorage,
    config.cloudAccountName,
    config.cloudAccountPassword,
    config.cloudGuildName,
    config.cloudUpload,
  ]);

  useEffect(() => {
    initialRender.current = false;
  }, []);

  const isComponentDisabled = () => {
    return queuedUploads > 0 || queuedDownloads > 0;
  };

  const getDisabledText = () => {
    return (
      <TextBanner>
        {getLocalePhrase(language, Phrase.CloudSettingsDisabledText)}
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

  const getSwitchForm = (
    preference: keyof ConfigurationSchema,
    label: Phrase,
  ) => {
    const changeFn = (checked: boolean) => {
      setConfigValue(preference, checked);
      setConfig((prevState) => {
        return {
          ...prevState,
          [preference]: checked,
        };
      });
    };

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor={preference} className="flex items-center">
          {getLocalePhrase(language, label)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema[preference].description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch(preference, changeFn)}
        </div>
      </div>
    );
  };

  const setMinRaidThreshold = (value: string) => {
    setConfigValue('cloudUploadRaidMinDifficulty', value);

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRaidMinDifficulty: value,
      };
    });
  };

  const getMinRaidDifficultySelect = () => {
    if (!config.cloudUploadRaids) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label
          htmlFor="cloudUploadRaidMinDifficulty"
          className="flex items-center"
        >
          {getLocalePhrase(language, Phrase.UploadDifficultyThresholdLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudUploadRaidMinDifficulty.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select
          onValueChange={setMinRaidThreshold}
          disabled={!config.cloudUploadRaids}
          value={config.cloudUploadRaidMinDifficulty}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a difficulty" />
          </SelectTrigger>
          <SelectContent>
            {raidDifficultyOptions.map((difficulty) => (
              <SelectItem key={difficulty.name} value={difficulty.name}>
                {getLocalePhrase(language, difficulty.phrase)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const setMinKeystoneLevel = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      // Allow setting empty as midpoint.
      setConfig((prev) => ({ ...prev, cloudUploadDungeonMinLevel: -1 }));
      return;
    }

    const cloudUploadDungeonMinLevel = parseInt(event.target.value, 10);

    if (Number.isNaN(cloudUploadDungeonMinLevel)) {
      // Block invalid config.
      return;
    }

    setConfigValue('cloudUploadDungeonMinLevel', cloudUploadDungeonMinLevel);

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadDungeonMinLevel,
      };
    });
  };

  const getMinKeystoneLevelField = () => {
    if (!config.cloudUploadDungeons) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label
          htmlFor="cloudUploadDungeonMinLevel"
          className="flex items-center"
        >
          {getLocalePhrase(language, Phrase.UploadLevelThresholdLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudUploadDungeonMinLevel.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={
            config.cloudUploadDungeonMinLevel >= 0
              ? config.cloudUploadDungeonMinLevel
              : ''
          }
          name="cloudUploadDungeonMinLevel"
          disabled={!config.cloudUploadDungeons}
          onChange={setMinKeystoneLevel}
          type="numeric"
          min={2}
        />
      </div>
    );
  };

  const setCloudStorage = (checked: boolean) => {
    setConfig((prevState) => {
      const cloudStorage = checked;

      const newState = {
        ...prevState,
        cloudStorage,
      };

      if (!cloudStorage) {
        // Can't have upload on if cloud storage is off so also set that
        // to false if we're disabling cloud storage.
        newState.cloudUpload = false;
      }

      return newState;
    });
  };

  const setCloudUpload = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUpload: checked,
      };
    });
  };

  const setCloudUploadRetail = (checked: boolean) => {
    setConfigValue('cloudUploadRetail', checked);

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRetail: checked,
      };
    });
  };

  const setCloudUploadClassic = (checked: boolean) => {
    setConfigValue('cloudUploadClassic', checked);

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadClassic: checked,
      };
    });
  };

  const getCloudSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudStorage" className="flex items-center">
          {getLocalePhrase(language, Phrase.CloudPlaybackLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudStorage.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudStorage', setCloudStorage)}
        </div>
      </div>
    );
  };

  const getCloudUploadSwitch = () => {
    if (!config.cloudStorage) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudUpload" className="flex items-center">
          {getLocalePhrase(language, Phrase.CloudUploadLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudUpload.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudUpload', setCloudUpload)}
        </div>
      </div>
    );
  };

  const getRetailUploadSwitch = () => {
    if (!config.cloudUpload) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudUploadRetail" className="flex items-center">
          {getLocalePhrase(language, Phrase.CloudUploadRetailLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudUploadRetail.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudUploadRetail', setCloudUploadRetail)}
        </div>
      </div>
    );
  };

  const getClassicUploadSwitch = () => {
    if (!config.cloudUpload) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudUploadClassic" className="flex items-center">
          {getLocalePhrase(language, Phrase.CloudUploadClassicLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudUploadClassic.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudUploadClassic', setCloudUploadClassic)}
        </div>
      </div>
    );
  };

  const setCloudUploadRateLimit = (checked: boolean) => {
    setConfigValue('cloudUploadRateLimit', checked);

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRateLimit: checked,
      };
    });
  };

  const getCloudUploadRateLimitSwitch = () => {
    if (!config.cloudUpload) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="cloudUploadRateLimit" className="flex items-center">
          {getLocalePhrase(language, Phrase.UploadRateLimitToggleLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudUploadRateLimit.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('cloudUploadRateLimit', setCloudUploadRateLimit)}
        </div>
      </div>
    );
  };

  const setCloudAccountName = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudAccountName: event.target.value.toLowerCase(),
      };
    });
  };

  const getCloudAccountNameField = () => {
    if (!config.cloudStorage) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudAccountName" className="flex items-center">
          {getLocalePhrase(language, Phrase.UserEmailLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudAccountName.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="cloudAccountName"
          value={config.cloudAccountName}
          onChange={setCloudAccountName}
          spellCheck={false}
          required
        />
        {config.cloudAccountName === '' && (
          <span className="text-error text-xs font-semibold mt-1">
            {getLocalePhrase(language, Phrase.CannotBeEmpty)}
          </span>
        )}
      </div>
    );
  };

  const setCloudPassword = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudAccountPassword: event.target.value,
      };
    });
  };

  const getCloudAccountPasswordField = () => {
    if (!config.cloudStorage) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudAccountPassword" className="flex items-center">
          {getLocalePhrase(language, Phrase.PasswordLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudAccountPassword.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="cloudAccountPassword"
          value={config.cloudAccountPassword}
          onChange={setCloudPassword}
          spellCheck={false}
          type="password"
          required
        />
        {config.cloudAccountPassword === '' && (
          <span className="text-error text-xs font-semibold mt-1">
            {getLocalePhrase(language, Phrase.CannotBeEmpty)}
          </span>
        )}
      </div>
    );
  };

  const setCloudGuild = (value: string) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudGuildName: value,
      };
    });
  };

  const refreshGuildList = () => {
    ipc.refreshCloudGuilds();
  };

  const getCloudGuildField = () => {
    const { available, authenticated } = appState.cloudStatus;

    if (!config.cloudStorage || !authenticated) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudGuildName" className="flex items-center">
          {getLocalePhrase(language, Phrase.GuildNameLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudGuildName.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex flex-row gap-x-2">
          <Select onValueChange={setCloudGuild} value={config.cloudGuildName}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a guild" />
            </SelectTrigger>
            <SelectContent>
              {available.map((guild) => (
                <SelectItem key={guild} value={guild}>
                  {guild}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip
            content={getLocalePhrase(language, Phrase.CloudRefreshGuildTooltip)}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshGuildList}
              disabled={!authenticated}
            >
              <RefreshCcw size={16} />
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  };

  const renderPermissionIcon = (enabled: boolean) =>
    enabled ? (
      <Check size={20} className="inline-flex ml-2" color="green" />
    ) : (
      <X size={20} className="inline-flex ml-2" color="red" />
    );

  const getPermissionDetails = (phrase: Phrase, enabled: boolean) => {
    let icon = (
      <MonitorPlay
        size={20}
        className="inline-flex mr-2 text-foreground-lighter"
      />
    );

    if (phrase === Phrase.PermissionWriteLabel) {
      icon = (
        <Pencil
          size={20}
          className="inline-flex mr-2 text-foreground-lighter"
        />
      );
    } else if (phrase === Phrase.PermissionDeleteLabel) {
      icon = (
        <Trash size={20} className="inline-flex mr-2 text-foreground-lighter" />
      );
    }

    return (
      <div>
        {icon}
        <span className="text-xs text-foreground font-semibold whitespace-nowrap">
          {getLocalePhrase(language, phrase)}
          {renderPermissionIcon(enabled)}
        </span>
      </div>
    );
  };

  const getCloudPermissions = () => {
    const { read, write, del } = appState.cloudStatus;

    return (
      <div className="flex-col">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.PermissionLabel)}
          <Tooltip
            content={getLocalePhrase(language, Phrase.PermissionDescription)}
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>

        <div className="flex flex-row gap-x-4">
          <Tooltip
            content={getLocalePhrase(
              language,
              Phrase.PermissionReadDescription,
            )}
          >
            {getPermissionDetails(Phrase.PermissionReadLabel, read)}
          </Tooltip>
          <Tooltip
            content={getLocalePhrase(
              language,
              Phrase.PermissionWriteDescription,
            )}
          >
            {getPermissionDetails(Phrase.PermissionWriteLabel, write)}
          </Tooltip>
          <Tooltip
            content={getLocalePhrase(
              language,
              Phrase.PermissionDeleteDescription,
            )}
          >
            {getPermissionDetails(Phrase.PermissionDeleteLabel, del)}
          </Tooltip>
        </div>
      </div>
    );
  };

  const getCloudUsageBar = () => {
    const { usage, limit } = appState.cloudStatus;
    const usageGB = usage / 1024 ** 3;
    const limitGB = limit / 1024 ** 3;
    const perc = Math.round((100 * usage) / limit);

    return (
      <div className="flex-col">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.CloudUsageDescription)}
        </Label>

        <div className="flex flex-row items-center justify-start w-1/3 min-w-80 max-w-120 gap-x-2">
          <Tooltip
            content={getLocalePhrase(language, Phrase.CloudUsageDescription)}
          >
            <Cloud size={24} className="text-foreground-lighter" />
          </Tooltip>
          <Progress value={perc} className="h-3" />
          <span className="text-[11px] text-foreground font-semibold whitespace-nowrap">
            {Math.round(usageGB)}GB / {Math.round(limitGB)}GB
          </span>
        </div>
      </div>
    );
  };

  const getCloudUploadCategorySettings = () => {
    return (
      <>
        <div className="flex flex-row gap-x-6">
          {getRetailUploadSwitch()}
          {getClassicUploadSwitch()}
        </div>
        <div className="flex flex-row gap-x-6">
          {getSwitchForm('cloudUploadRaids', Phrase.UploadRaidsLabel)}
          {config.cloudUploadRaids &&
            getSwitchForm(
              'uploadCurrentRaidEncountersOnly',
              Phrase.UploadCurrentRaidsOnlyLabel,
            )}
          {getMinRaidDifficultySelect()}
        </div>

        <div className="flex flex-row gap-x-6">
          {getSwitchForm('cloudUploadDungeons', Phrase.UploadMythicPlusLabel)}
          {getMinKeystoneLevelField()}
        </div>

        <div className="flex flex-row gap-x-6">
          {getSwitchForm('cloudUpload2v2', Phrase.Upload2v2Label)}
          {getSwitchForm('cloudUpload3v3', Phrase.Upload3v3Label)}
          {getSwitchForm('cloudUpload5v5', Phrase.Upload5v5Label)}
          {getSwitchForm('cloudUploadSkirmish', Phrase.UploadSkirmishLabel)}
          {getSwitchForm(
            'cloudUploadSoloShuffle',
            Phrase.UploadSoloShuffleLabel,
          )}
          {getSwitchForm(
            'cloudUploadBattlegrounds',
            Phrase.UploadBattlgroundsLabel,
          )}
        </div>

        <div className="flex flex-row gap-x-6">
          {getSwitchForm('manualRecordUpload', Phrase.ManualRecordUploadLabel)}
          {getSwitchForm('cloudUploadClips', Phrase.UploadClipsLabel)}
        </div>
      </>
    );
  };

  const setUploadRateLimit = (event: React.ChangeEvent<HTMLInputElement>) => {
    const cloudUploadRateLimitMbps = parseInt(event.target.value, 10);

    if (Number.isNaN(cloudUploadRateLimitMbps)) {
      // Block invalid config.
      return;
    }

    setConfigValue('cloudUploadRateLimitMbps', cloudUploadRateLimitMbps);

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRateLimitMbps,
      };
    });
  };

  const getRateLimitField = () => {
    if (!config.cloudUpload || !config.cloudUploadRateLimit) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-60 max-w-80">
        <Label htmlFor="cloudUploadRateLimitMbps" className="flex items-center">
          {getLocalePhrase(language, Phrase.UploadRateLimitValueLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.cloudUploadRateLimitMbps.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          name="cloudUploadRateLimitMbps"
          value={config.cloudUploadRateLimitMbps}
          onChange={setUploadRateLimit}
          spellCheck={false}
          type="numeric"
        />
        {config.cloudUploadRateLimitMbps < 1 && (
          <span className="text-error text-xs font-semibold mt-1">
            {getLocalePhrase(language, Phrase.OneOrGreater)}
          </span>
        )}
      </div>
    );
  };

  const disabled = isComponentDisabled();

  const getPossiblyHiddenFields = () => {
    return (
      <>
        <div className="flex flex-row">{getCloudSwitch()}</div>
        <div className="flex flex-row gap-4 flex-wrap">
          {getCloudAccountNameField()}
          {getCloudAccountPasswordField()}
          {getCloudGuildField()}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-y-4 flex-wrap">
      {disabled && getDisabledText()}
      {!disabled && getPossiblyHiddenFields()}

      {config.cloudStorage && (
        <>
          {getCloudUsageBar()}
          {getCloudPermissions()}
          <Separator className="my-4" />
        </>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-x-6">
          {getCloudUploadSwitch()}
          {getCloudUploadRateLimitSwitch()}
          {getRateLimitField()}
        </div>
        {config.cloudUpload && getCloudUploadCategorySettings()}
      </div>
    </div>
  );
};

export default CloudSettings;
