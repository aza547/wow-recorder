import * as React from 'react';
import { openDirectorySelectorDialog } from './settingUtils';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import { stateKeyToSettingKeyMap, StateToSettingKeyMapKey } from './settingUtils';

const ipc = window.electron.ipcRenderer;
const store = window.electron.store;

export default function GeneralSettings() {

  const [state, setState] = React.useState({
    bufferPath: store.get('buffer-path'),
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
        value={state.bufferPath}
        id="buffer-path" 
        label="Buffer Path" 
        variant="outlined" 
        onClick={() => openDirectorySelectorDialog('bufferPath')} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
    </Stack>
  );
}