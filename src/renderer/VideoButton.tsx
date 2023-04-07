import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  dungeonsByMapId,
  soloShuffleResultColors,
  specializationById,
} from 'main/constants';
import { getVideoResultText } from 'main/helpers';
import { TNavigatorState } from 'main/types';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FolderIcon from '@mui/icons-material/Folder';
import React from 'react';
import * as Images from './images';
import { getFormattedDuration, getWoWClassColor } from './rendererutils';
import { VideoCategory } from '../types/VideoCategory';
import ArenaCompDisplay from './ArenaCompDisplay';
import DungeonCompDisplay from './DungeonCompDisplay';
import RaidEncounterInfo from './RaidEncounterInfo';

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
    encounterID,
    zoneID,
    fullPath,
    upgradeLevel,
    soloShuffleRoundsWon,
    soloShuffleRoundsPlayed,
  } = video;

  const bookmarkOpacity = isProtected ? 1 : 0.2;
  let resultColor = 'rgb(156, 21, 21, 0.3)';

  if (isSoloShuffle) {
    if (soloShuffleRoundsWon >= 0 && soloShuffleRoundsWon <= 6) {
      resultColor = soloShuffleResultColors[soloShuffleRoundsWon];
    }
  } else if (result) {
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
            opacity: '70%',
            border: '1px solid black',
            borderRadius: '1%',
            boxSizing: 'border-box',
            height: '100px',
            width: '200px',
            objectFit: 'cover',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            bottom: '100px',
            width: '100%',
            height: '100%',
            flexDirection: 'column',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isSoloShuffle && (
            <Typography
              align="center"
              sx={{
                color: 'white',
                fontWeight: '600',
                fontFamily: '"Arial",sans-serif',
                fontSize: '2rem',
                textShadow:
                  '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              }}
            >
              {resultText}
            </Typography>
          )}

          {isMythicPlus && (
            <>
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
                {resultText}
              </Typography>
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
                {dungeonsByMapId[video.mapID]}
              </Typography>
              <Typography
                align="center"
                sx={{
                  color: '#ff8000',
                  fontWeight: '600',
                  fontFamily: '"Arial",sans-serif',
                  fontSize: '1rem',
                  textShadow:
                    '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                }}
              >
                +{video.level}
              </Typography>
            </>
          )}

          {!isSoloShuffle && !isMythicPlus && !isBattleground && (
            <Typography
              align="center"
              sx={{
                color: 'white',
                fontWeight: '600',
                fontFamily: '"Arial",sans-serif',
                fontSize: '2rem',
                textShadow:
                  '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              }}
            >
              {resultText}
            </Typography>
          )}
        </Box>
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
              textShadow:
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
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
              textShadow:
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
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
              textShadow:
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
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
              textShadow:
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
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
              textShadow:
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
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
      </Box>
    </Box>
  );
}
