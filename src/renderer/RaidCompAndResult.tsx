import { Box, Typography } from '@mui/material';
import React from 'react';
import { RawCombatant, RendererVideo } from 'main/types';
import { specializationById } from 'main/constants';
import { getVideoResultText } from './rendererutils';
import * as Images from './images';
import DeathIcon from '../../assets/icon/death.png';

interface IProps {
  video: RendererVideo;
  raidCategoryState: RendererVideo[];
}

type RoleCount = {
  tank: number;
  healer: number;
  damage: number;
};

const RaidCompAndResult: React.FC<IProps> = (props: IProps) => {
  const { video, raidCategoryState } = props;
  const { combatants, deaths } = video;
  const resultText = getVideoResultText(video);
  const deathCount = deaths ? deaths.length : 0;

  const roleCount: RoleCount = {
    tank: 0,
    healer: 0,
    damage: 0,
  };

  combatants.forEach((combant: RawCombatant) => {
    const specID = combant._specID;

    if (specID === undefined) {
      return;
    }

    const spec = specializationById[specID];

    if (spec === undefined) {
      return;
    }

    const { role } = spec;
    roleCount[role]++;
  });

  const getDailyPullNumber = () => {
    const videoDate = video.start
      ? new Date(video.start)
      : new Date(video.mtime);

    const dailyVideosInOrder: RendererVideo[] = [];

    raidCategoryState.forEach((neighbourVideo) => {
      const bestDate = neighbourVideo.start
        ? neighbourVideo.start
        : neighbourVideo.mtime;

      const neighbourDate = new Date(bestDate);

      const sameDay =
        neighbourDate.getDate() === videoDate.getDate() &&
        neighbourDate.getMonth() === videoDate.getMonth() &&
        neighbourDate.getFullYear() === videoDate.getFullYear();

      if (
        video.encounterID === undefined ||
        neighbourVideo.encounterID === undefined
      ) {
        return;
      }

      const sameEncounter = video.encounterID === neighbourVideo.encounterID;

      if (
        video.difficultyID === undefined ||
        neighbourVideo.difficultyID === undefined
      ) {
        return;
      }

      const sameDifficulty = video.difficultyID === neighbourVideo.difficultyID;

      if (sameDay && sameEncounter && sameDifficulty) {
        dailyVideosInOrder.push(neighbourVideo);
      }
    });

    dailyVideosInOrder.sort(
      (A: RendererVideo, B: RendererVideo) => A.mtime - B.mtime
    );

    return dailyVideosInOrder.indexOf(video) + 1;
  };

  const renderCounter = (role: string) => {
    return (
      <Box
        key={`parent-${role}`}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          p: '4px',
        }}
      >
        <Box
          key={`child-${role}`}
          component="img"
          src={Images.roleImages[role]}
          sx={{
            height: '20px',
            width: '20px',
            objectFit: 'cover',
          }}
        />
        <Typography
          sx={{
            color: 'white',
            fontFamily: '"Arial",sans-serif',
            ml: '2px',
            fontSize: '0.75rem',
            fontWeight: '600',
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          {roleCount[role as keyof RoleCount]}
        </Typography>
      </Box>
    );
  };

  const renderRaidComp = () => {
    if (combatants.length < 1) {
      return <></>;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {Object.keys(roleCount).map(renderCounter)}
      </Box>
    );
  };

  const renderResult = () => {
    return (
      <Box
        sx={{
          mx: '2px',
          display: 'flex',
          flexDirection: 'column',
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
          {`${resultText} (Pull ${getDailyPullNumber()})`}
        </Typography>
      </Box>
    );
  };

  const renderDeaths = () => {
    return (
      <Box
        sx={{
          mx: 1,
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {renderDeaths()}
      {renderRaidComp()}
      {renderResult()}
    </Box>
  );
};

export default RaidCompAndResult;
