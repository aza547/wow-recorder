import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import {
  Box,
  Button,
  IconButton,
  Popover,
  Popper,
  Tooltip,
  Typography,
} from '@mui/material';
import { RecStatus } from 'main/types';
import React from 'react';

interface IProps {
  recorderStatus: RecStatus;
  configError: string;
}

export default function RecorderStatus(props: IProps) {
  const { recorderStatus, configError } = props;

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

  const getStatusSummary = () => {
    if (recorderStatus === RecStatus.Recording) {
      return (
        <>
          <Typography sx={{ color: 'white' }}>
            Warcraft Recorder is currently recording. You can force the
            recording to end, but this should never be required.
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
        <Typography sx={{ color: 'white' }}>
          Warcraft Recorder is ready to record and is waiting for a recordable
          event to appear in the combat log.
        </Typography>
      );
    }

    if (recorderStatus === RecStatus.WaitingForWoW) {
      return (
        <Typography sx={{ color: 'white' }}>
          Warcraft Recorder has valid configuration, and is waiting for World of
          Warcraft to be launched.
        </Typography>
      );
    }

    return (
      <>
        <Typography sx={{ color: 'white' }}>
          Warcraft Recorder is incorrectly configured, please resolve the below
          error.
        </Typography>
        <Typography sx={{ color: 'red' }}>{configError}</Typography>
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

    return <ReportProblemIcon sx={{ width: '25px', height: '25px' }} />;
  };

  const getAppropriateColor = () => {
    if (recorderStatus === RecStatus.Recording) {
      return 'red';
    }

    if (recorderStatus === RecStatus.InvalidConfig) {
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
            border: '1px solid #bb4420',
            p: 1,
            width: '400px',
            bgcolor: '#272e48',
          }}
        >
          {getStatusSummary()}
        </Box>
      </Popover>
    </>
  );
}
