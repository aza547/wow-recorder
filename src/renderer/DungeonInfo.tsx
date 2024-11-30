import { Box } from '@mui/material';
import React from 'react';
import { RendererVideo } from 'main/types';
import { dungeonAffixesById } from 'main/constants';
import { affixImages } from './images';

interface IProps {
  video: RendererVideo;
}

const DungeonInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { affixes } = video;

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
