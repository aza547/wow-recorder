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

  if (video.player) {
    playerName = video.player._name;
    specIcon = Images.specImages[video.player._specID] || Images.specImages[0];
    playerClass = specializationById[video.player._specID]?.class ?? '';
  } else {
    playerName = '';
    specIcon = Images.specImages[0];
    playerClass = '';
  }

  const playerClassColor = getWoWClassColor(playerClass);
  console.log(playerClass);
  console.log(playerClassColor);

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        <Box
          component="img"
          src={specIcon}
          sx={{
            height: '50px',
            width: '50px',
            border: '1px solid black',
            borderRadius: '15%',
            boxSizing: 'border-box',
            objectFit: 'cover',
            m: 1,
          }}
        />

        <Typography
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'left',
            color: playerClassColor,
            fontWeight: '750',
            fontFamily: '"Arial Narrow","Arial",sans-serif',
          }}
        >
          {playerName}
        </Typography>

        <ArenaCompDisplay
          combatants={video.combatants}
          playerTeamID={video.player._teamID}
        />

        <Typography
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '750',
            fontFamily: '"Arial Narrow","Arial",sans-serif',
          }}
        >
          {formattedDuration}
        </Typography>

        <Typography
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '750',
            fontFamily: '"Arial Narrow","Arial",sans-serif',
          }}
        >
          {video.time} {video.date}
        </Typography>

        {isMythicPlus || (
          <>
            <Typography
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '750',
                fontFamily: '"Arial Narrow","Arial",sans-serif',
              }}
            >
              {video.encounter}
            </Typography>
            <Typography
              display="inline"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '750',
                fontFamily: '"Arial Narrow","Arial",sans-serif',
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '750',
                fontFamily: '"Arial Narrow","Arial",sans-serif',
              }}
            >
              {dungeonsByMapId[video.mapID]}
            </Typography>
            <Typography
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '750',
                fontFamily: '"Arial Narrow","Arial",sans-serif',
              }}
            >
              +{video.level}
            </Typography>
          </>
        )}

        {isRaid && videoInstanceDifficulty && (
          <Typography
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '750',
              fontFamily: '"Arial Narrow","Arial",sans-serif',
            }}
          >
            {videoInstanceDifficulty.difficulty}
          </Typography>
        )}

        <Typography
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '750',
            fontFamily: '"Arial Narrow","Arial",sans-serif',
          }}
        >
          {resultText}
        </Typography>
      </Box>
    </Box>
  );
}
