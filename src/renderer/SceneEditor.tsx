import {
  Box,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import React, { ChangeEvent } from 'react';
import {
  useSettings,
  setConfigValues,
  getConfigValue,
} from 'settings/useSettings';
import { OurDisplayType } from 'main/types';
import RecorderPreview from './RecorderPreview';
import ChatOverlaySlider from './ChatOverlaySlider';

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

const ipc = window.electron.ipcRenderer;
let debounceTimer: NodeJS.Timer | undefined;
const displayConfiguration = ipc.sendSync('getAllDisplays', []);

const SceneEditor: React.FC = () => {
  const [config, setConfig] = useSettings();
  const resolution = getConfigValue<string>('obsOutputResolution');
  const [xRes, yRes] = resolution.split('x').map((s) => parseInt(s, 10));

  React.useEffect(() => {
    ipc.sendMessage('overlay', [
      config.chatOverlayEnabled,
      config.chatOverlayWidth,
      config.chatOverlayHeight,
      config.chatOverlayXPosition,
      config.chatOverlayYPosition,
    ]);
  }, [
    config.chatOverlayEnabled,
    config.chatOverlayHeight,
    config.chatOverlayWidth,
    config.chatOverlayXPosition,
    config.chatOverlayYPosition,
  ]);

  React.useEffect(() => {
    ipc.sendMessage('recorder', [
      'scene',
      config.obsCaptureMode,
      config.monitorIndex,
    ]);
  }, [config.monitorIndex, config.obsCaptureMode]);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => setConfigValues(config), 1000);

  const setOverlayEnabled = (event: ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayEnabled: event.target.checked,
      };
    });
  };

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

  const setWidth = (width: number) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayWidth: width,
      };
    });
  };

  const setHeight = (height: number) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayHeight: height,
      };
    });
  };

  const setXPosition = (xPos: number) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayXPosition: xPos,
      };
    });
  };

  const setYPosition = (yPos: number) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayYPosition: yPos,
      };
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      }}
    >
      <Box sx={{ width: '100%', height: '100%' }}>
        <RecorderPreview />
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '12%',
          mb: 2,
          mt: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            width: '50%',
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
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            width: '50%',
            ml: 1,
            mr: 1,
          }}
        >
          <FormControlLabel
            control={
              <Switch
                sx={switchStyle}
                checked={config.chatOverlayEnabled}
                onChange={setOverlayEnabled}
              />
            }
            label="Chat Overlay"
            labelPlacement="top"
            sx={{ color: 'white' }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <FormControlLabel
              control={
                <ChatOverlaySlider
                  value={config.chatOverlayWidth}
                  disabled={!config.chatOverlayEnabled}
                  setValue={setWidth}
                  max={2000}
                />
              }
              label="Width"
              labelPlacement="start"
              sx={{
                color: 'white',
                '& .MuiFormControlLabel-label.Mui-disabled': {
                  color: 'white',
                },
              }}
            />
            <FormControlLabel
              control={
                <ChatOverlaySlider
                  value={config.chatOverlayHeight}
                  disabled={!config.chatOverlayEnabled}
                  setValue={setHeight}
                  max={1000}
                />
              }
              label="Height"
              labelPlacement="start"
              sx={{
                color: 'white',
                '& .MuiFormControlLabel-label.Mui-disabled': {
                  color: 'white',
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <FormControlLabel
              control={
                <ChatOverlaySlider
                  value={config.chatOverlayXPosition}
                  disabled={!config.chatOverlayEnabled}
                  setValue={setXPosition}
                  max={xRes}
                />
              }
              label="Horizonal"
              labelPlacement="start"
              sx={{
                color: 'white',
                '& .MuiFormControlLabel-label.Mui-disabled': {
                  color: 'white',
                },
              }}
            />
            <FormControlLabel
              control={
                <ChatOverlaySlider
                  value={config.chatOverlayYPosition}
                  disabled={!config.chatOverlayEnabled}
                  setValue={setYPosition}
                  max={yRes}
                />
              }
              label="Vertical"
              labelPlacement="start"
              sx={{
                color: 'white',
                '& .MuiFormControlLabel-label.Mui-disabled': {
                  color: 'white',
                },
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SceneEditor;
