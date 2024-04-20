import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Box,
  Button,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import { RecStatus } from 'main/types';
import React from 'react';
import { getSettings } from './useSettings';

interface IProps {
  recorderStatus: RecStatus;
  error: string;
}

export default function RecorderStatus(props: IProps) {
  const { recorderStatus, error } = props;
  const config = getSettings();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const stopRecording = () => {
    window.electron.ipcRenderer.sendMessage('recorder', ['stop']);
  };

  const getConfiguredFlavours = () => {
    if (config.recordRetail && config.recordClassic) {
      return 'Retail and Classic';
    }

    if (config.recordRetail) {
      return 'Retail';
    }

    if (config.recordClassic) {
      return 'Classic';
    }

    return 'nothing. You likely want to enable retail, classic, or both in the app settings';
  };

  const getStatusSummary = () => {
    if (recorderStatus === RecStatus.Recording) {
      return (
        <>
          <Typography sx={{ color: '#bb4420', m: 1 }}>
            Warcraft Recorder is currently recording.
          </Typography>
          <Typography sx={{ color: 'white', fontSize: '0.75rem', m: 1 }}>
            You can force the recording to end. Normally this should not be
            required. This can help end a failed Mythic+ run that would
            otherwise need a few minutes to wrap up.
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Button
              variant="outlined"
              onClick={stopRecording}
              sx={{
                m: 2,
                color: 'white',
                borderColor: 'white',
                ':hover': {
                  color: '#bb4420',
                  borderColor: '#bb4420',
                },
              }}
            >
              Force Stop
            </Button>
          </Box>
        </>
      );
    }

    if (recorderStatus === RecStatus.ReadyToRecord) {
      return (
        <>
          <Typography sx={{ color: '#bb4420', m: 1 }}>
            Detected World of Warcraft is running.
          </Typography>

          <Typography sx={{ color: 'white', fontSize: '0.75rem', m: 1 }}>
            Warcraft Recorder is waiting for a recordable event to appear in the
            combat log. Watching log paths:
          </Typography>

          {config.recordRetail && (
            <Typography sx={{ color: 'white', fontSize: '0.75rem', mx: 1 }}>
              Retail: {config.retailLogPath}
            </Typography>
          )}

          {config.recordClassic && (
            <Typography sx={{ color: 'white', fontSize: '0.75rem', mx: 1 }}>
              Classic: {config.classicLogPath}
            </Typography>
          )}

          <Typography sx={{ color: 'white', fontSize: '0.75rem', m: 1 }}>
            Tip: If recordings do not start, check your logging settings in-game
            and confirm your log path configuration is correct.
          </Typography>
        </>
      );
    }

    if (recorderStatus === RecStatus.WaitingForWoW) {
      return (
        <>
          <Typography sx={{ color: '#bb4420', m: 1 }}>
            Waiting for World of Warcraft to start.
          </Typography>
          <Typography sx={{ color: 'white', m: 1, fontSize: '0.75rem' }}>
            Warcraft Recorder is configured to record {getConfiguredFlavours()}.
          </Typography>
        </>
      );
    }

    if (recorderStatus === RecStatus.FatalError) {
      return (
        <>
          <Typography sx={{ color: 'white', m: 1 }}>
            Warcraft Recorder has hit a fatal error.
          </Typography>
          <Typography sx={{ color: 'white', m: 1, fontSize: '0.75rem' }}>
            Please restart the application.
          </Typography>
          <Typography sx={{ color: 'red', m: 1, fontSize: '0.75rem' }}>
            {error}
          </Typography>
          <Typography sx={{ color: 'white', m: 1, fontSize: '0.75rem' }}>
            If this problem is recurring, please ask for help in Discord. See
            the pins in the #help channel for advice on getting help.
          </Typography>
        </>
      );
    }

    if (recorderStatus === RecStatus.Overruning) {
      return (
        <>
          <Typography sx={{ color: '#bb4420', m: 1 }}>
            Over-running...
          </Typography>
          <Typography sx={{ color: 'white', m: 1, fontSize: '0.75rem' }}>
            Warcraft Recorder has detected an activity has completed successfuly
            and is recording a few seconds extra to catch the aftermath.
          </Typography>
        </>
      );
    }

    return (
      <>
        <Typography sx={{ color: 'white' }}>
          Warcraft Recorder is incorrectly configured, please resolve the below
          error.
        </Typography>
        <Typography sx={{ color: 'red' }}>{error}</Typography>
      </>
    );
  };

  const getAppropriateIcon = () => {
    if (recorderStatus === RecStatus.Recording) {
      return <FiberManualRecordIcon sx={{ width: '25px', height: '25px' }} />;
    }

    if (recorderStatus === RecStatus.ReadyToRecord) {
      return <VisibilityIcon sx={{ width: '25px', height: '25px' }} />;
    }

    if (recorderStatus === RecStatus.WaitingForWoW) {
      return <VisibilityOffIcon sx={{ width: '25px', height: '25px' }} />;
    }

    if (recorderStatus === RecStatus.Overruning) {
      return <MoreTimeIcon sx={{ width: '25px', height: '25px' }} />;
    }

    if (recorderStatus === RecStatus.Reconfiguring) {
      return (
        <SettingsIcon
          sx={{
            width: '25px',
            height: '25px',
            animation: 'spin 2s linear infinite',
            '@keyframes spin': {
              from: { transform: 'rotate(0deg)' },
              to: { transform: 'rotate(360deg)' },
            },
          }}
        />
      );
    }

    return <ReportProblemIcon sx={{ width: '25px', height: '25px' }} />;
  };

  const getAppropriateColor = () => {
    if (recorderStatus === RecStatus.ReadyToRecord) {
      return '#bb4420';
    }

    if (recorderStatus === RecStatus.FatalError) {
      return 'red';
    }

    if (
      recorderStatus === RecStatus.InvalidConfig ||
      recorderStatus === RecStatus.Overruning
    ) {
      return 'yellow';
    }

    return 'white';
  };

  return (
    <>
      <Tooltip title="Status">
        <IconButton
          id="rec-status-button"
          type="button"
          onClick={handleClick}
          sx={{
            padding: '2px',
            minWidth: '25px',
            color: getAppropriateColor(),
          }}
        >
          {getAppropriateIcon()}
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box
          sx={{
            border: '1px solid white',
            p: 2,
            borderRadius: '5px',
            width: '400px',
            bgcolor: '#272e48',
            display: 'flex',
            alignItems: 'left',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          {getStatusSummary()}
        </Box>
      </Popover>
    </>
  );
}
