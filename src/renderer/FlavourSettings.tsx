import FormControlLabel from '@mui/material/FormControlLabel';
import { Box, IconButton, Switch, TextField, Tooltip } from '@mui/material';
import { ConfigurationSchema, configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import React from 'react';
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

const FlavourSettings: React.FC = () => {
  const [config, setConfig] = useSettings();

  React.useEffect(() => {
    setConfigValues({
      recordRetail: config.recordRetail,
      retailLogPath: config.retailLogPath,
      recordClassic: config.recordClassic,
      classicLogPath: config.classicLogPath,
    });
  }, [
    config.recordRetail,
    config.recordClassic,
    config.retailLogPath,
    config.classicLogPath,
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

  const setRecordRetail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordRetail: event.target.checked,
      };
    });
  };

  const setRecordClassic = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        recordClassic: event.target.checked,
      };
    });
  };

  const setRetailLogPath = async () => {
    const newPath = await pathSelect();

    setConfig((prevState) => {
      return {
        ...prevState,
        retailLogPath: newPath,
      };
    });
  };

  const getRetailSettings = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <FormControlLabel
          control={getSwitch('recordRetail', setRecordRetail)}
          label="Retail"
          labelPlacement="top"
          style={formControlLabelStyle}
        />
        <Box sx={{ display: 'flex' }}>
          <TextField
            value={config.retailLogPath}
            disabled={!config.recordRetail}
            label="Retail Log Path"
            variant="outlined"
            onClick={setRetailLogPath}
            InputLabelProps={{ shrink: true }}
            sx={{ ...style, my: 1 }}
            inputProps={{ style: { color: 'white' } }}
          />
          <Tooltip
            title={configSchema.retailLogPath.description}
            sx={{ position: 'relative', right: '0px', top: '17px' }}
          >
            <IconButton>
              <InfoIcon style={{ color: 'white' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  };

  const setClassicLogPath = async () => {
    const newPath = await pathSelect();

    setConfig((prevState) => {
      return {
        ...prevState,
        classicLogPath: newPath,
      };
    });
  };

  const getClassicSettings = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <FormControlLabel
          control={getSwitch('recordClassic', setRecordClassic)}
          label="Classic"
          labelPlacement="top"
          style={formControlLabelStyle}
        />
        <Box sx={{ display: 'flex' }}>
          <TextField
            value={config.classicLogPath}
            disabled={!config.recordClassic}
            label="Classic Log Path"
            variant="outlined"
            onClick={setClassicLogPath}
            InputLabelProps={{ shrink: true }}
            sx={{ ...style, my: 1 }}
            inputProps={{ style: { color: 'white' } }}
          />
          <Tooltip
            title={configSchema.classicLogPath.description}
            sx={{ position: 'relative', right: '0px', top: '17px' }}
          >
            <IconButton>
              <InfoIcon style={{ color: 'white' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {getRetailSettings()}
      {getClassicSettings()}
    </Box>
  );
};

export default FlavourSettings;
