import React from 'react';
import Box from '@mui/material/Box';
import { RendererVideo } from 'main/types';

interface IProps {
  video: RendererVideo;
}

const BattlegroundInfo: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { zoneName } = video;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: 'column',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span className="text-white font-semibold text-base text-shadow-instance">
        {zoneName}
      </span>
    </Box>
  );
};

export default BattlegroundInfo;
