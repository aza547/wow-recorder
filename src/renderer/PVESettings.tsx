import FormControlLabel from '@mui/material/FormControlLabel';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import { ConfigurationSchema, configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import React from 'react';
import { setConfigValues, useSettings } from './useSettings';

const style = {
  width: '450px',
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused fieldset': { borderColor: '#bb4220' },
    '& > fieldset': { borderColor: 'black' },
  },
  '& .MuiInputLabel-root': { color: 'white' },
  '& label.Mui-focused': { color: '#bb4220' },
};

const formControlStyle = { m: 1, width: '100%' };

const selectStyle = {
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

  React.useEffect(() => {
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
        label="Raids"
        labelPlacement="top"
        style={{ color: 'white' }}
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
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          value={config.minEncounterDuration}
          label="Minimum Encounter Duration"
          disabled={!config.recordRaids}
          onChange={setMinEncounterDuration}
          variant="outlined"
          type="number"
          error={config.minEncounterDuration < 1}
          helperText={
            config.minEncounterDuration < 1 ? 'Must be 1 or greater' : ' '
          }
          InputLabelProps={{ shrink: true }}
          sx={{ ...style }}
          inputProps={{ style: { color: 'white' } }}
        />
        <Tooltip title={configSchema.minEncounterDuration.description}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
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
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl size="small" sx={formControlStyle}>
          <InputLabel sx={selectStyle}>Minimum Raid Difficulty</InputLabel>
          <Select
            value={config.minRaidDifficulty}
            disabled={!config.recordRaids}
            label="Minimum Raid Difficulty"
            onChange={setMinRaidDifficulty}
            sx={selectStyle}
          >
            {raidDifficultyOptions.map((difficulty: string) => (
              <MenuItem key={difficulty} value={difficulty}>
                {difficulty}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title={configSchema.minRaidDifficulty.description}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
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
        label="Mythic+"
        labelPlacement="top"
        style={{ color: 'white' }}
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
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          value={config.minKeystoneLevel}
          onChange={setMinKeystoneLevel}
          disabled={!config.recordDungeons}
          label="Minimum Keystone Level"
          variant="outlined"
          type="number"
          error={config.minKeystoneLevel < 1}
          helperText={
            config.minKeystoneLevel < 1 ? 'Must be 1 or greater' : ' '
          }
          InputLabelProps={{ shrink: true }}
          sx={{ ...style }}
          inputProps={{ style: { color: 'white' }, min: 2 }}
        />
        <Tooltip title={configSchema.minKeystoneLevel.description}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
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
        }}
      >
        {getRecordDungeonSwitch()}
        {getMinKeystoneLevelField()}
      </Box>
    </Box>
  );
};

export default PVESettings;
