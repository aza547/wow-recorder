import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import { DeviceType, IOBSDevice } from 'main/types';
import React from 'react';
import { VolumeDown, VolumeUp } from '@mui/icons-material';
import { configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import { useSettings, setConfigValues } from './useSettings';
import {
  blurAll,
  getAudioDeviceDescription,
  getKeyByValue,
  getKeyModifiersString,
  getNextKeyOrMouseEvent,
  getPTTKeyPressEventFromConfig,
  isKeyModifier,
  standardizeAudioDeviceNames,
} from './rendererutils';
import { PTTKeyPressEvent, UiohookKeyMap } from '../types/KeyTypesUIOHook';

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
};

const sliderSx = {
  '& .MuiSlider-thumb': {
    color: 'white',
  },
  '& .MuiSlider-track': {
    color: '#bb4220',
  },
  '& .MuiSlider-rail': {
    color: '#bb4220',
  },
  '& .MuiSlider-active': {
    color: '#bb4220',
  },
};

const formControlStyle = { m: 1, width: '100%' };

const switchStyle = {
  mx: 2,
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

const AudioSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const initialRender = React.useRef(true);

  const [audioDevices, setAudioDevices] = React.useState<{
    input: IOBSDevice[];
    output: IOBSDevice[];
  }>({ input: [], output: [] });

  const [pttHotKeyFieldFocused, setPttHotKeyFieldFocused] =
    React.useState(false);

  const [pttHotKey, setPttHotKey] = React.useState<PTTKeyPressEvent>(
    getPTTKeyPressEventFromConfig(config)
  );

  React.useEffect(() => {
    const getAvailableAudioDevices = async () => {
      const devices = await ipc.invoke('getAudioDevices', []);
      setAudioDevices(devices);
    };

    getAvailableAudioDevices();

    // The reset of this effect handles config changes, so if it's the
    // initial render then just return here.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      setConfigValues({
        audioOutputDevices: config.audioOutputDevices,
        speakerVolume: config.speakerVolume,
        audioInputDevices: config.audioInputDevices,
        micVolume: config.micVolume,
        obsForceMono: config.obsForceMono,
        pushToTalk: config.pushToTalk,
        pushToTalkKey: config.pushToTalkKey,
        pushToTalkMouseButton: config.pushToTalkMouseButton,
        pushToTalkModifiers: config.pushToTalkModifiers,
      });

      ipc.sendMessage('settingsChange', []);
    }, 500);
  }, [
    config.audioOutputDevices,
    config.speakerVolume,
    config.audioInputDevices,
    config.micVolume,
    config.obsForceMono,
    config.pushToTalk,
    config.pushToTalkKey,
    config.pushToTalkMouseButton,
    config.pushToTalkModifiers,
  ]);

  React.useEffect(() => {
    const setPushToTalkKey = (event: PTTKeyPressEvent) => {
      setConfig((prevState) => {
        return {
          ...prevState,
          pushToTalkKey: event.keyCode,
          pushToTalkMouseButton: event.mouseButton,
          pushToTalkModifiers: getKeyModifiersString(event),
        };
      });
    };

    const getNextNonModifierKey = async () => {
      while (pttHotKeyFieldFocused) {
        // eslint-disable-next-line no-await-in-loop
        const keyPressEvent = await getNextKeyOrMouseEvent();

        if (!isKeyModifier(keyPressEvent)) {
          setPttHotKeyFieldFocused(false);
          setPttHotKey(keyPressEvent);
          setPushToTalkKey(keyPressEvent);
          blurAll(document);
          break;
        }
      }
    };

    getNextNonModifierKey();
  }, [pttHotKeyFieldFocused, setConfig]);

  const input = standardizeAudioDeviceNames(
    config.audioInputDevices,
    audioDevices
  );

  const output = standardizeAudioDeviceNames(
    config.audioOutputDevices,
    audioDevices
  );

  const handleMultiSelect = (
    type: DeviceType,
    event: SelectChangeEvent<string[]>
  ) => {
    const {
      target: { value },
    } = event;

    const standardizedValue = standardizeAudioDeviceNames(
      value,
      audioDevices
    ).join();

    if (type === DeviceType.INPUT) {
      setConfig((prevState) => {
        return {
          ...prevState,
          audioInputDevices: standardizedValue,
        };
      });
    } else {
      setConfig((prevState) => {
        return {
          ...prevState,
          audioOutputDevices: standardizedValue,
        };
      });
    }
  };

  const getSelectedChip = (id: string) => {
    const description = getAudioDeviceDescription(id, audioDevices);
    return (
      <Chip
        sx={{ height: '25px', bgcolor: 'white' }}
        key={description}
        label={description}
      />
    );
  };

  const renderSelected = (selected: string[]) => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
        }}
      >
        {selected !== undefined && selected.map(getSelectedChip)}
      </Box>
    );
  };

  const getOutputMenuItem = (device: IOBSDevice) => {
    const tooManySelected = output.length >= 5;
    const isSelected = output.indexOf(device.id) > -1;

    return (
      <MenuItem
        sx={{ height: '25px' }}
        disabled={tooManySelected && !isSelected}
        key={`device_${device.id}`}
        value={device.id}
      >
        <Checkbox checked={isSelected} />
        <ListItemText primary={device.description} />
      </MenuItem>
    );
  };

  const getInputMenuItem = (device: IOBSDevice) => {
    const tooManySelected = input.length >= 5;
    const isSelected = input.indexOf(device.id) > -1;

    return (
      <MenuItem
        sx={{ height: '25px' }}
        disabled={tooManySelected && !isSelected}
        key={`device_${device.id}`}
        value={device.id}
      >
        <Checkbox checked={isSelected} />
        <ListItemText primary={device.description} />
      </MenuItem>
    );
  };

  const getSpeakerSelect = () => {
    return (
      <FormControl size="small" sx={formControlStyle}>
        <InputLabel sx={selectStyle}>Speakers</InputLabel>
        <Select
          multiple
          value={output}
          label="Speakers"
          sx={selectStyle}
          renderValue={renderSelected}
          onChange={(e) => {
            handleMultiSelect(DeviceType.OUTPUT, e);
          }}
        >
          {audioDevices.output.map(getOutputMenuItem)}
        </Select>
      </FormControl>
    );
  };

  const setSpeakerVolume = (_event: Event, newValue: number | number[]) => {
    if (typeof newValue !== 'number') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        speakerVolume: newValue / 100,
      };
    });
  };

  const getSpeakerVolume = () => {
    return (
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
          <VolumeDown sx={{ color: 'white' }} />
          <Slider
            sx={sliderSx}
            value={config.speakerVolume * 100}
            onChange={setSpeakerVolume}
          />
          <VolumeUp sx={{ color: 'white' }} />
        </Stack>
      </Box>
    );
  };

  const getMicSelect = () => {
    return (
      <FormControl size="small" variant="outlined" sx={formControlStyle}>
        <InputLabel sx={selectStyle}>Mics</InputLabel>
        <Select
          multiple
          value={input}
          label="Mics"
          sx={selectStyle}
          renderValue={renderSelected}
          onChange={(e) => {
            handleMultiSelect(DeviceType.INPUT, e);
          }}
        >
          {audioDevices.input.map(getInputMenuItem)}
        </Select>
      </FormControl>
    );
  };

  const setMicVolume = (_event: Event, newValue: number | number[]) => {
    if (typeof newValue !== 'number') {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        micVolume: newValue / 100,
      };
    });
  };

  const getMicVolume = () => {
    return (
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
          <VolumeDown sx={{ color: 'white' }} />
          <Slider
            sx={sliderSx}
            value={config.micVolume * 100}
            onChange={setMicVolume}
          />
          <VolumeUp sx={{ color: 'white' }} />
        </Stack>
      </Box>
    );
  };

  const setForceMono = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsForceMono: event.target.checked,
      };
    });
  };

  const setPushToTalk = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        pushToTalk: event.target.checked,
      };
    });
  };

  const getMonoSwitch = () => {
    return (
      <FormControlLabel
        control={
          <Switch
            sx={switchStyle}
            checked={config.obsForceMono}
            onChange={setForceMono}
          />
        }
        label="Mono Input"
        labelPlacement="top"
        sx={{
          color: 'white',
        }}
      />
    );
  };

  const getPushToTalkSwitch = () => {
    return (
      <FormControlLabel
        control={
          <Switch
            sx={switchStyle}
            checked={config.pushToTalk}
            onChange={setPushToTalk}
          />
        }
        label="Push To Talk"
        labelPlacement="top"
        sx={{
          color: 'white',
        }}
      />
    );
  };

  const getKeyPressEventString = (event: PTTKeyPressEvent) => {
    const keys: string[] = [];

    if (event.altKey) keys.push('Alt');
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.shiftKey) keys.push('Shift');
    if (event.metaKey) keys.push('Win');

    const { keyCode, mouseButton } = event;

    if (keyCode > 0) {
      const key = getKeyByValue(UiohookKeyMap, keyCode);
      if (key !== undefined) keys.push(key);
    } else if (mouseButton > 0) {
      keys.push(`Mouse ${event.mouseButton}`);
    }

    return keys.join('+');
  };

  const getHotkeyString = () => {
    if (pttHotKeyFieldFocused) {
      return 'Press any key combination...';
    }

    if (pttHotKey !== null) {
      return `${getKeyPressEventString(pttHotKey)} (Click to re-bind)`;
    }

    return 'Click to bind';
  };

  const getPushToTalkSelect = () => {
    return (
      <TextField
        value={getHotkeyString()}
        label="Push to Talk Key"
        sx={selectStyle}
        InputLabelProps={{ shrink: true, style: { color: 'white' } }}
        InputProps={{ readOnly: true, style: { color: 'white' } }}
        onFocus={() => setPttHotKeyFieldFocused(true)}
        onBlur={() => setPttHotKeyFieldFocused(false)}
      />
    );
  };

  const getInfoIcon = () => {
    const helptext = [
      ['Speakers', configSchema.audioOutputDevices.description].join('\n'),
      ['Mics', configSchema.audioInputDevices.description].join('\n'),
      ['Mono Input', configSchema.obsForceMono.description].join('\n'),
      ['Push To Talk', configSchema.pushToTalk.description].join('\n'),
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '300px',
          mx: 2,
        }}
      >
        {getSpeakerSelect()}
        {getSpeakerVolume()}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '300px',
          mx: 2,
        }}
      >
        {getMicSelect()}
        {getMicVolume()}
      </Box>

      {getMonoSwitch()}
      {getPushToTalkSwitch()}
      {config.pushToTalk && getPushToTalkSelect()}
      {getInfoIcon()}
    </Box>
  );
};

export default AudioSourceControls;
