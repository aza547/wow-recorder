import * as React from 'react';
import { Tab, Menu, MenuItem, Divider } from '@mui/material';
import { VideoCategory, categories, videoButtonSx, specializationById, dungeonsByMapId }  from 'main/constants';
import { ChallengeModeTimelineSegment, TimelineSegmentType } from 'main/keystone';
import { getFormattedDuration } from './rendererutils';
import ListItemIcon from '@mui/material/ListItemIcon';
import Check from '@mui/icons-material/Check';
import * as Images from './images'
import { getEncounterNameById, getInstanceDifficulty, getVideoResultClass, getVideoResultText } from 'main/helpers';
import { SoloShuffleTimelineSegment } from 'main/types';

// For shorthand referencing. 
const ipc = window.electron.ipcRenderer;

export default function VideoButton(props: any) {
  const state = props.state;
  const videoIndex = props.index;

  const categoryIndex = state.categoryIndex;
  const category = categories[categoryIndex] as VideoCategory;

  const video = state.videoState[category][videoIndex];
  const videoPath = video.fullPath;

  // Need to not be const as it will be modified later if a Mythic+.
  let resultText = getVideoResultText(category, 
                                      video.result, 
                                      video.soloShuffleRoundsWon, 
                                      video.soloShuffleRoundsPlayed);
                                      
  const resultClass = getVideoResultClass(category, 
                                          video.result, 
                                          video.soloShuffleRoundsWon, 
                                          video.soloShuffleRoundsPlayed);

  const isProtected = video.protected;

  const duration = video.duration;
  const formattedDuration = getFormattedDuration(duration);

  const [anchorElement, setAnchorElement] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorElement);

  let playerName;
  let specIcon;
  let playerClass;

  if (video.player) {
    playerName = video.player._name;
    specIcon = Images.specImages[video.player._specID] || Images.specImages[0];
    playerClass = specializationById[video.player._specID]?.class ?? "";
  } else {
    playerName = "";
    specIcon = Images.specImages[0];
    playerClass = "";
  }
  
  // BGs don't log COMBATANT_INFO events so we can't display a lot of stuff
  // that we can for other categories. 
  const isMythicPlus = (category === VideoCategory.MythicPlus);
  const isSoloShuffle = (category === VideoCategory.SoloShuffle);
  const isRaid = category === VideoCategory.Raids;
  const videoInstanceDifficulty = isRaid ? getInstanceDifficulty(video.difficultyID) : null;

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
  * Called when a right click on the video button occurs. 
  */
  const openMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    setAnchorElement(event.currentTarget);
  };

  /**
  *  Called when either a button is clicked or something else on the screen is. 
  */
  const handleCloseMenu = () => {
    setAnchorElement(null);
  };

  /**
  * Delete a video.
  */
  function deleteVideo(filePath: string) {
    ipc.sendMessage('contextMenu', ['delete', filePath])
    handleCloseMenu();
  };

  /**
  * Move a video to the permanently saved location. 
  */
  const saveVideo = (filePath: string) => {
    ipc.sendMessage('contextMenu', ['save', filePath])
    handleCloseMenu();
  };

  /**
  * Open the location of the video in file explorer.
  */
  const openLocation = (filePath: string) => {
    ipc.sendMessage('contextMenu', ['open', filePath])
    handleCloseMenu();
  };

  /**
   * Seek the selected video to the specified relative timestamp
   */
  const seekVideo = (videoIndex: number, timestamp: number) => {
    ipc.sendMessage('contextMenu', ['seekVideo', videoIndex, timestamp])
    handleCloseMenu();
  };

  /**
   * Generate the JSX for the timeline segments that are used in the context menu on
   * the VideoButton.
   */
  const renderKeystoneTimelineSegments = (timeline: ChallengeModeTimelineSegment[]): any[] => {
    const timelineSegmentsMenuItems = timeline.map((segment: any) => {
      let timelineSegmentMenu;
      let segmentDurationText;
      const result = Boolean(segment.result);

      // If the metadata for some reason gets a malformed timestamp, let's
      // not make it break the whole UI but instead silently ignore it for now.
      try {
        segmentDurationText = getFormattedDuration(segment.timestamp);
      } catch (e: any) {
        console.error(e)
        return;
      }

      if (segment.segmentType === TimelineSegmentType.Trash) {
        timelineSegmentMenu = <div className='segment-type segment-type-trash'>
          <span>{ segmentDurationText }</span>: Trash
        </div>
      } else
      if (segment.segmentType == TimelineSegmentType.BossEncounter) {
        timelineSegmentMenu = <div className='segment-entry'>
          <div className='segment-type segment-type-boss'>
            <span>{ segmentDurationText }</span>: Boss: { getEncounterNameById(segment.encounterId) }
          </div>
          <div className={ 'segment-result ' + (result ? 'goodResult' : 'badResult') }>
            { getVideoResultText(VideoCategory.Raids, result, 0, 0) }
          </div>
        </div>
      }

      return (
        <MenuItem key={ 'video-segment-' + segment.timestamp } onClick={() => seekVideo(videoIndex, segment.timestamp)}>
          { timelineSegmentMenu }
        </MenuItem>
      );
    });

    return [
      ...timelineSegmentsMenuItems,
      <Divider key='video-segments-end' />,
    ];
  };

  /**
   * Generate the JSX for the timeline segments that are used in the context menu on
   * the VideoButton.
   */
  const renderSoloShuffleTimelineSegments = (timeline: SoloShuffleTimelineSegment[]): any[] => {
    const timelineSegmentsMenuItems = timeline.map((segment: any) => {
      let timelineSegmentMenu;
      let segmentDurationText;
      const result = Boolean(segment.result);

      // If the metadata for some reason gets a malformed timestamp, let's
      // not make it break the whole UI but instead silently ignore it for now.
      try {
        segmentDurationText = getFormattedDuration(segment.timestamp);
      } catch (e: any) {
        console.error(e)
        return;
      }

      timelineSegmentMenu = 
        <div className='segment-entry'>
          <div className='segment-type'>
            <span>{ segmentDurationText }</span>: Round { segment.number }
          </div>
          <div className={ 'segment-result ' + (result ? 'goodResult' : 'badResult') }>
            { getVideoResultText(VideoCategory.ThreeVThree, result, 0, 0) }
          </div>
        </div>


      return (
        <MenuItem key={ 'video-segment-' + segment.timestamp } onClick={() => seekVideo(videoIndex, segment.timestamp)}>
          { timelineSegmentMenu }
        </MenuItem>
      );
    });

    return [
      ...timelineSegmentsMenuItems,
      <Divider key='video-segments-end' />,
    ];
  };

  const buttonClasses = ['videoButton'];
  let keystoneTimelineSegments = [];
  
  
  if (isMythicPlus) {
    buttonClasses.push('dungeon')

    if (video.result) {
      resultText = '+' + video.upgradeLevel;
    }

    const timeline = video.timeline;

    if (timeline) {
      keystoneTimelineSegments = renderKeystoneTimelineSegments(video.timeline);
    }
  }

  let soloShuffleTimelineSegments = [];

  if (isSoloShuffle && (video.timeline !== undefined)) {
    soloShuffleTimelineSegments = renderSoloShuffleTimelineSegments(video.timeline);
  }

  const difficultyClass = isMythicPlus ? "instance-difficulty" : "difficulty";

  return (
    <React.Fragment>
      <Tab 
        label={
          <div 
            id={ videoPath } 
            className={ buttonClasses.join(' ') } 
            style={{ backgroundImage: `url(${buttonImage})`, backgroundSize: "200px 100px"}} 
            onContextMenu={openMenu}
          >
            <div className="videoButtonDarken"></div>
            <div className='duration'>{ formattedDuration }</div>
            <div className='date'>{ video.date }</div>
            <div className='time'>{ video.time }</div>
            <div className={'result ' + resultClass }>{ resultText }</div>
            <div className='specIcon'><img src={ specIcon } /></div>  
            <div className={ playerClass + ' name'}>{ playerName }</div>

            { isMythicPlus ||
              <div>
                <div className='encounter'>{ video.encounter.slice(0, 13) }</div>
                <div className='zone'>{ video.zoneName }</div>
              </div>
            }

            { isMythicPlus &&
              <div>
                <div className='encounter'>
                  { dungeonsByMapId[video.mapID]?.slice(0, 13) } 
                </div>
                <div className='instance-difficulty difficulty-mythic'>
                  +{ video.level }
                </div>
              </div>
            }

            { isRaid && videoInstanceDifficulty &&
              <div className={ difficultyClass + ' difficulty-' + videoInstanceDifficulty.difficultyID }>
                { videoInstanceDifficulty.difficulty }
              </div>
            }

          </div> 
        }
        key={ videoPath }
        sx = {{ ...videoButtonSx }}
        {...props}
      />
      <Menu 
        id={ videoPath } 
        anchorEl={anchorElement} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} 
        open={open} onClose={handleCloseMenu} 
        MenuListProps={{'aria-labelledby': 'basic-button'}}>
        { keystoneTimelineSegments.length > 0 && keystoneTimelineSegments }
        { soloShuffleTimelineSegments.length > 0 && soloShuffleTimelineSegments }
        <MenuItem onClick={() => deleteVideo(videoPath)}>Delete</MenuItem>
        <MenuItem onClick={() => saveVideo(videoPath)}> 
          {isProtected &&
            <ListItemIcon>
              <Check />
            </ListItemIcon>
          }
          Save
        </MenuItem>
        <MenuItem onClick={() => openLocation(videoPath)}>Open Location</MenuItem>
      </Menu>
    </React.Fragment>
  );
}
