import {
  Box,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  FormControl,
  IconButton,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import React, { useState } from 'react';
import { OurDisplayType, WindowCaptureChoice } from 'main/types';
import { configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
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

const formControlStyle = { m: 1, width: '100%' };

const selectStyle = {
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
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: 'darkgrey',
  },
  '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
    borderColor: 'darkgrey',
  },
};

const VideoSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const [displays, setDisplays] = useState<OurDisplayType[]>([]);
  const [windows, setWindows] = useState<WindowCaptureChoice[]>([]);
  const initialRender = React.useRef(true);

  React.useEffect(() => {
    const getDisplays = async () => {
      const allDisplays = await ipc.invoke('getAllDisplays', []);
      setDisplays(allDisplays);
    };

    getDisplays();

    const getWindows = async () => {
      const allWindows = await ipc.invoke('getWindows', []);
      setWindows(allWindows);
    };

    getWindows();

    // The reset of this effect handles config changes, so if it's the
    // initial render then just return here.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      obsCaptureMode: config.obsCaptureMode,
      obsWindowName: config.obsWindowName,
      monitorIndex: config.monitorIndex,
      captureCursor: config.captureCursor,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.monitorIndex,
    config.obsCaptureMode,
    config.captureCursor,
    config.obsWindowName,
  ]);

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

  const setOBSWindowName = (event: SelectChangeEvent<string>) => {
    const {
      target: { value },
    } = event;

    setConfig((prevState) => {
      return {
        ...prevState,
        obsWindowName: value,
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
          height: '40px',
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
      <ToggleButtonGroup
        value={config.obsCaptureMode}
        exclusive
        onChange={setOBSCaptureMode}
        sx={{ border: '1px solid white', height: '40px', mx: 1 }}
      >
        {getToggleButton('window_capture', 'window')}
        {getToggleButton('game_capture', 'game')}
        {getToggleButton('monitor_capture', 'monitor')}
      </ToggleButtonGroup>
    );
  };

  const getMonitorToggle = () => {
    if (config.obsCaptureMode !== 'monitor_capture') {
      return <></>;
    }

    return (
      <ToggleButtonGroup
        value={config.monitorIndex}
        exclusive
        onChange={setMonitor}
        sx={{ border: '1px solid white', height: '40px', mx: 1 }}
      >
        {displays.map((display: OurDisplayType) =>
          getToggleButton(display.index, display.index + 1)
        )}
      </ToggleButtonGroup>
    );
  };

  const getWindowSelect = () => {
    if (config.obsCaptureMode !== 'window_capture') {
      return <></>;
    }

    const mapWindowToMenuItem = (item: WindowCaptureChoice) => {
      return (
        <MenuItem sx={{ height: '25px' }} key={item.name} value={item.value}>
          {item.name}
        </MenuItem>
      );
    };

    return (
      <FormControl size="small" sx={{ ...formControlStyle, maxWidth: '200px' }}>
        <InputLabel sx={selectStyle}>Window</InputLabel>
        <Select
          value={config.obsWindowName}
          label="Window"
          onChange={setOBSWindowName}
          sx={{ ...selectStyle }}
        >
          {windows.map(mapWindowToMenuItem)}
        </Select>
      </FormControl>
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

  const getInfoIcon = () => {
    const helptext = [
      ['Capture Mode', configSchema.obsCaptureMode.description].join('\n'),
      ['Monitor', configSchema.monitorIndex.description].join('\n'),
      ['Capture Cursor', configSchema.captureCursor.description].join('\n'),
    ].join('\n\n');

    return (
      <Tooltip title={<div style={{ whiteSpace: 'pre-line' }}>{helptext}</div>}>
        <IconButton>
          <InfoIcon style={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
      }}
    >
      {getCaptureModeToggle()}
      {getMonitorToggle()}
      {getWindowSelect()}
      {getCursorToggle()}
      {getInfoIcon()}
    </Box>
  );
};

export default VideoSourceControls;
