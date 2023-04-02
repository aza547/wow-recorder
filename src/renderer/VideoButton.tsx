import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { soloShuffleResultColors, specializationById } from 'main/constants';
import { getInstanceDifficulty, getVideoResultText } from 'main/helpers';
import { TNavigatorState } from 'main/types';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FolderIcon from '@mui/icons-material/Folder';
import * as Images from './images';
import { getFormattedDuration, getWoWClassColor } from './rendererutils';
import { VideoCategory } from '../types/VideoCategory';
import ArenaCompDisplay from './ArenaCompDisplay';
import DungeonCompDisplay from './DungeonCompDisplay';
import RaidEncounterInfo from './RaidEncounterInfo';
import React from 'react';

interface IProps {
  index: number;
  navigation: TNavigatorState;
  videostate: any;
}

const categories = Object.values(VideoCategory);

export default function VideoButton(props: IProps) {
  const { index, navigation, videostate } = props;
  const { categoryIndex } = navigation;
  const category = categories[categoryIndex] as VideoCategory;
  const video = videostate[category][index];

  const isMythicPlus = category === VideoCategory.MythicPlus;
  const isRaid = category === VideoCategory.Raids;
  const isBattleground = category === VideoCategory.Battlegrounds;
  const isArena = !isMythicPlus && !isRaid && !isBattleground;
  const isSoloShuffle = category === VideoCategory.SoloShuffle;

  const {
    duration,
    result,
    isProtected,
    player,
    difficultyID,
    encounterID,
    zoneID,
    fullPath,
    upgradeLevel,
    soloShuffleRoundsWon,
    soloShuffleRoundsPlayed,
  } = video;

  const bookmarkOpacity = isProtected ? 1 : 0.2;
  let resultColor = 'rgb(156, 21, 21, 0.3)';

  if (category === VideoCategory.SoloShuffle) {
    console.log("a", soloShuffleRoundsWon);
    if (soloShuffleRoundsWon >= 0 && soloShuffleRoundsWon <= 6) {
      console.log("b", resultColor);
      resultColor = soloShuffleResultColors[soloShuffleRoundsWon];
    }
  } else {
    resultColor = 'rgb(53, 164, 50, 0.3)';
  }

  const formattedDuration = getFormattedDuration(duration);

  let playerName;
  let playerRealm;
  let specIcon;
  let playerClass;
  let playerClassColor;

  if (player) {
    playerName = player._name;
    playerRealm = player._realm;
    specIcon = Images.specImages[player._specID] || Images.specImages[0];
    playerClass = specializationById[player._specID]?.class ?? '';
    playerClassColor = getWoWClassColor(playerClass);
  } else {
    playerName = '';
    playerRealm = '';
    specIcon = Images.specImages[0];
    playerClass = '';
    playerClassColor = 'black';
  }

  let buttonImage;

  if (category === VideoCategory.Raids) {
    buttonImage = Images.raidImages[encounterID];
  } else if (category === VideoCategory.MythicPlus) {
    buttonImage = Images.dungeonImages[video.zoneID];
  } else if (category === VideoCategory.Battlegrounds) {
    buttonImage = Images.battlegroundImages[video.zoneID];
  } else {
    buttonImage = Images.arenaImages[zoneID];
  }

  const resultText = getVideoResultText(
    category,
    result,
    upgradeLevel,
    soloShuffleRoundsWon,
    soloShuffleRoundsPlayed
  );

  const videoInstanceDifficulty = isRaid
    ? getInstanceDifficulty(difficultyID)
    : null;

  /**
   * Delete a video.
   */
  const deleteVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    window.electron.ipcRenderer.sendMessage('contextMenu', [
      'delete',
      fullPath,
    ]);
  };

  /**
   * Move a video to the permanently saved location.
   */
  const saveVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    window.electron.ipcRenderer.sendMessage('contextMenu', ['save', fullPath]);
  };

  /**
   * Open the location of the video in file explorer.
   */
  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    window.electron.ipcRenderer.sendMessage('contextMenu', ['open', fullPath]);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100px',
      }}
    >
      <Box
        sx={{
          height: '100px',
          width: '200px',
        }}
      >
        <Box
          component="img"
          src={buttonImage}
          sx={{
            border: '1px solid black',
            borderRadius: '1%',
            boxSizing: 'border-box',
            height: '100px',
            width: '200px',
            objectFit: 'cover',
          }}
        />

        {(isSoloShuffle || isMythicPlus) && (
          <Typography
            align="center"
            sx={{
              position: 'relative',
              bottom: '75px',
              left: '0px',
              color: 'white',
              fontWeight: '600',
              fontFamily: '"Arial",sans-serif',
              fontSize: '2rem',
              WebkitTextStroke: '2px black',
            }}
          >
            {resultText}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          border: '1px solid black',
          borderRadius: '1%',
          boxSizing: 'border-box',
          bgcolor: resultColor,
          ml: 2,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '15% 15% 25% 15% 15% 15%',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Box
            component="img"
            src={specIcon}
            sx={{
              height: '25px',
              width: '25px',
              border: '1px solid black',
              borderRadius: '15%',
              boxSizing: 'border-box',
              objectFit: 'cover',
            }}
          />

          <Typography
            sx={{
              color: playerClassColor,
              fontWeight: '600',
              fontFamily: '"Arial",sans-serif',
            }}
          >
            {playerName}
          </Typography>

          <Typography
            sx={{
              color: 'white',
              fontWeight: '600',
              fontFamily: '"Arial",sans-serif',
              fontSize: '0.7rem',
            }}
          >
            {playerRealm}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gridColumnStart: 2,
            gridColumnEnd: 3,
          }}
        >
          <HourglassBottomIcon sx={{ color: 'white' }} />
          <Typography
            sx={{
              color: 'white',
              fontWeight: '600',
              fontFamily: '"Arial",sans-serif',
            }}
          >
            {formattedDuration}
          </Typography>
        </Box>

        <Box
          sx={{
            gridColumnStart: 3,
            gridColumnEnd: 4,
          }}
        >
          {isArena && (
            <ArenaCompDisplay
              combatants={video.combatants}
              playerTeamID={video.player._teamID}
            />
          )}
          {isMythicPlus && <DungeonCompDisplay combatants={video.combatants} />}
          {isRaid && <RaidEncounterInfo video={video} />}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gridColumnStart: 4,
            gridColumnEnd: 5,
          }}
        >
          <AccessTimeIcon sx={{ color: 'white' }} />
          <Typography
            sx={{
              color: 'white',
              fontWeight: '600',
              fontFamily: '"Arial",sans-serif',
            }}
          >
            {video.time}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gridColumnStart: 5,
            gridColumnEnd: 6,
          }}
        >
          <EventIcon sx={{ color: 'white' }} />
          <Typography
            sx={{
              color: 'white',
              fontWeight: '600',
              fontFamily: '"Arial",sans-serif',
            }}
          >
            {video.date}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gridColumnStart: 6,
            gridColumnEnd: 7,
          }}
        >
          <Tooltip title="Never age out">
            <IconButton onClick={saveVideo}>
              <BookmarksIcon
                sx={{ color: 'white', opacity: bookmarkOpacity }}
              />
            </IconButton>
          </Tooltip>

          <Tooltip title="Open location">
            <IconButton onClick={openLocation}>
              <FolderIcon sx={{ color: 'white' }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete">
            <IconButton onClick={deleteVideo}>
              <DeleteForeverIcon sx={{ color: 'white' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* {isMythicPlus || (
          <>
            <Typography
              sx={{
                fontWeight: '600',
                fontFamily: '"Arial",sans-serif',
                gridColumnStart: 6,
                gridColumnEnd: 7,
              }}
            >
              {video.encounter}
            </Typography>
            <Typography
              display="inline"
              sx={{
                fontWeight: '600',
                fontFamily: '"Arial",sans-serif',
                gridColumnStart: 7,
                gridColumnEnd: 8,
              }}
            >
              {video.zoneName}
            </Typography>
          </>
        )}

        {isMythicPlus && (
          <>
            <Typography
              sx={{
                fontWeight: '600',
                fontFamily: '"Arial",sans-serif',
                gridColumnStart: 6,
                gridColumnEnd: 7,
              }}
            >
              {dungeonsByMapId[video.mapID]}
            </Typography>
            <Typography
              sx={{
                fontWeight: '600',
                fontFamily: '"Arial",sans-serif',
                gridColumnStart: 6,
                gridColumnEnd: 7,
              }}
            >
              +{video.level}
            </Typography>
          </>
        )}

        {isRaid && videoInstanceDifficulty && (
          <Typography
            sx={{
              fontWeight: '600',
              fontFamily: '"Arial",sans-serif',
              gridColumnStart: 6,
              gridColumnEnd: 7,
            }}
          >
            {videoInstanceDifficulty.difficulty}
          </Typography>
        )}

        <Typography
          sx={{
            fontWeight: '600',
            fontFamily: '"Arial",sans-serif',
            gridColumnStart: 8,
            gridColumnEnd: 9,
          }}
        >
          {resultText}
        </Typography> */}
      </Box>
    </Box>
  );
}
