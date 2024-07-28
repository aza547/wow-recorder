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
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FolderIcon from '@mui/icons-material/Folder';
import MessageIcon from '@mui/icons-material/Message';
import React, { MutableRefObject, useEffect, useState } from 'react';
import { RendererVideo, AppState } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import LinkIcon from '@mui/icons-material/Link';
import {
  getResultColor,
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
  getFormattedDuration,
  getVideoTime,
  getVideoDate,
  stopPropagation,
  povNameSort,
  countUniquePovs,
} from './rendererutils';
import ArenaCompDisplay from './ArenaCompDisplay';
import DungeonCompDisplay from './DungeonCompDisplay';
import RaidEncounterInfo from './RaidEncounterInfo';
import BattlegroundInfo from './BattlegroundInfo';
import DungeonInfo from './DungeonInfo';
import ArenaInfo from './ArenaInfo';
import RaidCompAndResult from './RaidCompAndResult';
import TagDialog from './TagDialog';
import ControlIcon from '../../assets/icon/ctrl-icon.png';
import PovSelection from './PovSelection';
import { useSettings } from './useSettings';
import SnackBar from './SnackBar';
import StateManager from './StateManager';

interface IProps {
  selected: boolean;
  video: RendererVideo;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
}

const dialogButtonSx = {
  color: 'white',
  ':hover': {
    color: 'white',
    borderColor: '#bb4420',
    background: '#bb4420',
  },
};

const iconButtonSx = {
  backgroundColor: 'dimgray',
  border: '1px solid black',
  boxShadow: 3,
  borderRadius: '5px',
  mx: '2px',
  '& .MuiTouchRipple-root .MuiTouchRipple-child': {
    borderRadius: '5px',
  },
  ':hover': {
    background: '#bb4420',
  },
};

const ipc = window.electron.ipcRenderer;

export default function VideoButton(props: IProps) {
  const {
    selected,
    video,
    stateManager,
    videoState,
    setAppState,
    persistentProgress,
  } = props;
  const [config] = useSettings();
  const formattedDuration = getFormattedDuration(video);
  const isMythicPlus = isMythicPlusUtil(video);
  const isRaid = isRaidUtil(video);
  const isBattleground = isBattlegroundUtil(video);
  const isArena = isArenaUtil(video);
  const resultColor = getResultColor(video);
  const videoTime = getVideoTime(video);
  const videoDate = getVideoDate(video);

  const [ctrlDown, setCtrlDown] = useState<boolean>(false);
  const [tagDialogOpen, setTagDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [localPovIndex, setLocalPovIndex] = useState<number>(0);

  const [linkSnackBarSuccessOpen, setLinkSnackBarSuccessOpen] = useState(false);
  const [linkSnackBarFailedOpen, setLinkSnackBarFailedOpen] = useState(false);

  const povs = [video, ...video.multiPov].sort(povNameSort);
  const multiPov = povs.length > 1;

  const pov = povs[localPovIndex];
  const { videoName, cloud, thumbnailSource, isProtected, tag, videoSource } =
    pov;

  // Check if we have this point of view duplicated in the other storage
  // type. Don't want to be showing the download button if we have already
  // got it on disk and vice versa.
  const haveOnDisk =
    !cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => !v.cloud)
      .length > 0;

  const haveInCloud =
    cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => v.cloud)
      .length > 0;

  const bookmarkOpacity = isProtected ? 1 : 0.2;
  const tagOpacity = tag ? 1 : 0.2;
  let tagTooltip: string = tag || 'Add a tag';

  if (tagTooltip.length > 50) {
    tagTooltip = `${tagTooltip.slice(0, 50)}...`;
  }

  // We do some hokey maths here to decide the height of the button, because
  // I've no idea how else to stop the image resizing the entire thing unless
  // its parent has an absolute size, super annoying.
  const uniquePovs = countUniquePovs(povs);
  const buttonHeight = Math.max(25 + uniquePovs * 25, 130);

  useEffect(() => {
    if (povs.length > localPovIndex) {
      return;
    }

    setLocalPovIndex(0);
  }, [localPovIndex, povs.length, selected]);

  /**
   * Delete a video.
   */
  const deleteVideo = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setDeleteDialogOpen(false);

    const src = cloud ? videoName : videoSource;
    window.electron.ipcRenderer.sendMessage('deleteVideo', [src, cloud]);
    stateManager.current.deleteVideo(pov);

    if (!selected) {
      return;
    }

    setLocalPovIndex(0);
    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: undefined,
        playingVideo: undefined,
      };
    });
  };

  /**
   * Delete all the points of view for this video.
   */
  const deleteAllPovs = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setDeleteDialogOpen(false);

    povs.forEach((p) => {
      const src = p.cloud ? p.videoName : p.videoSource;

      window.electron.ipcRenderer.sendMessage('deleteVideo', [src, p.cloud]);

      stateManager.current.deleteVideo(p);
    });

    if (!selected) {
      return;
    }

    setLocalPovIndex(0);

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: undefined,
        playingVideo: undefined,
      };
    });
  };

  /**
   * Sets up event listeners so that users can skip the "Are you sure you want
   * to delete this video?" prompt by holding CTRL.
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
  });

  const openTagDialog = () => {
    setTagDialogOpen(true);
  };

  const protectVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    stateManager.current.toggleProtect(pov);
    const src = cloud ? videoName : videoSource;
    const bool = !isProtected;

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'save',
      src,
      cloud,
      bool,
    ]);
  };

  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'open',
      videoSource,
      cloud,
    ]);
  };

  const deleteSingleClicked = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (ctrlDown) {
      deleteVideo(event);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const deleteAllClicked = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (ctrlDown) {
      deleteAllPovs(event);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const getTagDialog = () => {
    return (
      <TagDialog
        video={pov}
        tagDialogOpen={tagDialogOpen}
        setTagDialogOpen={setTagDialogOpen}
        stateManager={stateManager}
      />
    );
  };

  const getDeleteDialog = () => {
    const getTitle = () => {
      const msg = 'Are you sure?';
      return <DialogTitle sx={{ color: 'white' }}>{msg}</DialogTitle>;
    };

    const getHotKeyText = () => {
      return (
        <DialogContent sx={{ py: '4px' }}>
          <DialogContentText sx={{ color: 'white' }}>
            Hold{' '}
            <img
              src={ControlIcon}
              alt="Control Key"
              width="35"
              height="35"
              style={{ verticalAlign: 'middle' }}
            />{' '}
            to skip this prompt.
          </DialogContentText>
        </DialogContent>
      );
    };

    const getCancelButton = () => {
      return (
        <Button
          onClick={(event) => {
            event.stopPropagation();
            setDeleteDialogOpen(false);
          }}
          sx={dialogButtonSx}
        >
          Cancel
        </Button>
      );
    };

    const getDeleteButton = () => {
      return (
        <Button
          onClick={(event) => {
            event.stopPropagation();
            deleteVideo(event);
          }}
          sx={dialogButtonSx}
        >
          Delete
        </Button>
      );
    };

    return (
      <Dialog
        open={deleteDialogOpen}
        PaperProps={{ style: { backgroundColor: '#1A233A' } }}
      >
        {getTitle()}
        {getHotKeyText()}
        <DialogActions>
          {getCancelButton()}
          {getDeleteButton()}
        </DialogActions>
      </Dialog>
    );
  };

  const getOpenButton = () => {
    return (
      <Tooltip title="Open location">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={openLocation}
          sx={iconButtonSx}
        >
          <FolderIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const uploadVideo = async () => {
    ipc.sendMessage('videoButton', ['upload', videoSource]);
  };

  const getUploadButton = () => {
    return (
      <Tooltip title="Upload to cloud">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={uploadVideo}
          sx={iconButtonSx}
        >
          <UploadIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const downloadVideo = async () => {
    ipc.sendMessage('videoButton', ['download', pov]);
  };

  const getDownloadButton = () => {
    return (
      <Tooltip title="Download to disk">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={downloadVideo}
          sx={iconButtonSx}
        >
          <DownloadIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const getShareableLinkSnackBarSuccess = () => {
    return (
      <SnackBar
        message="Link copied, valid for up to 30 days."
        timeout={2}
        open={linkSnackBarSuccessOpen}
        setOpen={setLinkSnackBarSuccessOpen}
        color="#bb4420"
      />
    );
  };

  const getShareableLinkSnackBarFailed = () => {
    return (
      <SnackBar
        message="Failed to generate link, see logs."
        timeout={2}
        open={linkSnackBarFailedOpen}
        setOpen={setLinkSnackBarFailedOpen}
        color="#ff0033"
      />
    );
  };

  const getShareableLink = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      await ipc.invoke('getShareableLink', [videoName]);
      setLinkSnackBarSuccessOpen(true);
    } catch (error) {
      setLinkSnackBarFailedOpen(true);
    }
  };

  const getShareLinkButton = () => {
    return (
      <Tooltip title="Get sharable link">
        <div>
          {getShareableLinkSnackBarSuccess()}
          {getShareableLinkSnackBarFailed()}
          <IconButton
            onMouseDown={stopPropagation}
            onClick={getShareableLink}
            sx={iconButtonSx}
          >
            <LinkIcon sx={{ color: 'white' }} />
          </IconButton>
        </div>
      </Tooltip>
    );
  };

  const getDeleteSingleButton = () => {
    return (
      <Tooltip title="Delete">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={deleteSingleClicked}
          sx={iconButtonSx}
        >
          <DeleteIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  const getDeleteAllButton = () => {
    return (
      <Tooltip title="Delete all points of view">
        <IconButton
          onMouseDown={stopPropagation}
          onClick={deleteAllClicked}
          sx={iconButtonSx}
        >
          <DeleteSweepIcon sx={{ color: 'white' }} />
        </IconButton>
      </Tooltip>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
      }}
    >
      {getTagDialog()}
      {getDeleteDialog()}

      <Box
        sx={{
          border: '1px solid black',
          borderRadius: '5px',
          bgcolor: resultColor,
          width: '100%',
          height: `${buttonHeight}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          boxSizing: 'border-box',
        }}
      >
        <Box
          component="img"
          src={thumbnailSource}
          sx={{
            borderTopLeftRadius: '5px',
            borderBottomLeftRadius: '5px',
            borderRight: '1px solid black',
            width: '25%',
            minWidth: '25%',
            maxWidth: '25%',
            height: '100%',
            minHeight: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: 'black',
            boxSizing: 'border-box',
          }}
        />

        <Box
          sx={{
            height: '100%',
            width: '35%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PovSelection
            povs={povs}
            parentButtonSelected={selected}
            localPovIndex={localPovIndex}
            setLocalPovIndex={setLocalPovIndex}
            setAppState={setAppState}
            persistentProgress={persistentProgress}
          />
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '25%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ m: 2 }}>
            {isArena && <ArenaInfo video={video} />}
            {isMythicPlus && <DungeonInfo video={video} />}
            {isRaid && <RaidEncounterInfo video={video} />}
            {isBattleground && <BattlegroundInfo video={video} />}
          </Box>
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '25%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ m: 2 }}>
            {isArena && <ArenaCompDisplay video={video} />}
            {isMythicPlus && <DungeonCompDisplay video={video} />}
            {isRaid && (
              <RaidCompAndResult
                video={video}
                raidCategoryState={videoState.filter(
                  (v) => v.category === VideoCategory.Raids
                )}
              />
            )}
          </Box>
        </Box>

        <Box
          sx={{
            height: '100%',
            width: '35%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              mx: 1,
            }}
          >
            <Tooltip title="Duration">
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mx: 1,
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
            </Tooltip>

            <Tooltip title="Time">
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mx: 1,
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
            </Tooltip>

            <Tooltip title="Date">
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mx: 1,
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
            </Tooltip>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              mx: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Tooltip title={tagTooltip}>
                <IconButton
                  onMouseDown={stopPropagation}
                  onClick={openTagDialog}
                  sx={iconButtonSx}
                >
                  <MessageIcon sx={{ color: 'white', opacity: tagOpacity }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Never age out">
                <IconButton
                  onMouseDown={stopPropagation}
                  onClick={protectVideo}
                  sx={iconButtonSx}
                >
                  <BookmarksIcon
                    sx={{ color: 'white', opacity: bookmarkOpacity }}
                  />
                </IconButton>
              </Tooltip>

              {cloud && getShareLinkButton()}
              {!cloud && getOpenButton()}
              {cloud && !haveOnDisk && getDownloadButton()}
              {!cloud &&
                !haveInCloud &&
                config.cloudUpload &&
                getUploadButton()}
              {getDeleteSingleButton()}
              {multiPov && getDeleteAllButton()}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
