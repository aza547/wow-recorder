import * as React from 'react';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { FakeChangeEvent, ISettingsPanelProps } from 'main/types';
import { DialogContentText, Switch } from '@mui/material';
import { configSchema } from '../main/configSchema';
import InformationDialog from '../renderer/InformationDialog';
import { openDirectorySelectorDialog } from './settingUtils';

const ipc = window.electron.ipcRenderer;

export default function GeneralSettings(props: ISettingsPanelProps) {
  const { config, onChange } = props;
  const [openDialog, setDialog] = React.useState(false);

  const closeDialog = () => setDialog(false);

  /**
   * Event handler when user selects an option in dialog window.
   */
  React.useEffect(() => {
    ipc.on('settingsWindow', (args: any) => {
      const [func, setting, value, validationResult] = args;

      if (func === 'pathSelected') {
        if (setting === 'retailLogPath' || setting === 'classicLogPath') {
          if (!validationResult) {
            setDialog(true);
            return;
          }
        }

        onChange(new FakeChangeEvent(setting, value));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = {
    width: '450px',
    '& .MuiOutlinedInput-root': {
      '&.Mui-focused fieldset': { borderColor: '#bb4220' },
      '& > fieldset': { borderColor: 'black' },
    },
    '& .MuiInputLabel-root': { color: 'white' },
    '& label.Mui-focused': { color: '#bb4220' },
  };

  const formControlLabelStyle = { color: 'white' };
  const formGroupStyle = { width: '48ch' };

  const switchStyle = {
    '& .MuiSwitch-switchBase': {
      '&.Mui-checked': {
        color: '#fff',
        '+.MuiSwitch-track': {
          backgroundColor: '#bb4220',
          opacity: 1.0,
        },
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: 0.5,
      },
    },
  };

  const getSwitch = (preference: string) => (
    <Switch
      sx={switchStyle}
      checked={Boolean(config[preference])}
      name={preference}
      onChange={onChange}
    />
  );

  const openLink = (url: string) => {
    ipc.sendMessage('openURL', [url]);
  };

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
          name="storagePath"
          value={config.storagePath}
          id="storage-path"
          label="Storage Path"
          variant="outlined"
          onClick={() => openDirectorySelectorDialog('storagePath')}
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
        <Tooltip
          title={configSchema.storagePath.description}
          sx={{ position: 'relative', right: '0px', top: '17px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField
          value={config.retailLogPath}
          id="retail-log-path"
          label="Retail Log Path"
          variant="outlined"
          onClick={() => openDirectorySelectorDialog('retailLogPath')}
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
        <Tooltip
          title={configSchema.retailLogPath.description}
          sx={{ position: 'relative', right: '0px', top: '17px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField
          name="classicLogPath"
          value={config.classicLogPath}
          id="classic-log-path"
          label="Classic Log Path"
          variant="outlined"
          onClick={() => openDirectorySelectorDialog('classicLogPath')}
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
        <Tooltip
          title={configSchema.classicLogPath.description}
          sx={{ position: 'relative', right: '0px', top: '17px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField
          name="maxStorage"
          value={config.maxStorage}
          onChange={onChange}
          id="max-storage"
          label="Max Storage (GB)"
          variant="outlined"
          type="number"
          error={config.maxStorage < 0}
          helperText={config.maxStorage < 0 ? 'Must be positive' : ' '}
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
        <Tooltip
          title={configSchema.maxStorage.description}
          sx={{ position: 'relative', right: '0px', top: '17px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span">
        <FormGroup sx={formGroupStyle}>
          <FormControlLabel
            control={getSwitch('startUp')}
            label="Run on startup"
            style={formControlLabelStyle}
          />
        </FormGroup>
        <Tooltip
          title={configSchema.startUp.description}
          sx={{ position: 'fixed', left: '320px', top: '360px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span">
        <FormGroup sx={formGroupStyle}>
          <FormControlLabel
            control={getSwitch('startMinimized')}
            label="Start minimized"
            style={formControlLabelStyle}
          />
        </FormGroup>
        <Tooltip
          title={configSchema.startMinimized.description}
          sx={{ position: 'fixed', left: '325px', top: '398px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span">
        <FormGroup sx={formGroupStyle}>
          <FormControlLabel
            control={getSwitch('minimizeOnQuit')}
            label="Minimize on quit"
            style={formControlLabelStyle}
          />
        </FormGroup>
        <Tooltip
          title={configSchema.minimizeOnQuit.description}
          sx={{ position: 'fixed', left: '330px', top: '437px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span">
        <FormGroup sx={formGroupStyle}>
          <FormControlLabel
            control={getSwitch('minimizeToTray')}
            label="Minimize to tray"
            style={formControlLabelStyle}
          />
        </FormGroup>
        <Tooltip
          title={configSchema.minimizeToTray.description}
          sx={{ position: 'fixed', left: '327px', top: '475px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <InformationDialog
        title="🚫 Not a combat log directory"
        open={openDialog}
        buttons={['close']}
        default="close"
        onClose={closeDialog}
      >
        <DialogContentText>
          The directory you picked does not look like a directory for World of
          Warcraft combat logs.
        </DialogContentText>

        <DialogContentText>
          You can easily find this directory by{' '}
          <a
            href="#"
            onClick={() =>
              openLink(
                'https://github.com/aza547/wow-recorder/blob/main/docs/LocateLogDirectory.md'
              )
            }
          >
            following this guide
          </a>
          .
        </DialogContentText>
      </InformationDialog>
    </Stack>
  );
}
