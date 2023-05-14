import {
  Box,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import React from 'react';
import { OurDisplayType } from 'main/types';
import { useSettings, setConfigValues } from './useSettings';

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
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    // Don't fire on the initial render.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      obsCaptureMode: config.obsCaptureMode,
      monitorIndex: config.monitorIndex,
      captureCursor: config.captureCursor,
    });

    ipc.sendMessage('recorder', ['video']);
  }, [config.monitorIndex, config.obsCaptureMode, config.captureCursor]);
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
  const getToggleButton = (
    value: string | number,
    display: string | number
  ) => {
    return (
      <ToggleButton
        value={value}
        key={value}
        sx={{
          color: 'white',
          height: '30px',
          '&.Mui-selected, &.Mui-selected:hover': {
            color: 'white',
            backgroundColor: '#bb4420',
          },
        }}
      >
        {display}
      </ToggleButton>
    );
  };

  const getCaptureModeToggle = () => {
    return (
      <FormControlLabel
        control={
          <ToggleButtonGroup
            value={config.obsCaptureMode}
            exclusive
            onChange={setOBSCaptureMode}
            sx={{ border: '1px solid white' }}
          >
            {getToggleButton('game_capture', 'game')}
            {getToggleButton('monitor_capture', 'monitor')}
          </ToggleButtonGroup>
        }
        label="Capture Mode"
        labelPlacement="top"
        sx={{ color: 'white' }}
      />
    );
  };

  const getMonitorToggle = () => {
    if (config.obsCaptureMode === 'game_capture') {
      return <></>;
    }

    return (
      <FormControlLabel
        control={
          <ToggleButtonGroup
            value={config.monitorIndex}
            exclusive
            onChange={setMonitor}
            sx={{ border: '1px solid white' }}
          >
            {displayConfiguration.map((display: OurDisplayType) =>
              getToggleButton(display.index, display.index + 1)
            )}
          </ToggleButtonGroup>
        }
        label="Monitor"
        labelPlacement="top"
        sx={{ color: 'white' }}
      />
    );
  };

  const getCursorToggle = () => {
    return (
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
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        m: 2,
      }}
    >
      {getCaptureModeToggle()}
      {getMonitorToggle()}
      {getCursorToggle()}
    </Box>
  );
};

export default VideoSourceControls;
