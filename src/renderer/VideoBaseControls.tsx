import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import { obsResolutions } from 'main/constants';
import { useSettings, setConfigValues } from './useSettings';

const ipc = window.electron.ipcRenderer;

const formControlStyle = { m: 1, width: '100%' };

const selectStyle = {
  color: 'white',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'white',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#bb4220',
  },
  '&.Mui-focused': {
    borderColor: '#bb4220',
    color: '#bb4220',
  },
};

interface IProps {
  recorderStatus: RecStatus;
}

/**
 * The video base controls. The distinction here between the controls in
 * VideoSourceControls is that the base controls can't be changed live.
 *
 *   - If we're mid encounter, we can't allow settings changes as we can't
 *     stop/start the recording without ruining the clip.
 *   - If WoW is open, OBS is recording but it's uninteresting footage,
 *     changes are allowed but we will need to restart the recorder.
 *   - Otherwise, let the user do whatever they want.
 */
const VideoBaseControls: React.FC<IProps> = (props: IProps) => {
  const [config, setConfig] = useSettings();
  const { recorderStatus } = props;
  console.log(recorderStatus);

  const outputResolutions = Object.keys(obsResolutions);
  const fpsOptions = ['10', '20', '30', '60'];

  React.useEffect(() => {
    setConfigValues({
      obsOutputResolution: config.obsOutputResolution,
      obsFPS: config.obsFPS,
      obsKBitRate: config.obsKBitRate,
    });

    ipc.sendMessage('recorder', ['base']);
  }, [config.obsOutputResolution, config.obsFPS, config.obsKBitRate]);

  const isComponentDisabled = () => {
    return recorderStatus === RecStatus.Recording;
  };

  const getMenuItem = (value: string) => {
    return (
      <MenuItem
        sx={{ height: '25px' }}
        key={`obs-output-resolution-${value}`}
        value={value}
      >
        {value}
      </MenuItem>
    );
  };

  const getToggleButton = (value: string) => {
    return (
      <ToggleButton
        value={value}
        key={value}
        sx={{
          color: 'white',
          height: '30px',
          '&.Mui-selected, &.Mui-selected:hover': {
            color: 'white',
            backgroundColor: '#bb4420',
          },
        }}
      >
        {value}
      </ToggleButton>
    );
  };

  const setCanvasResolution = (event: SelectChangeEvent<string>) => {
    const {
      target: { value },
    } = event;

    setConfig((prevState) => {
      return {
        ...prevState,
        obsOutputResolution: value,
      };
    });
  };

  const getCanvasResolutionSelect = () => {
    return (
      <FormControl size="small" sx={formControlStyle}>
        <InputLabel id="obs-output-resolution-label" sx={selectStyle}>
          Canvas Resolution
        </InputLabel>
        <Select
          value={config.obsOutputResolution}
          label="Output resolution for OBS"
          disabled={isComponentDisabled()}
          onChange={setCanvasResolution}
          sx={selectStyle}
        >
          {outputResolutions.map(getMenuItem)}
        </Select>
      </FormControl>
    );
  };

  const setFPS = (_event: React.MouseEvent<HTMLElement>, fps: number) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsFPS: fps,
      };
    });
  };

  const getFPSToggle = () => {
    return (
      <FormControlLabel
        control={
          <ToggleButtonGroup
            value={config.obsFPS}
            exclusive
            onChange={setFPS}
            sx={{ border: '1px solid white' }}
          >
            {fpsOptions.map(getToggleButton)}
          </ToggleButtonGroup>
        }
        label="FPS"
        labelPlacement="top"
        sx={{ color: 'white' }}
      />
    );
  };

  const isBitrateValid = () => {
    return config.obsKBitRate > 1 && config.obsKBitRate < 300;
  };

  const getBitrateHelperText = () => {
    return isBitrateValid() ? '' : 'Must be between 1 and 300';
  };

  const setBitrate = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prevState) => {
      return {
        ...prevState,
        obsKBitRate: parseInt(event.target.value, 10),
      };
    });
  };

  const getDisabledText = () => {
    if (!isComponentDisabled()) {
      return <></>;
    }

    return (
      <Typography
        variant="h6"
        align="center"
        sx={{
          color: 'white',
          fontSize: '0.75rem',
          fontFamily: '"Arial",sans-serif',
          fontStyle: 'italic',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        These settings can not be modified whilst a recording is active.
      </Typography>
    );
  };

  const getBitrateField = () => {
    return (
      <FormControl size="small" sx={formControlStyle}>
        <TextField
          size="small"
          name="obsKBitRate"
          value={config.obsKBitRate}
          disabled={isComponentDisabled()}
          onChange={setBitrate}
          label="Video Bit Rate (Mbps)"
          variant="outlined"
          type="number"
          error={!isBitrateValid()}
          helperText={getBitrateHelperText()}
          sx={{ ...selectStyle, my: 1 }}
          InputLabelProps={{ shrink: true, style: { color: 'white' } }}
          inputProps={{ style: { color: 'white' } }}
        />
      </FormControl>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        m: 2,
      }}
    >
      {getDisabledText()}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {getCanvasResolutionSelect()}
        {getBitrateField()}
        {getFPSToggle()}
      </Box>
    </Box>
  );
};

export default VideoBaseControls;
