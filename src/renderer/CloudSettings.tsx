import * as React from 'react';
import { configSchema, ConfigurationSchema } from 'config/configSchema';
import {
  AppState,
  Character,
  CharacterFilter,
  RendererVideo,
} from 'main/types';
import {
  Check,
  Cloud,
  Eraser,
  Info,
  MonitorPlay,
  Pencil,
  PlusIcon,
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
import { specImages } from './images';
import {
  formatRealmNameForDisplay,
  getSpecClass,
  getWoWClassColor,
} from './rendererutils';
import AddCharacterFilterDialog from './AddCharacterFilterDialog';

const ipc = window.electron.ipcRenderer;

const raidDifficultyOptions = [
  { name: 'LFR', phrase: Phrase.LFR },
  { name: 'Normal', phrase: Phrase.Normal },
  { name: 'Heroic', phrase: Phrase.Heroic },
  { name: 'Mythic', phrase: Phrase.Mythic },
];

let debounceTimer: NodeJS.Timeout | undefined;

const CategoryHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-foreground-lighter font-bold">{children}</h2>
);

interface IProps {
  appState: AppState;
  config: ConfigurationSchema;
  setConfig: Dispatch<SetStateAction<ConfigurationSchema>>;
  videoState: RendererVideo[];
}

const CloudSettings = (props: IProps) => {
  const { appState, config, setConfig, videoState } = props;
  const { language } = appState;
  const initialRender1 = useRef(true);
  const initialRender2 = useRef(true);

  useEffect(() => {
    if (initialRender1.current) {
      initialRender1.current = false;
      return;
    }

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
    if (initialRender2.current) {
      initialRender2.current = false;
      return;
    }

    setConfigValues({
      characterUploadFilters: config.characterUploadFilters,
    });
  }, [config.characterUploadFilters]);

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
            <SelectValue
              placeholder={getLocalePhrase(language, Phrase.SelectDifficulty)}
            />
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
              <SelectValue
                placeholder={getLocalePhrase(language, Phrase.SelectGuild)}
              />
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

  const getPossiblyHiddenFields = () => {
    return (
      <>
        <div className="flex flex-row gap-4 flex-wrap">
          {getCloudAccountNameField()}
          {getCloudAccountPasswordField()}
          {getCloudGuildField()}
        </div>
      </>
    );
  };

  const renderCharacterFilterRow = (
    filter: CharacterFilter,
    known: Map<string, Character>,
    index: number,
  ) => {
    const character = known.get(`${filter.name}:${filter.realm}`);
    let specIcon = specImages[0];
    let playerClassColor = 'gray';

    if (character) {
      const knownSpec = Object.hasOwnProperty.call(
        specImages,
        character.specID as keyof typeof specImages,
      );

      if (knownSpec) {
        specIcon = specImages[character.specID as keyof typeof specImages];
        const playerClass = getSpecClass(character.specID);
        playerClassColor = getWoWClassColor(playerClass);
      }
    }

    let bgClass = '';

    if (index % 2 === 0) {
      bgClass += 'bg-secondary/20 ';
    } else {
      bgClass += 'bg-secondary/60 ';
    }

    return (
      <tr
        key={`${filter.name}-${filter.realm}`}
        className={`rounded-md ${bgClass}`}
      >
        <td>
          <div className="flex items-center gap-x-1">
            <img
              src={specIcon}
              className="bg-background-higher h-6 w-6 rounded-[15%] border border-black object-cover"
            />
            <span
              className="font-sans font-semibold text-md text-shadow-instance truncate "
              style={{ color: playerClassColor }}
            >
              {filter.name}
            </span>
          </div>
        </td>
        <td>
          <span>{formatRealmNameForDisplay(filter.realm)}</span>
        </td>
        <td>
          <div className="flex items-center justify-center">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <X
                className="text-red-500 opacity-70"
                onClick={() => clearCharacterFilter(index)}
              />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const renderCharacterFilterHelpText = () => {
    if (config.characterUploadFilters.length > 0) {
      return (
        <div className="flex flex-col text-sm text-foreground">
          {getLocalePhrase(language, Phrase.CharacterFilterActive)}
        </div>
      );
    }

    return (
      <div className="flex flex-col text-sm text-foreground">
        {getLocalePhrase(language, Phrase.CharacterFilterNone)}
      </div>
    );
  };

  const knownPlayers = new Map<string, Character>();

  videoState.forEach((rv) => {
    if (!rv.player) {
      return;
    }

    const { _name, _realm, _specID } = rv.player;

    if (!_name || !_realm || !_specID) {
      return;
    }

    knownPlayers.set(`${_name}:${_realm}`, {
      name: _name,
      realm: _realm,
      specID: _specID,
    });
  });

  const clearCharacterFilters = () => {
    setConfig((prev) => ({ ...prev, characterUploadFilters: [] }));
  };

  const clearCharacterFilter = (index: number) => {
    setConfig((prev) => {
      const newFilters = [...prev.characterUploadFilters];
      newFilters.splice(index, 1);
      return { ...prev, characterUploadFilters: newFilters };
    });
  };

  const getCharacterFilterSettings = () => {
    return (
      <div className="flex flex-col gap-y-2">
        {renderCharacterFilterHelpText()}
        {config.characterUploadFilters.length > 0 && (
          <table className="m-2 w-fit">
            <thead className="border-b border-t border-video-border">
              <tr>
                <th className="text-left w-[200px]">Character</th>
                <th className="text-left w-[200px]">Realm</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {config.characterUploadFilters.map((filter, index) =>
                renderCharacterFilterRow(filter, knownPlayers, index),
              )}
            </tbody>
          </table>
        )}

        <div className="flex gap-2">
          <AddCharacterFilterDialog
            appState={appState}
            videoState={videoState}
            config={config}
            setConfig={setConfig}
          >
            <Button variant="outline">
              <PlusIcon className="mr-1" />
              {getLocalePhrase(language, Phrase.CharacterAdd)}
            </Button>
          </AddCharacterFilterDialog>
          <Button onClick={clearCharacterFilters} variant="outline">
            <Eraser className="mr-2" size={20} />
            {getLocalePhrase(language, Phrase.Clear)}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-4 flex-wrap">
      <div className="flex flex-row">{getCloudSwitch()}</div>
      {getPossiblyHiddenFields()}

      {config.cloudStorage && (
        <>
          {getCloudUsageBar()}
          {getCloudPermissions()}

          <div>
            <CategoryHeading>
              {getLocalePhrase(
                appState.language,
                Phrase.CloudUploadSettingsLabel,
              )}
            </CategoryHeading>
            <Separator className="mt-2 mb-4" />
            <div className="flex flex-row gap-x-6">
              {getCloudUploadSwitch()}
              {getRetailUploadSwitch()}
              {getClassicUploadSwitch()}
              {getCloudUploadRateLimitSwitch()}
              {getRateLimitField()}
            </div>
          </div>

          {config.cloudUpload && (
            <>
              <div>
                <CategoryHeading>
                  {getLocalePhrase(
                    appState.language,
                    Phrase.CloudFilterSettingsLabel,
                  )}
                </CategoryHeading>
                <Separator className="mt-2 mb-4" />
                {config.cloudUpload && (
                  <div className="flex flex-col gap-4">
                    {getCloudUploadCategorySettings()}
                  </div>
                )}
              </div>
              <div>
                <CategoryHeading>
                  {getLocalePhrase(
                    appState.language,
                    Phrase.CloudAdvancedFilterSettingsLabel,
                  )}
                </CategoryHeading>
                <Separator className="mt-2 mb-4" />
                <div className="flex flex-col gap-4">
                  {getCharacterFilterSettings()}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CloudSettings;
