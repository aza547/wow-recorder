import * as React from 'react';
import {
  Tab,
  Menu,
  MenuItem,
  Divider,
  List,
  Box,
  CardMedia,
  Card,
  Typography,
  CardContent,
  Grid,
} from '@mui/material';

import {
  videoButtonSx,
  specializationById,
  dungeonsByMapId,
} from 'main/constants';

import {
  ChallengeModeTimelineSegment,
  TimelineSegmentType,
} from 'main/keystone';

import ListItemIcon from '@mui/material/ListItemIcon';
import Check from '@mui/icons-material/Check';
import Protected from '@mui/icons-material/BookmarkAdded';

import {
  getEncounterNameById,
  getInstanceDifficulty,
  getVideoResultClass,
  getVideoResultText,
} from 'main/helpers';

import { SoloShuffleTimelineSegment, TNavigatorState } from 'main/types';
import * as Images from './images';
import { getFormattedDuration } from './rendererutils';
import { VideoCategory } from '../types/VideoCategory';
import { border } from '@mui/system';

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
  const videoPath = video.fullPath;

  // Need to not be const as it will be modified later if a Mythic+.
  let resultText = getVideoResultText(
    category,
    video.result,
    video.soloShuffleRoundsWon,
    video.soloShuffleRoundsPlayed
  );

  const resultClass = getVideoResultClass(
    category,
    video.result,
    video.soloShuffleRoundsWon,
    video.soloShuffleRoundsPlayed
  );

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
        flexWrap: 'wrap',
        width: '100%',
      }}
    >
      <Card
        sx={{
          height: '50px',
          width: '100px',
          border: '1px solid black',
          borderRadius: '1%',
        }}
      >
        <CardMedia
          component="img"
          image={buttonImage}
          sx={{ objectFit: 'cover', height: '50px', width: '100px' }}
        />
      </Card>
      <Card
        sx={{
          minWidth: 700,
          border: '1px solid black',
          borderRadius: '1%',
          bgcolor: '#1A233A',
          ml: 2,
        }}
      >
        <CardContent
          sx={{
            p: 0,
            '&:last-child': { pb: 0 },
            m: 1,
            position: 'absolute',
            color: 'white',
          }}
        >
          <Box sx={{ position: 'absolute', top: '0px', left: '0px' }}>
            <img id="spec-icon" src={specIcon} alt="spec icon" />
          </Box>

          <Box sx={{ position: 'absolute', top: '0px', left: '22.5px' }}>
            <div className={`${playerClass}`}>{playerName}</div>
          </Box>

          <Box sx={{ position: 'absolute', top: '0px', left: '100px' }}>
            {formattedDuration}
          </Box>

          <Box sx={{ position: 'absolute', top: '0px', left: '200px' }}>
            {video.date}
          </Box>

          <Box sx={{ position: 'absolute', top: '0px', left: '300px' }}>
            {video.time}
          </Box>

          {isMythicPlus || (
            <>
              <Box sx={{ position: 'absolute', top: '0px', left: '400px' }}>
                {video.encounter}
              </Box>
              <Box sx={{ position: 'absolute', top: '0px', left: '500px' }}>
                {video.zoneName}
              </Box>
            </>
          )}

          {isMythicPlus && (
            <>
              <Box sx={{ position: 'absolute', top: '0px', left: '400px' }}>
                {dungeonsByMapId[video.mapID]}
              </Box>
              <Box sx={{ position: 'absolute', top: '0px', left: '500px' }}>
                <div className="difficulty-mythic">+{video.level}</div>
              </Box>
            </>
          )}

          {isRaid && videoInstanceDifficulty && (
            <Box sx={{ position: 'absolute', top: '0px', left: '600px' }}>
              {videoInstanceDifficulty.difficulty}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
