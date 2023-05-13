import { Box, Typography } from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import GeneralSettings from './GeneralSettings';
import AdvancedSettings from './WindowsSettings';
import FlavourSettings from './FlavourSettings';
import PVESettings from './PVESettings';
import PVPSettings from './PVPSettings';

interface IProps {
  recorderStatus: RecStatus;
}

const SettingsPage: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;

  const getHeading = (heading: string) => {
    return (
      <Typography
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          fontWeight: 700,
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {heading}
      </Typography>
    );
  };
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
      <Box sx={{ mx: 2, mt: 2 }}>{getHeading('General Settings')}</Box>
      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.6)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <GeneralSettings recorderStatus={recorderStatus}/>
      </Box>

      <Box sx={{ mx: 2 }}>{getHeading('Game Settings')}</Box>
      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <FlavourSettings recorderStatus={recorderStatus}/>
      </Box>

      <Box sx={{ mx: 2 }}>{getHeading('PvE Settings')}</Box>
      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <PVESettings />
      </Box>

      <Box sx={{ mx: 2 }}>{getHeading('PvP Settings')}</Box>
      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          boxShadow: 1,
          p: 2,
          m: 2,
        }}
      >
        <PVPSettings />
      </Box>

      <Box sx={{ mx: 2 }}>{getHeading('Windows Settings')}</Box>
      <Box
        sx={{
          backgroundColor: '#182035',
          border: '1px solid rgba(0, 0, 0, 0.4)',
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
