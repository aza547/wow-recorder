import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FolderIcon from '@mui/icons-material/Folder';
import React from 'react';
import { RendererVideo } from 'main/types';
import {
  getDungeonName,
  getPlayerClass,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
  getResultColor,
  getVideoImage,
  getVideoResultText,
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
  isSoloShuffleUtil,
  getFormattedDuration,
  getWoWClassColor,
  getVideoTime,
  getVideoDate,
} from './rendererutils';
import * as Images from './images';
import ArenaCompDisplay from './ArenaCompDisplay';
import DungeonCompDisplay from './DungeonCompDisplay';
import RaidEncounterInfo from './RaidEncounterInfo';
import BattlegroundInfo from './BattlegroundInfo';

interface IProps {
  video: RendererVideo;
}

export default function VideoButton(props: IProps) {
  const { video } = props;
  const { isProtected, fullPath } = video;
  const formattedDuration = getFormattedDuration(video);
  const dungeonName = getDungeonName(video);
  const buttonImage = getVideoImage(video);
  const resultText = getVideoResultText(video);
  const isMythicPlus = isMythicPlusUtil(video);
  const isRaid = isRaidUtil(video);
  const isBattleground = isBattlegroundUtil(video);
  const isArena = isArenaUtil(video);
  const isSoloShuffle = isSoloShuffleUtil(video);
  const resultColor = getResultColor(video);
  const playerName = getPlayerName(video);
  const playerRealm = getPlayerRealm(video);
  const playerClass = getPlayerClass(video);
  const playerClassColor = getWoWClassColor(playerClass);
  const playerSpecID = getPlayerSpecID(video);
  const videoTime = getVideoTime(video);
  const videoDate = getVideoDate(video);
  const specIcon = Images.specImages[playerSpecID];
  const bookmarkOpacity = isProtected ? 1 : 0.2;

  const deleteVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    window.electron.ipcRenderer.sendMessage('contextMenu', [
      'delete',
      fullPath,
    ]);
  };

  const protectVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    window.electron.ipcRenderer.sendMessage('contextMenu', ['save', fullPath]);
  };

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
                fontSize: '1rem',
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
                {dungeonName}
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
                fontSize: '1rem',
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
          gridTemplateColumns: '15% 13% 25% 13% 13% 21%',
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
          {isArena && <ArenaCompDisplay video={video} />}
          {isMythicPlus && <DungeonCompDisplay video={video} />}
          {isRaid && <RaidEncounterInfo video={video} />}
          {isBattleground && <BattlegroundInfo video={video} />}
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
            {videoTime}
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
            {videoDate}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gridColumnStart: 6,
            gridColumnEnd: 7,
            p: 2,
          }}
        >
          <Tooltip title="Never age out">
            <IconButton onClick={protectVideo}>
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
