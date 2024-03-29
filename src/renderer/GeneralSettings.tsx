import * as React from 'react';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import { LinearProgress, Switch, Tooltip, Typography } from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
import { CloudStatus, DiskStatus, RecStatus } from 'main/types';
import { useEffect, useRef, useState } from 'react';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import { QualityPresets } from 'main/obsEnums';
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

  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({
    usageGB: 0,
    maxUsageGB: 250,
  });

  const [diskStatus, setDiskStatus] = useState<DiskStatus>({
    usageGB: 0,
    maxUsageGB: config.maxStorage,
  });

  useEffect(() => {
    // Populate the progress bar on initial mount, and also on config
    // change; the user could change cloud accounts.
    ipc.sendMessage('getCloudStatus', []);
    ipc.sendMessage('getDiskStatus', []);

    if (initialRenderVideoConfig.current) {
      // Drop out if initial render, we don't care about settings
      // changes until the user has had a chance to make some.
      initialRenderVideoConfig.current = false;
      return;
    }

    // We don't allow ultra quality with cloud upload, so drop it here if
    // we've just turned cloud upload on.
    const ultra = config.obsQuality === QualityPresets.ULTRA;
    const dropQuality = config.cloudUpload && ultra;
    const obsQuality = dropQuality ? QualityPresets.HIGH : config.obsQuality;

    setConfigValues({
      storagePath: config.storagePath,
      bufferStoragePath: config.bufferStoragePath,
      separateBufferPath: config.separateBufferPath,
      maxStorage: config.maxStorage,
      cloudStorage: config.cloudStorage,
      cloudUpload: config.cloudUpload,
      cloudAccountName: config.cloudAccountName,
      cloudAccountPassword: config.cloudAccountPassword,
      cloudGuildName: config.cloudGuildName,
      obsQuality,
    });

    // Inform the backend of a settings change so we can update config
    // and validate it's good.
    ipc.sendMessage('settingsChange', []);
  }, [
    config.separateBufferPath,
    config.storagePath,
    config.bufferStoragePath,
    config.maxStorage,
    config.cloudStorage,
    config.cloudAccountName,
    config.cloudAccountPassword,
    config.cloudGuildName,
    config.cloudUpload,
    config.obsQuality,
  ]);

  ipc.on('updateCloudStatus', (status) => {
    setCloudStatus(status as CloudStatus);
  });

  ipc.on('updateDiskStatus', (status) => {
    setDiskStatus(status as DiskStatus);
  });

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

  const setCloudStorage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      const cloudStorage = event.target.checked;

      const newState = {
        ...prevState,
        cloudStorage,
      };

      if (!cloudStorage) {
        // Can't have upload on if cloud storage is off so also set that
        // to false if we're disabling cloud storage.
        newState.cloudUpload = false;
      }

      return newState;
    });
  };

  const setCloudUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUpload: event.target.checked,
      };
    });
  };

  const getCloudSwitch = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <Box>
        <FormControlLabel
          control={getSwitch('cloudStorage', setCloudStorage)}
          label="Cloud Playback"
          labelPlacement="top"
          style={formControlLabelStyle}
          disabled={isComponentDisabled()}
        />
      </Box>
    );
  };

  const getCloudUploadSwitch = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <Box>
        <FormControlLabel
          control={getSwitch('cloudUpload', setCloudUpload)}
          label="Cloud Upload"
          labelPlacement="top"
          style={formControlLabelStyle}
          disabled={isComponentDisabled()}
        />
      </Box>
    );
  };

  const setCloudAccountName = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudAccountName: event.target.value,
      };
    });
  };

  const getCloudAccountNameField = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <Box>
        <TextField
          name="cloudAccountName"
          value={config.cloudAccountName}
          label="Account Name"
          variant="outlined"
          spellCheck={false}
          onChange={setCloudAccountName}
          error={config.cloudAccountName === ''}
          helperText={config.cloudAccountName === '' ? 'Must not be empty' : ''}
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          sx={{ ...style, m: 1, width: '300px' }}
          inputProps={{ style: { color: 'white' } }}
        />
      </Box>
    );
  };

  const setCloudPassword = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudAccountPassword: event.target.value,
      };
    });
  };

  const getCloudAccountPasswordField = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <Box>
        <TextField
          name="cloudAccountPassword"
          value={config.cloudAccountPassword}
          label="Account Pasword"
          type="password"
          variant="outlined"
          error={config.cloudAccountPassword === ''}
          helperText={
            config.cloudAccountPassword === '' ? 'Must not be empty' : ''
          }
          onChange={setCloudPassword}
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          sx={{ ...style, m: 1, width: '300px' }}
          inputProps={{ style: { color: 'white' } }}
        />
      </Box>
    );
  };

  const setCloudGuild = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudGuildName: event.target.value,
      };
    });
  };

  const getCloudGuildField = () => {
    if (isComponentDisabled() || !config.cloudStorage) {
      return <></>;
    }

    return (
      <Box>
        <TextField
          name="cloudGuildName"
          value={config.cloudGuildName}
          label="Guild Name"
          variant="outlined"
          spellCheck={false}
          error={config.cloudGuildName === ''}
          helperText={config.cloudGuildName === '' ? 'Must not be empty' : ''}
          onChange={setCloudGuild}
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          sx={{ ...style, m: 1, width: '300px' }}
          inputProps={{ style: { color: 'white' } }}
        />
      </Box>
    );
  };

  const getCloudUsageBar = () => {
    if (!config.cloudStorage) {
      return <></>;
    }

    const usage = Math.round(cloudStatus.usageGB);
    const max = Math.round(cloudStatus.maxUsageGB);
    const perc = (100 * usage) / max;

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
        <Tooltip title="Cloud usage">
          <CloudIcon
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
          {usage}GB of {max}GB
        </Typography>
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

      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        {getCloudSwitch()}
        {getCloudUploadSwitch()}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        {getCloudAccountNameField()}
        {getCloudAccountPasswordField()}
        {getCloudGuildField()}
      </Box>

      {getDiskUsageBar()}
      {getCloudUsageBar()}
    </Box>
  );
};

export default GeneralSettings;
