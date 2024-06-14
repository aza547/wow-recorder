import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import React from 'react';
import { RecStatus } from 'main/types';
import { configSchema } from 'main/configSchema';
import InfoIcon from '@mui/icons-material/Info';
import { scrollBarSx } from 'main/constants';
import GeneralSettings from './GeneralSettings';
import WindowsSettings from './WindowsSettings';
import FlavourSettings from './FlavourSettings';
import PVESettings from './PVESettings';
import PVPSettings from './PVPSettings';
import CloudSettings from './CloudSettings';

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
    /* eslint-disable prettier/prettier */
    ['Disk Storage Folder', configSchema.storagePath.description].join('\n'),
    ['Max Disk Storage', configSchema.maxStorage.description].join('\n'),
    ['Separate Buffer Folder', configSchema.separateBufferPath.description].join('\n'),
    ['Buffer Storage Folder', configSchema.bufferStoragePath.description].join('\n'),
    /* eslint-enable prettier/prettier */
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
    ['Record Classic Era', configSchema.recordEra.description].join('\n'),
    ['Era Log Path', configSchema.eraLogPath.description].join('\n'),
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

const getCloudSettingsInfoIcon = () => {
  const helptext = [
    /* eslint-disable prettier/prettier */
    ['Cloud Playback', configSchema.cloudStorage.description].join('\n'),
    ['Cloud Upload', configSchema.cloudUpload.description].join('\n'),
    ['Upload Rate Limit', configSchema.cloudUploadRateLimit.description].join('\n'),
    ['Account Name', configSchema.cloudAccountName.description].join('\n'),
    ['Account Password', configSchema.cloudAccountPassword.description].join('\n'),
    ['Guild Name', configSchema.cloudGuildName.description].join('\n'),
    ['Upload Toggles', "Provides control over what content types get automatically uploaded."].join('\n'),
    /* eslint-enable prettier/prettier */
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
        overflowY: 'auto',
        ...scrollBarSx,
        '&::-webkit-scrollbar': {
          width: '1em',
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

      <Box
        sx={{
          mx: 2,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {getHeading('Cloud Settings')}
        {getCloudSettingsInfoIcon()}
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
        <CloudSettings recorderStatus={recorderStatus} />
      </Box>
    </Box>
  );
};

export default SettingsPage;
