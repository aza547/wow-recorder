import { Box } from '@mui/material';
import React from 'react';
import { RawCombatant, RendererVideo } from 'main/types';
import { specializationById } from 'main/constants';
import { roleImages } from './images';
import DeathIcon from '../../assets/icon/death.png';

interface IProps {
  video: RendererVideo;
}

type RoleCount = {
  tank: number;
  healer: number;
  damage: number;
};

const RaidCompAndResult: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { combatants, deaths } = video;

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
          src={roleImages[role as keyof typeof roleImages]}
          sx={{
            height: '20px',
            width: '20px',
            objectFit: 'cover',
          }}
        />
        <span className="text-white font-semibold text-xs text-shadow-instance ml-1">
          {roleCount[role as keyof RoleCount]}
        </span>
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
        <span className="text-white font-semibold text-xs text-shadow-instance">
          {deathCount}
        </span>
        <Box
          key="death-icon"
          component="img"
          src={DeathIcon}
          sx={{
            p: '2px',
            height: '20px',
            width: '20px',
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
        p: 1,
      }}
    >
      {renderDeaths()}
      {renderRaidComp()}
    </Box>
  );
};

export default RaidCompAndResult;
