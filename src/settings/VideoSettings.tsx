import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { OurDisplayType } from 'main/types';
import ConfigContext from "./ConfigContext";

const ipc = window.electron.ipcRenderer;
const displayConfiguration = ipc.sendSync('settingsWindow', ['getAllDisplays']);
const obsResolutions: any = ipc.sendSync('settingsWindow', ['getObsAvailableResolutions']);
const { Base: baseResolutions, Output: outputResolutions } = obsResolutions;

export default function VideoSettings() {
  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig: any) => ({ ...prevConfig, [stateKey]: value }));
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
        <InputLabel id="demo-simple-select-label" sx = {style}>Monitor</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="monitor-index"
          value={config.monitorIndex}
          label="Monitor"
          onChange={(event) => modifyConfig('monitorIndex', event.target.value)} 
          sx={style}
        >
          { displayConfiguration.map((display: OurDisplayType) =>
            <MenuItem key={ 'display-' + display.id } value={ display.index + 1 }>
              [{ display.index + 1 }] { display.size.width }x{ display.size.height } @ { display.displayFrequency } Hz ({display.physicalPosition}) {display.primary ? ' (Primary)' : ''}
            </MenuItem>
          )}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="obs-output-resolution-label" sx = {style}>Video output resolution</InputLabel>
        <Select
          labelId="obs-output-resolution-label"
          id="obs-output-resolution"
          value={config.obsOutputResolution}
          label="Output resolution for OBS"
          onChange={(event) => modifyConfig('obsOutputResolution', event.target.value)}
          sx={style}
        >
          { outputResolutions.map((res: string) =>
            <MenuItem key={ 'obs-output-resolution-' + res } value={ res }>
              { res }
            </MenuItem>
          )}
        </Select>
      </FormControl>
    </Stack>
  );
}
