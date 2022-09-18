import * as React from 'react';
import { Tab, Menu, MenuItem, Divider } from '@mui/material';
import { VideoCategory, categories, videoButtonSx, specializationById, dungeonEncounters, dungeonsByMapId, dungeonTimersByMapId }  from 'main/constants';
import { VideoSegmentType, calculateKeystoneCompletionResult } from 'main/keystone';
import { getResultText, getFormattedDuration, getVideoResult, getInstanceDifficulty } from './rendererutils';
import ListItemIcon from '@mui/material/ListItemIcon';
import Check from '@mui/icons-material/Check';
import * as Images from './images'



/**
 * For shorthand referencing. 
 */
const ipc = window.electron.ipcRenderer;

export default function VideoButton(props: any) {
  const state = props.state;
  const videoIndex = props.index;

  const categoryIndex = state.categoryIndex;
  const category = categories[categoryIndex] as VideoCategory;

  const video = state.videoState[category][videoIndex];
  const videoPath = video.fullPath;

  const isGoodResult = getVideoResult(video);
  const resultText = getResultText(category, isGoodResult);
  const MMR = video.teamMMR ? ("MMR: " + video.teamMMR) : undefined;

  const isProtected = video.protected;

  const duration = video.duration;
  const formattedDuration = getFormattedDuration(duration);

  const resultClass: string = isGoodResult ? "goodResult" : "badResult";
  
  const [anchorElement, setAnchorElement] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorElement);

  const playerName = video.playerName;
  const specIcon: string = Images.spec[video.playerSpecID] || Images.spec[0];
  const playerClass = specializationById[video.playerSpecID]?.class ?? '';
  
  const dateDisplay: string = video.isFromToday ? video.time : video.date;
  const dateHoverText = video.date + " " + video.time;

  // BGs don't log COMBATANT_INFO events so we can't display a lot of stuff
  // that we can for other categories. 
  const isBG = category === VideoCategory.Battlegrounds;
  const isMythicPlus = (category == VideoCategory.MythicPlus && video.challengeMode !== undefined);
  const isRaid = category === VideoCategory.Raids;
  const videoInstanceDifficulty = isRaid ? getInstanceDifficulty(video.difficultyID) : null;

  let buttonImage;

  switch (category) {
    case VideoCategory.Raids:
      buttonImage = Images.raid[video.encounterID];
      break;

    case VideoCategory.MythicPlus:
      buttonImage = Images.dungeon[video.challengeMode.zoneId];
      break;

    case VideoCategory.Battlegrounds:
      buttonImage = Images.battleground[video.zoneID];
      break;

    default:
      buttonImage = Images.arena[video.zoneID];
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

  const getDungeonEncounterById = (id: number): string => {
    if (dungeonEncounters.hasOwnProperty(id)) {
      return dungeonEncounters[id]
    }

    return 'Unknown boss';
  }

  const buttonClasses = ['videoButton'];
  const keystoneVideoSegments = []
  let keystoneUpgradeLevel;

  if (isMythicPlus) {
    buttonClasses.push('dungeon')

    // If the video metadata doesn't contain its own alloted time array, we'll use whichever
    // is current in the constants.
    const keystoneAllottedTime = video.challengeMode.allottedTime ?? dungeonTimersByMapId[video.challengeMode.mapId];

    // Calculate the upgrade levels of the keystone
    const keystoneResult = calculateKeystoneCompletionResult(
      keystoneAllottedTime,
      video.challengeMode.duration
    );
    keystoneUpgradeLevel  = '+'.repeat(keystoneResult)

    /**
     * Generate the JSX for the video segments that are used in the context menu on
     * the VideoButton.
     */
    const videoSegments = video.challengeMode.videoSegments.map((segment: any) => {
      let videoSegmentMenu;
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

      if (segment.segmentType === VideoSegmentType.Trash) {
        videoSegmentMenu = <div className='segment-type segment-type-trash'>
          <span>{ segmentDurationText }</span>: Trash
        </div>
      } else
      if (segment.segmentType == VideoSegmentType.BossEncounter) {
        videoSegmentMenu = <div className='segment-entry'>
          <div className='segment-type segment-type-boss'>
            <span>{ segmentDurationText }</span>: Boss: { getDungeonEncounterById(segment.encounterId) }
          </div>
          <div className={ 'segment-result ' + (result ? 'goodResult' : 'badResult') }>
            { getResultText(VideoCategory.Raids, result) }
          </div>
        </div>
      }

      return (
        <MenuItem key={ 'video-segment-' + segment.timestamp } onClick={() => seekVideo(videoIndex, segment.timestamp)}>
          { videoSegmentMenu }
        </MenuItem>
      );
    });

    keystoneVideoSegments.push(
      <MenuItem key='video-segment-label' disabled>Video Segments</MenuItem>,
      <Divider key='video-segments-begin' />,
      ...videoSegments,
      <Divider key='video-segments-end' />,
    );
  }

  return (
    <React.Fragment>
      <Tab 
        label={
          <div id={ videoPath } className={ buttonClasses.join(' ') } style={{ backgroundImage: `url(${buttonImage})`}} onContextMenu={openMenu}>
            <div className='duration'>{ formattedDuration }</div>
            { isMythicPlus ||
              <div>
                <div className='encounter'>{ video.encounter }</div>
                <div className='zone'>{ video.zone }</div>
              </div>
            }
            { isMythicPlus &&
              <div>
                <div className='zone'>{ dungeonsByMapId[video.challengeMode.mapId] }</div>
                <div className='zone level'>{ keystoneUpgradeLevel  }{ video.challengeMode.level }</div>
              </div>
            }
            <div className='time' title={ dateHoverText }>{ dateDisplay }</div>    
            { isRaid && videoInstanceDifficulty &&
              <div className={'instance-difficulty difficulty-' + videoInstanceDifficulty.difficultyId}>
                { videoInstanceDifficulty.difficulty.charAt(0).toUpperCase() }
              </div>
            }
            { isBG ||
              <div>
                <div className='specIcon'>
                  <img src={ specIcon } />
                </div>  
                <div className={ playerClass + ' name'}>{ playerName }</div>
              </div>
            }
            <div className={ 'resultText ' + resultClass } title={ MMR }>{ resultText }</div>
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
        { keystoneVideoSegments.length > 0 && keystoneVideoSegments }
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
