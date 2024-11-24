import { Box } from '@mui/material';
import React from 'react';
import { RendererVideo } from 'main/types';
import { dungeonAffixesById } from 'main/constants';
import { affixImages } from './images';
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
          alignItems: 'center',
        }}
      >
        <Box
          key={`child-${affixID}`}
          component="img"
          src={affixImages[affixID as keyof typeof affixImages]}
          sx={{
            height: '30px',
            width: '30px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
        <span className="text-white font-semibold text-sm text-shadow-instance ml-0.5 pl-1">
          {dungeonAffixesById[affixID]}
        </span>
      </Box>
    );
  };

  const renderDungeonName = () => {
    return (
      <span className="text-white font-semibold text-lg text-shadow-instance text-center">
        {dungeonName}
      </span>
    );
  };

  const renderDungeonLevel = () => {
    return (
      <span className="text-[#ff8000] font-semibold text-md text-shadow-instance">
        +{video.keystoneLevel || video.level}
      </span>
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
        <span className="text-white font-semibold text-xs text-shadow-instance">
          {resultText}
        </span>
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
        <span className="text-white font-semibold text-xs text-shadow-instance">
          {deathCount}
        </span>
        <Box
          key="death-icon"
          component="img"
          src={DeathIcon}
          sx={{
            p: '2px',
            height: '16px',
            width: '16px',
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
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 1,
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
