import { configSchema, ConfigurationSchema } from 'config/configSchema';
import React from 'react';
import { Info } from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { AppState } from 'main/types';
import { setConfigValues, useSettings } from './useSettings';
import Switch from './components/Switch/Switch';
import Label from './components/Label/Label';
import { Tooltip } from './components/Tooltip/Tooltip';
import { Input } from './components/Input/Input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './components/Select/Select';
import { Phrase } from 'localisation/phrases';

const raidDifficultyOptions = [
  { name: 'LFR', phrase: Phrase.LFR },
  { name: 'Normal', phrase: Phrase.Normal },
  { name: 'Heroic', phrase: Phrase.Heroic },
  { name: 'Mythic', phrase: Phrase.Mythic },
];

interface IProps {
  appState: AppState;
}

const PVESettings = (props: IProps) => {
  const { appState } = props;
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    const toSet: Record<string, boolean | string | number> = {
      recordRaids: config.recordRaids,
      minEncounterDuration: config.minEncounterDuration,
      minRaidDifficulty: config.minRaidDifficulty,
      recordDungeons: config.recordDungeons,
      recordChallengeModes: config.recordChallengeModes,
      raidOverrun: config.raidOverrun,
      dungeonOverrun: config.dungeonOverrun,
      recordCurrentRaidEncountersOnly: config.recordCurrentRaidEncountersOnly,
    };

    // Only set these if they are valid values. We allow -1 set in the
    // frontend to represent temporarily unset values in the Input fields.
    if (config.minEncounterDuration >= 0) {
      toSet.minEncounterDuration = config.minEncounterDuration;
    }

    if (config.raidOverrun >= 0) {
      toSet.raidOverrun = config.raidOverrun;
    }

    if (config.minKeystoneLevel >= 0) {
      toSet.minKeystoneLevel = config.minKeystoneLevel;
    }

    if (config.dungeonOverrun >= 0) {
      toSet.dungeonOverrun = config.dungeonOverrun;
    }

    setConfigValues(toSet);
  }, [
    config.dungeonOverrun,
    config.minEncounterDuration,
    config.minKeystoneLevel,
    config.minRaidDifficulty,
    config.raidOverrun,
    config.recordDungeons,
    config.recordChallengeModes,
    config.recordRaids,
    config.recordCurrentRaidEncountersOnly,
  ]);

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

  const setRecordRaids = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordRaids: checked,
      };
    });
  };

  const getRecordRaidSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="recordRaids" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.RecordRaidsLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.recordRaids.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('recordRaids', setRecordRaids)}
        </div>
      </div>
    );
  };

  const setRecordCurrentRaidEncountersOnly = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordCurrentRaidEncountersOnly: checked,
      };
    });
  };

  const getRecordCurrentEncountersOnlySwitch = () => {
    if (!config.recordRaids) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-[140px]">
        <Label
          htmlFor="recordCurrentRaidEncountersOnly"
          className="flex items-center"
        >
          {getLocalePhrase(
            appState.language,
            Phrase.RecordCurrentRaidsOnlyLabel,
          )}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.recordCurrentRaidEncountersOnly.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch(
            'recordCurrentRaidEncountersOnly',
            setRecordCurrentRaidEncountersOnly,
          )}
        </div>
      </div>
    );
  };

  const setMinEncounterDuration = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.value) {
      // Allow setting empty as midpoint.
      setConfig((prev) => ({ ...prev, minEncounterDuration: -1 }));
      return;
    }

    const minEncounterDuration = parseInt(event.target.value, 10);

    if (Number.isNaN(minEncounterDuration)) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        minEncounterDuration,
      };
    });
  };

  const getMinEncounterDurationField = () => {
    if (!config.recordRaids) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label htmlFor="minEncounterDuration" className="flex items-center">
          {getLocalePhrase(
            appState.language,
            Phrase.MinimumEncounterDurationLabel,
          )}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.minEncounterDuration.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={
            config.minEncounterDuration >= 0 ? config.minEncounterDuration : ''
          }
          name="minEncounterDuration"
          disabled={!config.recordRaids}
          onChange={setMinEncounterDuration}
          type="numeric"
        />
      </div>
    );
  };

  const setMinRaidDifficulty = (value: string) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        minRaidDifficulty: value,
      };
    });
  };

  const getMinRaidDifficultySelect = () => {
    if (!config.recordRaids) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label htmlFor="minRaidDifficulty" className="flex items-center">
          {getLocalePhrase(
            appState.language,
            Phrase.MinimumRaidDifficultyLabel,
          )}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.minRaidDifficulty.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select
          onValueChange={setMinRaidDifficulty}
          disabled={!config.recordRaids}
          value={config.minRaidDifficulty}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={getLocalePhrase(
                appState.language,
                Phrase.SelectDifficulty,
              )}
            />
          </SelectTrigger>
          <SelectContent>
            {raidDifficultyOptions.map((difficulty) => (
              <SelectItem key={difficulty.name} value={difficulty.name}>
                {getLocalePhrase(appState.language, difficulty.phrase)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const setRaidOverrun = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      // Allow setting empty as midpoint.
      setConfig((prev) => ({ ...prev, raidOverrun: -1 }));
      return;
    }

    const raidOverrun = parseInt(event.target.value, 10);

    if (Number.isNaN(raidOverrun) || raidOverrun < 0 || raidOverrun > 60) {
      // Don't allow invalid config to go further.
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        raidOverrun,
      };
    });
  };

  const getRaidOverrunField = () => {
    if (!config.recordRaids) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label htmlFor="raidOverrun" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.RaidOverrunLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.raidOverrun.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.raidOverrun >= 0 ? config.raidOverrun : ''}
          name="raidOverrun"
          disabled={!config.recordRaids}
          onChange={setRaidOverrun}
          type="numeric"
        />
      </div>
    );
  };

  const setDungeonOverrun = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      // Allow setting empty as midpoint.
      setConfig((prev) => ({ ...prev, dungeonOverrun: -1 }));
      return;
    }

    const dungeonOverrun = parseInt(event.target.value, 10);

    if (
      Number.isNaN(dungeonOverrun) ||
      dungeonOverrun < 0 ||
      dungeonOverrun > 60
    ) {
      // Don't allow invalid config to go further.
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        dungeonOverrun,
      };
    });
  };

  const getDungeonOverrunField = () => {
    if (!config.recordDungeons) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label htmlFor="dungeonOverrun" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.MythicPlusOverrunLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.dungeonOverrun.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.dungeonOverrun >= 0 ? config.dungeonOverrun : ''}
          name="dungeonOverrun"
          disabled={!config.recordDungeons}
          onChange={setDungeonOverrun}
          type="numeric"
        />
      </div>
    );
  };

  const setRecordDungeons = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordDungeons: checked,
      };
    });
  };

  const setRecordChallengeModes = (checked: boolean) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordChallengeModes: checked,
      };
    });
  };

  const getRecordDungeonSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="recordDungeons" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.RecordMythicPlusLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.recordDungeons.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('recordDungeons', setRecordDungeons)}
        </div>
      </div>
    );
  };

  const setMinKeystoneLevel = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      // Allow setting empty as midpoint.
      setConfig((prev) => ({ ...prev, minKeystoneLevel: -1 }));
      return;
    }

    const minKeystoneLevel = parseInt(event.target.value, 10);

    if (Number.isNaN(minKeystoneLevel)) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        minKeystoneLevel,
      };
    });
  };

  const getMinKeystoneLevelField = () => {
    if (!config.recordDungeons) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label htmlFor="minKeystoneLevel" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.MinimumKeystoneLevelLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.minKeystoneLevel.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.minKeystoneLevel >= 0 ? config.minKeystoneLevel : ''}
          name="minKeystoneLevel"
          disabled={!config.recordDungeons}
          onChange={setMinKeystoneLevel}
          type="numeric"
          min={2}
        />
      </div>
    );
  };

  const getChallengeModeField = () => {
    if (!config.recordClassic) {
      return <></>;
    }

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label htmlFor="recordChallengeModes" className="flex items-center">
          {getLocalePhrase(appState.language, Phrase.ChallengeModeLabel)}
          <Tooltip
            content={getLocalePhrase(
              appState.language,
              configSchema.recordChallengeModes.description,
            )}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('recordChallengeModes', setRecordChallengeModes)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row gap-x-6">
        {getRecordRaidSwitch()}
        {getRecordCurrentEncountersOnlySwitch()}
        {getMinEncounterDurationField()}
        {getRaidOverrunField()}
        {getMinRaidDifficultySelect()}
      </div>

      <div className="flex flex-col gap-y-2">
        <div className="flex flex-row gap-x-6">
          {getRecordDungeonSwitch()}
          {getChallengeModeField()}
          {getMinKeystoneLevelField()}
          {getDungeonOverrunField()}
        </div>
      </div>
    </div>
  );
};

export default PVESettings;
