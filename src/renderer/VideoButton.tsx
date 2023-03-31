import * as React from 'react';
import {
  MenuItem,
  Divider,
  Box,
  CardMedia,
  Card,
  CardContent,
  Typography,
} from '@mui/material';

import { specializationById, dungeonsByMapId } from 'main/constants';

import {
  ChallengeModeTimelineSegment,
  TimelineSegmentType,
} from 'main/keystone';

import {
  getEncounterNameById,
  getInstanceDifficulty,
  getVideoResultClass,
  getVideoResultText,
} from 'main/helpers';

import { SoloShuffleTimelineSegment, TNavigatorState } from 'main/types';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import * as Images from './images';
import { getFormattedDuration, getWoWClassColor } from './rendererutils';
import { VideoCategory } from '../types/VideoCategory';
import ArenaCompDisplay from './ArenaCompDisplay';

interface IProps {
  index: number;
  navigation: TNavigatorState;
  videostate: any;
}

// For shorthand referencing.
const ipc = window.electron.ipcRenderer;
const categories = Object.values(VideoCategory);

export default function VideoButton(props: IProps) {
  const { index, navigation, videostate } = props;
  const { categoryIndex } = navigation;
  const category = categories[categoryIndex] as VideoCategory;
  const video = videostate[category][index];

  let resultColor = 'rgb(156, 21, 21, 0.3)';

  // Need to not be const as it will be modified later if a Mythic+.
  let resultText = getVideoResultText(
    category,
    video.result,
    video.soloShuffleRoundsWon,
    video.soloShuffleRoundsPlayed
  );

  if (video.result) {
    resultColor = 'rgb(53, 164, 50, 0.3)';
  }

  const isProtected = video.protected;

  const { duration } = video;
  const formattedDuration = getFormattedDuration(duration);

  const [anchorElement, setAnchorElement] = React.useState<null | HTMLElement>(
    null
  );
  const [mouseX, setMouseX] = React.useState<number>(0);
  const [mouseY, setMouseY] = React.useState<number>(0);
  const open = Boolean(anchorElement);

  let playerName;
  let specIcon;
  let playerClass;
  let playerRealm;

  if (video.player) {
    playerName = video.player._name;
    playerRealm = video.player._realm;
    specIcon = Images.specImages[video.player._specID] || Images.specImages[0];
    playerClass = specializationById[video.player._specID]?.class ?? '';
  } else {
    playerName = '';
    playerRealm = '';
    specIcon = Images.specImages[0];
    playerClass = '';
  }

  const playerClassColor = getWoWClassColor(playerClass);

  // BGs don't log COMBATANT_INFO events so we can't display a lot of stuff
  // that we can for other categories.
  const isMythicPlus = category === VideoCategory.MythicPlus;
  const isSoloShuffle = category === VideoCategory.SoloShuffle;
  const isRaid = category === VideoCategory.Raids;
  const videoInstanceDifficulty = isRaid
    ? getInstanceDifficulty(video.difficultyID)
    : null;

  let buttonImage;

  switch (category) {
    case VideoCategory.Raids:
      buttonImage = Images.raidImages[video.encounterID];
      break;

    case VideoCategory.MythicPlus:
      buttonImage = Images.dungeonImages[video.zoneID];
      break;

    case VideoCategory.Battlegrounds:
      buttonImage = Images.battlegroundImages[video.zoneID];
      break;

    default:
      buttonImage = Images.arenaImages[video.zoneID];
  }

  /**
   * Functions to handle opening and closing of context menus.
   */
  const openMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    setAnchorElement(event.currentTarget);
    setMouseY(event.clientY);
    setMouseX(event.clientX);
  };

  const handleCloseMenu = () => {
    setAnchorElement(null);
  };

  let closeMenuTimer: NodeJS.Timer;

  const mouseEnterMenu = () => {
    clearTimeout(closeMenuTimer);
  };

  const mouseExitMenu = () => {
    clearTimeout(closeMenuTimer);
    closeMenuTimer = setTimeout(() => setAnchorElement(null), 300);
  };

  /**
   * Delete a video.
   */
  function deleteVideo(filePath: string) {
    ipc.sendMessage('contextMenu', ['delete', filePath]);
    handleCloseMenu();
  }

  /**
   * Move a video to the permanently saved location.
   */
  const saveVideo = (filePath: string) => {
    ipc.sendMessage('contextMenu', ['save', filePath]);
    handleCloseMenu();
  };

  /**
   * Open the location of the video in file explorer.
   */
  const openLocation = (filePath: string) => {
    ipc.sendMessage('contextMenu', ['open', filePath]);
    handleCloseMenu();
  };

  /**
   * Seek the selected video to the specified relative timestamp
   */
  const seekVideo = (index: number, timestamp: number) => {
    // @@@ TODO FIX
    // ipc.sendMessage('contextMenu', ['seekVideo', index, timestamp]);
    // handleCloseMenu();
  };

  /**
   * Generate the JSX for the timeline segments that are used in the context menu on
   * the VideoButton.
   */
  const renderKeystoneTimelineSegments = (
    timeline: ChallengeModeTimelineSegment[]
  ): any[] => {
    const timelineSegmentsMenuItems = timeline.map((segment: any) => {
      let timelineSegmentMenu;
      let segmentDurationText;
      const result = Boolean(segment.result);

      // If the metadata for some reason gets a malformed timestamp, let's
      // not make it break the whole UI but instead silently ignore it for now.
      try {
        segmentDurationText = getFormattedDuration(segment.timestamp);
      } catch (e: any) {
        console.error(e);
        return;
      }

      if (segment.segmentType === TimelineSegmentType.Trash) {
        timelineSegmentMenu = (
          <div className="segment-type segment-type-trash">
            <span>{segmentDurationText}</span>: Trash
          </div>
        );
      } else if (segment.segmentType == TimelineSegmentType.BossEncounter) {
        timelineSegmentMenu = (
          <div className="segment-entry">
            <div className="segment-type segment-type-boss">
              <span>{segmentDurationText}</span>: Boss:{' '}
              {getEncounterNameById(segment.encounterId)}
            </div>
            <div
              className={`segment-result ${
                result ? 'goodResult' : 'badResult'
              }`}
            >
              {getVideoResultText(VideoCategory.Raids, result, 0, 0)}
            </div>
          </div>
        );
      }

      return (
        <MenuItem
          key={`video-segment-${segment.timestamp}`}
          onClick={() => seekVideo(index, segment.timestamp)}
        >
          {timelineSegmentMenu}
        </MenuItem>
      );
    });

    return [...timelineSegmentsMenuItems, <Divider key="video-segments-end" />];
  };

  /**
   * Generate the JSX for the timeline segments that are used in the context menu on
   * the VideoButton.
   */
  const renderSoloShuffleTimelineSegments = (
    timeline: SoloShuffleTimelineSegment[]
  ): any[] => {
    const timelineSegmentsMenuItems = timeline.map((segment: any) => {
      let timelineSegmentMenu;
      let segmentDurationText;
      const result = Boolean(segment.result);

      // If the metadata for some reason gets a malformed timestamp, let's
      // not make it break the whole UI but instead silently ignore it for now.
      try {
        segmentDurationText = getFormattedDuration(segment.timestamp);
      } catch (e: any) {
        console.error(e);
        return;
      }

      timelineSegmentMenu = (
        <div className="segment-entry">
          <div className="segment-type">
            <span>{segmentDurationText}</span>: Round {segment.round}
          </div>
          <div
            className={`segment-result ${result ? 'goodResult' : 'badResult'}`}
          >
            {getVideoResultText(VideoCategory.ThreeVThree, result, 0, 0)}
          </div>
        </div>
      );

      return (
        <MenuItem
          key={`video-segment-${segment.timestamp}`}
          onClick={() => seekVideo(index, segment.timestamp)}
        >
          {timelineSegmentMenu}
        </MenuItem>
      );
    });

    return [...timelineSegmentsMenuItems, <Divider key="video-segments-end" />];
  };

  const buttonClasses = ['videoButton'];
  let keystoneTimelineSegments = [];

  if (isMythicPlus) {
    buttonClasses.push('dungeon');

    if (video.result) {
      resultText = `+${video.upgradeLevel}`;
      resultColor = '#1eff00';
    }

    const { timeline } = video;

    if (timeline) {
      keystoneTimelineSegments = renderKeystoneTimelineSegments(video.timeline);
    }
  }

  let soloShuffleTimelineSegments = [];

  if (isSoloShuffle && video.timeline !== undefined) {
    soloShuffleTimelineSegments = renderSoloShuffleTimelineSegments(
      video.timeline
    );
  }

  const difficultyClass = isMythicPlus ? 'instance-difficulty' : 'difficulty';

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
      }}
    >
      <Box
        component="img"
        src={buttonImage}
        sx={{
          border: '1px solid black',
          borderRadius: '1%',
          boxSizing: 'border-box',
          display: 'flex',
          height: '75px',
          flex: '0 0 150px',
          objectFit: 'cover',
        }}
      />
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
          <ArenaCompDisplay
            combatants={video.combatants}
            playerTeamID={video.player._teamID}
          />
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
            flexDirection: 'column',
            alignItems: 'center',
            gridColumnStart: 6,
            gridColumnEnd: 7,
          }}
        >
          <BookmarksIcon sx={{ color: 'white' }} />
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
