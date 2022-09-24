import * as React from 'react';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { stateKeyToSettingKeyMap, StateToSettingKeyMapKey } from './settingUtils';
import Stack from '@mui/material/Stack';
import { ObsAudioDevice } from 'main/obsAudioDeviceUtils';

const ipc = window.electron.ipcRenderer;
const store = window.electron.store;

export default function GeneralSettings() {

  const [state, setState] = React.useState({
    audioInputDevice: store.get('audio-input-device'),
    audioOutputDevice: store.get('audio-output-device'),
  });

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

  /**
   * setSetting, why not just use react state hook?
   */
  const setSetting = (stateKey: StateToSettingKeyMapKey, value: any) => {
    const settingKey = stateKeyToSettingKeyMap[stateKey]
    const element = document.getElementById(settingKey)

    console.log(stateKey, value, settingKey, element);

    if (!element) {
      return;
    }

    console.log(`[SettingsWindow] Set setting '${settingKey}' to '${value}'`)
    element.setAttribute("value", value);

    setState((prevState) => ({...prevState, [stateKey]: value}))
  }

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
          value={state.audioInputDevice}
          label="Input"
          onChange={(event) => setSetting('audioInputDevice', event.target.value)}
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
          value={state.audioOutputDevice}
          label="Output"
          onChange={(event) => setSetting('audioOutputDevice', event.target.value)}
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