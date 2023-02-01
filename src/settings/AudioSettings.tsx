import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { IOBSDevice, ISettingsPanelProps } from 'main/types';
import {
  Checkbox,
  Chip,
  FormControlLabel,
  ListItemText,
  Switch,
} from '@mui/material';
import React from 'react';
import { configSchema, ConfigurationSchemaKey } from '../main/configSchema';

const ipc = window.electron.ipcRenderer;

enum DeviceType {
  INPUT,
  OUTPUT,
}

export default function GeneralSettings(props: ISettingsPanelProps) {
  const { config, onChange } = props;
  const devices = ipc.sendSync('getAudioDevices', []);
  const inputDevices: IOBSDevice[] = devices.input;
  const outputDevices: IOBSDevice[] = devices.output;
  const availableAudioDevices = {
    input: inputDevices,
    output: outputDevices,
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

  /**
   * Standardizes device names to an array of strings and filters by known devices.
   *
   * @param deviceNames the device names to standardize
   * @returns the standardized device names
   */
  const standardizeDeviceNames = (deviceNames: string[] | string): string[] => {
    let normalizedDeviceNames: string[];

    if (typeof deviceNames === 'string') {
      normalizedDeviceNames = deviceNames.split(',');
    } else {
      normalizedDeviceNames = deviceNames;
    }

    return normalizedDeviceNames.filter(isKnownDevice);
  };

  const initialInputs = standardizeDeviceNames(config.audioInputDevices);
  const initialOutputs = standardizeDeviceNames(config.audioOutputDevices);
  const initialForceMono = config.obsForceMono;

  const [input, setInput] = React.useState<string[]>(initialInputs);
  const [output, setOutput] = React.useState<string[]>(initialOutputs);
  const [forceMono, setForceMono] = React.useState<boolean>(initialForceMono);

  const forceMonoConfigKey: ConfigurationSchemaKey = 'obsForceMono';

  const handleMultiSelect = (
    type: DeviceType,
    event: SelectChangeEvent<string[]>
  ) => {
    const {
      target: { value },
    } = event;
    const standardizedValue: string[] = standardizeDeviceNames(value);

    if (type === DeviceType.INPUT) {
      setInput(standardizedValue);
    } else {
      setOutput(standardizedValue);
    }
    onChange(event);
  };

  const selectStyle = {
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
  const formControlStyle = { my: 1, width: '450px' };
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

  return (
    <Stack
      component="form"
      sx={{
        '& > :not(style)': { width: '50ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl variant="outlined" sx={formControlStyle}>
          <InputLabel id="input-label" sx={selectStyle}>
            Input Devices
          </InputLabel>
          <Select
            name="audioInputDevices"
            labelId="input-label"
            id="audio-input-device"
            multiple
            value={input}
            label="Input Devices"
            sx={selectStyle}
            onChange={(e) => {
              handleMultiSelect(DeviceType.INPUT, e);
            }}
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
          >
            {availableAudioDevices.input.map((device: IOBSDevice) => {
              // We arbitrarily limit input devices to 3.
              // See Recorder.audioInputChannels.
              const tooManySelected = input.length > 3;
              const isSelected = input.indexOf(device.id) > -1;

              return (
                <MenuItem
                  disabled={tooManySelected && !isSelected}
                  key={`device_${device.id}`}
                  value={device.id}
                >
                  <Checkbox checked={isSelected} />
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
        <FormControlLabel
          control={
            <Switch
              sx={switchStyle}
              checked={forceMono}
              name={forceMonoConfigKey}
              onChange={(isForceMono) => {
                setForceMono(Boolean(isForceMono.target.checked));
                onChange(isForceMono);
              }}
            />
          }
          label="Mono Input"
          sx={{
            color: 'white',
          }}
        />
        <Tooltip title={configSchema.obsForceMono.description}>
          <IconButton>
            <InfoIcon sx={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl sx={formControlStyle}>
          <InputLabel id="ouput-label" sx={selectStyle}>
            Output Devices
          </InputLabel>
          <Select
            name="audioOutputDevices"
            labelId="output-label"
            id="audio-output-device"
            multiple
            value={output}
            label="Output Devices"
            sx={selectStyle}
            onChange={(e) => {
              handleMultiSelect(DeviceType.OUTPUT, e);
            }}
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
          >
            {availableAudioDevices.output.map((device: IOBSDevice) => {
              // We arbitrarily limit output devices to 5.
              // See Recorder.audioOutputChannels.
              const tooManySelected = output.length > 5;
              const isSelected = output.indexOf(device.id) > -1;

              return (
                <MenuItem
                  disabled={tooManySelected && !isSelected}
                  key={`device_${device.id}`}
                  value={device.id}
                >
                  <Checkbox checked={isSelected} />
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
