import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { OurDisplayType } from 'main/types';
import ConfigContext from "./ConfigContext";
import { Box, TextField } from '@mui/material';
import { configSchema } from '../main/configSchema'
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

const ipc = window.electron.ipcRenderer;
const displayConfiguration = ipc.sendSync('settingsWindow', ['getAllDisplays']);
const obsResolutions: any = ipc.sendSync('settingsWindow', ['getObsAvailableResolutions']);
const { Base: baseResolutions, Output: outputResolutions } = obsResolutions;

const fpsOptions = ['10', '20', '30', '60'];

export default function VideoSettings() {
  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig: any) => ({ ...prevConfig, [stateKey]: value }));
  };

  if (!fpsOptions.includes(config.obsFPS)) {
    config.obsFPS = fpsOptions.at(-1);
  }

  const style = {
    width: '405px',
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
    "& .MuiInputLabel-root": {
      color: 'white'
    },
  }

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
        <FormControl sx={{my: 1}}>
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
        <Tooltip title={configSchema["monitorIndex"].description} >
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl sx={{my: 1}}>
          <InputLabel id="obs-output-resolution-label" sx = {style}>Video Output Resolution</InputLabel>
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
        <Tooltip title={configSchema["obsOutputResolution"].description} >
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl sx={{my: 1}}>
          <InputLabel id="obs-fps-label" sx = {style}>Video FPS</InputLabel>
          <Select
            labelId="obs-fps-label"
            id="obs-fps"
            value={config.obsFPS}
            label="Video FPS"
            onChange={(event) => modifyConfig('obsFPS', event.target.value)}
            sx={style}
          >
            { fpsOptions.map((res: string) =>
              <MenuItem key={ 'obs-fps-' + res } value={ res }>
                { res }
              </MenuItem>
            )}
          </Select>
        </FormControl>
        <Tooltip title={configSchema["obsFPS"].description} >
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField 
          value={config.obsKBitRate}
          onChange={event => { modifyConfig("obsKBitRate", parseInt(event.target.value, 10)) }}
          id="video-bit-rate" 
          label="Video Bit Rate (kbps)" 
          variant="outlined" 
          type="number" 
          error= { config.obsKBitRate < 1  || config.obsKBitRate > 300 }
          helperText={(config.obsKBitRate < 1  || config.obsKBitRate > 300) ? "Must be between 1 and 300" : ' '}
          InputLabelProps={{ shrink: true }}
          sx={{...style, my: 1}}
          inputProps={{ style: { color: "white" } }}
        />
        <Tooltip title={configSchema["obsKBitRate"].description} sx={{position: 'relative', right: '0px', top: '17px'}}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>

    </Stack>
  );
}
