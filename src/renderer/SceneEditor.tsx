import { Box, Divider } from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import RecorderPreview from './RecorderPreview';
import ChatOverlayControls from './ChatOverlayControls';
import VideoSourceControls from './VideoSourceControls';
import AudioSourceControls from './AudioSourceControls';
import VideoBaseControls from './VideoBaseControls';

interface IProps {
  recorderStatus: RecStatus;
}

const SceneEditor: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;

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
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <VideoSourceControls />
          <Divider
            flexItem
            orientation="vertical"
            sx={{ borderColor: 'black' }}
          />
          <AudioSourceControls />
        </Box>
        <Divider
          flexItem
          orientation="horizontal"
          sx={{ borderColor: 'black' }}
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <VideoBaseControls recorderStatus={recorderStatus} />
          <Divider
            flexItem
            orientation="vertical"
            sx={{ borderColor: 'black' }}
          />
          <ChatOverlayControls />
        </Box>
      </Box>
    </Box>
  );
};

export default SceneEditor;
