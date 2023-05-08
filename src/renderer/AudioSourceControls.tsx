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
  Switch,
} from '@mui/material';
import { DeviceType, IOBSDevice } from 'main/types';
import React from 'react';
import { useSettings, setConfigValues } from 'settings/useSettings';
import {
  getAudioDeviceDescription,
  standardizeAudioDeviceNames,
} from './rendererutils';

const ipc = window.electron.ipcRenderer;

const AudioSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  const availableAudioDevices = ipc.sendSync('getAudioDevices', []);
  setConfigValues(config);

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
    ipc.sendMessage('recorder', [
      'audio',
      config.audioOutputDevices,
      config.audioInputDevices,
      config.obsForceMono,
    ]);
  }, [
    config.audioOutputDevices,
    config.audioInputDevices,
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

  const formControlStyle = { m: 1, width: '200px' };

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
      {getSpeakerSelect()}
      {getMicSelect()}
      {getMonoSwitch()}
    </Box>
  );
};

export default AudioSourceControls;
