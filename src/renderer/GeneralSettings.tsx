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
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      separateBufferPath: config.separateBufferPath,
      maxStorage: config.maxStorage,
    });

    ipc.sendMessage('recorder', ['base']);
  }, [
    config.separateBufferPath,
    config.storagePath,
    config.bufferStoragePath,
    config.maxStorage,
  ]);

  const setseparateBufferPath = (
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
    return recorderStatus === RecStatus.Recording;
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
          fontSize: '1rem',
          fontFamily: '"Arial",sans-serif',
          fontStyle: 'italic',
          m: 1,
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        These settings can not be modified whilst a recording is active.
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
    return (
      <Box>
        <FormControlLabel
          control={getSwitch('separateBufferPath', setseparateBufferPath)}
          label="Separate Buffer Path"
          labelPlacement="top"
          style={formControlLabelStyle}
          disabled={isComponentDisabled()}
        />
      </Box>
    );
  };

  const getBufferPathField = () => {
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
