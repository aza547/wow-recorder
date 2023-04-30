import { Box, FormControlLabel, Switch } from '@mui/material';
import React, { ChangeEvent } from 'react';
import {
  useOverlaySettings,
  setConfigValues,
  getConfigValue,
} from 'settings/useSettings';
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

const SceneEditor: React.FC = () => {
  const [overlayConfig, setOverlayConfig] = useOverlaySettings();
  const resolution = getConfigValue<string>('obsOutputResolution');
  const [xRes, yRes] = resolution.split('x').map((s) => parseInt(s, 10));

  ipc.sendMessage('overlay', [
    overlayConfig.chatOverlayEnabled,
    overlayConfig.chatOverlayWidth,
    overlayConfig.chatOverlayHeight,
    overlayConfig.chatOverlayXPosition,
    overlayConfig.chatOverlayYPosition,
  ]);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => setConfigValues(overlayConfig), 1000);

  const setEnabled = (event: ChangeEvent<HTMLInputElement>) => {
    setOverlayConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayEnabled: event.target.checked,
      };
    });
  };

  const setWidth = (width: number) => {
    setOverlayConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayWidth: width,
      };
    });
  };

  const setHeight = (height: number) => {
    setOverlayConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayHeight: height,
      };
    });
  };

  const setXPosition = (xPos: number) => {
    setOverlayConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayXPosition: xPos,
      };
    });
  };

  const setYPosition = (yPos: number) => {
    setOverlayConfig((prevState) => {
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
      <Box sx={{ width: '100%', height: '100%', mb: 2 }}>
        <RecorderPreview />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          width: '100%',
          height: '12%',
        }}
      >
        <FormControlLabel
          control={
            <Switch
              sx={switchStyle}
              checked={overlayConfig.chatOverlayEnabled}
              onChange={setEnabled}
            />
          }
          label="Chat Overlay"
          labelPlacement="bottom"
          sx={{ color: 'white' }}
        />

        <FormControlLabel
          control={
            <ChatOverlaySlider
              value={overlayConfig.chatOverlayWidth}
              disabled={!overlayConfig.chatOverlayEnabled}
              setValue={setWidth}
              max={2000}
            />
          }
          label="Width"
          labelPlacement="bottom"
          sx={{ color: 'white' }}
        />
        <FormControlLabel
          control={
            <ChatOverlaySlider
              value={overlayConfig.chatOverlayHeight}
              disabled={!overlayConfig.chatOverlayEnabled}
              setValue={setHeight}
              max={1000}
            />
          }
          label="Height"
          labelPlacement="bottom"
          sx={{ color: 'white' }}
        />
        <FormControlLabel
          control={
            <ChatOverlaySlider
              value={overlayConfig.chatOverlayXPosition}
              disabled={!overlayConfig.chatOverlayEnabled}
              setValue={setXPosition}
              max={xRes}
            />
          }
          label="Horizonal Position"
          labelPlacement="bottom"
          sx={{
            color: 'white',
            '&.Mui-disabled': {
              color: 'white',
            },
          }}
        />
        <FormControlLabel
          control={
            <ChatOverlaySlider
              value={overlayConfig.chatOverlayYPosition}
              disabled={!overlayConfig.chatOverlayEnabled}
              setValue={setYPosition}
              max={yRes}
            />
          }
          label="Vertical Position"
          labelPlacement="bottom"
          sx={{ color: 'white' }}
        />
      </Box>
    </Box>
  );
};

export default SceneEditor;
