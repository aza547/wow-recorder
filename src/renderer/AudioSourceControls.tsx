import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Slider,
  Stack,
  Switch,
} from '@mui/material';
import { DeviceType, IOBSDevice } from 'main/types';
import React from 'react';
import { useSettings, setConfigValues } from 'settings/useSettings';
import { VolumeDown, VolumeUp } from '@mui/icons-material';
import {
  getAudioDeviceDescription,
  standardizeAudioDeviceNames,
} from './rendererutils';

const ipc = window.electron.ipcRenderer;

const AudioSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const availableAudioDevices = ipc.sendSync('getAudioDevices', []);

  const input = standardizeAudioDeviceNames(
    config.audioInputDevices,
    availableAudioDevices
  );

  const output = standardizeAudioDeviceNames(
    config.audioOutputDevices,
    availableAudioDevices
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
      availableAudioDevices
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

  React.useEffect(() => {
    setConfigValues({
      audioOutputDevices: config.audioOutputDevices,
      speakerVolume: config.speakerVolume,
      audioInputDevices: config.audioInputDevices,
      micVolume: config.micVolume,
      obsForceMono: config.obsForceMono,
    });

    ipc.sendMessage('recorder', ['audio']);
  }, [
    config.audioOutputDevices,
    config.speakerVolume,
    config.audioInputDevices,
    config.micVolume,
    config.obsForceMono,
  ]);

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

  const getSelectedChip = (id: string) => {
    const description = getAudioDeviceDescription(id, availableAudioDevices);
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
        {selected.map(getSelectedChip)}
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
          {availableAudioDevices.output.map(getOutputMenuItem)}
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
          {availableAudioDevices.input.map(getInputMenuItem)}
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        m: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          m: 2,
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
          width: '100%',
        }}
      >
        {getMicSelect()}
        {getMicVolume()}
      </Box>

      {getMonoSwitch()}
    </Box>
  );
};

export default AudioSourceControls;
