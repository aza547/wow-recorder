
import * as React from 'react';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { categories, videoButtonSx, specToClass }  from '../main/constants';
import { getResultText, getFormattedDuration, getInstanceDifficulty } from './rendererutils';
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
  const isBG = category === "Battlegrounds";
  const isRaid = category === "Raids";
  const videoInstanceDifficulty = isRaid ? getInstanceDifficulty(video.difficultyID) : null;

  let buttonImage;

  // TODO, clean this ugly code up. What about M+ eventually?
  if (category === "Raids") {
    buttonImage = Images.raid[video.encounterID];
  } else if (isBG) {
    buttonImage = Images.battleground[video.zoneID];
  } else {
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
  function deleteVideo(filePath: string) {6
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

  return (
    <React.Fragment>
      <Tab 
        label={
          <div id={ videoPath } className='videoButton' style={{ backgroundImage: `url(${buttonImage})`}} onContextMenu={openMenu}>
            <div className='duration'>{ formattedDuration }</div>
            <div className='encounter'>{ video.encounter }</div>            
            <div className='zone'>{ video.zone }</div>
            <div className='time' title={ dateHoverText }>{ dateDisplay }</div>    
            { isRaid && videoInstanceDifficulty &&
              <div className={'instance-difficulty difficulty-' + videoInstanceDifficulty.difficultyId}>
                { videoInstanceDifficulty.difficulty.charAt(0).toUpperCase() }
              </div>
            }
            { isBG ||
              <div>
                <div className='specIcon'>
                  <img src={ specIcon } width='25' height='25'/>
                </div>  
                <div className={ playerClass + ' name'}>{ playerName }</div>
              </div>
            }
            <div className={ resultClass } title={ MMR }>{ resultText }</div>
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
