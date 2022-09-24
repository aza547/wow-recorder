import * as React from 'react';
import { openRetailLogPathDialog, openStoragePathDialog, openClassicLogPathDialog } from '../renderer/rendererutils';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import { stateKeyToSettingKeyMap, StateToSettingKeyMapKey } from './settingUtils';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';

const ipc = window.electron.ipcRenderer;
const store = window.electron.store;

export default function GeneralSettings() {

  const [state, setState] = React.useState({
    storagePath: store.get('storage-path'),
    retailLogPath: store.get('retail-log-path'),
    classicLogPath: store.get('classic-log-path'),
    maxStorage: store.get('max-storage'),
  });

  /**
   * Event handler when user selects an option in dialog window.
   */
   React.useEffect(() => {
    ipc.on('settingsWindow', (args: any) => {
      console.log(args);
      if (args[0] === "pathSelected") setSetting(args[1], args[2]);
    });
  }, []);

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
        '& > :not(style)': { m: 1, width: '50ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <TextField 
        value={state.storagePath}
        id="storage-path" 
        label="Storage Path" 
        variant="outlined" 
        onClick={openStoragePathDialog} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
      <TextField 
        value={state.retailLogPath}
        id="retail-log-path" 
        label="Retail Log Path" 
        variant="outlined" 
        onClick={openRetailLogPathDialog} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
      <TextField 
        value={state.classicLogPath}
        id="classic-log-path" 
        label="Classic Log Path" 
        variant="outlined" 
        onClick={openClassicLogPathDialog} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
      <TextField 
        value={state.maxStorage}
        onChange={event => setState({ maxStorage: event.target.value })}
        id="max-storage" 
        label="Max Storage (GB)" 
        variant="outlined" 
        type="number" 
        error= { state.maxStorage < 1 }
        helperText={(state.maxStorage < 1) ? "Must be positive" : ' '}
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
    </Stack>
  );
}