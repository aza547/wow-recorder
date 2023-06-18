import { Box, Typography } from '@mui/material';
import React from 'react';
import { RendererVideo } from 'main/types';
import { getVideoResultText } from './rendererutils';

interface IProps {
  video: RendererVideo;
}

const ArenaInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { category, zoneName } = video;
  const resultText = getVideoResultText(video);

  const renderResultText = () => {
    return (
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
    );
  };

  const renderMapName = () => {
    return (
      <Typography
        align="center"
        sx={{
          color: 'white',
          fontWeight: '600',
          fontFamily: '"Arial",sans-serif',
          fontSize: '1.25rem',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        {zoneName}
      </Typography>
    );
  };

  const renderCategoryName = () => {
    return (
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
        {category}
      </Typography>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderResultText()}
      {renderMapName()}
      {renderCategoryName()}
    </Box>
  );
};

export default ArenaInfo;
