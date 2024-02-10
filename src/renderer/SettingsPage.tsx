import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import { configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import GeneralSettings from './GeneralSettings';
import WindowsSettings from './WindowsSettings';
import FlavourSettings from './FlavourSettings';
import PVESettings from './PVESettings';
import PVPSettings from './PVPSettings';

interface IProps {
  recorderStatus: RecStatus;
}

const boxColor = '#141b2d';

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

const getGeneralSettingsInfoIcon = () => {
  const helptext = [
    ['Storage Path', configSchema.storagePath.description].join('\n'),
    ['Max Storage', configSchema.maxStorage.description].join('\n'),
    ['Separate Buffer Path', configSchema.separateBufferPath.description].join(
      '\n'
    ),
    ['Buffer Storage Path', configSchema.bufferStoragePath.description].join(
      '\n'
    ),
  ].join('\n\n');

  return (
    <Tooltip title={<div style={{ whiteSpace: 'pre-line' }}>{helptext}</div>}>
      <IconButton>
        <InfoIcon style={{ color: 'white' }} />
      </IconButton>
    </Tooltip>
  );
};

const getGameSettingsInfoIcon = () => {
  const helptext = [
    ['Record Retail', configSchema.recordRetail.description].join('\n'),
    ['Retail Log Path', configSchema.retailLogPath.description].join('\n'),
    ['Record Classic', configSchema.recordClassic.description].join('\n'),
    ['Classic Log Path', configSchema.classicLogPath.description].join('\n'),
  ].join('\n\n');

  return (
    <Tooltip title={<div style={{ whiteSpace: 'pre-line' }}>{helptext}</div>}>
      <IconButton>
        <InfoIcon style={{ color: 'white' }} />
      </IconButton>
    </Tooltip>
  );
};

const getPVESettingsInfoIcon = () => {
  const helptext = [
    /* eslint-disable prettier/prettier */
    ['Record Raids',               configSchema.recordRaids.description].join('\n'),
    ['Minimum Encounter Duration', configSchema.minEncounterDuration.description].join('\n'),
    ['Raid Overrun',               configSchema.raidOverrun.description].join('\n'),
    ['Minimum Raid Difficulty',    configSchema.minRaidDifficulty.description].join('\n'),
    ['Record Mythic+',             configSchema.recordDungeons.description].join('\n'),
    ['Minimum Keystone Level',     configSchema.minKeystoneLevel.description].join('\n'),
    ['Mythic+ Overrun',            configSchema.dungeonOverrun.description].join('\n'),
    // eslint-enable prettier/prettier */
  ].join('\n\n');

  return (
    <Tooltip title={<div style={{ whiteSpace: 'pre-line' }}>{helptext}</div>}>
      <IconButton>
        <InfoIcon style={{ color: 'white' }} />
      </IconButton>
    </Tooltip>
  );
};

const SettingsPage: React.FC<IProps> = (props: IProps) => {
  const { recorderStatus } = props;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
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
          mx: 2,
          mt: 2,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {getHeading('General Settings')}
        {getGeneralSettingsInfoIcon()}
      </Box>
      <Box
        sx={{
          backgroundColor: boxColor,
          border: '1px solid rgba(0, 0, 0, 0.6)',
          borderRadius: '5px',
          boxShadow: 3,
          p: 2,
          m: 2,
        }}
      >
        <GeneralSettings recorderStatus={recorderStatus} />
      </Box>

      <Box
        sx={{
          mx: 2,
          mt: 2,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {getHeading('Game Settings')}
        {getGameSettingsInfoIcon()}
      </Box>
      <Box
        sx={{
          backgroundColor: boxColor,
          border: '1px solid rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          boxShadow: 3,
          p: 2,
          m: 2,
        }}
      >
        <FlavourSettings recorderStatus={recorderStatus} />
      </Box>

      <Box
        sx={{
          mx: 2,
          mt: 2,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {getHeading('PvE Settings')}
        {getPVESettingsInfoIcon()}
      </Box>
      <Box
        sx={{
          backgroundColor: boxColor,
          border: '1px solid rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          boxShadow: 3,
          p: 2,
          m: 2,
        }}
      >
        <PVESettings />
      </Box>

      <Box sx={{ mx: 2 }}>{getHeading('PvP Settings')}</Box>
      <Box
        sx={{
          backgroundColor: boxColor,
          border: '1px solid rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          boxShadow: 3,
          p: 2,
          m: 2,
        }}
      >
        <PVPSettings />
      </Box>

      <Box sx={{ mx: 2 }}>{getHeading('Windows Settings')}</Box>
      <Box
        sx={{
          backgroundColor: boxColor,
          border: '1px solid rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          boxShadow: 3,
          p: 2,
          m: 2,
        }}
      >
        <WindowsSettings />
      </Box>
    </Box>
  );
};

export default SettingsPage;
