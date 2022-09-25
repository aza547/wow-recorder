import * as React from 'react';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import { stateKeyToSettingKeyMap, StateToSettingKeyMapKey, openDirectorySelectorDialog } from './settingUtils';
import ConfigContext from "./ConfigContext";

const ipc = window.electron.ipcRenderer;

export default function GeneralSettings() {

  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig) => ({ ...prevConfig, [stateKey]: value }));
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
        value={config.storagePath}
        id="storage-path" 
        label="Storage Path" 
        variant="outlined" 
        onClick={() => openDirectorySelectorDialog("storagePath")} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
      <TextField 
        value={config.retailLogPath}
        id="retail-log-path" 
        label="Retail Log Path" 
        variant="outlined" 
        onClick={() => openDirectorySelectorDialog("retailLogPath")} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
      <TextField 
        value={config.classicLogPath}
        id="classic-log-path" 
        label="Classic Log Path" 
        variant="outlined" 
        onClick={() => openDirectorySelectorDialog("classicLogPath")} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
      <TextField 
        value={config.maxStorage}
        onChange={event => { modifyConfig("maxStorage", event.target.value) }}
        id="max-storage" 
        label="Max Storage (GB)" 
        variant="outlined" 
        type="number" 
        error= { config.maxStorage < 1 }
        helperText={(config.maxStorage < 1) ? "Must be positive" : ' '}
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      />
    </Stack>
  );
}