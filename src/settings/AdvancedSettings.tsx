import * as React from 'react';
import { openDirectorySelectorDialog } from './settingUtils';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import ConfigContext from "./ConfigContext";
import Box from '@mui/material/Box';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { configSchema } from '../main/configSchema'

const ipc = window.electron.ipcRenderer;

export default function GeneralSettings() {

  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig: any) => ({ ...prevConfig, [stateKey]: value }));
  };

  /**
   * Event handler when user selects an option in dialog window.
   */
   React.useEffect(() => {
    ipc.on('settingsWindow', (args: any) => {
      if (args[0] === "pathSelected") modifyConfig(args[1], args[2]);
    });
  }, []);


  const style = {
    width: '405px',
    "& .MuiOutlinedInput-root": {
      "&.Mui-focused fieldset": {borderColor: "#bb4220"},
      "& > fieldset": {borderColor: "black" }
    },
    "& .MuiInputLabel-root": {color: 'white'},
    "& label.Mui-focused": {color: "#bb4220"},
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
        <TextField 
          value={config.bufferStoragePath}
          id="buffer-path" 
          label="Buffer Path" 
          variant="outlined" 
          onClick={() => openDirectorySelectorDialog('bufferStoragePath')} 
          InputLabelProps={{ shrink: true }}
          sx={{...style, my: 1}}
          inputProps={{ style: { color: "white" } }}
        />
        <Tooltip title={configSchema["bufferStoragePath"].description} >
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center'}}>
        <TextField 
          value={config.minEncounterDuration}
          onChange={event => { modifyConfig("minEncounterDuration", parseInt(event.target.value, 10)) }}
          id="max-storage" 
          label="Min Encounter Duration (sec)" 
          variant="outlined" 
          type="number" 
          error= { config.minEncounterDuration < 1 }
          helperText={(config.minEncounterDuration < 1) ? "Must be positive" : ' '}
          InputLabelProps={{ shrink: true }}
          sx={{...style, my: 1}}
          inputProps={{ style: { color: "white" } }}
        />
        <Tooltip title={configSchema["minEncounterDuration"].description} sx={{position: 'fixed', left: '572px', top: '140px'}} >
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}