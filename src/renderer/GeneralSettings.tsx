import * as React from 'react';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import { Switch } from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
import { setConfigValues, useSettings } from './useSettings';
import { pathSelect } from './rendererutils';

const style = {
  width: '450px',
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused fieldset': { borderColor: '#bb4220' },
    '& > fieldset': { borderColor: 'black' },
  },
  '& .MuiInputLabel-root': { color: 'white' },
  '& label.Mui-focused': { color: '#bb4220' },
};

const formControlLabelStyle = { color: 'white' };

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

const GeneralSettings = () => {
  const [config, setConfig] = useSettings();

  React.useEffect(() => {
    setConfigValues({
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      seperateBufferPath: config.seperateBufferPath,
    });
  }, [config.seperateBufferPath, config.storagePath, config.bufferStoragePath]);

  const setSeperateBufferPath = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        bufferStoragePath: '',
        seperateBufferPath: event.target.checked,
      };
    });
  };

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

  const setStoragePath = async () => {
    const newPath = await pathSelect();

    setConfig((prevState) => {
      return {
        ...prevState,
        storagePath: newPath,
      };
    });
  };

  const getStoragePathField = () => {
    return (
      <Box>
        <TextField
          name="storagePath"
          value={config.storagePath}
          label="Storage Path"
          variant="outlined"
          onClick={setStoragePath}
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
      </Box>
    );
  };

  const setBufferPath = async () => {
    const newPath = await pathSelect();

    setConfig((prevState) => {
      return {
        ...prevState,
        bufferStoragePath: newPath,
      };
    });
  };

  const getBufferPathField = () => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          name="bufferStoragePath"
          value={config.bufferStoragePath}
          label="Buffer Path"
          variant="outlined"
          disabled={!config.seperateBufferPath}
          // TODO: onClick still fires when disabled, restyle as button? https://github.com/mui/material-ui/issues/32560
          onClick={setBufferPath}
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
        <FormControlLabel
          control={getSwitch('seperateBufferPath', setSeperateBufferPath)}
          label="Seperate Buffer Path"
          labelPlacement="top"
          style={formControlLabelStyle}
        />
      </Box>
    );
  };

  const setMaxStorage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        maxStorage: parseInt(event.target.value, 10),
      };
    });
  };

  const getMaxStorageField = () => {
    return (
      <Box>
        <TextField
          name="maxStorage"
          value={config.maxStorage}
          onChange={setMaxStorage}
          label="Max Storage (GB)"
          variant="outlined"
          type="number"
          error={config.maxStorage < 0}
          helperText={config.maxStorage < 0 ? 'Must be positive' : ' '}
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
      </Box>
    );
  };

  return (
    <Box>
      {getStoragePathField()}
      {getBufferPathField()}
      {getMaxStorageField()}
    </Box>
  );
};

export default GeneralSettings;
