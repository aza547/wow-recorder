import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import FolderIcon from '@mui/icons-material/Folder';
import MessageIcon from '@mui/icons-material/Message';
import React, { useEffect, useState } from 'react';
import { RendererVideo, RendererVideoState, TNavigatorState } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import {
  getPlayerClass,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
  getResultColor,
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
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
import DungeonInfo from './DungeonInfo';
import ArenaInfo from './ArenaInfo';
import RaidCompAndResult from './RaidCompAndResult';
import TagDialog from './TagDialog';
import ControlIcon from '../../assets/icon/ctrl-icon.png';

interface IProps {
  video: RendererVideo;
  videoState: RendererVideoState;
  setVideoState: React.Dispatch<React.SetStateAction<RendererVideoState>>;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const dialogButtonSx = {
  color: 'white',
  ':hover': {
    color: 'white',
    borderColor: '#bb4420',
    background: '#bb4420',
  },
};

export default function VideoButton(props: IProps) {
  const { video, videoState, setVideoState, setNavigation } = props;
  const { isProtected, fullPath, imagePath, tag } = video;
  const formattedDuration = getFormattedDuration(video);
  const isMythicPlus = isMythicPlusUtil(video);
  const isRaid = isRaidUtil(video);
  const isBattleground = isBattlegroundUtil(video);
  const isArena = isArenaUtil(video);
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
  const tagOpacity = tag ? 1 : 0.2;
  let deleteVideoOnUnmount = false;
  let tagTooltip: string = tag ? `Tag: ${tag}` : 'Tag';

  if (tagTooltip.length > 50) {
    // If the tooltip is over 50 chars then truncate it.
    tagTooltip = `${tagTooltip.slice(0, 50)}...`;
  }

  const [ctrlDown, setCtrlDown] = useState<boolean>(false);
  const [tagDialogOpen, setTagDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);

  /**
   * Delete a video. This avoids attempting to delete the video
   * from disk when the MP4 file is still open in the UI by:
   *
   * - Setting this deleteOnUnmount to true.
   * - Removing it from the videoState.
   * - That triggers a re-render which unmounts this button and closes the file.
   * - The useEffect hook then runs the actual delete from disk IPC call.
   *
   * That solves the problem of allowing us to delete an open video while
   * keeping the app responsive. Some risk a deleted video re-appears if the OS
   * call fails to delete (e.g. it's open in another program) but happy to live
   * with that.
   */
  const deleteVideo = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    deleteVideoOnUnmount = true;
    let deletedIndex: number;

    setVideoState((prevState) => {
      deletedIndex = prevState[video.category].indexOf(video);
      prevState[video.category].splice(deletedIndex, 1);
      return prevState;
    });

    setNavigation((prevState) => {
      let newSelectedIndex: number;

      if (prevState.videoIndex === deletedIndex) {
        // Deleting the selected video so just reset to the first in the category.
        newSelectedIndex = 0;
      } else if (prevState.videoIndex > deletedIndex) {
        // Deleting a video before the selected video so move back one to remain
        // on the same video selection.
        newSelectedIndex = prevState.videoIndex - 1;
      } else {
        // Deleting a video after selection, no change to selected index.
        newSelectedIndex = prevState.videoIndex;
      }

      return {
        ...prevState,
        videoIndex: newSelectedIndex,
      };
    });
  };

  /**
   * IPC call to the main process to actually delete a video and it's
   * assosciated files from disk.
   */
  const deleteVideoFromDisk = () => {
    window.electron.ipcRenderer.sendMessage('videoButton', [
      'delete',
      fullPath,
    ]);
  };

  /**
   * Sets up event listeners so that users can skip the "Are you sure you want
   * to delete this video?" prompt by holding CTRL. Also sets the callback on
   * unmount to delete the video if the delete button was clicked.
   */
  useEffect(() => {
    document.addEventListener('keyup', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(false);
      }
    });
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(true);
      }
    });

    return () => {
      if (deleteVideoOnUnmount) {
        deleteVideoFromDisk();
      }
    };
  });

  const openTagDialog = () => {
    setTagDialogOpen(true);
  };

  const protectVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    window.electron.ipcRenderer.sendMessage('videoButton', ['save', fullPath]);
  };

  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    window.electron.ipcRenderer.sendMessage('videoButton', ['open', fullPath]);
  };

  const deleteClicked = (event: React.MouseEvent<HTMLElement>) => {
    if (ctrlDown) {
      deleteVideo(event);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  const markForDelete = () => {
    deleteVideoOnUnmount = true;
    closeDeleteDialog();
  };

  const getTagDialog = () => {
    return (
      <TagDialog
        video={video}
        tagDialogOpen={tagDialogOpen}
        setTagDialogOpen={setTagDialogOpen}
      />
    );
  };

  const getDeleteDialog = () => {
    return (
      <Dialog
        open={deleteDialogOpen}
        PaperProps={{ style: { backgroundColor: '#1A233A' } }}
      >
        <DialogTitle sx={{ color: 'white' }}>
          Permanently Delete this Video?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'white' }}>
            Hold{' '}
            <img
              src={ControlIcon}
              alt="Control Key"
              width="35"
              height="35"
              style={{ verticalAlign: 'middle' }}
            />{' '}
            to skip this prompt in future.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} sx={dialogButtonSx}>
            Cancel
          </Button>
          <Button onClick={markForDelete} sx={dialogButtonSx}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '80px',
      }}
    >
      {getTagDialog()}
      {getDeleteDialog()}
      <Box
        sx={{
          height: '80px',
          width: '200px',
        }}
      >
        <Box
          component="img"
          src={imagePath}
          sx={{
            border: '1px solid black',
            borderRadius: '5px',
            boxSizing: 'border-box',
            height: '80px',
            width: '200px',
            objectFit: 'contain',
            backgroundColor: 'black',
          }}
        />
      </Box>

      <Box
        sx={{
          border: '1px solid black',
          borderRadius: '5px',
          boxSizing: 'border-box',
          bgcolor: resultColor,
          ml: 2,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '15% 25% 20% 8% 8% 8% 15%',
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
            gridColumnStart: 2,
            gridColumnEnd: 3,
          }}
        >
          {isArena && <ArenaInfo video={video} />}
          {isMythicPlus && <DungeonInfo video={video} />}
          {isRaid && <RaidEncounterInfo video={video} />}
          {isBattleground && <BattlegroundInfo video={video} />}
        </Box>

        <Box
          sx={{
            gridColumnStart: 3,
            gridColumnEnd: 4,
          }}
        >
          {isArena && <ArenaCompDisplay video={video} />}
          {isMythicPlus && <DungeonCompDisplay video={video} />}
          {isRaid && (
            <RaidCompAndResult
              video={video}
              raidCategoryState={videoState[VideoCategory.Raids]}
            />
          )}
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gridColumnStart: 5,
            gridColumnEnd: 6,
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
            gridColumnStart: 6,
            gridColumnEnd: 7,
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
            justifyContent: 'center',
            gridColumnStart: 7,
            gridColumnEnd: 8,
            p: 2,
          }}
        >
          <Tooltip title={tagTooltip}>
            <IconButton onClick={openTagDialog}>
              <MessageIcon sx={{ color: 'white', opacity: tagOpacity }} />
            </IconButton>
          </Tooltip>

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
            <div>
              <IconButton onClick={deleteClicked}>
                <DeleteForeverIcon sx={{ color: 'white' }} />
              </IconButton>
            </div>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
