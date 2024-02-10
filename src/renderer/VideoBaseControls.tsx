import {
  Box,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { FC, useEffect, useRef, useState } from 'react';
import { Encoder, RecStatus } from 'main/types';
import { obsResolutions } from 'main/constants';
import { configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import { ESupportedEncoders, QualityPresets } from 'main/obsEnums';
import { useSettings, setConfigValues } from './useSettings';
import {
  encoderFilter,
  isHighRes,
  mapEncoderToString,
  mapStringToEncoder,
} from './rendererutils';

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
  '&:hover': {
    '&& fieldset': {
      borderColor: '#bb4220',
    },
  },
  '& .MuiOutlinedInput-root': {
    '&.Mui-focused fieldset': {
      borderColor: '#bb4220',
    },
  },
  '.MuiSvgIcon-root ': {
    fill: 'white !important',
  },
};

const outputResolutions = Object.keys(obsResolutions);
const fpsOptions = [10, 20, 30, 60];

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
const VideoBaseControls: FC<IProps> = (props: IProps) => {
  const [config, setConfig] = useSettings();
  const { recorderStatus } = props;
  const initialRender = useRef(true);
  const highRes = isHighRes(config.obsOutputResolution);
  const [encoders, setEncoders] = useState<Encoder[]>([]);

  useEffect(() => {
    const getAvailableEncoders = async () => {
      const allEncoders = await ipc.invoke('getEncoders', []);

      const availableEncoders = allEncoders
        .filter((s: string) => encoderFilter(s, highRes))
        .map(mapStringToEncoder)
        .sort((a: Encoder, b: Encoder) => a.type < b.type);

      setEncoders(availableEncoders);
    };

    getAvailableEncoders();

    // The reset of this effect handles config changes, so if it's the
    // initial render then just return here.
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    setConfigValues({
      obsOutputResolution: config.obsOutputResolution,
      obsFPS: config.obsFPS,
      obsQuality: config.obsQuality,
      obsRecEncoder: config.obsRecEncoder,
    });

    ipc.sendMessage('settingsChange', []);
  }, [
    config.obsOutputResolution,
    config.obsFPS,
    config.obsQuality,
    config.obsRecEncoder,
    highRes,
  ]);

  const isComponentDisabled = () => {
    const isRecording = recorderStatus === RecStatus.Recording;
    const isOverrunning = recorderStatus === RecStatus.Overruning;
    return isRecording || isOverrunning;
  };

  const getMenuItem = (value: string) => {
    return (
      <MenuItem sx={{ height: '25px' }} key={value} value={value}>
        {value}
      </MenuItem>
    );
  };

  const getEncoderMenuItem = (enc: Encoder) => {
    return (
      <MenuItem sx={{ height: '25px' }} key={enc.name} value={enc.name}>
        {mapEncoderToString(enc)}
      </MenuItem>
    );
  };

  const getQualityMenuItem = (quality: QualityPresets) => {
    return (
      <MenuItem sx={{ height: '25px' }} key={quality} value={quality}>
        {quality}
      </MenuItem>
    );
  };

  const getToggleButton = (value: number) => {
    return (
      <ToggleButton
        value={value}
        key={value}
        sx={{
          color: 'white',
          height: '40px',
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

    const selectedhighRes = isHighRes(value);

    if (selectedhighRes) {
      setConfig((prevState) => {
        return {
          ...prevState,
          obsOutputResolution: value,
          obsRecEncoder: ESupportedEncoders.OBS_X264,
        };
      });
    } else {
      setConfig((prevState) => {
        return {
          ...prevState,
          obsOutputResolution: value,
        };
      });
    }
  };

  const getCanvasResolutionSelect = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <FormControl size="small" sx={{ ...formControlStyle, maxWidth: '150px' }}>
        <InputLabel sx={selectStyle}>Canvas Resolution</InputLabel>
        <Select
          value={config.obsOutputResolution}
          label="Canvas Resolution"
          disabled={isComponentDisabled()}
          onChange={setCanvasResolution}
          sx={selectStyle}
          MenuProps={{
            PaperProps: {
              sx: {
                height: '300px',
                overflowY: 'scroll',
              },
            },
          }}
        >
          {outputResolutions.map(getMenuItem)}
        </Select>
      </FormControl>
    );
  };

  const setFPS = (_event: React.MouseEvent<HTMLElement>, fps: number) => {
    if (fps === null) {
      return;
    }

    setConfig((prevState) => {
      return {
        ...prevState,
        obsFPS: fps,
      };
    });
  };

  const getFPSToggle = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <FormControlLabel
        control={
          <ToggleButtonGroup
            value={config.obsFPS}
            disabled={isComponentDisabled()}
            exclusive
            onChange={setFPS}
            sx={{ border: '1px solid white', height: '40px' }}
          >
            {fpsOptions.map(getToggleButton)}
          </ToggleButtonGroup>
        }
        label="FPS"
        labelPlacement="top"
        sx={{ color: 'white', pb: 3 }}
      />
    );
  };

  const setQuality = (event: SelectChangeEvent<string>) => {
    const {
      target: { value },
    } = event;

    setConfig((prevState) => {
      return {
        ...prevState,
        obsQuality: value,
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
        These settings can not be modified while a recording is active.
      </Typography>
    );
  };

  const getQualitySelect = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <FormControl size="small" sx={{ ...formControlStyle, maxWidth: '150px' }}>
        <InputLabel sx={selectStyle}>Quality</InputLabel>
        <Select
          value={config.obsQuality}
          label="Quality"
          disabled={isComponentDisabled()}
          onChange={setQuality}
          sx={{ ...selectStyle }}
        >
          {Object.values(QualityPresets).map(getQualityMenuItem)}
        </Select>
      </FormControl>
    );
  };

  const setEncoder = (event: SelectChangeEvent<string>) => {
    const {
      target: { value },
    } = event;

    setConfig((prevState) => {
      return {
        ...prevState,
        obsRecEncoder: value,
      };
    });
  };

  const getEncoderSelect = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    return (
      <FormControl size="small" sx={{ ...formControlStyle, maxWidth: '250px' }}>
        <InputLabel sx={selectStyle}>Video Encoder</InputLabel>
        <Select
          value={config.obsRecEncoder}
          label="Video Encoder"
          disabled={isComponentDisabled()}
          onChange={setEncoder}
          sx={{ ...selectStyle }}
        >
          {encoders.map(getEncoderMenuItem)}
        </Select>
      </FormControl>
    );
  };

  const getInfoIcon = () => {
    if (isComponentDisabled()) {
      return <></>;
    }

    const helptext = [
      ['FPS', configSchema.obsFPS.description].join('\n'),
      ['Canvas Resolution', configSchema.obsOutputResolution.description].join(
        '\n'
      ),
      ['Quality', configSchema.obsQuality.description].join('\n'),
      ['Video Encoder', configSchema.obsRecEncoder.description].join('\n'),
    ].join('\n\n');

    return (
      <Tooltip title={<div style={{ whiteSpace: 'pre-line' }}>{helptext}</div>}>
        <IconButton>
          <InfoIcon style={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
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
        {getFPSToggle()}
        {getCanvasResolutionSelect()}
        {getQualitySelect()}
        {getEncoderSelect()}
        {getInfoIcon()}
      </Box>
    </Box>
  );
};

export default VideoBaseControls;
