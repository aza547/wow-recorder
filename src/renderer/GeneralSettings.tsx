import * as React from 'react';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import { Switch, Typography } from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
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

interface IProps {
  recorderStatus: RecStatus;
}

const ipc = window.electron.ipcRenderer;

const GeneralSettings: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;
  const [config, setConfig] = useSettings();
  const initialRenderVideoConfig = React.useRef(true);
  const initialRenderSizeMonitorConfig = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRenderVideoConfig.current) {
      initialRenderVideoConfig.current = false;
      return;
    }

    setConfigValues({
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      separateBufferPath: config.separateBufferPath,
    });

    ipc.sendMessage('settingsChange', []);
  }, [config.separateBufferPath, config.storagePath, config.bufferStoragePath]);

  // A change to maxStorage doesn't need to restart the recorder, only the
  // size monitor changes here.
  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRenderSizeMonitorConfig.current) {
      initialRenderSizeMonitorConfig.current = false;
      return;
    }

    setConfigValues({
      maxStorage: config.maxStorage,
    });
  }, [config.maxStorage]);

  const setSeparateBufferPath = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        bufferStoragePath: '',
        separateBufferPath: event.target.checked,
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

  const setStoragePath = async () => {
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
        storagePath: newPath,
      };
    });
  };

  const validateStoragePath = () => {
    // todo validate this
    if (config.storagePath === '') {
      return false;
    }

    return true;
  };

  const storagePathHelperText = () => {
    if (validateStoragePath()) {
      return '';
    }

    return 'Invalid storage path';
  };

  const getStoragePathField = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <Box>
        <TextField
          name="storagePath"
          value={config.storagePath}
          label="Storage Path"
          variant="outlined"
          onClick={setStoragePath}
          error={!validateStoragePath()}
          disabled={isComponentDisabled()}
          helperText={storagePathHelperText()}
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          sx={{ ...style, my: 1, width: '600px' }}
          inputProps={{ style: { color: 'white' } }}
        />
      </Box>
    );
  };

  const setBufferPath = async () => {
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
        bufferStoragePath: newPath,
      };
    });
  };

  const getBufferSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <Box>
        <FormControlLabel
          control={getSwitch('separateBufferPath', setSeparateBufferPath)}
          label="Separate Buffer Path"
          labelPlacement="top"
          style={formControlLabelStyle}
          disabled={isComponentDisabled()}
        />
      </Box>
    );
  };

  const getBufferPathField = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    if (!config.separateBufferPath) {
      return <></>;
    }

    return (
      <Box>
        <TextField
          name="bufferStoragePath"
          value={config.bufferStoragePath}
          label="Buffer Path"
          variant="outlined"
          onClick={setBufferPath}
          disabled={isComponentDisabled()}
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          sx={{ ...style, my: 1, width: '600px' }}
          inputProps={{ style: { color: 'white' } }}
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
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <Box>
        <TextField
          value={config.maxStorage}
          onChange={setMaxStorage}
          label="Max Storage (GB)"
          variant="outlined"
          disabled={isComponentDisabled()}
          type="number"
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          sx={{ ...style, my: 1 }}
          inputProps={{ min: 0, style: { color: 'white' } }}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {getDisabledText()}
      {getStoragePathField()}
      {getMaxStorageField()}
      {getBufferSwitch()}
      {getBufferPathField()}
    </Box>
  );
};

export default GeneralSettings;
