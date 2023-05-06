import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { OurDisplayType, ISettingsPanelProps } from 'main/types';
import { Box, FormControlLabel, Switch, TextField } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React from 'react';
import { configSchema, ConfigurationSchemaKey } from '../main/configSchema';
import { obsResolutions } from '../main/constants';

const ipc = window.electron.ipcRenderer;
const displayConfiguration = ipc.sendSync('settingsWindow', ['getAllDisplays']);

const outputResolutions = Object.keys(obsResolutions);
const fpsOptions = ['10', '20', '30', '60'];

const obsCaptureModes = {
  game_capture: 'Game Capture (Recommended)',
  monitor_capture: 'Monitor Capture',
};

export default function VideoSettings(props: ISettingsPanelProps) {
  const { config, onChange } = props;

  const initialCaptureCursor = config.captureCursor;
  const [captureCursor, setCaptureCursor] =
    React.useState<boolean>(initialCaptureCursor);

  const style = {
    width: '405px',
    color: 'white',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'black',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#bb4220',
    },
    '&.Mui-focused': {
      borderColor: '#bb4220',
      color: '#bb4220',
    },
    '& .MuiInputLabel-root': {
      color: 'white',
    },
  };

  const getBitrateTooltip = () => {
    return (
      <div>
        {configSchema.obsKBitRate.description}
        <br />
        <br />
        <table>
          <tr>
            <th>Quality</th>
            <th>30 FPS</th>
            <th>60 FPS</th>
          </tr>
          <tr>
            <td>720p</td>
            <td>7 Mbps</td>
            <td>10 Mbps</td>
          </tr>
          <tr>
            <td>1080p</td>
            <td>10 Mbps</td>
            <td>15 Mbps</td>
          </tr>
          <tr>
            <td>1440p</td>
            <td>20 Mbps</td>
            <td>30 Mbps</td>
          </tr>
          <tr>
            <td>2160p</td>
            <td>50 Mbps</td>
            <td>80 Mbps</td>
          </tr>
        </table>
      </div>
    );
  };

  const captureCursorConfigKey: ConfigurationSchemaKey = 'captureCursor';

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
        <FormControl sx={{ my: 1 }}>
          <InputLabel id="obs-output-resolution-label" sx={style}>
            Video Output Resolution
          </InputLabel>
          <Select
            name="obsOutputResolution"
            labelId="obs-output-resolution-label"
            id="obs-output-resolution"
            value={config.obsOutputResolution}
            label="Output resolution for OBS"
            onChange={onChange}
            sx={style}
          >
            {outputResolutions.map((res: string) => (
              <MenuItem key={`obs-output-resolution-${res}`} value={res}>
                {res}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title={configSchema.obsOutputResolution.description}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControl sx={{ my: 1 }}>
          <InputLabel id="obs-fps-label" sx={style}>
            Video FPS
          </InputLabel>
          <Select
            name="obsFPS"
            labelId="obs-fps-label"
            id="obs-fps"
            value={config.obsFPS}
            label="Video FPS"
            onChange={onChange}
            sx={style}
          >
            {fpsOptions.map((res: string) => (
              <MenuItem key={`obs-fps-${res}`} value={res}>
                {res}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title={configSchema.obsFPS.description}>
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <TextField
          name="obsKBitRate"
          value={config.obsKBitRate}
          onChange={onChange}
          id="video-bit-rate"
          label="Video Bit Rate (Mbps)"
          variant="outlined"
          type="number"
          error={config.obsKBitRate < 1 || config.obsKBitRate > 300}
          helperText={
            config.obsKBitRate < 1 || config.obsKBitRate > 300
              ? 'Must be between 1 and 300'
              : ' '
          }
          InputLabelProps={{ shrink: true }}
          sx={{ ...style, my: 1 }}
          inputProps={{ style: { color: 'white' } }}
        />
        <Tooltip
          title={getBitrateTooltip()}
          sx={{ position: 'relative', right: '0px', top: '17px' }}
        >
          <IconButton>
            <InfoIcon style={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              sx={switchStyle}
              checked={captureCursor}
              name={captureCursorConfigKey}
              onChange={(isCaptureCursor) => {
                setCaptureCursor(Boolean(isCaptureCursor.target.checked));
                onChange(isCaptureCursor);
              }}
            />
          }
          label="Capture Cursor"
          sx={{
            color: 'white',
          }}
        />
        <Tooltip title={configSchema.captureCursor.description}>
          <IconButton>
            <InfoIcon sx={{ color: 'white' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}
