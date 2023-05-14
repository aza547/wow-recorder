import { Box, FormControlLabel, Switch } from '@mui/material';
import React, { ChangeEvent } from 'react';
import { useSettings, setConfigValues, getConfigValue } from './useSettings';
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

const ChatOverlayControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);
  const resolution = getConfigValue<string>('obsOutputResolution');
  const [xRes, yRes] = resolution.split('x').map((s) => parseInt(s, 10));

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      chatOverlayEnabled: config.chatOverlayEnabled,
      chatOverlayHeight: config.chatOverlayHeight,
      chatOverlayWidth: config.chatOverlayWidth,
      chatOverlayXPosition: config.chatOverlayXPosition,
      chatOverlayYPosition: config.chatOverlayYPosition,
    });

    ipc.sendMessage('overlay', []);
  }, [
    config.chatOverlayEnabled,
    config.chatOverlayHeight,
    config.chatOverlayWidth,
    config.chatOverlayXPosition,
    config.chatOverlayYPosition,
  ]);

  const setOverlayEnabled = (event: ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayEnabled: event.target.checked,
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
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
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
  );
};

export default ChatOverlayControls;
