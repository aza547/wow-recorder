import {
  Box,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import React from 'react';
import { useSettings, setConfigValues } from 'settings/useSettings';
import { OurDisplayType } from 'main/types';
import { configSchema } from 'main/configSchema';

const ipc = window.electron.ipcRenderer;

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

const VideoSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const displayConfiguration = ipc.sendSync('getAllDisplays', []);
  const availableAudioDevices = ipc.sendSync('getAudioDevices', []);
  setConfigValues(config);

  const setOBSCaptureMode = (
    _event: React.MouseEvent<HTMLElement>,
    mode: string
  ) => {
    if (mode === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        obsCaptureMode: mode,
      };
    });
  };

  const setMonitor = (
    _event: React.MouseEvent<HTMLElement>,
    display: number
  ) => {
    if (display === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        monitorIndex: display,
      };
    });
  };

  const setCaptureCursor = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        captureCursor: event.target.checked,
      };
    });
  };

  React.useEffect(() => {
    ipc.sendMessage('recorder', [
      'scene',
      config.obsCaptureMode,
      config.monitorIndex,
      config.captureCursor,
    ]);
  }, [config.monitorIndex, config.obsCaptureMode, config.captureCursor]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        ml: 1,
        mr: 1,
      }}
    >
      <FormControlLabel
        control={
          <ToggleButtonGroup
            value={config.obsCaptureMode}
            exclusive
            onChange={setOBSCaptureMode}
            sx={{ border: '1px solid white' }}
          >
            <ToggleButton
              value="game_capture"
              key="game_capture"
              sx={{
                color: 'white',
                height: '30px',
                '&.Mui-selected, &.Mui-selected:hover': {
                  color: 'white',
                  backgroundColor: '#bb4420',
                },
              }}
            >
              Game
            </ToggleButton>
            <ToggleButton
              value="monitor_capture"
              key="monitor_capture"
              sx={{
                color: 'white',
                height: '30px',
                '&.Mui-selected, &.Mui-selected:hover': {
                  color: 'white',
                  backgroundColor: '#bb4420',
                },
              }}
            >
              Monitor
            </ToggleButton>
          </ToggleButtonGroup>
        }
        label="Capture Mode"
        labelPlacement="top"
        sx={{ color: 'white' }}
      />
      {config.obsCaptureMode === 'monitor_capture' && (
        <FormControlLabel
          control={
            <ToggleButtonGroup
              value={config.monitorIndex}
              exclusive
              onChange={setMonitor}
              sx={{ border: '1px solid white' }}
            >
              {displayConfiguration.map((display: OurDisplayType) => (
                <ToggleButton
                  value={display.index}
                  key={display.index}
                  sx={{
                    color: 'white',
                    height: '30px',
                    '&.Mui-selected, &.Mui-selected:hover': {
                      color: 'white',
                      backgroundColor: '#bb4420',
                    },
                  }}
                >
                  {display.index + 1}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          }
          label="Monitor"
          labelPlacement="top"
          sx={{ color: 'white' }}
        />
      )}

      <FormControlLabel
        control={
          <Switch
            sx={switchStyle}
            checked={config.captureCursor}
            onChange={setCaptureCursor}
          />
        }
        label="Capture Cursor"
        labelPlacement="top"
        sx={{
          color: 'white',
        }}
      />
    </Box>
  );
};

export default VideoSourceControls;
