import * as React from 'react';
import Box from '@mui/material/Box';
import {
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ConfigurationSchema } from 'main/configSchema';
import { CloudStatus, RecStatus } from 'main/types';
import { useState } from 'react';
import CloudIcon from '@mui/icons-material/Cloud';
import { setConfigValues, useSettings } from './useSettings';

const ipc = window.electron.ipcRenderer;

const raidDifficultyOptions = ['LFR', 'Normal', 'Heroic', 'Mythic'];

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

let debounceTimer: NodeJS.Timer | undefined;

interface IProps {
  recorderStatus: RecStatus;
}

const CloudSettings = (props: IProps) => {
  const { recorderStatus } = props;
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({
    usageGB: 0,
    maxUsageGB: 0,
  });

  React.useEffect(() => {
    if (initialRender.current) {
      // Drop out on initial render after getting the cloud status,
      // we don't need to set config. The first time we load.
      ipc.sendMessage('getCloudStatus', []);
      initialRender.current = false;
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      setConfigValues({
        cloudStorage: config.cloudStorage,
        cloudAccountName: config.cloudAccountName,
        cloudAccountPassword: config.cloudAccountPassword,
        cloudGuildName: config.cloudGuildName,
        cloudUpload: config.cloudUpload,
        cloudUpload2v2: config.cloudUpload2v2,
        cloudUpload3v3: config.cloudUpload3v3,
        cloudUpload5v5: config.cloudUpload5v5,
        cloudUploadSkirmish: config.cloudUploadSkirmish,
        cloudUploadSoloShuffle: config.cloudUploadSoloShuffle,
        cloudUploadDungeons: config.cloudUploadDungeons,
        cloudUploadRaids: config.cloudUploadRaids,
        cloudUploadBattlegrounds: config.cloudUploadBattlegrounds,
        cloudUploadRaidMinDifficulty: config.cloudUploadRaidMinDifficulty,
        cloudUploadDungeonMinLevel: config.cloudUploadDungeonMinLevel,
        chatOverlayOwnImage: config.chatOverlayOwnImage,
      });

      // Inform the backend of a settings change so we can update config
      // and validate it's good.
      ipc.sendMessage('settingsChange', []);
    }, 500);
  }, [
    config.cloudStorage,
    config.cloudAccountName,
    config.cloudAccountPassword,
    config.cloudGuildName,
    config.cloudUpload,
    config.cloudUpload2v2,
    config.cloudUpload3v3,
    config.cloudUpload5v5,
    config.cloudUploadSkirmish,
    config.cloudUploadSoloShuffle,
    config.cloudUploadDungeons,
    config.cloudUploadRaids,
    config.cloudUploadBattlegrounds,
    config.cloudUploadRaidMinDifficulty,
    config.cloudUploadDungeonMinLevel,
    config.chatOverlayOwnImage,
  ]);

  React.useEffect(() => {
    ipc.on('updateCloudStatus', (status) => {
      setCloudStatus(status as CloudStatus);
    });
  }, []);

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
        Some settings in this category are currently hidden as they can not be
        modified while a recording is active.
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

  const getSwitchForm = (
    preference: keyof ConfigurationSchema,
    label: string,
    width: string | undefined = undefined
  ) => {
    const changeFn = (event: React.ChangeEvent<HTMLInputElement>) => {
      setConfig((prevState) => {
        return {
          ...prevState,
          [preference]: event.target.checked,
        };
      });
    };

    return (
      <FormControlLabel
        control={getSwitch(preference, changeFn)}
        label={label}
        labelPlacement="top"
        style={{ color: 'white', width }}
      />
    );
  };

  const formControlStyle = { width: '100%' };

  const style = {
    m: 1,
    width: '100%',
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

  const setMinRaidThreshold = (event: SelectChangeEvent<string>) => {
    const {
      target: { value },
    } = event;

    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadRaidMinDifficulty: value,
      };
    });
  };

  const getMinRaidDifficultySelect = () => {
    if (!config.cloudUploadRaids) {
      return <></>;
    }

    return (
      <FormControl sx={{ ...formControlStyle, maxWidth: '250px' }}>
        <InputLabel sx={{ ...style, maxWidth: '250px' }}>
          Upload Difficulty Threshold
        </InputLabel>
        <Select
          value={config.cloudUploadRaidMinDifficulty}
          disabled={!config.cloudUploadRaids}
          label="Upload Difficulty Threshold"
          variant="outlined"
          onChange={setMinRaidThreshold}
          sx={{ ...style, maxWidth: '250px' }}
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

  const setMinKeystoneLevel = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        cloudUploadDungeonMinLevel: parseInt(event.target.value, 10),
      };
    });
  };

  const getMinKeystoneLevelField = () => {
    if (!config.cloudUploadDungeons) {
      return <></>;
    }

    return (
      <TextField
        value={config.cloudUploadDungeonMinLevel}
        onChange={setMinKeystoneLevel}
        disabled={!config.cloudUploadDungeons}
        label="Upload Level Threshold"
        variant="outlined"
        type="number"
        error={config.cloudUploadDungeonMinLevel < 2}
        InputLabelProps={{ shrink: true, style: { color: 'white' } }}
        sx={{ ...style, maxWidth: '250px' }}
        inputProps={{ min: 0, style: { color: 'white' } }}
      />
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

        // We disable the own image property if we've just turned off
        // cloud storage. It's a paid feature.
        newState.chatOverlayOwnImage = false;
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

  const getCloudUploadCategorySettings = () => {
    return (
      <>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            width: '100%',
            mt: 1,
          }}
        >
          {getSwitchForm('cloudUploadRaids', 'Upload Raids', '125px')}
          {getMinRaidDifficultySelect()}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'start',
            width: '100%',
          }}
        >
          {getSwitchForm('cloudUploadDungeons', 'Upload Mythic+', '125px')}
          {getMinKeystoneLevelField()}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'start',
            width: '100%',
            my: 1,
          }}
        >
          {getSwitchForm('cloudUpload2v2', 'Upload 2v2', '125px')}
          {getSwitchForm('cloudUpload3v3', 'Upload 3v3', '125px')}
          {getSwitchForm('cloudUpload5v5', 'Upload 5v5', '125px')}
          {getSwitchForm('cloudUploadSkirmish', 'Upload Skirmish', '125px')}
          {getSwitchForm(
            'cloudUploadSoloShuffle',
            'Upload Solo Shuffle',
            '150px'
          )}
          {getSwitchForm(
            'cloudUploadBattlegrounds',
            'Upload Battlegrounds',
            '160px'
          )}
        </Box>
      </>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {getDisabledText()}

      <Box sx={{ display: 'flex', flexDirection: 'row', mb: 1 }}>
        {getCloudSwitch()}
        {getCloudUploadSwitch()}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        {getCloudAccountNameField()}
        {getCloudAccountPasswordField()}
        {getCloudGuildField()}
      </Box>

      {config.cloudUpload && getCloudUsageBar()}
      {config.cloudUpload && getCloudUploadCategorySettings()}
    </Box>
  );
};

export default CloudSettings;
