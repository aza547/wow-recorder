import { Box } from '@mui/material';
import React from 'react';
import RecorderPreview from './RecorderPreview';
import ChatOverlayControls from './ChatOverlayControls';
import SourceControls from './SourceControls';

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
          height: '30%',
        }}
      >
        <SourceControls />
        <ChatOverlayControls />
      </Box>
    </Box>
  );
};

export default SceneEditor;
