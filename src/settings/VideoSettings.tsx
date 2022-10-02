import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { OurDisplayType } from 'main/types';
import ConfigContext from "./ConfigContext";
import { configSchema } from '../main/configSchema'
import Box from '@mui/material/Box';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

const ipc = window.electron.ipcRenderer;
const displayConfiguration = ipc.sendSync('settingsWindow', ['getAllDisplays']);

export default function VideoSettings() {
  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig: any) => ({ ...prevConfig, [stateKey]: value }));
  };

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
      <Box component="span" sx={{ display: 'flex', alignItems: 'center'}}>
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
    </Stack>
  );
}