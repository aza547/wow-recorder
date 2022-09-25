import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { ObsAudioDevice } from 'main/obsAudioDeviceUtils';
import ConfigContext from "./ConfigContext";

const ipc = window.electron.ipcRenderer;

export default function GeneralSettings() {

  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig: any) => ({ ...prevConfig, [stateKey]: value }));
  };

  const audioDevices = ipc.sendSync('getAudioDevices', []);

  const availableAudioDevices = {
    input: [
      new ObsAudioDevice('none', '(None: no microphone input will be recorded)'),
      new ObsAudioDevice('all', '(All)'),
      ...audioDevices.input,
    ],
    output: [
      new ObsAudioDevice('none', '(None: no sound will be recorded)'),
      new ObsAudioDevice('all', '(All)'),
      ...audioDevices.output,
    ]
  };

  const style = {
    height: '2.5rem',
    color: 'white',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'black'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#bb4220'
    },
    '&.Mui-focused': {
      borderColor: '#bb4220',
      color: '#bb4220'
    },
  }   

  return (
    <Stack
      component="form"
      sx={{
        '& > :not(style)': { m: 1, width: '50ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label" sx = {style}>Input</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="audio-input-device"
          value={config.audioInputDevice}
          label="Input"
          onChange={(event) => modifyConfig('audioInputDevice', event.target.value)}
          sx={style}
        >
          { availableAudioDevices.input.map((device: ObsAudioDevice) => {
            return (
              <MenuItem key={ 'device_' + device.id } value={ device.id }>{ device.name }</MenuItem>
            )
          })}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label" sx = {style}>Output</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="audio-output-device"
          value={config.audioOutputDevice}
          label="Output"
          onChange={(event) => modifyConfig('audioOutputDevice', event.target.value)}
          sx={style}
        >
          { availableAudioDevices.output.map((device: ObsAudioDevice) => {
            return (
              <MenuItem key={ 'device_' + device.id } value={ device.id }>{ device.name }</MenuItem>
            )
          })}
        </Select>
      </FormControl>
    </Stack>
  );
}