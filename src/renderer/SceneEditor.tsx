import { Box } from '@mui/material';
import React from 'react';
import RecorderPreview from './RecorderPreview';
import ChatOverlayControls from './ChatOverlayControls';
import VideoSourceControls from './VideoSourceControls';
import AudioSourceControls from './AudioSourceControls';

const SceneEditor: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      }}
    >
      <Box sx={{ width: '100%', height: '75%' }}>
        <RecorderPreview />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          width: '100%',
          height: '40%',
        }}
      >
        <VideoSourceControls />
        <AudioSourceControls />
        <ChatOverlayControls />
      </Box>
    </Box>
  );
};

export default SceneEditor;
