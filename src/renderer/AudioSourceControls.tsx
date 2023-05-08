import { Box } from '@mui/material';
import React from 'react';
import { useSettings } from 'settings/useSettings';

const ipc = window.electron.ipcRenderer;

const VideoSourceControls: React.FC = () => {
  const [config, setConfig] = useSettings();
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        ml: 1,
        mr: 1,
      }}
    >
      Audio Controls
    </Box>
  );
};

export default VideoSourceControls;
