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

export default function VideoSettings() {
  const [state, setState] = React.useState({
    monitorIndex: store.get('monitor-index'),
  });

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
        <InputLabel id="demo-simple-select-label" sx = {style}>Monitor</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="audio-input-device"
          value={state.monitorIndex}
          label="Monitor"
          onChange={(event) => setSetting('monitorIndex', event.target.value)}
          sx={style}
        >
          <MenuItem key={ 'device_1'} value={ 1 }>1</MenuItem>
          <MenuItem key={ 'device_2'  } value={ 2 }>2</MenuItem>
          <MenuItem key={ 'device_3' } value={ 3 }>3</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}