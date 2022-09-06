
import * as React from 'react';
import { Tab, Menu, MenuItem, Divider } from '@mui/material';
import { VideoCategory, categories, videoButtonSx, specToClass, dungeonEncounters, dungeonsByMapId }  from 'main/constants';
import { VideoSegmentType, calculateCompletionResult } from 'main/keystone';
import { getResultText, getFormattedDuration } from './rendererutils';
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
  const category = categories[categoryIndex]

  const video = state.videoState[category][videoIndex];
  const videoPath = video.fullPath;

  const isGoodResult = video.result;
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
  const playerClass = specToClass[video.playerSpecID];
  
  const dateDisplay: string = video.isFromToday ? video.time : video.date;
  const dateHoverText = video.date + " " + video.time;

  // BGs don't log COMBATANT_INFO events so we can't display a lot of stuff
  // that we can for other categories. 
  const isBG = category === VideoCategory.Battlegrounds;
  const isMythicPlus = VideoCategory.MythicPlus && video.challengeMode !== undefined;
  // For Mythic+, the recording player name and icon isn't super important

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
  const seekVideo = (videoIndex: number, ts: number) => {
    ipc.sendMessage('contextMenu', ['seekVideo', videoIndex, ts])
    handleCloseMenu();
  };

  const getDungeonEncounterById = (id: number): string => {
    if (dungeonEncounters.hasOwnProperty(id)) {
      return dungeonEncounters[id]
    }

    return 'Unknown boss';
  }

  const keystoneResult = calculateCompletionResult(
    video.challengeMode.mapId,
    video.challengeMode.duration
  );
  const keystonePlusses = '+'.repeat(keystoneResult)

  const buttonClasses = ['videoButton'];
  let mythicKeystoneSegments = []
  if (isMythicPlus) {
    buttonClasses.push('dungeon')

    const videoSegments = video.challengeMode.videoSegments.map((segment: any) => {
      let videoSegmentMenu;
      const result = Boolean(segment.result)

      if (segment.segmentType === VideoSegmentType.Trash) {
        videoSegmentMenu = <div className='segment-type segment-type-trash'>
          <span>{ getFormattedDuration(segment.ts) }</span>: Trash
        </div>
      } else
      if (segment.segmentType == VideoSegmentType.BossEncounter) {
        videoSegmentMenu = <div className='segment-entry'>
          <div className='segment-type segment-type-boss'>
            <span>{ getFormattedDuration(segment.ts) }</span>: Boss: { getDungeonEncounterById(segment.encounterId) }
          </div>
          <div className={ 'segment-result ' + (result ? 'goodResult' : 'badResult') }>
            { getResultText(VideoCategory.Raids, result) }
          </div>
        </div>
      }

      return (
        <MenuItem key={ 'video-segment-' + segment.ts } onClick={() => seekVideo(videoIndex, segment.ts)}>
          { videoSegmentMenu }
        </MenuItem>
      )
    });

    mythicKeystoneSegments.push(<MenuItem key='video-segment-label' disabled>Video Segments</MenuItem>)
    mythicKeystoneSegments.push(<Divider key='video-segments-begin' />)
    mythicKeystoneSegments.push(...videoSegments)
    mythicKeystoneSegments.push(<Divider key='video-segments-end' />)
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
                <div className='zone level'>{ keystonePlusses }{ video.challengeMode.level }</div>
              </div>
            }
            <div className='time' title={ dateHoverText }>{ dateDisplay }</div>    
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
        { mythicKeystoneSegments.length > 0 && mythicKeystoneSegments }
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
