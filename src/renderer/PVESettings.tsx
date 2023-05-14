import FormControlLabel from '@mui/material/FormControlLabel';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  TextField,
} from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
import React from 'react';
import { setConfigValues, useSettings } from './useSettings';

const formControlStyle = { m: 1, width: '200px' };

const style = {
  width: '300px',
  color: 'white',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'white',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#bb4220',
  },
  '&.Mui-focused': {
    borderColor: '#bb4220',
    color: '#bb4220',
  },
  '&:hover': {
    '&& fieldset': {
      borderColor: '#bb4220',
    },
  },
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused fieldset': {
      borderColor: '#bb4220',
    },
  },
  '.MuiSvgIcon-root ': {
    fill: 'white !important',
  },
};

const switchStyle = {
  '& .MuiSwitch-switchBase': {
    '&.Mui-checked': {
      color: '#fff',
      '+.MuiSwitch-track': {
        backgroundColor: '#bb4220',
        opacity: 1.0,
      },
    },
    '&.Mui-disabled + .MuiSwitch-track': {
      opacity: 0.5,
    },
  },
};

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
    });
  }, [
    config.minEncounterDuration,
    config.minKeystoneLevel,
    config.minRaidDifficulty,
    config.recordDungeons,
    config.recordRaids,
  ]);

  const getSwitch = (
    preference: keyof ConfigurationSchema,
    changeFn: (event: React.ChangeEvent<HTMLInputElement>) => void
  ) => (
    <Switch
      sx={switchStyle}
      checked={Boolean(config[preference])}
      name={preference}
      onChange={changeFn}
    />
  );

  const setRecordRaids = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordRaids: event.target.checked,
      };
    });
  };

  const getRecordRaidSwitch = () => {
    return (
      <FormControlLabel
        control={getSwitch('recordRaids', setRecordRaids)}
        label="Record Raids"
        labelPlacement="top"
        style={{ color: 'white', width: '200px' }}
      />
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
      <TextField
        value={config.minEncounterDuration}
        label="Minimum Encounter Duration (secs)"
        disabled={!config.recordRaids}
        onChange={setMinEncounterDuration}
        variant="outlined"
        type="number"
        InputLabelProps={{ shrink: true, style: { color: 'white' } }}
        sx={style}
        inputProps={{ min: 0, style: { color: 'white' } }}
      />
    );
  };

  const setMinRaidDifficulty = (event: SelectChangeEvent<string>) => {
    const {
      target: { value },
    } = event;

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
      <FormControl sx={formControlStyle}>
        <InputLabel sx={style}>Minimum Raid Difficulty</InputLabel>
        <Select
          value={config.minRaidDifficulty}
          disabled={!config.recordRaids}
          label="Minimum Raid Difficulty"
          variant="outlined"
          onChange={setMinRaidDifficulty}
          sx={style}
        >
          {raidDifficultyOptions.map((difficulty: string) => (
            <MenuItem key={difficulty} value={difficulty}>
              {difficulty}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  const setRecordDungeons = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordDungeons: event.target.checked,
      };
    });
  };

  const getRecordDungeonSwitch = () => {
    return (
      <FormControlLabel
        control={getSwitch('recordDungeons', setRecordDungeons)}
        label="Record Mythic+"
        labelPlacement="top"
        style={{ color: 'white', width: '200px' }}
      />
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
      <TextField
        value={config.minKeystoneLevel}
        onChange={setMinKeystoneLevel}
        disabled={!config.recordDungeons}
        label="Minimum Keystone Level"
        variant="outlined"
        type="number"
        error={config.minKeystoneLevel < 0}
        InputLabelProps={{ shrink: true, style: { color: 'white' } }}
        sx={style}
        inputProps={{ min: 0, style: { color: 'white' } }}
      />
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {getRecordRaidSwitch()}
        {getMinEncounterDurationField()}
        {getMinRaidDifficultySelect()}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {getRecordDungeonSwitch()}
        {getMinKeystoneLevelField()}
      </Box>
    </Box>
  );
};

export default PVESettings;
