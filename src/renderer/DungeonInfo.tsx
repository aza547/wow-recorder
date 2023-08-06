import { Box, Typography } from '@mui/material';
import React from 'react';
import { RendererVideo } from 'main/types';
import { dungeonAffixesById } from 'main/constants';
import * as Images from './images';
import { getDungeonName, getVideoResultText } from './rendererutils';
import ChestIcon from '../../assets/icon/chest.png';
import DeathIcon from '../../assets/icon/death.png';

interface IProps {
  video: RendererVideo;
}

const DungeonInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { affixes, deaths } = video;
  const resultText = getVideoResultText(video);
  const dungeonName = getDungeonName(video);
  const deathCount = deaths ? deaths.length : 0;

  const renderAffixDisplay = (affixID: number) => {
    return (
      <Box
        key={`parent-${affixID}`}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: 'transparent',
        }}
      >
        <Box
          key={`child-${affixID}`}
          component="img"
          src={Images.affixImages[affixID]}
          sx={{
            height: '20px',
            width: '20px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
        <Typography
          sx={{
            color: 'white',
            fontFamily: '"Arial",sans-serif',
            ml: '2px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          {dungeonAffixesById[affixID]}
        </Typography>
      </Box>
    );
  };

  const renderDungeonName = () => {
    return (
      <Typography
        align="center"
        sx={{
          color: 'white',
          fontWeight: '600',
          fontFamily: '"Arial",sans-serif',
          fontSize: '1rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {dungeonName}
      </Typography>
    );
  };

  const renderDungeonLevel = () => {
    return (
      <Typography
        align="center"
        sx={{
          color: '#ff8000',
          fontWeight: '600',
          fontFamily: '"Arial",sans-serif',
          fontSize: '0.75rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        +{video.level}
      </Typography>
    );
  };

  const renderChests = () => {
    return (
      <Box
        sx={{
          mx: '2px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          align="center"
          sx={{
            color: 'white',
            fontWeight: '600',
            fontFamily: '"Arial",sans-serif',
            fontSize: '0.75rem',
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          {resultText}
        </Typography>
        <Box
          key="chest-icon"
          component="img"
          src={ChestIcon}
          sx={{
            height: '20px',
            width: '20px',
            objectFit: 'cover',
          }}
        />
      </Box>
    );
  };

  const renderDeaths = () => {
    return (
      <Box
        sx={{
          mx: '2px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          align="center"
          sx={{
            color: 'white',
            fontWeight: '600',
            fontFamily: '"Arial",sans-serif',
            fontSize: '0.75rem',
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          {deathCount}
        </Typography>
        <Box
          key="chest-icon"
          component="img"
          src={DeathIcon}
          sx={{
            p: '2px',
            height: '18px',
            width: '12px',
            objectFit: 'cover',
          }}
        />
      </Box>
    );
  };

  const renderDungeonResult = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderChests()}
        {renderDeaths()}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '50%',
        }}
      >
        {renderDungeonResult()}
        {renderDungeonName()}
        {renderDungeonLevel()}
      </Box>

      <Box
        sx={{
          width: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          {affixes && affixes.map(renderAffixDisplay)}
        </Box>
      </Box>
    </Box>
  );
};

export default DungeonInfo;
