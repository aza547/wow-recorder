import {
  Box,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import React, { ChangeEvent } from 'react';
import { configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import LockIcon from '@mui/icons-material/Lock';
import { useSettings, setConfigValues, getConfigValue } from './useSettings';
import ChatOverlaySlider from './ChatOverlaySlider';
import { fileSelect } from './rendererutils';

const textFieldStyle = {
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
      chatOverlayOwnImage: config.chatOverlayOwnImage,
      chatOverlayOwnImagePath: config.chatOverlayOwnImagePath,
      chatOverlayScale: config.chatOverlayScale,
      chatOverlayHeight: config.chatOverlayHeight,
      chatOverlayWidth: config.chatOverlayWidth,
      chatOverlayXPosition: config.chatOverlayXPosition,
      chatOverlayYPosition: config.chatOverlayYPosition,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.chatOverlayEnabled,
    config.chatOverlayOwnImage,
    config.chatOverlayOwnImagePath,
    config.chatOverlayScale,
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

  const setOwnImage = (event: ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayOwnImage: event.target.checked,
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

  const getChatOverlayEnabledSwitch = () => {
    return (
      <FormControlLabel
        control={
          <Switch
            sx={switchStyle}
            checked={config.chatOverlayEnabled}
            onChange={setOverlayEnabled}
          />
        }
        label={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Chat Overlay
          </Box>
        }
        labelPlacement="top"
        sx={{ color: 'white' }}
      />
    );
  };

  const getProOnlyIcon = () => {
    return (
      <Tooltip title="Available to Pro users">
        <IconButton sx={{ py: 0, px: 1 }}>
          <LockIcon
            style={{ color: '#bb4420' }}
            sx={{ height: '15px', width: '15px' }}
          />
        </IconButton>
      </Tooltip>
    );
  };

  const getChatOverlayOwnImageSwitch = () => {
    return (
      <FormControlLabel
        control={
          <Switch
            sx={switchStyle}
            checked={config.cloudStorage && config.chatOverlayOwnImage}
            onChange={setOwnImage}
            disabled={!config.cloudStorage || !config.chatOverlayEnabled}
          />
        }
        label={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Own Image
            {getProOnlyIcon()}
          </Box>
        }
        labelPlacement="top"
        sx={{
          color: 'white',
          '& .MuiFormControlLabel-label.Mui-disabled': {
            color: 'white',
          },
        }}
      />
    );
  };

  const getChatOverlaySizeSliders = () => {
    const disabled = !config.chatOverlayEnabled || config.chatOverlayOwnImage;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <FormControlLabel
          control={
            <ChatOverlaySlider
              value={config.chatOverlayWidth}
              disabled={disabled}
              setValue={setWidth}
              max={2000}
              step={1}
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
              disabled={disabled}
              setValue={setHeight}
              max={1000}
              step={1}
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
    );
  };

  const getChatOverlayPositionSliders = () => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <FormControlLabel
          control={
            <ChatOverlaySlider
              value={config.chatOverlayXPosition}
              disabled={!config.chatOverlayEnabled}
              setValue={setXPosition}
              max={xRes}
              step={1}
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
              step={1}
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
    );
  };

  const setScale = (scale: number) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayScale: scale,
      };
    });
  };

  const getScaleSlider = () => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <FormControlLabel
          control={
            <ChatOverlaySlider
              value={config.chatOverlayScale}
              disabled={!config.chatOverlayEnabled}
              setValue={setScale}
              max={5}
              step={0.05}
            />
          }
          label="Scale"
          labelPlacement="start"
          sx={{
            color: 'white',
            '& .MuiFormControlLabel-label.Mui-disabled': {
              color: 'white',
            },
          }}
        />
      </Box>
    );
  };

  const getInfoIcon = () => {
    const helptext = [
      /* eslint-disable prettier/prettier */
      ['Chat Overlay', configSchema.chatOverlayEnabled.description].join('\n'),
      ['Own Image', configSchema.chatOverlayOwnImage.description].join('\n'),
      ['Image Path', configSchema.chatOverlayOwnImagePath.description].join('\n'),
      ['Width & Height', 'How the default image should be cropped. Not available for custom overlays.'].join('\n'),
      ['Horizontal & Vertical', 'The coordinates on the scene where the overlay should be placed.'].join('\n'),
      ['Scale', configSchema.chatOverlayScale.description].join('\n'),
      /* eslint-enable prettier/prettier */
    ].join('\n\n');

    return (
      <Tooltip title={<div style={{ whiteSpace: 'pre-line' }}>{helptext}</div>}>
        <IconButton>
          <InfoIcon style={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const setOverlayPath = async () => {
    const newPath = await fileSelect();

    if (newPath === '') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        chatOverlayOwnImagePath: newPath,
      };
    });
  };

  const getOwnImagePathField = () => {
    return (
      <TextField
        name="overlayImagePath"
        value={config.chatOverlayOwnImagePath}
        label="Image Path"
        variant="outlined"
        onClick={setOverlayPath}
        InputLabelProps={{ shrink: true, style: { color: 'white' } }}
        sx={{ ...textFieldStyle, m: 2, width: '400px' }}
        inputProps={{ style: { color: 'white' } }}
      />
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {getChatOverlayEnabledSwitch()}
        {getChatOverlayOwnImageSwitch()}
        {config.cloudStorage &&
          config.chatOverlayOwnImage &&
          getOwnImagePathField()}
        {getInfoIcon()}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {getChatOverlaySizeSliders()}
        {getChatOverlayPositionSliders()}
        {getScaleSlider()}
      </Box>
    </Box>
  );
};

export default ChatOverlayControls;
