import * as React from 'react';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import { LinearProgress, Switch, Tooltip, Typography } from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
import { DiskStatus, RecStatus } from 'main/types';
import { useEffect, useRef, useState } from 'react';
import SaveIcon from '@mui/icons-material/Save';
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

const formControlLabelStyle = { color: 'white', m: 2 };

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
  const initialRenderVideoConfig = useRef(true);

  const [diskStatus, setDiskStatus] = useState<DiskStatus>({
    usageGB: 0,
    maxUsageGB: 0,
  });

  React.useEffect(() => {
    ipc.on('updateDiskStatus', (status) => {
      setDiskStatus(status as DiskStatus);
    });
  }, []);

  useEffect(() => {
    // Populate the progress bar on initial mount, and also on config
    // change; the user could change cloud accounts.
    ipc.sendMessage('getDiskStatus', []);

    if (initialRenderVideoConfig.current) {
      // Drop out if initial render, we don't care about settings
      // changes until the user has had a chance to make some.
      initialRenderVideoConfig.current = false;
      return;
    }

    setConfigValues({
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      separateBufferPath: config.separateBufferPath,
      maxStorage: config.maxStorage,
    });

    // Inform the backend of a settings change so we can update config
    // and validate it's good.
    ipc.sendMessage('settingsChange', []);
  }, [
    config.separateBufferPath,
    config.storagePath,
    config.bufferStoragePath,
    config.maxStorage,
  ]);

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

  const getStoragePathField = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <Box>
        <TextField
          name="storagePath"
          value={config.storagePath}
          label="Disk Storage Folder"
          variant="outlined"
          onClick={setStoragePath}
          error={config.storagePath === ''}
          disabled={isComponentDisabled()}
          helperText={config.storagePath === '' ? 'Must not be empty' : ''}
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
          label="Separate Buffer Folder"
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
          label="Buffer Folder"
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
          label="Max Disk Storage (GB)"
          variant="outlined"
          type="number"
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          sx={{ ...style, my: 1 }}
          inputProps={{ min: 0, style: { color: 'white' } }}
        />
      </Box>
    );
  };

  const getDiskUsageBar = () => {
    const usage = Math.round(diskStatus.usageGB);
    const max = Math.round(diskStatus.maxUsageGB);
    let perc = max === 0 ? 100 : (100 * usage) / max;
    if (perc > 100) perc = 100;
    const text =
      max === 0 ? `${usage}GB of Unlimited` : `${usage}GB of ${max}GB`;

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'left',
          width: '100%',
          my: 2,
        }}
      >
        <Tooltip title="Disk usage">
          <SaveIcon
            sx={{ color: 'white', height: '20px', width: '20px', mx: 1 }}
          />
        </Tooltip>
        <LinearProgress
          variant="determinate"
          value={perc}
          sx={{
            minWidth: '300px',
            height: '15px',
            borderRadius: '2px',
            border: '1px solid black',
            backgroundColor: 'white',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#bb4420',
            },
          }}
        />
        <Typography
          sx={{
            color: 'white',
            fontSize: '0.75rem',
            mx: '5px',
          }}
        >
          {text}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {getDisabledText()}

      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        {getStoragePathField()}
        {getBufferSwitch()}
      </Box>

      {getBufferPathField()}
      {getMaxStorageField()}
      {getDiskUsageBar()}
    </Box>
  );
};

export default GeneralSettings;
