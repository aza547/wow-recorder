import FormControlLabel from '@mui/material/FormControlLabel';
import { Box, Switch, TextField, Typography } from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
import React from 'react';
import { RecStatus } from 'main/types';
import { setConfigValues, useSettings } from './useSettings';
import { pathSelect } from './rendererutils';

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
};

const formControlLabelStyle = { color: 'white', width: '200px' };

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
      color: 'grey',
      backgroundColor: 'grey',
    },
    '&.Mui-disabled': {
      opacity: 0.5,
      color: 'grey',
      backgroundColor: 'grey',
    },
  },
};

interface IProps {
  recorderStatus: RecStatus;
}

const ipc = window.electron.ipcRenderer;

const FlavourSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      recordRetail: config.recordRetail,
      retailLogPath: config.retailLogPath,
      recordClassic: config.recordClassic,
      classicLogPath: config.classicLogPath,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.recordRetail,
    config.recordClassic,
    config.retailLogPath,
    config.classicLogPath,
  ]);

  const isComponentDisabled = () => {
    const isRecording = recorderStatus === RecStatus.Recording;
    const isOverrunning = recorderStatus === RecStatus.Overruning;
    return isRecording || isOverrunning;
  };

  const getDisabledText = () => {
    if (!isComponentDisabled()) {
      return <></>;
    }

    return (
      <Typography
        variant="h6"
        sx={{
          color: 'white',
          fontSize: '0.75rem',
          fontFamily: '"Arial",sans-serif',
          fontStyle: 'italic',
          m: 1,
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        These settings can not be modified while a recording is active.
      </Typography>
    );
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

  const validateRetailLogPath = () => {
    // todo validate it
    if (config.retailLogPath === '') {
      return false;
    }

    return true;
  };

  const retailLogPathHelperText = () => {
    if (validateRetailLogPath()) {
      return '';
    }

    return 'Invalid retail log path';
  };

  const getRetailSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <Box>
          <FormControlLabel
            disabled={isComponentDisabled()}
            control={getSwitch('recordRetail', setRecordRetail)}
            label="Record Retail"
            labelPlacement="top"
            style={formControlLabelStyle}
          />
        </Box>
        {config.recordRetail && (
          <TextField
            value={config.retailLogPath}
            disabled={!config.recordRetail || isComponentDisabled()}
            label="Retail Log Path"
            variant="outlined"
            error={!validateRetailLogPath()}
            helperText={retailLogPathHelperText()}
            onClick={setRetailLogPath}
            InputLabelProps={{ shrink: true, style: { color: 'white' } }}
            sx={{ ...style, width: '600px', my: 1 }}
            inputProps={{ style: { color: 'white' } }}
          />
        )}
      </Box>
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

  const validateClassicLogPath = () => {
    // todo validate it
    if (config.classicLogPath === '') {
      return false;
    }

    return true;
  };

  const classicLogPathHelperText = () => {
    if (validateClassicLogPath()) {
      return '';
    }

    return 'Invalid classic log path';
  };

  const getClassicSettings = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <Box>
          <FormControlLabel
            disabled={isComponentDisabled()}
            control={getSwitch('recordClassic', setRecordClassic)}
            label="Record Classic"
            labelPlacement="top"
            style={formControlLabelStyle}
          />
        </Box>
        {config.recordClassic && (
          <TextField
            value={config.classicLogPath}
            disabled={!config.recordClassic || isComponentDisabled()}
            label="Classic Log Path"
            variant="outlined"
            error={!validateClassicLogPath()}
            helperText={classicLogPathHelperText()}
            onClick={setClassicLogPath}
            InputLabelProps={{ shrink: true, style: { color: 'white' } }}
            sx={{ ...style, width: '600px', my: 1 }}
            inputProps={{ style: { color: 'white' } }}
          />
        )}
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
      {getDisabledText()}
      {getRetailSettings()}
      {getClassicSettings()}
    </Box>
  );
};

export default FlavourSettings;
