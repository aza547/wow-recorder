import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { FakeChangeEvent, IOBSDevice, ISettingsPanelProps } from 'main/types';
import { Checkbox, Chip, ListItemText, OutlinedInput } from '@mui/material';
import React from 'react';
import { configSchema } from '../main/configSchema';

const ipc = window.electron.ipcRenderer;

enum DeviceType {
  INPUT,
  OUTPUT,
}

export default function GeneralSettings(props: ISettingsPanelProps) {
  const { config, onChange } = props;

  let initialInputs: string[];

  if (config.audioInputDevices) {
    initialInputs = String(config.audioInputDevices).split(',');
  } else {
    initialInputs = [];
  }

  let initialOutputs: string[];

  if (config.audioOutputDevices) {
    initialOutputs = String(config.audioOutputDevices).split(',');
  } else {
    initialOutputs = [];
  }

  const [input, setInput] = React.useState<string[]>(initialInputs);
  const [output, setOutput] = React.useState<string[]>(initialOutputs);

  const devices = ipc.sendSync('getAudioDevices', []);

  const inputDevices: IOBSDevice[] = devices.input;
  const outputDevices: IOBSDevice[] = devices.output;

  const availableAudioDevices = {
    input: inputDevices,
    output: outputDevices,
  };

  const handleMultiSelect = (
    type: DeviceType,
    event: SelectChangeEvent<string[]>
  ) => {
    const {
      target: { value },
    } = event;

    if (type === DeviceType.INPUT) {
      setInput(
        // On autofill we get a stringified value.
        typeof value === 'string' ? value.split(',') : value
      );
    } else {
      setOutput(
        // On autofill we get a stringified value.
        typeof value === 'string' ? value.split(',') : value
      );
    }
  };

  const getDeviceDescription = (id: string) => {
    let result = 'Unknown';

    availableAudioDevices.input.forEach((device) => {
      if (device.id === id) {
        result = device.description;
      }
    });

    availableAudioDevices.output.forEach((device) => {
      if (device.id === id) {
        result = device.description;
      }
    });

    return result;
  };

  const isKnownDevice = (id: string) => {
    if (getDeviceDescription(id) === 'Unknown') {
      return false;
    }

    return true;
  };

  // Remove any unknown devices from the list, and the state variables. That
  // means if the user presses save, even without any changes, the unknown
  // devices will be removed from config.
  React.useEffect(() => {
    const knownInputs = input.filter(isKnownDevice);
    setInput(knownInputs);
    onChange(new FakeChangeEvent('audioInputDevices', knownInputs));

    const knownOutputs = output.filter(isKnownDevice);
    setOutput(knownOutputs);
    onChange(new FakeChangeEvent('audioOutputDevices', knownOutputs));
  }, []);

  const style = {
    width: '405px',
    color: 'white',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'black',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#bb4220',
    },
    '&.Mui-focused': {
      borderColor: '#bb4220',
      color: '#bb4220',
    },
  };

  return (
    <Stack
      component="form"
      sx={{
        '& > :not(style)': { m: 0, width: '50ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl sx={{ my: 1 }}>
          <InputLabel id="demo-simple-select-label" sx={style}>
            Input
          </InputLabel>
          <Select
            name="audioInputDevices"
            labelId="select-audio-in-devices"
            id="audio-input-device"
            multiple
            value={input}
            label="Input"
            onChange={(e) => {
              handleMultiSelect(DeviceType.INPUT, e);
              onChange(e);
            }}
            input={<OutlinedInput label="Tag" />}
            renderValue={(selected) => {
              return (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                  }}
                >
                  {selected.map((value) => (
                    <Chip
                      sx={{
                        bgcolor: 'white',
                      }}
                      key={getDeviceDescription(value)}
                      label={getDeviceDescription(value)}
                    />
                  ))}
                </Box>
              );
            }}
            sx={style}
          >
            {availableAudioDevices.input.map((device: IOBSDevice) => {
              return (
                <MenuItem key={`device_${device.id}`} value={device.id}>
                  <Checkbox checked={input.indexOf(device.id) > -1} />
                  <ListItemText primary={device.description} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <Tooltip title={configSchema.audioInputDevices.description}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl sx={{ my: 1 }}>
          <InputLabel id="demo-simple-select-label" sx={style}>
            Output
          </InputLabel>
          <Select
            name="audioOutputDevices"
            labelId="select-audio-devices"
            id="audio-output-device"
            multiple
            value={output}
            label="Output"
            onChange={(e) => {
              handleMultiSelect(DeviceType.OUTPUT, e);
              onChange(e);
            }}
            input={<OutlinedInput label="Tag" />}
            renderValue={(selected) => (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.5,
                }}
              >
                {selected.map((value) => (
                  <Chip
                    sx={{
                      bgcolor: 'white',
                    }}
                    key={getDeviceDescription(value)}
                    label={getDeviceDescription(value)}
                  />
                ))}
              </Box>
            )}
            sx={style}
          >
            {availableAudioDevices.output.map((device: IOBSDevice) => {
              return (
                <MenuItem key={`device_${device.id}`} value={device.id}>
                  <Checkbox checked={output.indexOf(device.id) > -1} />
                  <ListItemText primary={device.description} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <Tooltip title={configSchema.audioOutputDevices.description}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}
