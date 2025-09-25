import { ErrorReport, Crashes } from 'main/types';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Tooltip, IconButton, Popover, Box, Typography } from '@mui/material';
import { useState } from 'react';

interface IProps {
  crashes: Crashes;
}

export default function CrashStatus(props: IProps) {
  const { crashes } = props;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  if (crashes.length < 1) {
    return <></>;
  }

  const getCrashHeading = () => {
    return (
      <Typography sx={{ color: 'white', fontSize: '0.75rem', m: 1 }}>
        An OBS crash has occured and has been recovered from. This should not
        happen in normal operation. You may wish to seek help by sharing your
        WCR and OBS logs in discord.
      </Typography>
    );
  };

  const getCrashSummary = () => {
    return (
      <>
        {crashes.map((ErrorReport: ErrorReport) => {
          const dateString = ErrorReport.date.toLocaleString();
          const { reason } = ErrorReport;

          return (
            <Typography
              key={dateString}
              sx={{ color: '#bb4420', fontSize: '0.75rem', m: 1 }}
            >
              {dateString}: {reason}
            </Typography>
          );
        })}
      </>
    );
  };

  return (
    <>
      <Tooltip title="Crash Report">
        <IconButton
          type="button"
          onClick={handleClick}
          sx={{
            padding: '2px',
            minWidth: '25px',
            color: 'white',
          }}
        >
          <BugReportIcon sx={{ width: '25px', height: '25px' }} />
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
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
          {getCrashHeading()}
          {getCrashSummary()}
        </Box>
      </Popover>
    </>
  );
}
