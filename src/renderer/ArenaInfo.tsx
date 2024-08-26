import { Box } from '@mui/material';
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
      <span className="text-white font-semibold text-xs text-shadow-instance">
        {resultText}
      </span>
    );
  };

  const renderMapName = () => {
    return (
      <span className="text-white font-semibold text-base text-shadow-instance">
        {zoneName}
      </span>
    );
  };

  const renderCategoryName = () => {
    return (
      <span className="text-white font-semibold text-xs text-shadow-instance">
        {category}
      </span>
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
