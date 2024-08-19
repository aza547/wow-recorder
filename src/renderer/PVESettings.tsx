import { configSchema, ConfigurationSchema } from 'main/configSchema';
import React from 'react';
import { Info } from 'lucide-react';
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

const raidDifficultyOptions = ['LFR', 'Normal', 'Heroic', 'Mythic'];

const PVESettings: React.FC = () => {
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      recordRaids: config.recordRaids,
      minEncounterDuration: config.minEncounterDuration,
      minRaidDifficulty: config.minRaidDifficulty,
      recordDungeons: config.recordDungeons,
      minKeystoneLevel: config.minKeystoneLevel,
      raidOverrun: config.raidOverrun,
      dungeonOverrun: config.dungeonOverrun,
    });
  }, [
    config.dungeonOverrun,
    config.minEncounterDuration,
    config.minKeystoneLevel,
    config.minRaidDifficulty,
    config.raidOverrun,
    config.recordDungeons,
    config.recordRaids,
  ]);

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
          Record Raids
          <Tooltip content={configSchema.recordRaids.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          {getSwitch('recordRaids', setRecordRaids)}
        </div>
      </div>
    );
  };

  const setMinEncounterDuration = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        minEncounterDuration: parseInt(event.target.value, 10),
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
          Minimum Encounter Duration (sec)
          <Tooltip
            content={configSchema.minEncounterDuration.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.minEncounterDuration}
          name="minEncounterDuration"
          disabled={!config.recordRaids}
          onChange={setMinEncounterDuration}
          type="number"
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
          Minimum Raid Difficulty
          <Tooltip
            content={configSchema.minRaidDifficulty.description}
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
            <SelectValue placeholder="Placeholder" />
          </SelectTrigger>
          <SelectContent>
            {raidDifficultyOptions.map((difficulty: string) => (
              <SelectItem key={difficulty} value={difficulty}>
                {difficulty}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const setRaidOverrun = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value, 10);

    if (newValue < 0 || newValue > 60) {
      // Don't allow invalid config to go further.
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        raidOverrun: newValue,
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
          Raid Overrun (sec)
          <Tooltip content={configSchema.raidOverrun.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.raidOverrun}
          name="raidOverrun"
          disabled={!config.recordRaids}
          onChange={setRaidOverrun}
          type="number"
        />
      </div>
    );
  };

  const setDungeonOverrun = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value, 10);

    if (newValue < 0 || newValue > 60) {
      // Don't allow invalid config to go further.
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        dungeonOverrun: newValue,
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
          Mythic+ Overrun (sec)
          <Tooltip content={configSchema.dungeonOverrun.description} side="top">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.dungeonOverrun}
          name="dungeonOverrun"
          disabled={!config.recordDungeons}
          onChange={setDungeonOverrun}
          type="number"
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

  const getRecordDungeonSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label htmlFor="recordDungeons" className="flex items-center">
          Record Mythic+
          <Tooltip content={configSchema.recordDungeons.description} side="top">
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
    setConfig((prevState) => {
      return {
        ...prevState,
        minKeystoneLevel: parseInt(event.target.value, 10),
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
          Minimum Keystone Level
          <Tooltip
            content={configSchema.minKeystoneLevel.description}
            side="top"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Input
          value={config.minKeystoneLevel}
          name="minKeystoneLevel"
          disabled={!config.recordDungeons}
          onChange={setMinKeystoneLevel}
          type="number"
          min={2}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row gap-x-6">
        {getRecordRaidSwitch()}
        {getMinEncounterDurationField()}
        {getRaidOverrunField()}
        {getMinRaidDifficultySelect()}
      </div>

      <div className="flex flex-row gap-x-6">
        {getRecordDungeonSwitch()}
        {getMinKeystoneLevelField()}
        {getDungeonOverrunField()}
      </div>
    </div>
  );
};

export default PVESettings;
