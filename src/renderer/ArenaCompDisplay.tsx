import { Box } from '@mui/material';
import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { specializationById } from 'main/constants';
import { RawCombatant, RendererVideo } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import * as Images from './images';
import { getPlayerTeamID, getWoWClassColor } from './rendererutils';

interface IProps {
  video: RendererVideo;
}

const ArenaCompDisplay: React.FC<IProps> = (props: IProps) => {
  const { video } = props;
  const { combatants, category } = video;
  const isSoloShuffle = category === VideoCategory.SoloShuffle;
  const iconSize = '18px';

  if (combatants === undefined) {
    return <></>;
  }

  const playerTeamID = getPlayerTeamID(video);

  const friendly = combatants.filter(
    (combatant: RawCombatant) => combatant._teamID !== playerTeamID
  );

  const enemy = combatants.filter(
    (combatant: RawCombatant) => combatant._teamID === playerTeamID
  );

  if (friendly.length > 5 || friendly.length === 0) {
    return <></>;
  }

  if (enemy.length > 5 || enemy.length === 0) {
    return <></>;
  }

  if (enemy.length !== friendly.length) {
    return <></>;
  }

  const maybeIncludeVersus = () => {
    if (isSoloShuffle) {
      return <></>;
    }

    return <CloseIcon sx={{ color: 'white' }} />;
  };

  const renderEnemyCombatant = (combatant: RawCombatant) => {
    let nameColor = 'darkgrey';
    let specIcon = Images.specImages[0];

    if (combatant._specID !== undefined) {
      const knownSpec = Object.prototype.hasOwnProperty.call(
        specializationById,
        combatant._specID
      );

      if (knownSpec) {
        specIcon = Images.specImages[combatant._specID];
        const spec = specializationById[combatant._specID];
        nameColor = getWoWClassColor(spec.class);
      }
    }

    return (
      <Box
        key={combatant._name}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'end',
        }}
      >
        <span
          className="font-semibold text-xs text-shadow-instance mr-0.5"
          style={{ color: nameColor }}
        >
          {combatant._name}
        </span>
        <Box
          key={combatant._GUID}
          component="img"
          src={specIcon}
          sx={{
            height: iconSize,
            width: iconSize,
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
      </Box>
    );
  };

  const renderFriendlyCombatant = (combatant: RawCombatant) => {
    let nameColor = 'darkgrey';
    let specIcon = Images.specImages[0];

    if (combatant._specID !== undefined) {
      const knownSpec = Object.prototype.hasOwnProperty.call(
        specializationById,
        combatant._specID
      );

      if (knownSpec) {
        specIcon = Images.specImages[combatant._specID];
        const spec = specializationById[combatant._specID];
        nameColor = getWoWClassColor(spec.class);
      }
    }

    return (
      <Box
        key={combatant._name}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'start',
        }}
      >
        <Box
          key={combatant._GUID}
          component="img"
          src={specIcon}
          sx={{
            height: iconSize,
            width: iconSize,
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
        <span
          className="font-bold text-xs text-shadow-instance ml-0.5"
          style={{ color: nameColor }}
        >
          {combatant._name}
        </span>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: 'row',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        key="enemies"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'column',
        }}
      >
        {enemy.map(renderEnemyCombatant)}
      </Box>
      {maybeIncludeVersus()}
      <Box
        key="friendlies"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'column',
        }}
      >
        {friendly.map(renderFriendlyCombatant)}
      </Box>
    </Box>
  );
};

export default ArenaCompDisplay;
