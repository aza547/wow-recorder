import * as React from 'react';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import { openDirectorySelectorDialog } from './settingUtils';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import ConfigContext from "./ConfigContext";
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { configSchema } from '../main/configSchema'

const ipc = window.electron.ipcRenderer;

export default function GeneralSettings() {

  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig: any) => ({ ...prevConfig, [stateKey]: value }));
  };

  const modifyCheckboxConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({
      ...config,
      [event.target.name]: event.target.checked,
    });
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
    width: '450px',
    "& .MuiOutlinedInput-root": {
      "&.Mui-focused fieldset": {borderColor: "#bb4220"},
      "& > fieldset": {borderColor: "black" }
    },
    "& .MuiInputLabel-root": {color: 'white'},
    "& label.Mui-focused": {color: "#bb4220"},
  }   

  const checkBoxStyle = {color: "#bb4220"};
  const formControlLabelStyle = {color: "white"};
  const formGroupStyle = {width: '48ch'};

  const getCheckBox = (preference: string) => {
    return (
      <Checkbox 
        checked={ config[preference] } 
        onChange={modifyCheckboxConfig} 
        name={preference}
        style = {checkBoxStyle} 
      />
    )
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
      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField 
          value={config.storagePath}
          id="storage-path" 
          label="Storage Path" 
          variant="outlined" 
          onClick={() => openDirectorySelectorDialog("storagePath")} 
          InputLabelProps={{ shrink: true }}
          sx={{...style, my: 1}}
          inputProps={{ style: { color: "white" } }}
        />
        <Tooltip title={configSchema["storagePath"].description} sx={{position: 'relative', right: '0px', top: '17px'}}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>
      
      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField 
          value={config.retailLogPath}
          id="retail-log-path" 
          label="Retail Log Path" 
          variant="outlined" 
          onClick={() => openDirectorySelectorDialog("retailLogPath")} 
          InputLabelProps={{ shrink: true }}
          sx={{...style, my: 1}}
          inputProps={{ style: { color: "white" } }}
        />
        <Tooltip title={configSchema["retailLogPath"].description} sx={{position: 'relative', right: '0px', top: '17px'}}>
          <IconButton>
            <InfoIcon style={{ color: 'white'}}/>
          </IconButton>
        </Tooltip>
      </Box>
      {/* <TextField 
        value={config.classicLogPath}
        id="classic-log-path" 
        label="Classic Log Path" 
        variant="outlined" 
        onClick={() => openDirectorySelectorDialog("classicLogPath")} 
        InputLabelProps={{ shrink: true }}
        sx={style}
        inputProps={{ style: { color: "white" } }}
      /> */}

      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField 
          value={config.maxStorage}
          onChange={event => { modifyConfig("maxStorage", parseInt(event.target.value, 10)) }}
          id="max-storage" 
          label="Max Storage (GB)" 
          variant="outlined" 
          type="number" 
          error= { config.maxStorage < 0 }
          helperText={(config.maxStorage < 0) ? "Must be positive" : ' '}
          InputLabelProps={{ shrink: true }}
          sx={{...style, my: 1}}
          inputProps={{ style: { color: "white" } }}
        />
        <Tooltip title={configSchema["maxStorage"].description} sx={{position: 'relative', right: '0px', top: '17px'}}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span">
        <FormGroup sx={formGroupStyle}>
          <FormControlLabel control={getCheckBox("startUp")} label="Run on startup" style = {formControlLabelStyle} />
        </FormGroup>
        <Tooltip title={configSchema["startUp"].description} sx={{position: 'fixed', left: '315px', top: '292px'}}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span">
        <FormGroup sx={formGroupStyle}>
          <FormControlLabel control={getCheckBox("startMinimized")} label="Start minimized" style={formControlLabelStyle} />
        </FormGroup>
        <Tooltip title={configSchema["startMinimized"].description} sx={{position: 'fixed', left: '315px', top: '333px'}}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>
      
    </Stack>
  );
}
