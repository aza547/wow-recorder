import { Box, Button, Popover, Tooltip, Typography } from '@mui/material';
import BiotechIcon from '@mui/icons-material/Biotech';
import React from 'react';
import { VideoCategory } from 'types/VideoCategory';

const ipc = window.electron.ipcRenderer;

export default function TestButton() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const testCategories = [
    VideoCategory.TwoVTwo,
    VideoCategory.ThreeVThree,
    VideoCategory.SoloShuffle,
    VideoCategory.Raids,
    VideoCategory.Battlegrounds,
    VideoCategory.MythicPlus,
  ];

  const runTest = (event: any, category: VideoCategory) => {
    // 'Click' will perform a normal test
    // 'Ctrl-Alt-Click' will initiate a test but won't finish it
    // and requires a force stop of the recording.
    const endTest = !(event.ctrlKey && event.altKey);
    ipc.sendMessage('test', [category, endTest]);
    handleClose();
  };

  return (
    <>
      <Tooltip title="Test">
        <Button
          id="test-button"
          type="button"
          onClick={handleClick}
          sx={{ padding: '2px', minWidth: '25px' }}
        >
          <BiotechIcon sx={{ width: '25px', height: '25px', color: 'white' }} />
        </Button>
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
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid white',
            borderRadius: '1%',
            p: 1,
            width: '250px',
            bgcolor: '#272e48',
          }}
        >
          <Typography sx={{ color: 'white', fontSize: '0.75rem', m: 1 }}>
            This button allows you to test your video and recording settings by
            injecting some fake data into the combat log. This does not test if
            you have set up combat logging in-game correctly.
          </Typography>
          <Typography sx={{ color: 'white', fontSize: '0.75rem', m: 1 }}>
            Select a category:
          </Typography>
          {testCategories.map((category: VideoCategory) => {
            return (
              <Button
                key={`test-button-${category}`}
                variant="outlined"
                onClick={(e) => {
                  runTest(e, category);
                }}
                sx={{
                  m: '4px',
                  color: 'white',
                  borderColor: 'white',
                  ':hover': {
                    color: '#bb4420',
                    borderColor: '#bb4420',
                  },
                }}
              >
                {category}
              </Button>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
