import { Box } from '@mui/material';
import React from 'react';
import ContentSettings from './ContentSettings';

const SettingsPage: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        m: 4,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '50%',
          height: '50%',
        }}
      >
        <ContentSettings />
      </Box>
    </Box>
  );
};

export default SettingsPage;
