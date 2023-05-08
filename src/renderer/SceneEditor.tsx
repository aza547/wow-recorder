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
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '25%',
          mb: 2,
          mt: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          <VideoSourceControls />
          <AudioSourceControls />
        </Box>
        <ChatOverlayControls />
      </Box>
    </Box>
  );
};

export default SceneEditor;
