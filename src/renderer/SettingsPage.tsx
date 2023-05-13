import { Box } from '@mui/material';
import React from 'react';
import GeneralSettings from './GeneralSettings';
import AdvancedSettings from './WindowsSettings';
import FlavourSettings from './FlavourSettings';
import PVESettings from './PVESettings';
import PVPSettings from './PVPSettings';

const SettingsPage: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100% - 70px)',
        overflowY: 'scroll',
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': {
          width: '1em',
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f1f1',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: '#888',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: '#555',
        },
      }}
    >
      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <GeneralSettings />
      </Box>

      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <FlavourSettings />
      </Box>

      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <PVESettings />
      </Box>

      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <PVPSettings />
      </Box>

      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <AdvancedSettings />
      </Box>
    </Box>
  );
};

export default SettingsPage;
