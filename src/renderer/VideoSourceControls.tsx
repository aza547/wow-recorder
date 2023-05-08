import {
  Box,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import React from 'react';
import { useSettings, setConfigValues } from 'settings/useSettings';
import { OurDisplayType } from 'main/types';

const ipc = window.electron.ipcRenderer;

const VideoSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const displayConfiguration = ipc.sendSync('getAllDisplays', []);
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
    </Box>
  );
};

export default VideoSourceControls;
